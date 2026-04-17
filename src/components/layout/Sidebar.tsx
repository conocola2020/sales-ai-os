'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Zap,
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
    section: 'メイン',
    items: [
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
  orgName?: string | null
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ userName, userEmail, orgName, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

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
    <aside className="w-72 md:w-64 h-full bg-gray-950 border-r border-gray-800/50 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800/50 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={handleNavClick}>
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white leading-none block">Sales AI OS</span>
            <span className="text-xs text-gray-500 mt-0.5 block">営業自動化</span>
          </div>
        </Link>
        {/* Close button (mobile only) */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
        {navItems.map((group) => (
          <div key={group.section}>
            <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {group.section}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={handleNavClick}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all group',
                        isActive
                          ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                      )}
                    >
                      <Icon
                        className={clsx(
                          'w-5 h-5 md:w-4 md:h-4 flex-shrink-0 transition-colors',
                          isActive ? 'text-violet-400' : 'text-gray-500 group-hover:text-gray-300'
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={clsx(
                            'text-xs px-1.5 py-0.5 rounded-md font-semibold',
                            item.badge === 'AI'
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="w-3 h-3 text-violet-400/60" />
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
      <div className="px-3 py-4 border-t border-gray-800/50 space-y-1">
        <Link
          href="/dashboard/settings"
          onClick={handleNavClick}
          className="flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-all"
        >
          <Settings className="w-5 h-5 md:w-4 md:h-4 text-gray-500" />
          <span>設定</span>
        </Link>

        {/* User info */}
        <div className="px-3 py-3 mt-2 bg-gray-900 rounded-xl border border-gray-800/50">
          {orgName && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <Building2 className="w-3 h-3 text-violet-400 flex-shrink-0" />
              <p className="text-xs font-medium text-violet-300 truncate">{orgName}</p>
            </div>
          )}
          <p className="text-sm font-medium text-gray-200 truncate">{userName || 'ユーザー'}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{userEmail || ''}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors py-1"
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
          'md:hidden fixed inset-0 z-50 transition-all duration-300',
          isOpen ? 'visible' : 'invisible'
        )}
      >
        {/* Backdrop */}
        <div
          className={clsx(
            'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
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
