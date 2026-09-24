'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, Download, FileSpreadsheet, MoreVertical, Pencil, Plus, PlusCircle, Scale } from 'lucide-react'
import { openStrategyAssistant } from '../assistant/open'
import { cn } from '@/lib/utils'
import { addScenario, createForecast, refreshForecastModel, setForecastArchived, updateAssumption } from '@/lib/strategy/actions/forecasts'
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, FORECAST_METRIC_LABELS, FORECAST_METRICS, RISK_LABELS, RISK_LEVELS } from '@/lib/strategy/constants'
import type { ActionResult } from '@/lib/strategy/action-types'
import { BUTTON, ICON } from '../buttons'
import { Menu } from '../client/menu'
import { ConfirmDialog, Dialog, DialogButton } from '../client/dialog'
import { FormError, FormGrid, formValues, SelectField, TextField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'

interface Can { create: boolean; edit: boolean; assumptions: boolean; export: boolean }
interface Option { id: string; name: string }

function useForm(action: (values: Record<string, string>) => Promise<ActionResult>, onDone: () => void) {
  const { run, pending } = useStrategyAction()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() => action(formValues(event.currentTarget)))
    if (result.ok) { setFieldErrors({}); setFormError(null); onDone() }
    else { setFieldErrors(result.fieldErrors ?? {}); setFormError(result.error ?? null) }
  }
  return { submit, pending, fieldErrors, formError }
}

