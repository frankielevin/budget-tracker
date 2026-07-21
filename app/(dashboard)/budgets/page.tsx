'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { Plus, Edit, Trash2 } from 'lucide-react'
import BudgetModal from '@/components/BudgetModal'
import { spentByCategory as netSpentByCategory, categoryTypeLookup } from '@/lib/categoryTotals'
import type { Budget, Category } from '@/lib/types'

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  async function load() {
    const supabase = createClient()

    const [{ data: b }, { data: c }, { data: t }] = await Promise.all([
      supabase.from('budgets').select('*, category:categories(*)'),
      supabase.from('categories').select('*').order('name'),
      // Income is pulled in alongside expenses so a reimbursed purchase doesn't
      // eat the budget. Pending (future-dated) rows are excluded — not spent yet.
      supabase.from('transactions').select('category_id, amount, date, type').in('type', ['expense', 'income']).eq('pending', false),
    ])

    setBudgets(b || [])
    setCategories(c || [])

    const inPeriod = (t || []).filter(tx => {
      const d = new Date(tx.date + 'T00:00:00')
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    })
    // This query selects transaction columns only, so category types are
    // supplied separately rather than coming through a join.
    setSpentByCategory(netSpentByCategory(inPeriod, categoryTypeLookup(c || [])))
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedMonth, selectedYear])

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('budgets').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + (spentByCategory[b.category_id] || 0), 0)
  const totalRemaining = totalBudgeted - totalSpent

  const takenCategoryIds = budgets.map(b => b.category_id)
  const unbudgetedCount = categories.filter(c => !takenCategoryIds.includes(c.id)).length

  const dateSelectClass = 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer'

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Budgets</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {budgets.length} budget{budgets.length !== 1 ? 's' : ''} — checking progress for {MONTHS[selectedMonth]} {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className={dateSelectClass}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className={dateSelectClass}>
            {Array.from({ length: 41 }, (_, i) => 2026 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {unbudgetedCount > 0 && (
            <button
              onClick={() => { setEditingBudget(null); setShowModal(true) }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Add budget
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Total Budgeted</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalBudgeted)}</p>
            <p className="text-xs text-slate-400 mt-1">per month</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Spent in {MONTHS[selectedMonth]}</p>
            <p className={`text-2xl font-bold ${totalSpent > totalBudgeted ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
              {formatCurrency(totalSpent)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(0) : 0}% of budget</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Remaining</p>
            <p className={`text-2xl font-bold ${totalRemaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totalRemaining))}
            </p>
            <p className="text-xs text-slate-400 mt-1">{totalRemaining < 0 ? 'over budget' : 'left to spend'}</p>
          </div>
        </div>
      )}

      {/* Budget list */}
      {budgets.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus size={20} className="text-indigo-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">No budgets set yet</p>
          <p className="text-slate-400 text-sm mb-4">Add a budget once and it applies every month automatically.</p>
          <button
            onClick={() => { setEditingBudget(null); setShowModal(true) }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            Add your first budget
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(budget => {
            const cat = budget.category as Category | undefined
            const spent = spentByCategory[budget.category_id] || 0
            const pct = Math.min((spent / budget.amount) * 100, 100)
            const isOver = spent > budget.amount
            const isWarning = !isOver && pct >= 75
            const remaining = budget.amount - spent

            const barColor = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-green-500'
            const remainingColor = isOver ? 'text-red-500' : 'text-green-600'

            return (
              <div key={budget.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (cat?.color || '#6b7280') + '20' }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat?.color || '#6b7280' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{cat?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(spent)} spent of {formatCurrency(budget.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${remainingColor}`}>
                        {isOver
                          ? `${formatCurrency(Math.abs(remaining))} over`
                          : `${formatCurrency(remaining)} left`}
                      </p>
                      <p className="text-xs text-slate-400">{pct.toFixed(0)}% used</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingBudget(budget); setShowModal(true) }}
                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(budget.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <BudgetModal
          budget={editingBudget}
          categories={categories}
          takenCategoryIds={takenCategoryIds}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete budget?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">Your transactions won&apos;t be affected.</p>
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
