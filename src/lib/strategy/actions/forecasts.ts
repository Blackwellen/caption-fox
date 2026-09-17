'use server'

import type { ActionResult } from '../action-types'
import { authorise, dbError, fail, invalid, ownsRecord, rateLimited, record, revalidateStrategy } from '../server'
import { CONFIDENCE_LEVELS, FORECAST_METRICS, RISK_LEVELS } from '../constants'
import { scenarioProbabilityError } from '../metrics'
import { amount, dateOrder, FieldErrors, integer, isoDate, oneOf, tags as cleanTags, text, uuid } from '../validation'

const CURRENCIES = ['GBP', 'USD', 'EUR'] as const

function monthsBetween(start: string, end: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`)
  const last = new Date(`${end.slice(0, 7)}-01T00:00:00Z`)
  while (cursor <= last && out.length < 36) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return out
}

/**
 * Creates a forecast from figures the user enters: target plus best, expected
 * and downside totals. Monthly periods spread each total evenly — clearly a
 * starting model the owner refines, never invented performance data.
 */
export async function createForecast(input: Record<string, string | undefined>): Promise<ActionResult> {
  const { session, error } = await authorise('forecasts', 'createForecast')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const start = isoDate(errors, 'period_start', input.period_start, { label: 'Start', required: true })
  const end = isoDate(errors, 'period_end', input.period_end, { label: 'End', required: true })
  dateOrder(errors, 'period_end', start, end, 'End must be after the start.')
  const values = {
    name: text(errors, 'name', input.name, { label: 'Forecast name', required: true, max: 120 }),
    metric: oneOf(errors, 'metric', input.metric, FORECAST_METRICS, { label: 'Metric', fallback: 'revenue' }),
    currency: oneOf(errors, 'currency', input.currency, CURRENCIES, { label: 'Currency', fallback: 'GBP' }),
    target_value: amount(errors, 'target_value', input.target_value, { label: 'Target', required: true, min: 0 }),
    confidence: oneOf(errors, 'confidence', input.confidence, CONFIDENCE_LEVELS, { label: 'Confidence', fallback: 'medium' }),
    risk_level: oneOf(errors, 'risk_level', input.risk_level, RISK_LEVELS, { label: 'Risk', fallback: 'medium' }),
    strategy_id: uuid(errors, 'strategy_id', input.strategy_id, { label: 'Strategy' }),
  }
  const best = amount(errors, 'best_value', input.best_value, { label: 'Best case', required: true, min: 0 })
  const expected = amount(errors, 'expected_value', input.expected_value, { label: 'Expected case', required: true, min: 0 })
  const downside = amount(errors, 'downside_value', input.downside_value, { label: 'Downside case', required: true, min: 0 })
  if (best !== null && expected !== null && best < expected) errors.add('best_value', 'Best case must be at least the expected case.')
  if (downside !== null && expected !== null && downside > expected) errors.add('downside_value', 'Downside must not exceed the expected case.')
  const months = start && end ? monthsBetween(start, end) : []
  if (start && end && months.length > 36) errors.add('period_end', 'Forecasts can span at most 36 months.')
  if (!errors.ok) return invalid(errors)

  const { supabase, ctx, userId } = session
  if (values.strategy_id && !(await ownsRecord(supabase, 'strategy_records', values.strategy_id, ctx.workspaceId))) return fail('Strategy not found.')
  const now = new Date().toISOString()
  const { data: forecast, error: insertError } = await supabase.from('strategy_forecasts').insert({
    ...values, period_start: start, period_end: end, status: 'active', owner_id: userId, created_by: userId,
    last_recalculated_at: now, workspace_id: ctx.workspaceId,
  }).select('id').single()
  if (insertError || !forecast) return fail(dbError(insertError, 'Could not create the forecast.'))

  const scenarioSpecs = [
    { name: 'Best case', scenario_type: 'best', is_expected: false, probability: 25, forecast_value: best, sort_order: 1 },
    { name: 'Expected case', scenario_type: 'expected', is_expected: true, probability: 50, forecast_value: expected, sort_order: 2 },
    { name: 'Downside case', scenario_type: 'downside', is_expected: false, probability: 25, forecast_value: downside, sort_order: 3 },
  ]
  const { data: scenarios, error: scenarioError } = await supabase.from('strategy_forecast_scenarios').insert(scenarioSpecs.map(spec => ({
    ...spec, forecast_id: forecast.id, workspace_id: ctx.workspaceId, owner_id: userId, last_recalculated_at: now, drivers: [], risks: [],
  }))).select('id, forecast_value')
  if (scenarioError || !scenarios) {
    await supabase.from('strategy_forecasts').delete().eq('id', forecast.id).eq('workspace_id', ctx.workspaceId)
    return fail(dbError(scenarioError, 'Could not create the scenarios. Nothing was saved.'))
  }
  const periods = (scenarios as { id: string; forecast_value: number }[]).flatMap(scenario => months.map(date => ({
    workspace_id: ctx.workspaceId, forecast_id: forecast.id, scenario_id: scenario.id, period_date: date,
    period_label: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    target_value: Math.round(((values.target_value ?? 0) / months.length) * 100) / 100,
    forecast_value: Math.round((Number(scenario.forecast_value) / months.length) * 100) / 100,
  })))
  const { error: periodError } = await supabase.from('strategy_forecast_periods').insert(periods)
  if (periodError) {
    await supabase.from('strategy_forecasts').delete().eq('id', forecast.id).eq('workspace_id', ctx.workspaceId)
    return fail(dbError(periodError, 'Could not build the forecast periods. Nothing was saved.'))
  }
  await record(session, { entityType: 'forecast', entityId: forecast.id, action: 'created forecast', summary: `"${values.name}"`, surface: 'forecasts' })
  revalidateStrategy()
  return { ok: true, id: forecast.id, message: 'Forecast created. Refine monthly figures and assumptions next.' }
}

/**
 * Adds a scenario. The submitted probabilities for every scenario (existing +
 * new) must total exactly 100%, and are saved together.
 */
export async function addScenario(input: Record<string, string | undefined>): Promise<ActionResult> {
  const { session, error } = await authorise('forecasts', 'editForecast')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const forecastId = uuid(errors, 'forecast_id', input.forecast_id, { label: 'Forecast', required: true })
  const name = text(errors, 'name', input.name, { label: 'Scenario name', required: true, max: 80 })
  const probability = integer(errors, 'probability', input.probability, { label: 'Probability', min: 0, max: 100, required: true })
  const value = amount(errors, 'forecast_value', input.forecast_value, { label: 'Forecast value', required: true, min: 0 })
  const low = amount(errors, 'range_low', input.range_low, { label: 'Range low', min: 0 })
  const high = amount(errors, 'range_high', input.range_high, { label: 'Range high', min: 0 })
  if (low !== null && high !== null && high < low) errors.add('range_high', 'High must be at least low.')
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  const { data: forecast } = await supabase.from('strategy_forecasts').select('name').eq('id', forecastId!).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!forecast) return fail('Forecast not found.')
  const { data: existing } = await supabase.from('strategy_forecast_scenarios').select('id, name').eq('workspace_id', ctx.workspaceId).eq('forecast_id', forecastId!).order('sort_order')
  const current = (existing ?? []) as { id: string; name: string }[]
  const nextProbabilities = current.map(row => integer(errors, `probability_${row.id}`, input[`probability_${row.id}`], { label: `${row.name} probability`, min: 0, max: 100, required: true }) ?? 0)
  if (!errors.ok) return invalid(errors)
  const totalError = scenarioProbabilityError([...nextProbabilities, probability!])
  if (totalError) return fail(totalError, { probability: totalError })

  const { data: scenario, error: insertError } = await supabase.from('strategy_forecast_scenarios').insert({
    workspace_id: ctx.workspaceId, forecast_id: forecastId, name, scenario_type: 'custom', is_expected: false, probability,
    forecast_value: value, range_low: low, range_high: high, drivers: cleanTags(input.drivers), risks: cleanTags(input.risks),
    owner_id: userId, sort_order: current.length + 1, last_recalculated_at: new Date().toISOString(),
  }).select('id').single()
  if (insertError || !scenario) return fail(dbError(insertError, 'Could not add the scenario.'))
  for (const [index, row] of current.entries()) {
    await supabase.from('strategy_forecast_scenarios').update({ probability: nextProbabilities[index] }).eq('id', row.id).eq('workspace_id', ctx.workspaceId)
  }
  await record(session, { entityType: 'scenario', entityId: forecastId, action: 'ran scenario analysis', summary: `Added "${name}" to ${forecast.name}`, surface: 'forecasts' })
  revalidateStrategy()
  return { ok: true, id: scenario.id, message: 'Scenario added.' }
}

export async function updateAssumption(id: string, input: { value_text?: string; numeric_value?: string; confidence?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('forecasts', 'manageAssumptions')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = {
    value_text: text(errors, 'value_text', input.value_text, { label: 'Value', required: true, max: 40 }),
    numeric_value: amount(errors, 'numeric_value', input.numeric_value, { label: 'Numeric value' }),
    confidence: oneOf(errors, 'confidence', input.confidence, CONFIDENCE_LEVELS, { label: 'Confidence', required: true }),
  }
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  const { data: current } = await supabase.from('strategy_forecast_assumptions').select('label, value_text, forecast_id').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Assumption not found.')
  const { error: updateError } = await supabase.from('strategy_forecast_assumptions').update({ ...values, updated_by: userId }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the assumption.'))
  await record(session, {
    entityType: 'assumption', entityId: current.forecast_id, action: 'updated assumptions',
    summary: `${current.label} from ${current.value_text} to ${values.value_text}`, surface: 'forecasts', metadata: { before: current.value_text, after: values.value_text },
  })
  revalidateStrategy()
  return { ok: true, message: 'Assumption updated. Refresh the model to recalculate.' }
}

/** Recomputes each scenario's total from its periods and stamps the model as fresh. */
export async function refreshForecastModel(forecastId: string): Promise<ActionResult> {
  const { session, error } = await authorise('forecasts', 'editForecast')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  const { data: forecast } = await supabase.from('strategy_forecasts').select('name').eq('id', forecastId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!forecast) return fail('Forecast not found.')
  if (await rateLimited(supabase, ctx.workspaceId, userId, 'refreshed model', 12, 60)) return fail('The model was refreshed recently. Try again later.')
  const { data: periods } = await supabase.from('strategy_forecast_periods').select('scenario_id, forecast_value').eq('workspace_id', ctx.workspaceId).eq('forecast_id', forecastId)
  const totals = new Map<string, number>()
  for (const row of (periods ?? []) as { scenario_id: string; forecast_value: number }[]) totals.set(row.scenario_id, (totals.get(row.scenario_id) ?? 0) + Number(row.forecast_value))
  const now = new Date().toISOString()
  for (const [scenarioId, total] of totals) {
    await supabase.from('strategy_forecast_scenarios').update({ forecast_value: Math.round(total * 100) / 100, last_recalculated_at: now }).eq('id', scenarioId).eq('workspace_id', ctx.workspaceId)
  }
  await supabase.from('strategy_forecasts').update({ last_recalculated_at: now }).eq('id', forecastId).eq('workspace_id', ctx.workspaceId)
  await record(session, { entityType: 'forecast', entityId: forecastId, action: 'refreshed model', summary: `${forecast.name} recalculated`, surface: 'forecasts' })
  revalidateStrategy()
  return { ok: true, message: 'Model refreshed.' }
}

export async function setForecastArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('forecasts', 'editForecast')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_forecasts').select('name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Forecast not found.')
  const { error: updateError } = await supabase.from('strategy_forecasts')
    .update(archived ? { status: 'archived', archived_at: new Date().toISOString() } : { status: 'active', archived_at: null }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the forecast.'))
  await record(session, { entityType: 'forecast', entityId: id, action: archived ? 'archived forecast' : 'restored forecast', summary: `"${current.name}"`, surface: 'forecasts' })
  revalidateStrategy()
  return { ok: true, message: archived ? 'Forecast archived.' : 'Forecast restored.' }
}
