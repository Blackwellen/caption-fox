'use client'
import { ReactNode } from 'react'
import { Permission } from '@/lib/permissions'

interface PermissionGateProps {
  userPermissions: string[]
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ userPermissions, permission, children, fallback = null }: PermissionGateProps) {
  if (!userPermissions.includes(permission)) return <>{fallback}</>
  return <>{children}</>
}
