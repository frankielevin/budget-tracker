'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACCOUNT_COLORS } from '@/lib/utils'
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
  const [form, setForm] = useState({
    name: account?.name || '',
    type: account?.type || 'checking' as AccountType,
    balance: account?.balance?.toString() || '0',
    color: account?.color || '#6366f1',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      balance: parseFloat(form.balance) || 0,
      color: form.color,
    }

    let error
    if (account) {
      ;({ error } = await supabase.from('accounts').update(payload).eq('id', account.id))
    } else {
      ;({ error } = await supabase.from('accounts').insert(payload))
    }

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      onSave()
    }
  }

  const inputClass = 'w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white dark:bg-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400'
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {account ? 'Edit Account' : 'Add Account'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <label className={labelClass}>Current balance</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">£</span>
              <input type="number" step="0.01" value={form.balance} onChange={e => update('balance', e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Enter negative value for credit card debt</p>
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
