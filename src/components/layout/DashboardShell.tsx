'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

interface DashboardShellProps {
  children: React.ReactNode
  userName?: string
  userEmail?: string
}

export default function DashboardShell({ children, userName, userEmail }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-dvh overflow-hidden bg-[#08090b] text-stone-100">
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0d0f12]/95 px-4 py-3 backdrop-blur flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-stone-400 transition-colors hover:bg-white/[0.07] hover:text-white"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400 text-xs font-black text-neutral-950">
              S
            </div>
            <div>
              <span className="block text-sm font-bold leading-none text-white">Sales AI OS</span>
              <span className="mt-0.5 block text-[11px] text-stone-500">営業オペレーション</span>
            </div>
          </div>
          <div className="h-10 w-10" aria-hidden="true" />
        </header>
        <main className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#0b0d10_0%,#08090b_36%,#08090b_100%)]">
          {children}
        </main>
      </div>
    </div>
  )
}
