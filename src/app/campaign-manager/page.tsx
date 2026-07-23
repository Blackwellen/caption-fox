import { redirect } from 'next/navigation'

// Canonical buyer-workspace entry point. The existing /app shell remains the
// compatibility surface while links and saved URLs migrate to /campaign-manager.
export default function CampaignManagerEntry() {
  redirect('/app/home')
}
