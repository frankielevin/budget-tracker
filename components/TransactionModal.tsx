'use client'

import { useState } from 'react'
import { X, AlertCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { transactionDeltas, mergeDeltas, negateDeltas, applyBalanceDeltas, isPendingDate } from '@/lib/balances'
import { useScrollLock } from '@/lib/useScrollLock'
import type { Transaction, Account, Category, TransactionType } from '@/lib/types'

interface Props {
  transaction?: Transaction | null
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSave: () => void
}

export default function TransactionModal({ transaction, accounts, categories, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    type: transaction?.type || 'expense',
    amount: transaction?.amount?.toString() || '',
    description: transaction?.description || '',
    date: transaction?.date || new Date().toISOString().split('T')[0],
    account_id: transaction?.account_id || '',
    to_account_id: transaction?.to_account_id || '',
    category_id: transaction?.category_id || '',
    notes: transaction?.notes || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Freeze the page behind the modal — only the modal itself can move.
  useScrollLock()

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const isTransfer = form.type === 'transfer'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) {
      return setError('Please enter a valid amount.')
    }
    if (!form.description.trim()) {
      return setError('Please enter a description.')
    }
    if (isTransfer) {
      if (!form.account_id) return setError('Please select a From account.')
      if (!form.to_account_id) return setError('Please select a To account.')
      if (form.account_id === form.to_account_id) return setError('From and To accounts must be different.')
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // A future-dated transaction is pending: shown but not yet applied to
    // balances until its date arrives.
    const pending = isPendingDate(form.date)

    const payload = {
      user_id: user.id,
      type: form.type,
      amount,
      description: form.description.trim(),
      date: form.date,
      account_id: form.account_id || null,
      to_account_id: isTransfer ? (form.to_account_id || null) : null,
      category_id: isTransfer ? null : (form.category_id || null),
      notes: form.notes.trim() || null,
      pending,
    }

    // The balance impact of the new version — but only if it's active now.
    // Pending transactions contribute nothing until they're activated.
    const newEffect = pending ? {} : transactionDeltas({
      type: form.type as TransactionType,
      amount,
      account_id: payload.account_id,
      to_account_id: payload.to_account_id,
    })

    let error
    if (transaction) {
      ;({ error } = await supabase.from('transactions').update(payload).eq('id', transaction.id))
      if (!error) {
        // Undo whatever the previous version had applied (nothing, if it was
        // pending), then apply the new effect.
        const oldEffect = transaction.pending ? {} : transactionDeltas(transaction)
        await applyBalanceDeltas(supabase, mergeDeltas(negateDeltas(oldEffect), newEffect))
      }
    } else {
      ;({ error } = await supabase.from('transactions').insert(payload))
      if (!error) await applyBalanceDeltas(supabase, newEffect)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      {/* Sized to the dynamic viewport so the whole form fits without the modal
          scrolling on a phone; overflow stays as a safety net for tiny screens. */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {transaction ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 -mr-1">
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
                  onClick={() => update('type', t)}
                  className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer ${
                    form.type === t
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

          {/* Amount + Date share a row to keep the form to one screen. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
                <input type="number" step="0.01" min="0.01" inputMode="decimal" value={form.amount} onChange={e => update('amount', e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={form.date} onChange={e => update('date', e.target.value)} required className={inputClass} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={form.description} onChange={e => update('description', e.target.value)} required className={inputClass} placeholder={isTransfer ? 'e.g. Credit card payment' : 'e.g. Grocery shopping'} />
          </div>

          {/* Transfer: From + To accounts */}
          {isTransfer ? (
            <div className="space-y-3">
              <div>
                <label className={labelClass}>From account</label>
                <select value={form.account_id} onChange={e => update('account_id', e.target.value)} required className={inputClass}>
                  <option value="">Select account</option>
                  {accounts.filter(a => a.id !== form.to_account_id).map(a => (
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
                <select value={form.to_account_id} onChange={e => update('to_account_id', e.target.value)} required className={inputClass}>
                  <option value="">Select account</option>
                  {accounts.filter(a => a.id !== form.account_id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400">Both account balances will update automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Account</label>
                <select value={form.account_id} onChange={e => update('account_id', e.target.value)} className={inputClass}>
                  <option value="">No account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select value={form.category_id} onChange={e => update('category_id', e.target.value)} className={inputClass}>
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Anything worth remembering about this one"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer">
              {loading ? 'Saving...' : transaction ? 'Save changes' : 'Add transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
