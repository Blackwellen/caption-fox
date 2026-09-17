'use client'

import { useState } from 'react'
import { createResearch, updateResearch } from '@/lib/strategy/actions/research'
import {
  IMPACT_LEVELS, IMPACT_SHORT, RESEARCH_METHODS, RESEARCH_METHOD_LABELS, RESEARCH_SOURCE_LABELS, RESEARCH_SOURCE_TYPES,
} from '@/lib/strategy/constants'
import type { ResearchRow } from '@/lib/strategy/types'
import { Dialog, DialogButton } from '../client/dialog'
import { FormError, FormGrid, formValues, SelectField, TextArea, TextField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'
import type { Option } from './ObjectiveDialog'

/** Manual research record (a brief or findings without a file). Saved as a draft. */
export function ResearchDialog({
  open, onClose, collections, research, brief,
}: {
  open: boolean
  onClose: () => void
  collections: Option[]
  research?: ResearchRow | null
  /** "Create brief" mode: pre-sets copy for a research brief. */
  brief?: boolean
}) {
  const { run, pending } = useStrategyAction()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = formValues(event.currentTarget)
    const result = await run(() => (research ? updateResearch(research.id, values) : createResearch(values)))
    if (result.ok) { setFieldErrors({}); setFormError(null); onClose() }
    else { setFieldErrors(result.fieldErrors ?? {}); setFormError(result.fieldErrors ? null : result.error ?? null) }
  }

  return (
    <Dialog open={open} onClose={onClose} busy={pending} size="lg"
      title={research ? 'Edit research' : brief ? 'Create research brief' : 'Add research'}
      description={brief ? 'Scope a new study: the question, audience and method. It is saved as a draft.' : 'Record a study, report or insight. New items start as drafts until submitted for review.'}
      footer={(
        <>
          <DialogButton onClick={onClose} disabled={pending}>Cancel</DialogButton>
          <DialogButton variant="primary" type="submit" form="strategy-research-form" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : research ? 'Save changes' : brief ? 'Create brief' : 'Add research'}
          </DialogButton>
        </>
      )}>
      <FormError message={formError} />
      <form id="strategy-research-form" onSubmit={submit} noValidate>
        <FormGrid>
          <TextField className="sm:col-span-2" label="Title" name="title" required maxLength={160} defaultValue={research?.title} error={fieldErrors.title}
            placeholder={brief ? 'e.g. Gen Z purchase drivers brief' : 'e.g. Brand perception survey'} />
          <SelectField label="Source type" name="source_type" required defaultValue={research?.source_type ?? 'market_research'}
            options={RESEARCH_SOURCE_TYPES.map(value => ({ value, label: RESEARCH_SOURCE_LABELS[value] }))} error={fieldErrors.source_type} />
          <SelectField label="Method" name="method" required defaultValue={research?.method ?? (brief ? 'survey' : 'report')}
            options={RESEARCH_METHODS.map(value => ({ value, label: RESEARCH_METHOD_LABELS[value] }))} error={fieldErrors.method} />
          <SelectField label="Impact" name="impact" required defaultValue={research?.impact ?? 'medium'}
            options={IMPACT_LEVELS.map(value => ({ value, label: IMPACT_SHORT[value] }))} error={fieldErrors.impact} />
          <TextField label="Confidence (%)" name="confidence" type="number" min={0} max={100} defaultValue={research?.confidence ?? 60} error={fieldErrors.confidence} />
          <SelectField label="Collection" name="collection_id" defaultValue={research?.collection_id ?? ''} placeholder="No collection"
            options={collections.map(item => ({ value: item.id, label: item.name }))} error={fieldErrors.collection_id} />
          <TextField label="Theme" name="theme" maxLength={60} defaultValue={research?.theme ?? ''} placeholder="e.g. Brand Perception" error={fieldErrors.theme} />
          <TextField className="sm:col-span-2" label="Tags" name="tags" defaultValue={research?.tags?.join(', ') ?? ''} hint="Separate tags with commas." error={fieldErrors.tags} />
          <TextArea className="sm:col-span-2" label={brief ? 'Research question & scope' : 'Summary'} name="summary" maxLength={4000} rows={4}
            defaultValue={research?.summary ?? ''} error={fieldErrors.summary} />
        </FormGrid>
      </form>
    </Dialog>
  )
}