export function ForecastsHeaderActions({
  forecast, scenarios, strategies, can, compareHref,
}: {
  forecast: { id: string; name: string; currency: string } | null
  scenarios: { id: string; name: string; probability: number }[]
  strategies: Option[]
  can: Can
  compareHref: string
}) {
  const params = useSearchParams()
  const { run, pending } = useStrategyAction()
  const [open, setOpen] = useState<'forecast' | 'scenario' | 'archive' | null>(null)
  const close = () => setOpen(null)
  const create = useForm(values => createForecast(values), close)
  const scenario = useForm(values => addScenario({ ...values, forecast_id: forecast?.id }), close)
  const [probabilities, setProbabilities] = useState<Record<string, number>>({})
  const year = new Date().getFullYear()
  const total = scenarios.reduce((sum, row) => sum + (probabilities[row.id] ?? row.probability), 0) + (probabilities.new ?? 0)
  const exportHref = (format: string) => {
    const qs = new URLSearchParams(params.toString())
    qs.set('module', 'forecasts'); qs.set('format', format)
    return `/api/strategy/export?${qs}`
  }

  return (
    <>
      {can.create && <button type="button" className={BUTTON.primary} onClick={() => setOpen('forecast')}><PlusCircle aria-hidden className={ICON} /> New forecast</button>}
      {can.edit && forecast && <button type="button" className={BUTTON.secondary} onClick={() => { setProbabilities({}); setOpen('scenario') }}><Plus aria-hidden className={ICON} /> Add scenario</button>}
      {forecast && <a href={compareHref} className={BUTTON.secondary}><Scale aria-hidden className={ICON} /> Compare targets</a>}
      {can.export && (
        <Menu label="Export" items={[
          { id: 'csv', label: 'Export CSV', description: 'Periods for every scenario', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, href: exportHref('csv'), download: true },
          { id: 'json', label: 'Export JSON', icon: <Download className="h-3.5 w-3.5" />, href: exportHref('json'), download: true },
        ]} trigger={({ ref, toggle, open: isOpen, ...aria }) => (
          <button ref={ref} type="button" onClick={toggle} {...aria} className={BUTTON.secondary}>
            <Download aria-hidden className={ICON} /> Export
            <ChevronDown aria-hidden className={cn(ICON, 'ml-2 text-slate-500 transition-transform lg:ml-[9px]', isOpen && 'rotate-180')} />
          </button>
        )} />
      )}
      <Menu label="More actions" items={[
        { id: 'fox-ai', label: 'Ask Fox AI about forecasts', onSelect: openStrategyAssistant },
        { id: 'refresh', label: 'Refresh model now', disabled: !can.edit || !forecast || pending, disabledReason: !forecast ? 'No forecast selected' : 'Your role cannot refresh models', onSelect: () => { if (forecast) void run(() => refreshForecastModel(forecast.id)) } },
        { id: 'archive', label: 'Archive this forecast', disabled: !can.edit || !forecast, disabledReason: 'Your role cannot archive forecasts', onSelect: () => setOpen('archive') },
        { id: 'archived', label: 'View archived forecasts', href: '?view=table&archived=1', separatorBefore: true },
      ]} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label="More actions" className={BUTTON.icon}><MoreVertical aria-hidden className={ICON} /></button>
      )} />

      <Dialog open={open === 'forecast'} onClose={close} busy={create.pending} size="lg" title="New forecast"
        description="Enter your target and scenario totals. Monthly periods start as an even spread you can refine."
        footer={<><DialogButton onClick={close}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="sg-new-forecast" disabled={create.pending}>Create forecast</DialogButton></>}>
        <FormError message={create.formError} />
        <form id="sg-new-forecast" onSubmit={create.submit} noValidate>
          <FormGrid>
            <TextField className="sm:col-span-2" label="Forecast name" name="name" required maxLength={120} defaultValue={`FY${year} Revenue Forecast`} error={create.fieldErrors.name} />
            <SelectField label="Metric" name="metric" defaultValue="revenue" options={FORECAST_METRICS.map(value => ({ value, label: FORECAST_METRIC_LABELS[value] }))} />
            <SelectField label="Currency" name="currency" defaultValue={forecast?.currency ?? 'GBP'} options={['GBP', 'USD', 'EUR'].map(value => ({ value, label: value }))} />
            <TextField label="Period start" name="period_start" type="date" required defaultValue={`${year}-01-01`} error={create.fieldErrors.period_start} />
            <TextField label="Period end" name="period_end" type="date" required defaultValue={`${year}-12-31`} error={create.fieldErrors.period_end} />
            <TextField className="sm:col-span-2" label="Target" name="target_value" required inputMode="decimal" error={create.fieldErrors.target_value} />
            <TextField label="Best case total" name="best_value" required inputMode="decimal" error={create.fieldErrors.best_value} />
            <TextField label="Expected case total" name="expected_value" required inputMode="decimal" error={create.fieldErrors.expected_value} />
            <TextField label="Downside case total" name="downside_value" required inputMode="decimal" error={create.fieldErrors.downside_value} />
            <SelectField label="Confidence" name="confidence" defaultValue="medium" options={CONFIDENCE_LEVELS.map(value => ({ value, label: CONFIDENCE_LABELS[value] }))} />
            <SelectField label="Risk" name="risk_level" defaultValue="medium" options={RISK_LEVELS.map(value => ({ value, label: RISK_LABELS[value] }))} />
            <SelectField label="Strategy" name="strategy_id" placeholder="None" options={strategies.map(item => ({ value: item.id, label: item.name }))} />
          </FormGrid>
        </form>
      </Dialog>

      <Dialog open={open === 'scenario'} onClose={close} busy={scenario.pending} size="lg" title={`Add scenario to ${forecast?.name ?? 'forecast'}`}
        description="Probabilities across all scenarios must total 100%."
        footer={(
          <>
            <span className={cn('mr-auto text-[12.5px]', total === 100 ? 'text-emerald-600' : 'text-red-600')} role="status">Total probability: {total}%</span>
            <DialogButton onClick={close}>Cancel</DialogButton>
            <DialogButton variant="primary" type="submit" form="sg-new-scenario" disabled={scenario.pending || total !== 100}>Add scenario</DialogButton>
          </>
        )}>
        <FormError message={scenario.formError} />
        <form id="sg-new-scenario" onSubmit={scenario.submit} noValidate>
          <FormGrid>
            <TextField className="sm:col-span-2" label="Scenario name" name="name" required maxLength={80} error={scenario.fieldErrors.name} />
            <TextField label="Forecast value" name="forecast_value" required inputMode="decimal" error={scenario.fieldErrors.forecast_value} />
            <TextField label="Probability (%)" name="probability" type="number" required min={0} max={100} defaultValue={0}
              onChange={event => setProbabilities(state => ({ ...state, new: Number(event.target.value) || 0 }))} error={scenario.fieldErrors.probability} />
            <TextField label="Range low" name="range_low" inputMode="decimal" error={scenario.fieldErrors.range_low} />
            <TextField label="Range high" name="range_high" inputMode="decimal" error={scenario.fieldErrors.range_high} />
            <TextField label="Key drivers" name="drivers" hint="Comma separated" />
            <TextField label="Key risks" name="risks" hint="Comma separated" />
            {scenarios.map(row => (
              <TextField key={row.id} label={`${row.name} probability (%)`} name={`probability_${row.id}`} type="number" required min={0} max={100} defaultValue={row.probability}
                onChange={event => setProbabilities(state => ({ ...state, [row.id]: Number(event.target.value) || 0 }))} error={scenario.fieldErrors[`probability_${row.id}`]} />
            ))}
          </FormGrid>
        </form>
      </Dialog>

      <ConfirmDialog open={open === 'archive'} onClose={close} busy={pending} title={`Archive “${forecast?.name}”?`} description="Archived forecasts leave KPIs and charts but can be restored."
        confirmLabel="Archive" onConfirm={async () => { if (!forecast) return; const result = await run(() => setForecastArchived(forecast.id, true)); if (result.ok) close() }} />
    </>
  )
}

export function AssumptionEditor({ id, label, value, numeric, confidence, canEdit }: { id: string; label: string; value: string; numeric: number | null; confidence: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const form = useForm(values => updateAssumption(id, values), () => setOpen(false))
  if (!canEdit) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${label}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 lg:h-4 lg:w-4">
        <Pencil aria-hidden className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} busy={form.pending} size="sm" title={`Edit “${label}”`} description="Changes are logged with before/after values."
        footer={<><DialogButton onClick={() => setOpen(false)}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form={`sg-assumption-${id}`} disabled={form.pending}>Save</DialogButton></>}>
        <FormError message={form.formError} />
        <form id={`sg-assumption-${id}`} onSubmit={form.submit} noValidate className="space-y-3">
          <TextField label="Display value" name="value_text" required maxLength={40} defaultValue={value} error={form.fieldErrors.value_text} />
          <TextField label="Numeric value" name="numeric_value" inputMode="decimal" defaultValue={numeric ?? ''} error={form.fieldErrors.numeric_value} />
          <SelectField label="Confidence" name="confidence" required defaultValue={confidence} options={CONFIDENCE_LEVELS.map(level => ({ value: level, label: CONFIDENCE_LABELS[level] }))} />
        </form>
      </Dialog>
    </>
  )
}
