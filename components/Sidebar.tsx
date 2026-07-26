'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  ArrowUpRight,
  Wallet,
  Tag,
  BarChart3,
  PiggyBank,
  Repeat,
  Settings,
  LogOut,
  X,
  Menu,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowUpRight },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  username?: string
  email?: string
  displayName?: string | null
}

/**
 * Defined at module level rather than inside `Sidebar`. A component declared in
 * the render body is a new type on every render, so React unmounts and remounts
 * this whole subtree each time — harmless while it holds no state, but it would
 * silently reset anything added later (a collapsed section, focus, a scroll
 * position).
 *
 * `large` bumps every touch target up a size for the mobile drawer, where the
 * whole point is thumb reach; the desktop rail keeps the compact sizing.
 * `onClose`, when given, renders a close button inline in the header — kept in
 * normal flow (not absolutely positioned) so it stays aligned with the logo.
 */
function SidebarContent({
  pathname, username, email, displayName, onNavigate, onLogout, large = false, onClose,
}: SidebarProps & {
  pathname: string
  onNavigate: () => void
  onLogout: () => void
  large?: boolean
  onClose?: () => void
}) {
  const itemSize = large ? 'gap-4 px-4 py-3.5 text-base rounded-xl' : 'gap-3 px-3 py-2.5 text-sm rounded-lg'
  const iconSize = large ? 24 : 18

  return (
    <div className="flex flex-col h-full">
      {/* Logo (+ close button in the drawer) */}
      <div className={`border-b border-slate-800 ${large ? 'px-5 py-5' : 'px-6 py-5'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 ${large ? 'w-9 h-9' : 'w-8 h-8'}`}>
              <span className={`text-white font-bold leading-none ${large ? 'text-base' : 'text-sm'}`}>£</span>
            </div>
            <span className={`text-white font-bold truncate ${large ? 'text-lg' : 'text-base'}`}>Budget Tracker</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="shrink-0 -mr-1 p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto px-3 py-4 ${large ? 'space-y-1.5' : 'space-y-0.5'}`}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center font-medium transition-colors ${itemSize} ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={iconSize} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 py-2 mb-1">
          <p className={`text-white font-medium truncate ${large ? 'text-base' : 'text-sm'}`}>{displayName || username || 'User'}</p>
          <p className={`text-slate-500 truncate ${large ? 'text-sm' : 'text-xs'}`}>{displayName ? `@${username}` : email}</p>
        </div>
        <button
          onClick={onLogout}
          className={`flex items-center w-full font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ${itemSize}`}
        >
          <LogOut size={iconSize} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ username, email, displayName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Freeze the page behind the drawer. The scroll container is <main>, so lock
  // it directly (overflow + touch-action to stop iOS touch scrolling), and lock
  // the document as a backstop in case the scroll ever lives higher up.
  useEffect(() => {
    if (!mobileOpen) return
    const main = document.querySelector('main') as HTMLElement | null
    const root = document.documentElement
    const body = document.body
    const saved = {
      mainOverflowY: main?.style.overflowY ?? '',
      mainTouch: main?.style.touchAction ?? '',
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
    }
    if (main) {
      main.style.overflowY = 'hidden'
      main.style.touchAction = 'none'
    }
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      if (main) {
        main.style.overflowY = saved.mainOverflowY
        main.style.touchAction = saved.mainTouch
      }
      root.style.overflow = saved.rootOverflow
      body.style.overflow = saved.bodyOverflow
    }
  }, [mobileOpen])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const contentProps = {
    pathname,
    username,
    email,
    displayName,
    onNavigate: () => setMobileOpen(false),
    onLogout: handleLogout,
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-slate-900 border-r border-slate-800 shrink-0 h-dvh sticky top-0">
        <SidebarContent {...contentProps} />
      </aside>

      {/* Mobile top bar — taller for an easy menu tap, padded down past the
          status bar / notch on iOS. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold leading-none">£</span>
          </div>
          <span className="text-white font-bold text-base">Budget Tracker</span>
        </div>
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-slate-300 hover:text-white cursor-pointer p-2 -mr-2">
          <Menu size={26} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 cursor-pointer" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-slate-900 h-full flex flex-col pt-safe pb-safe">
            <SidebarContent {...contentProps} large onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
