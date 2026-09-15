import { requireStudioModule } from '@/lib/studio/server'
import { templateCounts, listTemplates, listWorkspacePeople } from '@/lib/studio/data'
import { parseStudioQuery, hasAnyFilter, type RawParams } from '@/lib/studio/query'
import { TEMPLATE_STATUSES, TEMPLATE_STATUS_LABELS, TEMPLATE_CATEGORIES, CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import Pagination from '@/components/studio/Pagination'
import { AccessBlocked, StudioEmpty, LoadError } from '@/components/studio/states'
import { STUDIO_PAGE } from '@/components/studio/primitives'
import { StudioToolbar, FilterSelect, ClearFiltersButton } from '@/components/studio/Toolbar'
import TemplateGrid from './TemplateGrid'
import NewTemplateButton from './NewTemplateButton'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'Templates · Studio · Caption Fox' }

export default async function TemplatesPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, userId, capabilities, modules, access } = await requireStudioModule('templates')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="templates" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['cards', 'table'], defaultView: 'cards', defaultSort: 'usage_desc' })

  const [counts, page, owners] = await Promise.all([
    templateCounts(supabase, ctx.workspaceId),
    listTemplates(supabase, ctx.workspaceId, q, { userId }),
    listWorkspacePeople(supabase, ctx.workspaceId),
  ])

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total templates', value: String(counts.total), tone: 'blue', icon: 'layers' },
    { id: 'published', label: 'Published', value: String(counts.published), tone: 'green', icon: 'check' },
    { id: 'mostUsed', label: 'Most used', value: counts.mostUsed?.name ?? '—', tone: 'violet', icon: 'sparkles' },
    { id: 'approved', label: 'Brand approved', value: String(counts.brandApproved), tone: 'blue', icon: 'check' },
    { id: 'review', label: 'Needs review', value: String(counts.needsReview), tone: 'amber', icon: 'eye' },
    { id: 'month', label: 'Saved this month', value: String(counts.savedThisMonth), tone: 'slate', icon: 'file' },
  ]

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader
        module="templates"
        modules={modules}
        actions={capabilities.createTemplates ? <NewTemplateButton /> : undefined}
      />

      {counts.error ? <LoadError message={counts.error} className="mb-4" /> : <KpiStrip items={kpis} className="mb-4" />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StudioToolbar placeholder="Search templates…" views={['cards', 'table']}>
          <FilterSelect param="channel" label="Channel" options={STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] }))} />
          <FilterSelect param="category" label="Category" options={TEMPLATE_CATEGORIES.map(c => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))} />
          <FilterSelect param="status" label="Status" options={TEMPLATE_STATUSES.map(s => ({ value: s, label: TEMPLATE_STATUS_LABELS[s] }))} />
          <FilterSelect param="owner" label="Owner" options={owners.map(o => ({ value: o.id, label: o.label }))} />
          <ClearFiltersButton hasFilters={hasAnyFilter(q)} />
        </StudioToolbar>
      </div>

      {page.error ? (
        <LoadError message={page.error} />
      ) : page.rows.length === 0 ? (
        <StudioEmpty
          icon="search"
          title={hasAnyFilter(q) ? 'No templates match these filters' : 'No templates yet'}
          message={hasAnyFilter(q) ? 'Try clearing filters or searching a different term.' : 'Create a reusable template to speed up future drafts.'}
        />
      ) : (
        <>
          <TemplateGrid rows={page.rows} view={q.view} capabilities={capabilities} />
          <div className="mt-4">
            <Pagination page={q.page} size={q.size} total={page.total} />
          </div>
        </>
      )}
    </div>
  )
}
