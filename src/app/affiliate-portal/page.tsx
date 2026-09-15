import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Sends an affiliate to their own grant-scoped portal. */
export default async function AffiliatePortalEntry() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/affiliates/login')
  const { data } = await supabase.from('affiliates').select('id').eq('user_id', user.id).maybeSingle()
  redirect(data ? `/affiliate-portal/${data.id}` : '/affiliates/portal')
}
