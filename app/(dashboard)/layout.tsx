import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const username = user.user_metadata?.username || user.email?.split('@')[0] || 'User'

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    // h-dvh (not h-screen): iOS standalone reports an unreliable 100vh, so the
    // dynamic viewport unit keeps the shell from being clipped by the toolbars.
    <div className="flex h-dvh bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar username={username} email={user.email} displayName={profile?.full_name || null} />
      {/* On mobile, clear the fixed top bar plus the status-bar inset; add a
          bottom inset so the last row clears the home indicator. */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </div>
  )
}
