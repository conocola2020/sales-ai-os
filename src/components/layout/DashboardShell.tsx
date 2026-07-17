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
    <div className="flex h-dvh overflow-hidden bg-white text-gray-900">
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between gap-3 border-b border-black/[0.08] bg-white/95 px-4 py-3 backdrop-blur flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.08] bg-black/[0.03] text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-900"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400 text-xs font-black text-neutral-950">
              S
            </div>
            <div>
              <span className="block text-sm font-bold leading-none text-gray-900">Sales AI OS</span>
              <span className="mt-0.5 block text-[11px] text-gray-500">営業オペレーション</span>
            </div>
          </div>
          <div className="h-10 w-10" aria-hidden="true" />
        </header>
        <main className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f6f7f9_0%,#ffffff_36%,#ffffff_100%)]">
          {children}
        </main>
      </div>
    </div>
  )
}
