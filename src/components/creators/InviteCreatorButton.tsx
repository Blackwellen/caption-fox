'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/campaigns/Toast'
import { inviteCreator } from '@/app/app/creators/actions'

/**
 * The "Invite Creator" workflow used from the Overview and Creators surfaces.
 * A real invitation row is created (or an existing pending one resent) and a
 * placeholder creator relationship is started at `invited` — this is not a
 * mock submit, the record appears in the creators list immediately.
 */
export default function InviteCreatorButton({ label = 'Invite Creator', className }: { label?: string; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')

  function reset() {
    setEmail(''); setDisplayName(''); setMessage(''); setError(null)
  }

  function submit() {
    if (pending) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return }
    startTransition(async () => {
      const result = await inviteCreator({ email, displayName, message })
      if (!result.ok) { setError(result.error ?? 'Could not send the invitation.'); return }
      notify('success', result.message ?? 'Invitation sent.')
      setOpen(false); reset(); router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" icon={<UserPlus size={15} />} onClick={() => setOpen(true)} className={className}>
        {label}
      </Button>
      <Modal
        open={open} onClose={() => { setOpen(false); reset() }}
        title="Invite a creator" description="Send an invitation to join this workspace's creator roster."
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button size="sm" loading={pending} onClick={submit}>Send invitation</Button>
          </div>
        )}
      >
        <form onSubmit={event => { event.preventDefault(); submit() }} className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Input label="Email address" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="creator@example.com" />
          <Input label="Display name (optional)" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Maya Chen" />
          <Textarea label="Message (optional)" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell them what you'd like to collaborate on…" />
          <p className="text-xs text-slate-400">The invitation expires in 14 days. Resending an invitation to the same address updates it instead of creating a duplicate.</p>
        </form>
      </Modal>
    </>
  )
}
