'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useScrollLock } from '@/lib/useScrollLock'
import type { Budget, Category } from '@/lib/types'

interface Props {
  budget?: Budget | null
  categories: Category[]
  takenCategoryIds: string[]
  onClose: () => void
  onSave: () => void
}

export default function BudgetModal({ budget, categories, takenCategoryIds, onClose, onSave }: Props) {
  const [categoryId, setCategoryId] = useState(budget?.category_id || '')
  const [amount, setAmount] = useState(budget?.amount?.toString() || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useScrollLock()

  const availableCategories = categories.filter(
    c => c.id === budget?.category_id || !takenCategoryIds.includes(c.id)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!categoryId) return setError('Please select a category.')
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) return setError('Please enter a valid amount.')

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let err
    if (budget) {
      ;({ error: err } = await supabase.from('budgets').update({ amount: parsed }).eq('id', budget.id))
    } else {
      ;({ error: err } = await supabase.from('budgets').insert({
        user_id: user.id,
        category_id: categoryId,
        amount: parsed,
      }))
    }

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      onSave()
    }
  }

  const inputClass = 'w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white dark:bg-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400'
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1'

  return (
    <div className="modal-overlay">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {budget ? 'Edit Budget' : 'Add Budget'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Applies every month automatically</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Category</label>
            {budget ? (
              <p className="text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5">
                {categories.find(c => c.id === budget.category_id)?.name || '—'}
              </p>
            ) : (
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className={inputClass}>
                <option value="">Select a category</option>
                {availableCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelClass}>Monthly limit</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
              <input type="number" step="0.01" min="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer">
              {loading ? 'Saving...' : budget ? 'Save changes' : 'Add budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
