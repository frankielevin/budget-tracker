'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todayStr } from '@/lib/balances'
import { ACCOUNT_COLORS, formatCurrency } from '@/lib/utils'
import { useScrollLock } from '@/lib/useScrollLock'
import type { Account, AccountType } from '@/lib/types'

interface Props {
  account?: Account | null
  onClose: () => void
  onSave: () => void
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Current' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'joint', label: 'Joint' },
  { value: 'other', label: 'Other' },
]

export default function AccountModal({ account, onClose, onSave }: Props) {
  // The balance as it stood when the form opened. Used to tell "the user
  // retyped this" apart from "the user never touched it".
  const initialBalance = account?.balance?.toString() || '0'
  const [form, setForm] = useState({
    name: account?.name || '',
    type: account?.type || 'checking' as AccountType,
    balance: initialBalance,
    color: account?.color || '#6366f1',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useScrollLock()

  const balanceChanged = !!account && form.balance !== initialBalance
  const adjustment = balanceChanged ? (parseFloat(form.balance) || 0) - (account?.balance || 0) : 0
  // A credit account holding a positive balance is legitimate (you've overpaid)
  // but far more often it means the debt was typed without a minus sign.
  const suspiciousCreditSign = form.type === 'credit' && (parseFloat(form.balance) || 0) > 0

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) return setError('Account name is required.')

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      type: form.type,
      color: form.color,
    }

    let error
    if (account) {
      // Only write `balance` when it was actually edited. Balances are otherwise
      // derived from transactions, so blindly re-saving the value this form
      // opened with would clobber anything that moved in the meantime.
      ;({ error } = await supabase
        .from('accounts')
        .update(balanceChanged ? { ...payload, balance: parseFloat(form.balance) || 0 } : payload)
        .eq('id', account.id))

      // Record what the correction was, so the ledger still explains the
      // balance instead of silently disagreeing with it.
      if (!error && balanceChanged && adjustment !== 0) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: account.id,
          to_account_id: null,
          category_id: null,
          type: adjustment > 0 ? 'income' : 'expense',
          amount: Math.abs(adjustment),
          description: 'Balance adjustment',
          date: todayStr(),
          notes: `Manual correction from ${account.balance.toFixed(2)} to ${(parseFloat(form.balance) || 0).toFixed(2)}`,
          pending: false,
        })
      }
    } else {
      // A new account's balance is its opening position — nothing to reconcile.
      ;({ error } = await supabase.from('accounts').insert({ ...payload, balance: parseFloat(form.balance) || 0 }))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:pl-60 bg-black/60">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {account ? 'Edit Account' : 'Add Account'}
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
            <label className={labelClass}>Account name</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} required className={inputClass} placeholder="e.g. Main Checking" />
          </div>

          <div>
            <label className={labelClass}>Account type</label>
            <select value={form.type} onChange={e => update('type', e.target.value)} className={inputClass}>
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{account ? 'Current balance' : 'Opening balance'}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
              <input type="number" step="0.01" value={form.balance} onChange={e => update('balance', e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Enter negative value for credit card debt</p>

            {suspiciousCreditSign && (
              <p className="text-xs text-amber-600 mt-1.5">
                This is a credit card with a positive balance, which counts towards your net worth.
                If you owe {formatCurrency(Math.abs(parseFloat(form.balance) || 0))}, enter it as a negative.
              </p>
            )}

            {balanceChanged && adjustment !== 0 && (
              <p className="text-xs text-indigo-600 mt-1.5">
                Balances normally come from your transactions. Saving this will record a
                &ldquo;Balance adjustment&rdquo; of {adjustment > 0 ? '+' : '−'}{formatCurrency(Math.abs(adjustment))} dated
                today, so your transaction history still adds up.
              </p>
            )}
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
              {loading ? 'Saving...' : account ? 'Save changes' : 'Add account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
