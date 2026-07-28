'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACCOUNT_COLORS } from '@/lib/utils'
import { useScrollLock } from '@/lib/useScrollLock'
import type { Category, CategoryType } from '@/lib/types'

interface Props {
  category?: Category | null
  onClose: () => void
  onSave: () => void
}

const CATEGORY_TYPES: { value: CategoryType; label: string; hint: string; accent: string }[] = [
  {
    value: 'expense',
    label: 'Money out',
    hint: 'Spending. Anything paid back to you reduces what this category cost.',
    accent: 'bg-red-100 text-red-700 border-red-400',
  },
  {
    value: 'income',
    label: 'Money in',
    hint: 'Earnings — salary, dividends, revenue. Never cancelled against spending.',
    accent: 'bg-green-100 text-green-700 border-green-400',
  },
  {
    value: 'both',
    label: 'Both',
    hint: 'Earns and costs, like a side project. The two sides stay separate.',
    accent: 'bg-indigo-100 text-indigo-700 border-indigo-400',
  },
]

export default function CategoryModal({ category, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: category?.name || '',
    color: category?.color || '#6366f1',
    type: category?.type || 'expense' as CategoryType,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useScrollLock()

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) return setError('Category name is required.')

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      color: form.color,
      type: form.type,
    }

    let error
    if (category) {
      ;({ error } = await supabase.from('categories').update(payload).eq('id', category.id))
    } else {
      ;({ error } = await supabase.from('categories').insert(payload))
    }

    if (error) {
      setError(error.message)
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {category ? 'Edit Category' : 'Add Category'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Category name</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} required className={inputClass} placeholder="e.g. Groceries" />
          </div>

          {/* The choice changes how totals are calculated, so it stays an
              explicit three-way choice with the reasoning attached — but as a
              segmented control (matching the transaction modal) rather than
              three stacked cards, which made the dialog taller than the screen
              and pushed the buttons out of reach. Only the selected option's
              hint shows; the worked example below covers all three. */}
          <div>
            <label className={labelClass}>What is this category for?</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => update('type', t.value)}
                  className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors cursor-pointer ${
                    form.type === t.value
                      ? t.accent
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Fixed height: the hints differ in length, and a reflow here would
                shift everything below it as you compare the options. */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug min-h-[2rem]">
              {CATEGORY_TYPES.find(t => t.value === form.type)?.hint}
            </p>
            <p className="text-xs text-slate-400 leading-snug">
              Example: a £100 shop with £40 paid back shows as £60 spent under <strong>Money out</strong>.
              Under <strong>Money in</strong> or <strong>Both</strong> it would show £100 spent and £40 earned.
            </p>
          </div>

          <div>
            <label className={labelClass}>Colour</label>
            {/* A grid, not flex-wrap: twelve swatches wrapped to eleven plus a
                lone orphan on the second row. */}
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 justify-items-center">
              {ACCOUNT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Colour ${color}`}
                  onClick={() => update('color', color)}
                  style={{ backgroundColor: color }}
                  className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full transition-transform hover:scale-110 cursor-pointer ${
                    form.color === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800 scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer">
              {loading ? 'Saving...' : category ? 'Save changes' : 'Add category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
