// Human label for a media file, derived from its MIME type and extension.
// Shared by server and client components.

import { MEDIA_STATUS_LABELS, type MediaStatus } from '@/lib/studio/constants'

export const STATUS_PILL: Record<string, string> = {
  ready: 'bg-[#e8f7ee] text-[#16803c]', needs_review: 'bg-[#fff1e6] text-[#d9480f]', uploaded: 'bg-[#e9f0ff] text-[#1a5cff]',
  changes_requested: 'bg-[#fdecec] text-[#c53030]', archived: 'bg-slate-100 text-slate-600',
}
export const statusLabel = (s: string) => (s === 'uploaded' ? 'In progress' : MEDIA_STATUS_LABELS[s as MediaStatus] ?? s)

const EXT_LABEL: Record<string, string> = {
  pdf: 'PDF', pptx: 'PPTX', ppt: 'PPT', docx: 'DOCX', doc: 'DOC', xlsx: 'XLSX', csv: 'CSV', svg: 'SVG', psd: 'PSD',
  sketch: 'Sketch', fig: 'Figma', ai: 'AI', zip: 'ZIP', gif: 'GIF',
}
const LONG: Record<string, string> = { PDF: 'Document', DOCX: 'Document', DOC: 'Document', PPTX: 'Presentation', PPT: 'Presentation', XLSX: 'Spreadsheet', CSV: 'Spreadsheet', PSD: 'Design', Sketch: 'Design', Figma: 'Design', AI: 'Design', SVG: 'Vector' }

/** Short label ("Image", "Video", "PDF", "PPTX") or, with `long`, a category ("Document", "Presentation"). */
export function kindLabel(mime: string | null, fileName: string, long = false): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const byExt = EXT_LABEL[ext]
  if (byExt && byExt !== 'GIF' && byExt !== 'SVG') return long ? LONG[byExt] ?? byExt : byExt
  if (byExt === 'SVG') return long ? 'Vector' : 'SVG'
  if (mime?.startsWith('image/')) return 'Image'
  if (mime?.startsWith('video/')) return 'Video'
  if (mime?.startsWith('audio/')) return 'Audio'
  return long ? 'File' : (ext ? ext.toUpperCase() : 'File')
}
