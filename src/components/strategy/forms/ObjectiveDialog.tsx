'use client'

import { useState } from 'react'
import { createObjective, updateObjective } from '@/lib/strategy/actions/objectives'
import { OBJECTIVE_TYPES, OBJECTIVE_TYPE_LABELS, PRIORITY_LABELS, STRATEGY_PRIORITIES } from '@/lib/strategy/constants'
import type { ObjectiveRow, PersonLite } from '@/lib/strategy/types'
import { Dialog, DialogButton } from '../client/dialog'
import { FormError, FormGrid, formValues, SelectField, TextArea, TextField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'

export interface Option { id: string; name: string }

/** Create or edit an objective. Validation runs server-side and maps back to fields. */
export function ObjectiveDialog({
  open, onClose, people, strategies, objective, onSaved,
}: {
  open: boolean
  onClose: () => void
  people: PersonLite[]
  strategies: Option[]
  objective?: ObjectiveRow | null
  onSaved?: (id: string) => void
}) {
  const { run, pending } = useStrategyAction()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const editing = Boolean(objective)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = formValues(event.currentTarget)
    const result = await run(() => (objective ? updateObjective(objective.id, values) : createObjective(values)))
    if (result.ok) {
      setFieldErrors({}); setFormError(null)
      onClose()
      if (result.id) onSaved?.(result.id)
    } else {
      setFieldErrors(result.fieldErrors ?? {})
      setFormError(result.fieldErrors ? null : result.error ?? null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} busy={pending} size="lg"
      title={editing ? 'Edit objective' : 'New objective'}
      description={editing ? 'Update ownership, targets and timing.' : 'Define a measurable outcome and who owns it.'}
      footer={(
        <>
          <DialogButton onClick={onClose} disabled={pending}>Cancel</DialogButton>
          <DialogButton variant="primary" type="submit" form="strategy-objective-form" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Create objective'}
          </DialogButton>
        </>
      )}>
      <FormError message={formError} />
      <form id="strategy-objective-form" onSubmit={submit} noValidate>
        <FormGrid>
          <TextField className="sm:col-span-2" label="Objective name" name="name" required maxLength={140}
            defaultValue={objective?.name} error={fieldErrors.name} placeholder="e.g. Increase brand awareness" />
          <SelectField label="Type" name="objective_type" required defaultValue={objective?.objective_type ?? 'growth'}
            options={OBJECTIVE_TYPES.map(value => ({ value, label: OBJECTIVE_TYPE_LABELS[value] }))} error={fieldErrors.objective_type} />
          <SelectField label="Priority" name="priority" required defaultValue={objective?.priority ?? 'medium'}
            options={STRATEGY_PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] }))} error={fieldErrors.priority} />
          <SelectField label="Owner" name="owner_id" defaultValue={objective?.owner_id ?? ''} placeholder="Me"
            options={people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} error={fieldErrors.owner_id} />
          <SelectField label="Strategy" name="strategy_id" defaultValue={objective?.strategy_id ?? ''} placeholder="No strategy"
            options={strategies.map(item => ({ value: item.id, label: item.name }))} error={fieldErrors.strategy_id} />
          <TextField label="Start date" name="start_date" type="date" defaultValue={objective?.start_date ?? ''} error={fieldErrors.start_date} />
          <TextField label="Due date" name="due_date" type="date" defaultValue={objective?.due_date ?? ''} error={fieldErrors.due_date} />
          <TextField label="Target" name="target_summary" maxLength={140} defaultValue={objective?.target_summary ?? ''}
            placeholder="e.g. Awareness from 60% to 70%" error={fieldErrors.target_summary} />
          <TextField label="Next action" name="next_action" maxLength={140} defaultValue={objective?.next_action ?? ''} error={fieldErrors.next_action} />
          {editing && (
            <>
              <TextField label="Progress (%)" name="progress" type="number" min={0} max={100} step={1} defaultValue={objective?.progress} error={fieldErrors.progress} />
              <TextField label="Confidence (%)" name="confidence" type="number" min={0} max={100} step={1} defaultValue={objective?.confidence} error={fieldErrors.confidence} />
            </>
          )}
          <TextArea className="sm:col-span-2" label="Description" name="description" maxLength={2000} defaultValue={objective?.description ?? ''} error={fieldErrors.description} />
        </FormGrid>
      </form>
    </Dialog>
  )
}
