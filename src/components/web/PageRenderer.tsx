import type { PageBlock } from '@/lib/web/types'

/**
 * Renders a page's block content. This is the one canonical renderer used
 * both for the builder's live preview and (later phase) the published public
 * page — never a screenshot, never duplicated logic between preview and
 * live output.
 */
export default function PageRenderer({ blocks }: { blocks: PageBlock[] }) {
  if (blocks.length === 0) {
    return <div className="flex h-40 items-center justify-center text-[12px] text-slate-400">Add a block to see a preview.</div>
  }

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900">
      {blocks.map(block => <RenderBlock key={block.id} block={block} />)}
    </div>
  )
}

function RenderBlock({ block }: { block: PageBlock }) {
  switch (block.type) {
    case 'hero':
      return (
        <div className="px-5 py-8 text-center">
          <h2 className="text-lg font-bold leading-snug">{String(block.heading ?? 'Headline')}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[12px] text-slate-500">{String(block.subheading ?? '')}</p>
          {Boolean(block.cta_label) && (
            <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-blue-600 px-4 text-[12px] font-medium text-white">
              {String(block.cta_label)}
            </span>
          )}
        </div>
      )
    case 'text':
      return (
        <div className="px-5 py-5">
          {Boolean(block.heading) && <h3 className="mb-1.5 text-[13px] font-semibold">{String(block.heading)}</h3>}
          <p className="text-[12px] leading-relaxed text-slate-600">{String(block.body ?? '')}</p>
        </div>
      )
    case 'benefits': {
      const items = Array.isArray(block.items) ? (block.items as string[]) : []
      return (
        <div className="px-5 py-5">
          {Boolean(block.heading) && <h3 className="mb-2 text-[13px] font-semibold">{String(block.heading)}</h3>}
          <ul className="grid grid-cols-2 gap-2 text-[12px] text-slate-600">
            {items.map((item, i) => <li key={i} className="rounded-lg bg-slate-50 px-2.5 py-2">{item}</li>)}
          </ul>
        </div>
      )
    }
    case 'faq': {
      const items = Array.isArray(block.items) ? (block.items as { q: string; a: string }[]) : []
      return (
        <div className="px-5 py-5">
          {Boolean(block.heading) && <h3 className="mb-2 text-[13px] font-semibold">{String(block.heading)}</h3>}
          <div className="space-y-2.5">
            {items.map((item, i) => (
              <div key={i}>
                <p className="text-[12px] font-medium text-slate-800">{item.q}</p>
                <p className="text-[11px] text-slate-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'cta':
      return (
        <div className="bg-slate-50 px-5 py-6 text-center">
          <p className="text-[13px] font-semibold text-slate-900">{String(block.heading ?? 'Ready to get started?')}</p>
          <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-blue-600 px-4 text-[12px] font-medium text-white">
            {String(block.cta_label ?? 'Get started')}
          </span>
        </div>
      )
    case 'footer':
      return (
        <div className="px-5 py-4 text-center text-[11px] text-slate-400">{String(block.text ?? '© Caption Fox')}</div>
      )
    default:
      return <div className="px-5 py-3 text-[11px] text-slate-400">Unsupported block type "{block.type}".</div>
  }
}
