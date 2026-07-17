'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Compass,
  LayoutDashboard,
  Star,
  Share2,
  Bot,
  Menu,
  X,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react'
import clsx from 'clsx'
import { MEO_PRODUCT_NAME, MEO_PRODUCT_TAGLINE } from '@/lib/meo/branding'

const navItems = [
  { label: 'ダッシュボード', href: '/meo', icon: LayoutDashboard, exact: true },
  { label: '口コミ管理', href: '/meo/reviews', icon: Star, badge: 'AI' },
  { label: 'サイテーション', href: '/meo/citations', icon: Share2 },
  { label: 'AIO可視性', href: '/meo/aio', icon: Bot, badge: 'AI' },
]

interface MeoShellProps {
  children: React.ReactNode
  userName?: string
  userEmail?: string
}

function MeoSidebar({
  userName,
  userEmail,
  onClose,
}: {
  userName?: string
  userEmail?: string
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <aside className="w-72 md:w-64 h-full bg-white border-r border-gray-200/50 flex flex-col">
      {/* ロゴ */}
      <div className="px-5 py-5 border-b border-gray-200/50 flex items-center justify-between">
        <Link href="/meo" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-shadow">
            <Compass className="w-4 h-4 text-gray-900" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900 leading-none block">
              {MEO_PRODUCT_NAME}
            </span>
            <span className="text-xs text-gray-500 mt-0.5 block">{MEO_PRODUCT_TAGLINE}</span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="メニューを閉じる"
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ナビ */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100/60'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {item.badge && (
                <span className="ml-auto px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* フッター */}
      <div className="px-3 py-4 border-t border-gray-200/50 space-y-1">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Sales AI OSに戻る
        </Link>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-900 font-medium truncate">{userName}</p>
            <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="ログアウト"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default function MeoShell({ children, userName, userEmail }: MeoShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* デスクトップサイドバー */}
      <div className="hidden md:block">
        <MeoSidebar userName={userName} userEmail={userEmail} />
      </div>

      {/* モバイルサイドバー */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <MeoSidebar
              userName={userName}
              userEmail={userEmail}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* モバイルヘッダー */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200/50 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Compass className="w-4 h-4 text-gray-900" />
            </div>
            <span className="text-sm font-bold text-gray-900">{MEO_PRODUCT_NAME}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
