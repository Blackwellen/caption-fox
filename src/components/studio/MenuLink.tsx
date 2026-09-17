'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './overlays'
import { S_FOCUS } from './ui'

export interface MenuLinkItem { label: string; href: string; download?: boolean }

/** An overflow menu whose items are real links (navigation or file download). */
export function MenuLink({ label, icon, items, variant = 'bordered', className }: {
  label: string
  icon: React.ReactNode
  items: MenuLinkItem[]
  variant?: 'bordered' | 'ghost'
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger haspopup="menu" label={label}
        className={cn('inline-flex items-center justify-center rounded-[7px] text-slate-600 hover:bg-slate-50', S_FOCUS,
          variant === 'bordered' ? 'h-10 w-10 border border-[#e3e7ee] bg-white lg:h-[28px] lg:w-[34px]' : 'h-8 w-8 lg:h-6 lg:w-6', className)}>
        {icon}
      </PopoverTrigger>
      <PopoverContent role="menu" label={label} width={220} align="end">
        {close => items.map(item => item.download ? (
          <a key={item.label} href={item.href} role="menuitem" onClick={close} download
            className="flex w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 outline-none hover:bg-slate-50 focus-visible:bg-slate-100 lg:py-1.5 lg:text-[12px]">
            {item.label}
          </a>
        ) : (
          <Link key={item.label} href={item.href} role="menuitem" onClick={close}
            className="flex w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 outline-none hover:bg-slate-50 focus-visible:bg-slate-100 lg:py-1.5 lg:text-[12px]">
            {item.label}
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  )
}
