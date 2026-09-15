'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { updateFormFields, publishForm, archiveForm } from '@/app/app/web/actions'
import { FORM_FIELD_TYPES, FORM_FIELD_TYPE_LABELS } from '@/lib/web/constants'
import { CARD, CARD_SHADOW } from './primitives'
import type { FormField, FormRow } from '@/lib/web/types'

export default function FormFieldsClient({ form, canEdit, canPublish, canDelete }: {
  form: FormRow; canEdit: boolean; canPublish: boolean; canDelete: boolean
}) {
  const { notify } = useToast()
  const [fields, setFields] = useState<FormField[]>(form.fields)
  const [dirty, setDirty] = useState(false)
  const [pending, startTransition] = useTransition()

  function mutate(next: FormField[]) { setFields(next); setDirty(true) }

  function addField() {
    mutate([...fields, { id: crypto.randomUUID(), type: 'text', label: 'New field', required: false }])
  }
  function removeField(id: string) { mutate(fields.filter(f => f.id !== id)) }
  function moveField(id: string, dir: -1 | 1) {
    const index = fields.findIndex(f => f.id === id)
    const target = index + dir
    if (index < 0 || target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    mutate(next)
  }
  function updateField(id: string, patch: Partial<FormField>) {
    mutate(fields.map(f => (f.id === id ? { ...f, ...patch } : f)))
  }

  function save() {
    startTransition(async () => {
      const result = await updateFormFields(form.id, fields)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Saved.') : (result.error ?? 'Could not save.'))
      if (result.ok) setDirty(false)
    })
  }

  function publish() {
    startTransition(async () => {
      const saveResult = await updateFormFields(form.id, fields)
      if (!saveResult.ok) { notify('error', saveResult.error ?? 'Could not save.'); return }
      const result = await publishForm(form.id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Published.') : (result.error ?? 'Could not publish.'))
      if (result.ok) setDirty(false)
    })
  }

  function archive() {
    if (!confirm(`Archive "${form.name}"? It will stop accepting submissions.`)) return
    startTransition(async () => {
      const result = await archiveForm(form.id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Archived.') : (result.error ?? 'Could not archive.'))
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className={cn(CARD, CARD_SHADOW, 'p-4')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-900">Fields ({fields.length})</h2>
          {canEdit && (
            <button type="button" onClick={addField} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">+ Add field</button>
          )}
        </div>

        {fields.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-slate-400">No fields yet — add one to start building this form.</p>
        ) : (
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li key={field.id} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={field.label} disabled={!canEdit} onChange={e => updateField(field.id, { label: e.target.value })}
                    placeholder="Field label" className="h-8 min-w-[140px] flex-1 rounded-md border border-slate-200 px-2 text-[12px] disabled:bg-slate-50"
                  />
                  <select
                    value={field.type} disabled={!canEdit} onChange={e => updateField(field.id, { type: e.target.value })}
                    className="h-8 rounded-md border border-slate-200 px-2 text-[12px] disabled:bg-slate-50"
                  >
                    {FORM_FIELD_TYPES.map(t => <option key={t} value={t}>{FORM_FIELD_TYPE_LABELS[t]}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input type="checkbox" checked={field.required} disabled={!canEdit} onChange={e => updateField(field.id, { required: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-300" />
                    Required
                  </label>
                  {canEdit && (
                    <div className="ml-auto flex items-center gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveField(field.id, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={12} /></button>
                      <button type="button" disabled={index === fields.length - 1} onClick={() => moveField(field.id, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={12} /></button>
                      <button type="button" onClick={() => removeField(field.id)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50">Save draft</button>
            {canPublish && <button type="button" onClick={publish} disabled={pending} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50">Save &amp; publish</button>}
            {canDelete && form.status !== 'archived' && <button type="button" onClick={archive} disabled={pending} className="ml-auto inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50">Archive</button>}
          </div>
        )}
      </div>

      <div className={cn(CARD, CARD_SHADOW, 'p-4')}>
        <h2 className="mb-3 text-[13px] font-semibold text-slate-900">Preview</h2>
        {fields.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-slate-400">Add fields to see a preview.</p>
        ) : (
          <div className="space-y-2.5">
            {fields.map(field => (
              <label key={field.id} className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">{field.label}{field.required && '*'}</span>
                {field.type === 'checkbox'
                  ? <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-300" />
                  : <input disabled placeholder={FORM_FIELD_TYPE_LABELS[field.type as keyof typeof FORM_FIELD_TYPE_LABELS] ?? field.type} className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-[12px]" />}
              </label>
            ))}
            <span className="mt-2 inline-flex h-8 items-center rounded-lg bg-blue-600 px-4 text-[12px] font-medium text-white">Submit</span>
          </div>
        )}
      </div>
    </div>
  )
}
