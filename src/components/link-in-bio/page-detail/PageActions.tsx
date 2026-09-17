'use client'

import { useRouter } from 'next/navigation'
import { Loader2, Play } from 'lucide-react'
import { duplicatePage, publishPage, setPageLifecycle, submitPageForReview, updatePageSettings } from '@/lib/link-in-bio/actions'
import { buttonClass } from '../ui'
import { Menu, useAction } from '../client'
import { notify } from '../feedback'
import { EditableTitle } from '../detail/DetailChrome'

type Props = {
  workspaceType: string; pageId: string; title: string; status: string; archived: boolean; publicPath: string
  caps: { edit: boolean; publish: boolean; archive: boolean; create: boolean }
  base: string; hasUnpublishedChanges: boolean
}

export function PageTitle({ workspaceType, pageId, title, canEdit }: { workspaceType: string; pageId: string; title: string; canEdit: boolean }) {
  return <EditableTitle value={title} canEdit={canEdit} onSave={next => updatePageSettings({ workspaceType, pageId, patch: { title: next } })} />
}

export default function PageActions({ workspaceType, pageId, title, status, archived, publicPath, caps, base, hasUnpublishedChanges }: Props) {
  const { run, pending } = useAction()
  const router = useRouter()
  const live = status === 'published' || status === 'scheduled'

  const primary = archived ? (
    <button type="button" disabled={pending || !caps.archive} title={caps.archive ? undefined : 'Your role cannot restore pages.'} className={buttonClass.primary}
      onClick={() => run(() => setPageLifecycle({ workspaceType, pageId, action: 'restore' }), { success: 'Page restored' })}>
      {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Restore page
    </button>
  ) : caps.publish ? (
    <button type="button" disabled={pending} className={`${buttonClass.primary} h-9 px-4`}
      onClick={() => run(() => publishPage({ workspaceType, pageId }), {}, data => notify(`Published version ${data.version}`))}>
      {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={13} fill="currentColor" aria-hidden />} {live && !hasUnpublishedChanges ? 'Republish' : 'Publish changes'}
    </button>
  ) : (
    <button type="button" disabled={pending || !caps.edit || status === 'in_review'} className={`${buttonClass.primary} h-9 px-4`}
      title={status === 'in_review' ? 'Already waiting for review' : undefined}
      onClick={() => run(() => submitPageForReview({ workspaceType, pageId }), { success: 'Submitted for review' })}>
      {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} {status === 'in_review' ? 'In review' : 'Submit for review'}
    </button>
  )

  return (
    <div className="flex items-center gap-2.5">
      {primary}
      <Menu label={`More actions for ${title}`} items={[
        { label: 'Open live page', href: publicPath, external: true, disabledReason: live ? null : 'This page is not published.' },
        { label: 'Duplicate', disabledReason: caps.create ? null : 'Your role cannot create pages.', onSelect: () => run(() => duplicatePage({ workspaceType, pageId }), { success: 'Page duplicated' }, data => router.push(`${base}/pages/${data.id}/design`)) },
        { label: 'Page settings', href: `${base}/pages/${pageId}/settings` },
        { label: 'Version history', href: `${base}/pages/${pageId}/versions` },
        ...(live ? [{ label: 'Unpublish', disabledReason: caps.publish ? null : 'Your role cannot publish pages.', onSelect: () => run(() => setPageLifecycle({ workspaceType, pageId, action: 'unpublish' }), { success: 'Page unpublished', confirm: 'Unpublish this page? Visitors will get a not-found page.' }) }] : []),
        archived
          ? { label: 'Restore', disabledReason: caps.archive ? null : 'Your role cannot archive pages.', onSelect: () => run(() => setPageLifecycle({ workspaceType, pageId, action: 'restore' }), { success: 'Page restored' }) }
          : { label: 'Archive', danger: true, disabledReason: caps.archive ? null : 'Your role cannot archive pages.', onSelect: () => run(() => setPageLifecycle({ workspaceType, pageId, action: 'archive' }), { success: 'Page archived', confirm: 'Archive this page? It will be unpublished and read-only.' }) },
      ]} />
    </div>
  )
}
