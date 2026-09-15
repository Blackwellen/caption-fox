import { ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function AccessBlocked() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="You don't have access to the Inbox"
      description="Ask a workspace owner or admin to grant you the View Inbox permission."
    />
  )
}
