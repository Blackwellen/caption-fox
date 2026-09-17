// Canonical Studio URLs. Studio lives at /{type}/studio/* (creator, business,
// brand, agency); the legacy /app/studio/* paths redirect here. Every link a
// Studio page, action or activity entry produces resolves through this module.

import { workspaceKindFromType } from '@/lib/navigation/resolver'
import type { StudioModule } from './constants'

export const STUDIO_SEGMENTS: Record<StudioModule, string> = {
  overview: '', compose: 'compose', 'ai-generate': 'ai-generate', ideas: 'ideas',
  templates: 'templates', hashtags: 'hashtags', media: 'media', content: 'content',
}

/** `/brand/studio` for a brand workspace, `/business/studio` for small_business. */
export function studioBase(ctx: { workspaceType: string | null | undefined }): string {
  return `/${workspaceKindFromType(ctx.workspaceType ?? undefined) ?? 'creator'}/studio`
}

export function studioHref(base: string, module: StudioModule, query?: string): string {
  const segment = STUDIO_SEGMENTS[module]
  const path = segment ? `${base}/${segment}` : base
  return query ? `${path}?${query}` : path
}
