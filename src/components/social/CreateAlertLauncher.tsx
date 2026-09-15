'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateAlertModal } from './CreateAlertModal'

export function CreateAlertLauncher() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">
        <Plus size={15} />Create Alert
      </button>
      {open && <CreateAlertModal onClose={() => setOpen(false)} />}
    </>
  )
}
