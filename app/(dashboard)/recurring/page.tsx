'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScrollLock } from '@/lib/useScrollLock'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit, Trash2, Repeat, Pause, Play, Clock } from 'lucide-react'
import RecurringModal from '@/components/RecurringModal'
import type { RecurringTransaction, Account, Category } from '@/lib/types'

export default function RecurringPage() {
  const [templates, setTemplates] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RecurringTransaction | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Lock the background while the delete dialog is open, matching the modals.
  useScrollLock(!!deleteId)
  const [upcomingByTemplate, setUpcomingByTemplate] = useState<Record<string, number>>({})
  const [alsoDeleteUpcoming, setAlsoDeleteUpcoming] = useState(true)

  async function load() {
    const supabase = createClient()
    const [{ data: r }, { data: a }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('recurring_transactions').select('*, account:accounts!account_id(*), to_account:accounts!to_account_id(*), category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      // Generated occurrences that haven't taken effect yet. These outlive their
      // template unless we clear them, and would still move balances on their date.
      supabase.from('transactions').select('recurring_id').eq('pending', true).not('recurring_id', 'is', null),
    ])
    setTemplates(r || [])
    setAccounts(a || [])
    setCategories(c || [])

    const counts: Record<string, number> = {}
    for (const row of p || []) {
      if (row.recurring_id) counts[row.recurring_id] = (counts[row.recurring_id] || 0) + 1
    }
    setUpcomingByTemplate(counts)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  /** Remove a template's not-yet-applied occurrences. Never touches settled rows. */
  async function clearUpcoming(templateId: string) {
    const supabase = createClient()
    await supabase.from('transactions').delete().eq('recurring_id', templateId).eq('pending', true)
  }

  async function handleToggleActive(t: RecurringTransaction) {
    const supabase = createClient()
    await supabase.from('recurring_transactions').update({ is_active: !t.is_active }).eq('id', t.id)
    // Pausing should actually stop the thing happening. Any already-generated
    // occurrence still waiting on its date gets withdrawn; resuming regenerates
    // it on the next sync, so this stays reversible.
    if (t.is_active) await clearUpcoming(t.id)
    load()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    if (alsoDeleteUpcoming) await clearUpcoming(id)
    await supabase.from('recurring_transactions').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  const active = templates.filter(t => t.is_active)
  const inactive = templates.filter(t => !t.is_active)

  // Yearly templates still cost you every month — spread them over 12 so the
  // totals reflect the real monthly commitment.
  const perMonth = (t: RecurringTransaction) => t.frequency === 'yearly' ? t.amount / 12 : t.amount
  const sumOf = (type: RecurringTransaction['type']) =>
    active.filter(t => t.type === type).reduce((s, t) => s + perMonth(t), 0)

  const monthlyIncome = sumOf('income')
  const monthlyExpenses = sumOf('expense')
  // Transfers move money between your own accounts, so they aren't spending —
  // but they are committed, and leaving them out overstates what's spare.
  const monthlyTransfers = sumOf('transfer')
  const unallocated = monthlyIncome - monthlyExpenses - monthlyTransfers

  const hasYearly = active.some(t => t.frequency === 'yearly')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Recurring</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {active.length} active template{active.length !== 1 ? 's' : ''} — auto-generated each period
          </p>
        </div>
        <button
          onClick={() => { setEditingTemplate(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus size={16} />
          Add<span className="hidden sm:inline"> recurring</span>
        </button>
      </div>

      {/* Summary */}
      {active.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Monthly Income</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(monthlyIncome)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Monthly Expenses</p>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(monthlyExpenses)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Monthly Transfers</p>
              <p className="text-2xl font-bold text-blue-500">{formatCurrency(monthlyTransfers)}</p>
              <p className="text-xs text-slate-400 mt-1">committed, not spent</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Unallocated</p>
              <p className={`text-2xl font-bold ${unallocated >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                {formatCurrency(unallocated)}
              </p>
              <p className="text-xs text-slate-400 mt-1">after expenses &amp; transfers</p>
            </div>
          </div>
          {hasYearly && (
            <p className="text-xs text-slate-400 mb-6">Yearly templates are averaged across 12 months.</p>
          )}
          {!hasYearly && <div className="mb-6" />}
        </>
      )}

      {templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Repeat size={20} className="text-indigo-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">No recurring transactions yet</p>
          <p className="text-slate-400 text-sm mb-4">Add a recurring template and it will auto-generate transactions each period.</p>
          <button
            onClick={() => { setEditingTemplate(null); setShowModal(true) }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            Add your first recurring
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Active</h2>
              <div className="space-y-2">
                {active.map(t => <TemplateRow key={t.id} t={t} upcoming={upcomingByTemplate[t.id] || 0} onEdit={() => { setEditingTemplate(t); setShowModal(true) }} onToggle={() => handleToggleActive(t)} onDelete={() => { setAlsoDeleteUpcoming(true); setDeleteId(t.id) }} />)}
              </div>
            </section>
          )}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 mb-3">Paused</h2>
              <div className="space-y-2">
                {inactive.map(t => <TemplateRow key={t.id} t={t} upcoming={upcomingByTemplate[t.id] || 0} onEdit={() => { setEditingTemplate(t); setShowModal(true) }} onToggle={() => handleToggleActive(t)} onDelete={() => { setAlsoDeleteUpcoming(true); setDeleteId(t.id) }} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {showModal && (
        <RecurringModal
          recurring={editingTemplate}
          accounts={accounts}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:pl-60 bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete recurring?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Transactions it has already generated and applied will not be affected.</p>

            {upcomingByTemplate[deleteId] > 0 && (
              <label className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoDeleteUpcoming}
                  onChange={e => setAlsoDeleteUpcoming(e.target.checked)}
                  className="mt-0.5 accent-amber-600 cursor-pointer"
                />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  Also remove {upcomingByTemplate[deleteId]} upcoming transaction{upcomingByTemplate[deleteId] !== 1 ? 's' : ''}.
                  <span className="block text-xs mt-0.5 opacity-80">
                    Left in place, they will still change your balances when their dates arrive.
                  </span>
                </span>
              </label>
            )}
            {!upcomingByTemplate[deleteId] && <div className="mb-5" />}

            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateRow({
  t, upcoming, onEdit, onToggle, onDelete,
}: {
  t: RecurringTransaction
  upcoming: number
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const cat = t.category as Category | undefined
  const acc = t.account as Account | undefined
  const toAcc = t.to_account as Account | undefined
  const isTransfer = t.type === 'transfer'
  const color = isTransfer ? '#3b82f6' : (cat?.color || (t.type === 'income' ? '#22c55e' : '#6b7280'))

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const freqLabel = t.frequency === 'monthly'
    ? `Monthly on the ${t.day_of_month}${ordinal(t.day_of_month)}`
    : `Yearly in ${MONTH_NAMES[t.start_month - 1]} on the ${t.day_of_month}${ordinal(t.day_of_month)}`

  // Single truncating meta line, matching the transactions list — the old
  // separate spans wrapped and clustered on a phone.
  const metaParts: string[] = [freqLabel]
  if (isTransfer && acc && toAcc) metaParts.push(`${acc.name} → ${toAcc.name}`)
  else {
    if (cat) metaParts.push(cat.name)
    if (acc) metaParts.push(acc.name)
  }

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3 ${!t.is_active ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit() } }}
      >
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t.description}</p>
          {upcoming > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-xs font-medium shrink-0">
              <Clock size={10} />
              {upcoming} upcoming
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">{metaParts.join(' · ')}</p>
      </div>
      {/* Amount over actions in one narrow column, freeing width for the text. */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-sm font-bold whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-500' : 'text-blue-500'}`}>
          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
        </span>
        <div className="flex items-center gap-0.5 -mr-1.5">
          <button onClick={onToggle} aria-label={t.is_active ? 'Pause' : 'Resume'} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer" title={t.is_active ? 'Pause' : 'Resume'}>
            {t.is_active ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={onEdit} aria-label="Edit" className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer">
            <Edit size={15} />
          </button>
          <button onClick={onDelete} aria-label="Delete" className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
