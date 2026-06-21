'use client'

import { ExternalLink, LogOut } from 'lucide-react'
import { logoutAction } from '@/features/auth/actions/auth.actions'

export function HostTopBar() {
  async function handleLogout() {
    await logoutAction()
    window.location.assign('/login')
  }

  return (
    <div className="flex items-center gap-2.5 ">
      <a
        href="/stream"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg   border-slate-700 bg-[#171717] cursor-pointer px-4 py-2.5 text-sm text-violet-200 shadow-[0px_0px_29px_0px_rgba(48,110,25,0.25)]"
      >
        <ExternalLink className="h-4 w-4" />
        Abrir Stream
      </a>
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Cerrar sesión"
        className="rounded-lg border cursor-pointer border-red-900 bg-[#171717] p-2.5 text-red-300 transition-colors hover:bg-[#1f1416]"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}
