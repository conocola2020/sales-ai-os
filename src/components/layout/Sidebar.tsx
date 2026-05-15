'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Zap,
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Send,
  MessageSquare,
  Handshake,
  Instagram,
  BarChart3,
  LogOut,
  ChevronRight,
  Settings,
  X,
  ReceiptText,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  {
    section: 'ワークスペース',
    items: [
      { label: '概要', href: '/dashboard', icon: LayoutDashboard, badge: null },
      { label: 'リード管理', href: '/dashboard/leads', icon: Users, badge: null },
      { label: '企業分析', href: '/dashboard/companies', icon: Building2, badge: null },
      { label: '文面生成', href: '/dashboard/compose', icon: FileText, badge: 'AI' },
      { label: '送信管理', href: '/dashboard/sending', icon: Send, badge: null },
    ],
  },
  {
    section: '営業フロー',
    items: [
      { label: '返信管理', href: '/dashboard/replies', icon: MessageSquare, badge: null },
      { label: '商談管理', href: '/dashboard/deals', icon: Handshake, badge: null },
    ],
  },
  {
    section: 'SNS',
    items: [
      { label: 'Instagram', href: '/dashboard/instagram', icon: Instagram, badge: null },
    ],
  },
  {
    section: 'アナリティクス',
    items: [
      { label: 'レポート', href: '/dashboard/reports', icon: BarChart3, badge: null },
    ],
  },
  {
    section: '経費管理',
    items: [
      { label: 'レシート読み取り', href: '/dashboard/receipts', icon: ReceiptText, badge: 'AI' },
    ],
  },
]

interface SidebarProps {
  userName?: string
  userEmail?: string
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ userName, userEmail, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const userInitial = (userName || userEmail || 'U').slice(0, 1).toUpperCase()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const handleNavClick = () => {
    onClose?.()
  }

  const sidebarContent = (
    <aside className="flex h-full w-72 flex-col border-r border-white/[0.08] bg-[#0d0f12] md:w-[268px]">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={handleNavClick}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-neutral-950 shadow-[0_12px_36px_rgba(20,184,166,0.2)] transition-transform group-hover:scale-[1.03]">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-sm font-bold leading-none text-white">Sales AI OS</span>
            <span className="mt-1 block text-xs text-stone-500">営業オペレーション基盤</span>
          </div>
        </Link>
        {/* Close button (mobile only) */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-white/[0.07] hover:text-white md:hidden"
            aria-label="メニューを閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navItems.map((group) => (
          <div key={group.section}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-600">
              {group.section}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={handleNavClick}
                      className={clsx(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all md:py-2.5',
                        isActive
                          ? 'border border-white/[0.10] bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                          : 'text-stone-400 hover:bg-white/[0.05] hover:text-stone-100'
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-teal-300" />
                      )}
                      <Icon
                        className={clsx(
                          'h-5 w-5 flex-shrink-0 transition-colors md:h-4 md:w-4',
                          isActive ? 'text-teal-300' : 'text-stone-500 group-hover:text-stone-300'
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={clsx(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide',
                            item.badge === 'AI'
                              ? 'border border-teal-400/25 bg-teal-400/10 text-teal-200'
                              : 'border border-red-500/30 bg-red-500/20 text-red-300'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="h-3 w-3 text-teal-300/70" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="space-y-2 border-t border-white/[0.08] px-3 py-4">
        <Link
          href="/dashboard/settings"
          onClick={handleNavClick}
          className={clsx(
            'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all md:py-2.5',
            pathname === '/dashboard/settings'
              ? 'border border-white/[0.10] bg-white/[0.07] text-white'
              : 'text-stone-400 hover:bg-white/[0.05] hover:text-stone-100'
          )}
        >
          <Settings className="h-5 w-5 text-stone-500 md:h-4 md:w-4" />
          <span>設定</span>
        </Link>

        {/* User info */}
        <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-200 text-sm font-bold text-neutral-950">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-100">{userName || 'ユーザー'}</p>
              <p className="mt-0.5 truncate text-xs text-stone-500">{userEmail || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 rounded-lg py-1 text-xs text-stone-500 transition-colors hover:text-red-300"
          >
            <LogOut className="w-3 h-3" />
            ログアウト
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: static sidebar */}
      <div className="hidden md:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile: overlay drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-50 transition-all duration-300 md:hidden',
          isOpen ? 'visible' : 'invisible'
        )}
      >
        {/* Backdrop */}
        <div
          className={clsx(
            'absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
        />
        {/* Drawer */}
        <div
          className={clsx(
            'absolute left-0 top-0 h-full transition-transform duration-300 ease-out',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  )
}
