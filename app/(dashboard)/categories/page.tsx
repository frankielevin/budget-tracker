'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react'
import CategoryModal from '@/components/CategoryModal'
import { formatCurrency } from '@/lib/utils'
import { miscategorisedReason } from '@/lib/categoryTotals'
import type { Category, CategoryType } from '@/lib/types'

const TYPE_BADGE: Record<CategoryType, { label: string; className: string }> = {
  expense: { label: 'Money out', className: 'bg-red-50 dark:bg-red-900/25 text-red-500 dark:text-red-400' },
  income: { label: 'Money in', className: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  both: { label: 'Both', className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetByCategory, setBudgetByCategory] = useState<Record<string, number>>({})
  const [recurringIncome, setRecurringIncome] = useState<Record<string, number>>({})
  const [recentTotals, setRecentTotals] = useState<Record<string, { income: number; expense: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()

    // Three months back, from the 1st — enough to see a pattern without
    // letting one odd month dominate.
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`

    const [{ data: c }, { data: b }, { data: r }, { data: t }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      // Budgets cascade-delete with their category, so we need to know which
      // categories carry one in order to warn before deleting.
      supabase.from('budgets').select('category_id, amount'),
      // Recurring income aimed at a category — the strongest sign it earns.
      supabase.from('recurring_transactions').select('category_id, amount, frequency').eq('type', 'income').eq('is_active', true),
      supabase.from('transactions').select('category_id, amount, type').in('type', ['expense', 'income']).eq('pending', false).gte('date', fromStr),
    ])

    setCategories(c || [])
    setBudgetByCategory(
      Object.fromEntries((b || []).map(x => [x.category_id, Number(x.amount)]))
    )

    const recurring: Record<string, number> = {}
    for (const row of r || []) {
      if (!row.category_id) continue
      const monthly = row.frequency === 'yearly' ? Number(row.amount) / 12 : Number(row.amount)
      recurring[row.category_id] = (recurring[row.category_id] || 0) + monthly
    }
    setRecurringIncome(recurring)

    const recent: Record<string, { income: number; expense: number }> = {}
    for (const row of t || []) {
      if (!row.category_id) continue
      if (!recent[row.category_id]) recent[row.category_id] = { income: 0, expense: 0 }
      if (row.type === 'income') recent[row.category_id].income += Number(row.amount)
      else recent[row.category_id].expense += Number(row.amount)
    }
    setRecentTotals(recent)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('categories').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  /** Why this category's type looks wrong, if it does. */
  function reviewReason(cat: Category): string | null {
    return miscategorisedReason({
      type: cat.type,
      recurringIncomePerMonth: recurringIncome[cat.id],
      recentIncome: recentTotals[cat.id]?.income,
      recentExpense: recentTotals[cat.id]?.expense,
      formatAmount: formatCurrency,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const needsReview = categories.filter(c => reviewReason(c)).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Categories</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{categories.length} categories</p>
        </div>
        <button
          onClick={() => { setEditingCategory(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add category
        </button>
      </div>

      {needsReview > 0 && (
        <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-5">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-400">
            <p className="font-medium">
              {needsReview} categor{needsReview === 1 ? 'y looks' : 'ies look'} mistyped
            </p>
            <p className="text-xs mt-0.5 leading-snug">
              Money arriving in a &ldquo;Money out&rdquo; category is treated as someone paying you back, so it
              cancels out spending. If it&rsquo;s actually income, your totals are understating it.
            </p>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">No categories yet. Add your first one!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={`bg-white dark:bg-slate-800 border rounded-xl p-4 hover:shadow-sm transition-shadow ${
                reviewReason(cat) ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: cat.color + '20' }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{cat.name}</span>
                  {/* Every category is labelled, including the default — an
                      unlabelled tile reads as "not set" rather than "money out". */}
                  <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-medium align-middle ${TYPE_BADGE[cat.type || 'expense'].className}`}>
                    {TYPE_BADGE[cat.type || 'expense'].label}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditingCategory(cat); setShowModal(true) }}
                  className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => setDeleteId(cat.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {reviewReason(cat) && (
              <button
                onClick={() => { setEditingCategory(cat); setShowModal(true) }}
                className="mt-3 w-full text-left flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
              >
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                  {reviewReason(cat)}
                  <span className="block font-medium mt-1">
                    Marked &ldquo;Money out&rdquo;, so that money is cancelling out spending. Tap to review.
                  </span>
                </span>
              </button>
            )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete category?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Transactions using this category will become uncategorised.</p>
            {budgetByCategory[deleteId] !== undefined && (
              <p className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-lg p-3 text-sm mb-5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  The {formatCurrency(budgetByCategory[deleteId])}/month budget on this category
                  will be deleted too.
                </span>
              </p>
            )}
            {budgetByCategory[deleteId] === undefined && <div className="mb-5" />}
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
