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

const CATEGORY_TYPES: { value: CategoryType; label: string; hint: string; accent: string; dot: string }[] = [
  {
    value: 'expense',
    label: 'Money out',
    hint: 'Spending. Anything paid back to you reduces what this category cost.',
    accent: 'bg-red-50 dark:bg-red-900/20 border-red-400',
    dot: 'bg-red-500 border-red-500',
  },
  {
    value: 'income',
    label: 'Money in',
    hint: 'Earnings — salary, dividends, revenue. Never cancelled against spending.',
    accent: 'bg-green-50 dark:bg-green-900/20 border-green-400',
    dot: 'bg-green-500 border-green-500',
  },
  {
    value: 'both',
    label: 'Both',
    hint: 'Earns and costs, like a side project. The two sides stay separate.',
    accent: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400',
    dot: 'bg-indigo-500 border-indigo-500',
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm max-h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {category ? 'Edit Category' : 'Add Category'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
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

          {/* All three explained at once — the choice changes how totals are
              calculated, so it shouldn't be something you can skip past. */}
          <div>
            <label className={labelClass}>What is this category for?</label>
            <div className="space-y-2">
              {CATEGORY_TYPES.map(t => {
                const selected = form.type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update('type', t.value)}
                    className={`w-full text-left rounded-lg border-2 px-3 py-2.5 transition-colors cursor-pointer ${
                      selected
                        ? t.accent
                        : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${selected ? t.dot : 'border-slate-300 dark:border-slate-500'}`} />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{t.label}</span>
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 pl-[22px] leading-snug">
                      {t.hint}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-snug">
              Example: a £100 shop with £40 paid back shows as £60 spent under <strong>Money out</strong>.
              Under <strong>Money in</strong> or <strong>Both</strong> it would show £100 spent and £40 earned.
            </p>
          </div>

          <div>
            <label className={labelClass}>Colour</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update('color', color)}
                  style={{ backgroundColor: color }}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 cursor-pointer ${
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
