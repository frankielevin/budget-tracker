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
import { useState } from 'react'

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
 */
function SidebarContent({
  pathname, username, email, displayName, onNavigate, onLogout,
}: SidebarProps & {
  pathname: string
  onNavigate: () => void
  onLogout: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold leading-none">£</span>
          </div>
          <span className="text-white font-bold text-base">Budget Tracker</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-sm font-medium truncate">{displayName || username || 'User'}</p>
          <p className="text-slate-500 text-xs truncate">{displayName ? `@${username}` : email}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
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

      {/* Mobile top bar — padded down past the status bar / notch on iOS. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">£</span>
          </div>
          <span className="text-white font-bold text-sm">Budget Tracker</span>
        </div>
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-slate-400 hover:text-white cursor-pointer p-1 -m-1">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 cursor-pointer" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-slate-900 h-full flex flex-col pt-safe pb-safe">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 text-slate-400 hover:text-white cursor-pointer z-10"
            >
              <X size={20} />
            </button>
            <SidebarContent {...contentProps} />
          </div>
        </div>
      )}
    </>
  )
}
