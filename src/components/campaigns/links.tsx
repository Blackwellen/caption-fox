'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'

/**
 * Campaigns live under the type-first workspace route (/creator/campaigns,
 * /brand/campaigns, …). Client components derive that prefix from the URL
 * itself, so a link can never point at another workspace type's shell.
 */
export function useCampaignsBase(): string {
  const pathname = usePathname() ?? ''
  const kind = pathname.split('/')[1]
  return kind && kind !== 'app' ? `/${kind}/campaigns` : '/app/campaigns'
}

/** A link relative to the Campaigns base: `to="/all"`, `to={`/${id}`}`, `to=""`. */
export function CampaignLink({ to, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { to: string }) {
  const base = useCampaignsBase()
  return <Link href={`${base}${to}`} {...props} />
}
