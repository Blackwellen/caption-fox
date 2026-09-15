'use client'

import { PublicMicroPageRenderer, type RenderableItem, type RenderablePage } from '@/components/link-in-bio/PublicMicroPageRenderer'
import { recordLinkClick } from '../actions'

export default function PublicLinkPageClient({
  pageId,
  page,
  items,
}: {
  pageId: string
  page: RenderablePage
  items: RenderableItem[]
}) {
  return (
    <PublicMicroPageRenderer
      page={page}
      items={items}
      onLinkClick={item => { recordLinkClick({ pageId, itemId: item.id }) }}
    />
  )
}
