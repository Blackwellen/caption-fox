'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Check, Plus, Building2, Store, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_WORKSPACE_COOKIE, type WorkspaceLite } from '@/lib/workspace-shared'

export default function WorkspaceSwitcher({
  workspaces,
  activeId,
  supplier,
  supplierActive = false,
  userId,
  defaultWorkspaceId,
}: {
  workspaces: WorkspaceLite[]
  activeId?: string | null
  supplier?: { display_name: string; verified?: boolean | null } | null
  /** True when the shell is currently rendering the supplier workspace. */
  supplierActive?: boolean
  /** Enables the "set as default login workspace" star per row when provided. */
  userId?: string | null
  defaultWorkspaceId?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [defaultId, setDefaultId] = useState(defaultWorkspaceId ?? null)
  const active = workspaces.find(w => w.id === activeId) ?? workspaces[0]

  async function setAsDefault(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!userId) return
    setDefaultId(id)
    const supabase = createClient()
    await supabase.from('profiles').update({ default_workspace_id: id }).eq('id', userId)
  }

  function choose(id: string) {
    // The browser cookie is the server-rendered workspace preference.
    // eslint-disable-next-line react-hooks/immutability
    window.document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`
    setOpen(false)
    // Always land in the real production shell at /app/home — the type-first
    // routes (/creator, /business, ...) are a separate dev/demo surface and
    // must never be the switcher's destination for regular users. Navigating
    // (rather than refreshing in place) also avoids showing a record page
    // that belongs to the workspace we just switched away from.
    router.push('/app/home')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors max-w-[200px]"
      >
        {supplierActive && supplier ? (
          <span className="w-5 h-5 rounded bg-violet-100 flex items-center justify-center shrink-0">
            <Store size={12} className="text-violet-600" />
          </span>
        ) : (
          <span className="w-5 h-5 rounded bg-fox-gradient flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {(active?.name ?? 'W')[0].toUpperCase()}
          </span>
        )}
        <span className="truncate">
          {supplierActive && supplier ? supplier.display_name : active?.name ?? 'My Workspace'}
        </span>
        <ChevronsUpDown size={13} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1.5">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workspaces</p>
            <div className="max-h-72 overflow-y-auto">
              {workspaces.map(w => (
                <div key={w.id} className="group flex items-center gap-1 px-1">
                  <button
                    onClick={() => choose(w.id)}
                    className="flex flex-1 min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
                      {w.name[0].toUpperCase()}
                    </span>
                    <span className="flex-1 text-left truncate">{w.name}</span>
                    {!supplierActive && w.id === active?.id && <Check size={14} className="text-blue-600 shrink-0" />}
                  </button>
                  {userId && (
                    <button
                      onClick={e => setAsDefault(w.id, e)}
                      title={w.id === defaultId ? 'Default login workspace' : 'Set as default login workspace'}
                      aria-label={w.id === defaultId ? 'Default login workspace' : 'Set as default login workspace'}
                      className="shrink-0 p-1.5 rounded-md hover:bg-slate-100"
                    >
                      <Star size={13} className={w.id === defaultId ? 'text-amber-500 fill-amber-500' : 'text-slate-300 group-hover:text-slate-400'} />
                    </button>
                  )}
                </div>
              ))}
              {workspaces.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400 flex items-center gap-2"><Building2 size={14} /> No workspaces</p>
              )}
            </div>
            {supplier && (
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => { setOpen(false); router.push('/supplier') }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded bg-violet-100 flex items-center justify-center shrink-0">
                    <Store size={13} className="text-violet-600" />
                  </span>
                  <span className="flex-1 text-left truncate">{supplier.display_name}</span>
                  {supplierActive
                    ? <Check size={14} className="text-violet-600 shrink-0" />
                    : <span className="text-[10px] text-violet-600 font-medium">Supplier</span>}
                </button>
              </div>
            )}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); router.push('/onboarding') }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus size={15} /> Create workspace
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
