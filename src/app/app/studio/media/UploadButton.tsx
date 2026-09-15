'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/campaigns/Toast'
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from '@/lib/studio/constants'
import { registerMediaAsset } from './actions'

/**
 * Uploads directly to the workspace's own Supabase Storage prefix, then
 * registers the object as a real `media_assets` row. Nothing is exposed by a
 * pasted external URL — every asset in Studio is upload-backed.
 */
export default function UploadButton({
  workspaceId, storageUsed, storageLimit,
}: { workspaceId: string; storageUsed: number; storageLimit: number }) {
  const router = useRouter()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { notify('error', 'You must be signed in to upload.'); return }

    setUploading(true)
    let remaining = Math.max(0, storageLimit - storageUsed)
    let succeeded = 0

    for (const file of Array.from(files)) {
      if (!ALLOWED_UPLOAD_MIME.includes(file.type)) {
        notify('error', `${file.name}: file type not supported.`)
        continue
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        notify('error', `${file.name}: file is larger than the 5 GB limit.`)
        continue
      }
      if (file.size > remaining) {
        notify('error', `${file.name}: not enough storage remaining on this plan.`)
        continue
      }

      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      // registerMediaAsset requires the path to sit under this workspace's
      // prefix — that is the boundary it re-checks server-side.
      const path = `${workspaceId}/studio/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('media').upload(path, file)
      if (uploadError) { notify('error', `${file.name}: ${uploadError.message}`); continue }

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

      const dimensions = await readImageDimensions(file)
      const result = await registerMediaAsset({
        fileName: file.name,
        storagePath: path,
        publicUrl: urlData.publicUrl,
        mimeType: file.type,
        fileSize: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
      })

      if (!result.ok) { notify('error', `${file.name}: ${result.error}`); continue }
      remaining -= file.size
      succeeded += 1
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (succeeded > 0) { notify('success', `${succeeded} file${succeeded === 1 ? '' : 's'} uploaded.`); router.refresh() }
  }

  return (
    <>
      <input
        ref={inputRef} type="file" multiple hidden
        accept={ALLOWED_UPLOAD_MIME.join(',')}
        onChange={e => handleFiles(e.target.files)}
      />
      <button
        type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload assets'}
      </button>
    </>
  )
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null)
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}
