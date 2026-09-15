import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { webServiceClient } from '@/lib/web/service-client'
import { checkRateLimit, clientKey } from '@/lib/web/rate-limit'
import type { FormField } from '@/lib/web/types'

/**
 * Public, unauthenticated form submission endpoint. Runs through the
 * service-role client because there is no user session to scope RLS
 * against — every query below filters explicitly by workspace_id and
 * form_id itself, and the form must be `published` to accept submissions.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params

  if (!checkRateLimit(clientKey(request, 'form-submit'), { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many submissions. Please try again in a minute.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const payload = (body && typeof body === 'object' ? body as Record<string, unknown> : {})
  const values = (payload.values && typeof payload.values === 'object' ? payload.values as Record<string, unknown> : {})

  const supabase = webServiceClient()
  const { data: form } = await supabase.from('web_forms')
    .select('id, workspace_id, status, fields, submissions_count, completed_count, confirmation_message')
    .eq('id', formId).maybeSingle()

  if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 })
  if (form.status !== 'published') return NextResponse.json({ error: 'This form is not currently accepting submissions.' }, { status: 403 })

  const fields = (form.fields ?? []) as FormField[]
  const errors: Record<string, string> = {}
  const clean: Record<string, unknown> = {}

  for (const field of fields) {
    const raw = values[field.id]
    const value = typeof raw === 'string' ? raw.trim().slice(0, 2000) : raw
    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.id] = `${field.label} is required.`
      continue
    }
    if (value === undefined || value === null || value === '') continue

    if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.id] = 'Enter a valid email address.'
      continue
    }
    if (field.type === 'select' && field.options?.length && typeof value === 'string' && !field.options.includes(value)) {
      errors[field.id] = 'Choose one of the listed options.'
      continue
    }
    clean[field.id] = value
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Some fields need attention.', fieldErrors: errors }, { status: 422 })
  }

  const ipHash = createHash('sha256').update(clientKey(request, 'form-submit')).digest('hex').slice(0, 32)

  const { error: insertError } = await supabase.from('web_form_submissions').insert({
    workspace_id: form.workspace_id, form_id: form.id, data: clean, completed: true,
    source_url: typeof payload.sourceUrl === 'string' ? payload.sourceUrl.slice(0, 500) : null, ip_hash: ipHash,
  })
  if (insertError) return NextResponse.json({ error: 'Could not record the submission. Please try again.' }, { status: 500 })

  await supabase.from('web_forms').update({
    submissions_count: (form.submissions_count ?? 0) + 1, completed_count: (form.completed_count ?? 0) + 1,
  }).eq('id', form.id)

  await supabase.from('web_activity').insert({
    workspace_id: form.workspace_id, entity_type: 'form', entity_id: form.id,
    action: 'submitted', summary: 'received a new form submission',
  })

  return NextResponse.json({ ok: true, message: form.confirmation_message ?? "Thanks — we've received your submission." })
}
