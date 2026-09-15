'use client'

import { useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BadgePercent, Building2, Check, ChevronDown, CircleHelp, Copy, LogOut, Menu, PanelLeftClose,
  PanelLeftOpen, Plus, Search, ShieldCheck, Star, Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_WORKSPACE_COOKIE, type WorkspaceLite } from '@/lib/workspace-shared'
import type { ShellNavigation } from '@/lib/navigation/types'
import NotificationsBell, { type NotificationItem } from '@/components/layout/NotificationsBell'
import { NAV_ICONS } from './icons'
import { ShellAvatar, ShellFoxMark } from './ShellLogo'
import { handleMenuKeys, useFocusFirstItem, usePopover } from './usePopover'
import type { ShellContextInfo, ShellUserInfo } from './types'

const ICON_BUTTON =
  'h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-shell-text-2 transition-colors duration-150 hover:bg-shell-canvas hover:text-shell-text'
const MENU_PANEL =
  'cf-shell-pop absolute top-full z-50 mt-2 rounded-xl border border-shell-border bg-white p-1.5 shadow-shell-pop'
const MENU_ITEM =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-shell-text-2 outline-none transition-colors hover:bg-shell-canvas hover:text-shell-text focus-visible:bg-shell-canvas focus-visible:text-shell-text'

const WORKSPACE_TYPE_LABEL: Record<string, string> = {
  creator: 'Creator', small_business: 'Business', business: 'Business', brand: 'Brand', agency: 'Agency',
}

