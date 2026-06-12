import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CampaignDetailClient from './CampaignDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !campaign) {
    notFound()
  }

  // Fetch related data in parallel
  const [postsRes, tasksRes, auditRes] = await Promise.allSettled([
    supabase
      .from('content_posts')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('campaign_tasks')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_id', id)
      .eq('resource_type', 'campaign')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <CampaignDetailClient
      campaign={campaign}
      initialPosts={postsRes.status === 'fulfilled' ? (postsRes.value.data ?? []) : []}
      initialTasks={tasksRes.status === 'fulfilled' ? (tasksRes.value.data ?? []) : []}
      initialAuditLogs={auditRes.status === 'fulfilled' ? (auditRes.value.data ?? []) : []}
    />
  )
}
