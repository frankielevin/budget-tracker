'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit, Trash2, Repeat, Pause, Play } from 'lucide-react'
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

  async function load() {
    const supabase = createClient()
    const [{ data: r }, { data: a }, { data: c }] = await Promise.all([
      supabase.from('recurring_transactions').select('*, account:accounts(*), category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ])
    setTemplates(r || [])
    setAccounts(a || [])
    setCategories(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggleActive(t: RecurringTransaction) {
    const supabase = createClient()
    await supabase.from('recurring_transactions').update({ is_active: !t.is_active }).eq('id', t.id)
    load()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('recurring_transactions').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  const active = templates.filter(t => t.is_active)
  const inactive = templates.filter(t => !t.is_active)

  const monthlyIncome = active.filter(t => t.type === 'income' && t.frequency === 'monthly').reduce((s, t) => s + t.amount, 0)
  const monthlyExpenses = active.filter(t => t.type === 'expense' && t.frequency === 'monthly').reduce((s, t) => s + t.amount, 0)

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
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add recurring
        </button>
      </div>

      {/* Summary */}
      {active.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Monthly Income</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(monthlyIncome)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Monthly Expenses</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(monthlyExpenses)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Net Monthly</p>
            <p className={`text-2xl font-bold ${monthlyIncome - monthlyExpenses >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
              {formatCurrency(monthlyIncome - monthlyExpenses)}
            </p>
          </div>
        </div>
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
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
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
                {active.map(t => <TemplateRow key={t.id} t={t} onEdit={() => { setEditingTemplate(t); setShowModal(true) }} onToggle={() => handleToggleActive(t)} onDelete={() => setDeleteId(t.id)} />)}
              </div>
            </section>
          )}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 mb-3">Paused</h2>
              <div className="space-y-2">
                {inactive.map(t => <TemplateRow key={t.id} t={t} onEdit={() => { setEditingTemplate(t); setShowModal(true) }} onToggle={() => handleToggleActive(t)} onDelete={() => setDeleteId(t.id)} />)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete recurring?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">Previously generated transactions will not be affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateRow({
  t, onEdit, onToggle, onDelete,
}: {
  t: RecurringTransaction
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const cat = t.category as Category | undefined
  const acc = t.account as Account | undefined
  const color = cat?.color || (t.type === 'income' ? '#22c55e' : '#6b7280')

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const freqLabel = t.frequency === 'monthly'
    ? `Monthly on the ${t.day_of_month}${ordinal(t.day_of_month)}`
    : `Yearly in ${MONTH_NAMES[t.start_month - 1]} on the ${t.day_of_month}${ordinal(t.day_of_month)}`

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-4 ${!t.is_active ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.description}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
          <span>{freqLabel}</span>
          {cat && <><span className="text-slate-200 dark:text-slate-600">·</span><span>{cat.name}</span></>}
          {acc && <><span className="text-slate-200 dark:text-slate-600">·</span><span>{acc.name}</span></>}
        </div>
      </div>
      <span className={`text-sm font-bold shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onToggle} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title={t.is_active ? 'Pause' : 'Resume'}>
          {t.is_active ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
          <Edit size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
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
