'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProviderLogo from '../ProviderLogo'
import { AD_PROVIDERS, type AdProvider } from '@/lib/advertising/providers'
import { saveProviderAppAction, startConnectAction } from '@/lib/advertising/actions'

// "Connect Account" entry point. Opens a real provider picker: a platform with
// a saved developer app connects immediately through OAuth; one without shows
// the exact credential fields it needs and never pretends to connect.

type Props = {
  workspaceId: string
  workspaceType: string
  providers: AdProvider[]
  primary?: boolean
  compact?: boolean
  label?: string
  icon?: ReactNode
  /** Opens the dialog on arrival when the URL carries ?connect=1 (e.g. from Overview's Connect Account). */
  autoOpenFromUrl?: boolean
  /** Renders as a plain text link, e.g. the "Set Up Now →" footer on a provider card. */
  linkStyle?: boolean
  className?: string
}

export default function ConnectAccountButton({
  workspaceId, workspaceType, providers, primary, compact, label, icon, autoOpenFromUrl, linkStyle, className,
}: Props) {
  const [clicked, setOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // ?connect=1 (Overview's Connect Account) opens the dialog; closing removes the param.
  const open = clicked || (!!autoOpenFromUrl && searchParams.get('connect') === '1')

  function close() {
    setOpen(false)
    // Drop ?connect=1 so a refresh or back does not reopen the dialog.
    if (autoOpenFromUrl && searchParams.get('connect')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('connect')
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          linkStyle
            ? 'inline-flex items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:text-blue-700 hover:underline'
            : compact
              ? 'rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50'
              : primary
                ? 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-blue-700'
                : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50',
          className,
        )}
      >
        {icon}
        {label ?? 'Connect Account'}
      </button>
      {open && (
        <ConnectDialog
          workspaceId={workspaceId} workspaceType={workspaceType} providers={providers}
          onClose={close}
        />
      )}
    </>
  )
}

function ConnectDialog({
  workspaceId, workspaceType, providers, onClose,
}: { workspaceId: string; workspaceType: string; providers: AdProvider[]; onClose: () => void }) {
  const [selected, setSelected] = useState<AdProvider | null>(providers.length === 1 ? providers[0] : null)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Connect an advertising account">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">{selected ? AD_PROVIDERS[selected].name : 'Connect a source'}</h2>
            <p className="text-[12px] text-slate-500">Each workspace connects with its own developer app credentials.</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={16} /></button>
        </div>

        {!selected ? (
          <ul className="p-3">
            {providers.map(provider => (
              <li key={provider}>
                <button
                  type="button"
                  onClick={() => setSelected(provider)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-slate-50"
                >
                  <ProviderLogo provider={provider} size={26} tile />
                  <span className="text-[13.5px] font-medium text-slate-800">{AD_PROVIDERS[provider].name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ProviderSetupForm
            provider={selected} workspaceId={workspaceId} workspaceType={workspaceType}
            onBack={providers.length > 1 ? () => setSelected(null) : undefined} onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

function ProviderSetupForm({
  provider, workspaceId, workspaceType, onBack, onClose,
}: { provider: AdProvider; workspaceId: string; workspaceType: string; onBack?: () => void; onClose: () => void }) {
  const definition = AD_PROVIDERS[provider]
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const redirectUri = `${appUrl}/api/advertising/oauth/${provider}/callback`

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await saveProviderAppAction({ workspaceId, workspaceType, provider, clientId, clientSecret, extras })
      if (!result.ok) { setError(result.error); return }
      setSaved(true)
    })
  }

  function connect() {
    startTransition(async () => {
      await startConnectAction({ workspaceId, workspaceType, provider })
    })
  }

  return (
    <div className="p-4">
      {onBack && <button onClick={onBack} className="mb-3 text-[12px] font-medium text-blue-600 hover:underline">← Choose a different platform</button>}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600">
        <p>1. Register a developer app in the <a href={definition.developerConsoleUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">{definition.name} developer console</a>.</p>
        <p className="mt-1">2. Set its redirect URI to:</p>
        <code className="mt-1 block truncate rounded bg-white px-2 py-1 text-[11px] text-slate-700">{redirectUri}</code>
        <p className="mt-1">3. Paste the client ID and secret below.{' '}
          <a href={definition.docsUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">API docs</a>
        </p>
      </div>

      <div className="mt-3 space-y-2.5">
        <Field label="Client ID" value={clientId} onChange={setClientId} />
        <Field label="Client secret" value={clientSecret} onChange={setClientSecret} secret />
        {definition.extraCredentials.map(field => (
          <Field
            key={field.key} label={field.label} hint={field.hint} secret={field.secret}
            value={extras[field.key] ?? ''} onChange={value => setExtras(prev => ({ ...prev, [field.key]: value }))}
          />
        ))}
      </div>

      {error && <p className="mt-2.5 text-[12px] text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50">Cancel</button>
        {!saved ? (
          <button
            onClick={submit} disabled={pending || !clientId.trim() || !clientSecret.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50 hover:bg-blue-700"
          >
            {pending ? 'Saving…' : 'Save app credentials'}
          </button>
        ) : (
          <button onClick={connect} disabled={pending} className="rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50 hover:bg-blue-700">
            {pending ? 'Redirecting…' : `Continue to ${definition.name}`}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({
  label, hint, value, onChange, secret,
}: { label: string; hint?: string; value: string; onChange: (value: string) => void; secret?: boolean }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-slate-600">{label}</span>
      <input
        type={secret ? 'password' : 'text'} value={value} onChange={event => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}
