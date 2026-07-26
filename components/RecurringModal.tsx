'use client'

import { useState } from 'react'
import { X, AlertCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useScrollLock } from '@/lib/useScrollLock'
import type { RecurringTransaction, Account, Category } from '@/lib/types'

interface Props {
  recurring?: RecurringTransaction | null
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSave: () => void
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function RecurringModal({ recurring, accounts, categories, onClose, onSave }: Props) {
  const now = new Date()
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(recurring?.type || 'expense')
  const [description, setDescription] = useState(recurring?.description || '')
  const [amount, setAmount] = useState(recurring?.amount?.toString() || '')
  const [accountId, setAccountId] = useState(recurring?.account_id || '')
  const [toAccountId, setToAccountId] = useState(recurring?.to_account_id || '')
  const [categoryId, setCategoryId] = useState(recurring?.category_id || '')
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>(recurring?.frequency || 'monthly')
  const [dayOfMonth, setDayOfMonth] = useState(recurring?.day_of_month?.toString() || '1')
  const [startMonth, setStartMonth] = useState(recurring?.start_month?.toString() || String(now.getMonth() + 1))
  const [startYear, setStartYear] = useState(recurring?.start_year?.toString() || String(now.getFullYear()))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useScrollLock()

  const isTransfer = type === 'transfer'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedAmount = parseFloat(amount)
    if (!description.trim()) return setError('Please enter a description.')
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) return setError('Please enter a valid amount.')
    const day = parseInt(dayOfMonth)
    if (isNaN(day) || day < 1 || day > 31) return setError('Day must be between 1 and 31.')
    if (isTransfer) {
      if (!accountId) return setError('Please select a From account.')
      if (!toAccountId) return setError('Please select a To account.')
      if (accountId === toAccountId) return setError('From and To accounts must be different.')
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      type,
      description: description.trim(),
      amount: parsedAmount,
      account_id: accountId || null,
      to_account_id: isTransfer ? (toAccountId || null) : null,
      category_id: isTransfer ? null : (categoryId || null),
      frequency,
      day_of_month: day,
      start_month: parseInt(startMonth),
      start_year: parseInt(startYear),
    }

    let err
    if (recurring) {
      ;({ error: err } = await supabase.from('recurring_transactions').update(payload).eq('id', recurring.id))
    } else {
      ;({ error: err } = await supabase.from('recurring_transactions').insert({ ...payload, is_active: true }))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {recurring ? 'Edit Recurring' : 'Add Recurring'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Auto-generates transactions each period</p>
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

          {/* Type toggle */}
          <div>
            <label className={labelClass}>Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['income', 'expense', 'transfer'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer ${
                    type === t
                      ? t === 'income'
                        ? 'bg-green-100 text-green-700 border-2 border-green-400'
                        : t === 'expense'
                        ? 'bg-red-100 text-red-700 border-2 border-red-400'
                        : 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} required autoFocus className={inputClass} placeholder={isTransfer ? 'e.g. Savings transfer, Credit card payment' : 'e.g. Netflix, Salary, Gym'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                <input type="number" step="0.01" min="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as 'monthly' | 'yearly')} className={inputClass}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Day of month (1–31)</label>
            <input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} required className={inputClass} />
            <p className="text-xs text-slate-400 mt-1">Past a month&apos;s length rolls to its last day (31 → 28 in Feb).</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start month</label>
              <select value={startMonth} onChange={e => setStartMonth(e.target.value)} className={inputClass}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Start year</label>
              <select value={startYear} onChange={e => setStartYear(e.target.value)} className={inputClass}>
                {Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {isTransfer ? (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>From account</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} required className={inputClass}>
                  <option value="">Select account</option>
                  {accounts.filter(a => a.id !== toAccountId).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-px w-12 bg-slate-200 dark:bg-slate-600" />
                  <ArrowRight size={14} className="text-slate-400" />
                  <div className="h-px w-12 bg-slate-200 dark:bg-slate-600" />
                </div>
              </div>
              <div>
                <label className={labelClass}>To account</label>
                <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} required className={inputClass}>
                  <option value="">Select account</option>
                  {accounts.filter(a => a.id !== accountId).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400">Both account balances will update automatically each period.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Account <span className="text-slate-400 font-normal">(opt.)</span></label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputClass}>
                  <option value="">No account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Category <span className="text-slate-400 font-normal">(opt.)</span></label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer">
              {loading ? 'Saving...' : recurring ? 'Save changes' : 'Add recurring'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