// Module-level so the write is not a render-time side effect.
function writeActiveWorkspaceCookie(id: string) {
  document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`
}

const subscribeNoop = () => () => {}

export interface ShellTopbarProps {
  nav: ShellNavigation
  context: ShellContextInfo
  user: ShellUserInfo
  userId: string
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenDrawer: () => void
  onOpenSearch: () => void
  menuButtonRef: RefObject<HTMLButtonElement | null>
  searchButtonRef: RefObject<HTMLButtonElement | null>
  workspaces?: WorkspaceLite[]
  activeWorkspaceId?: string | null
  supplier?: { display_name: string } | null
  defaultWorkspaceId?: string | null
  notifications: NotificationItem[]
  copyValue?: string | null
}

export default function ShellTopbar(props: ShellTopbarProps) {
  const { nav, collapsed, onToggleCollapsed, onOpenDrawer, onOpenSearch, menuButtonRef, searchButtonRef } = props
  const isMac = useSyncExternalStore(subscribeNoop, () => /Mac|iPhone|iPad/i.test(navigator.platform), () => true)

  return (
    <header className="relative z-40 shrink-0 border-b border-shell-border bg-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-[60px] items-center gap-2 px-3 sm:gap-3 sm:px-5 md:h-[72px] lg:px-6">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-pressed={collapsed}
          className={cn(ICON_BUTTON, 'hidden lg:inline-flex')}
        >
          {collapsed ? <PanelLeftOpen size={20} aria-hidden /> : <PanelLeftClose size={20} aria-hidden />}
        </button>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open navigation"
          className={cn(ICON_BUTTON, 'inline-flex lg:hidden')}
        >
          <Menu size={20} aria-hidden />
        </button>
        <Link href={nav.homeHref} aria-label="Caption Fox home" className="shrink-0 rounded-[10px] md:hidden">
          <ShellFoxMark size={32} />
        </Link>

        <ContextSwitcher {...props} />

        <button
          ref={searchButtonRef}
          type="button"
          onClick={onOpenSearch}
          aria-label={nav.searchPlaceholder}
          aria-keyshortcuts="Control+K Meta+K"
          className="hidden h-10 min-w-0 max-w-[440px] flex-1 items-center gap-2.5 rounded-[10px] border border-shell-border bg-shell-canvas px-3.5 text-left text-[13.5px] text-shell-muted transition-colors duration-150 hover:border-[#d3ddec] hover:bg-white md:flex"
        >
          <Search size={16} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{nav.searchPlaceholder}</span>
          <kbd className="shrink-0 rounded-md border border-shell-border bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-shell-muted">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <button type="button" onClick={onOpenSearch} aria-label="Search" className={cn(ICON_BUTTON, 'inline-flex md:hidden')}>
            <Search size={19} aria-hidden />
          </button>
          <PrimaryActionControl nav={nav} copyValue={props.copyValue} />
          <NotificationsBell initial={props.notifications} />
          <HelpMenu nav={nav} />
          <AccountMenu {...props} />
        </div>
      </div>
    </header>
  )
}

function ContextSwitcher({ context, workspaces = [], activeWorkspaceId, supplier, userId, defaultWorkspaceId }: ShellTopbarProps) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover()
  const menuRef = useRef<HTMLDivElement>(null)
  const [defaultId, setDefaultId] = useState(defaultWorkspaceId ?? null)
  useFocusFirstItem(open, menuRef)

  const icon = context.kind === 'admin'
    ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cf-violet-soft text-cf-violet"><ShieldCheck size={15} aria-hidden /></span>
    : context.kind === 'affiliate'
      ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><BadgePercent size={15} aria-hidden /></span>
      : context.kind === 'supplier'
        ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cf-violet-soft text-cf-violet"><Store size={15} aria-hidden /></span>
        : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-shell-blue-soft text-[12px] font-bold text-shell-blue">{(context.label[0] ?? 'W').toUpperCase()}</span>

  // The affiliate portal is grant-scoped: there is nothing to switch to.
  if (context.kind === 'affiliate') {
    return (
      <div className="hidden min-w-0 items-center gap-2.5 px-1 sm:flex">
        {icon}
        <span className="truncate text-[14px] font-semibold text-shell-text">{context.label}</span>
      </div>
    )
  }

  function choose(id: string) {
    writeActiveWorkspaceCookie(id)
    close(false)
    // A full navigation, not router.push + refresh: pushing to the page you
    // are already on does not re-render the shell, and a fresh load
    // guarantees nothing from the previous workspace stays on screen.
    window.location.assign('/app/home')
  }

  async function makeDefault(id: string) {
    setDefaultId(id)
    await createClient().from('profiles').update({ default_workspace_id: id }).eq('id', userId)
  }

  return (
    <div ref={rootRef} className="relative hidden min-w-0 sm:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Current context: ${context.label}. Switch context`}
        className="flex h-10 min-w-0 max-w-[220px] items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors duration-150 hover:bg-shell-canvas"
      >
        {icon}
        <span className="min-w-0 truncate text-[14px] font-semibold text-shell-text">{context.label}</span>
        <ChevronDown size={15} aria-hidden className="shrink-0 text-shell-muted" />
      </button>

      {open && (
        <div ref={menuRef} role="menu" aria-label="Switch context" onKeyDown={handleMenuKeys} className={cn(MENU_PANEL, 'left-0 w-72')}>
          {context.kind === 'admin' ? (
            <Link href="/app/home" role="menuitem" className={MENU_ITEM}>
              <Building2 size={15} aria-hidden className="text-shell-icon" />Return to workspace
            </Link>
          ) : (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-shell-muted">Workspaces</p>
              <div className="max-h-72 overflow-y-auto">
                {workspaces.map(workspace => {
                  const current = context.kind === 'workspace' && workspace.id === activeWorkspaceId
                  return (
                    <div key={workspace.id} role="none" className="flex items-center gap-1">
                      <button type="button" role="menuitem" onClick={() => choose(workspace.id)} className={cn(MENU_ITEM, 'min-w-0 flex-1')}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-shell-canvas text-[12px] font-bold text-shell-text-2">
                          {(workspace.name[0] ?? 'W').toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-shell-text">{workspace.name}</span>
                          <span className="block text-[11.5px] text-shell-muted">{WORKSPACE_TYPE_LABEL[workspace.type ?? ''] ?? 'Workspace'}</span>
                        </span>
                        {current && <Check size={15} aria-label="Current workspace" className="shrink-0 text-shell-blue" />}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => makeDefault(workspace.id)}
                        aria-label={workspace.id === defaultId ? `${workspace.name} is your default sign-in workspace` : `Make ${workspace.name} your default sign-in workspace`}
                        className="rounded-lg p-2 outline-none hover:bg-shell-canvas focus-visible:bg-shell-canvas"
                      >
                        <Star size={14} aria-hidden className={workspace.id === defaultId ? 'fill-amber-400 text-amber-400' : 'text-[#c3cedd]'} />
                      </button>
                    </div>
                  )
                })}
                {workspaces.length === 0 && <p className="px-2.5 py-2 text-[13px] text-shell-muted">No marketing workspaces yet.</p>}
              </div>
              {supplier && (
                <div className="mt-1 border-t border-shell-border-soft pt-1">
                  <Link href="/supplier" role="menuitem" className={MENU_ITEM}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cf-violet-soft text-cf-violet"><Store size={14} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-shell-text">{supplier.display_name}</span>
                      <span className="block text-[11.5px] text-shell-muted">Supplier workspace</span>
                    </span>
                    {context.kind === 'supplier' && <Check size={15} aria-label="Current workspace" className="shrink-0 text-shell-blue" />}
                  </Link>
                </div>
              )}
              <div className="mt-1 border-t border-shell-border-soft pt-1">
                <Link href="/onboarding?new=1" role="menuitem" className={cn(MENU_ITEM, 'font-medium text-shell-blue hover:text-shell-blue')}>
                  <Plus size={15} aria-hidden />Create workspace
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PrimaryActionControl({ nav, copyValue }: { nav: ShellNavigation; copyValue?: string | null }) {
  const { open, setOpen, rootRef, triggerRef } = usePopover()
  const menuRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  useFocusFirstItem(open, menuRef)

  const action = nav.primaryAction
  if (!action) return null

  const buttonClass =
    'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-shell-blue text-[14px] font-semibold text-white shadow-shell-button transition-colors duration-150 hover:bg-shell-blue-hover w-10 sm:w-auto sm:px-4'

  if (action.type === 'copy-link') {
    if (!copyValue) return null
    return (
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(copyValue)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        }}
        className={buttonClass}
        aria-live="polite"
      >
        {copied ? <Check size={17} aria-hidden /> : <Copy size={16} aria-hidden />}
        <span className="sr-only sm:not-sr-only">{copied ? 'Copied' : action.label}</span>
      </button>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClass}
      >
        <Plus size={17} strokeWidth={2.2} aria-hidden />
        <span className="sr-only sm:not-sr-only">{action.label}</span>
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="Create" onKeyDown={handleMenuKeys} className={cn(MENU_PANEL, 'right-0 w-60')}>
          {action.items.map(item => {
            const Icon = NAV_ICONS[item.icon]
            return (
              <Link key={item.id} href={item.href} role="menuitem" className={MENU_ITEM}>
                <Icon size={15} aria-hidden className="text-shell-icon" />{item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HelpMenu({ nav }: { nav: ShellNavigation }) {
  const { open, setOpen, rootRef, triggerRef } = usePopover()
  const menuRef = useRef<HTMLDivElement>(null)
  useFocusFirstItem(open, menuRef)
  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Help"
        className={cn(ICON_BUTTON, 'inline-flex')}
      >
        <CircleHelp size={20} aria-hidden />
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="Help" onKeyDown={handleMenuKeys} className={cn(MENU_PANEL, 'right-0 w-56')}>
          {nav.helpMenu.map(item => {
            const Icon = NAV_ICONS[item.icon]
            return (
              <Link key={item.id} href={item.href} role="menuitem" className={MENU_ITEM}>
                <Icon size={15} aria-hidden className="text-shell-icon" />{item.label}
              </Link>
            )
          })}
          <p className="mt-1 border-t border-shell-border-soft px-2.5 pb-1 pt-2 text-[11.5px] text-shell-muted">
            Press <kbd className="font-sans font-semibold">Ctrl/⌘ K</kbd> to search
          </p>
        </div>
      )}
    </div>
  )
}

function AccountMenu({ nav, user }: ShellTopbarProps) {
  const router = useRouter()
  const { open, setOpen, rootRef, triggerRef } = usePopover()
  const menuRef = useRef<HTMLDivElement>(null)
  useFocusFirstItem(open, menuRef)

  async function signOut() {
    await createClient().auth.signOut()
    router.push(nav.signOutRedirect)
    router.refresh()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="flex h-10 items-center gap-1 rounded-full pl-0.5 pr-1 transition-colors duration-150 hover:bg-shell-canvas sm:ml-1"
      >
        <ShellAvatar initials={user.initials} size={36} shape="circle" />
        <ChevronDown size={16} aria-hidden className="hidden text-shell-muted sm:block" />
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="Account" onKeyDown={handleMenuKeys} className={cn(MENU_PANEL, 'right-0 w-64')}>
          <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-1.5">
            <ShellAvatar initials={user.initials} size={36} shape="circle" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-shell-text">{user.name}</p>
              {user.email && <p className="truncate text-[12px] text-shell-muted">{user.email}</p>}
            </div>
          </div>
          <div className="border-t border-shell-border-soft pt-1">
            {nav.accountMenu.map(item => {
              const Icon = NAV_ICONS[item.icon]
              return (
                <Link key={item.id} href={item.href} role="menuitem" className={MENU_ITEM}>
                  <Icon size={15} aria-hidden className="text-shell-icon" />{item.label}
                </Link>
              )
            })}
            <Link href="/help" role="menuitem" className={cn(MENU_ITEM, 'sm:hidden')}>
              <CircleHelp size={15} aria-hidden className="text-shell-icon" />Help
            </Link>
          </div>
          <div className="mt-1 border-t border-shell-border-soft pt-1">
            <button type="button" role="menuitem" onClick={signOut} className={MENU_ITEM}>
              <LogOut size={15} aria-hidden className="text-shell-icon" />Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
