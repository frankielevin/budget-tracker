'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'
import { Plus, Edit, Trash2, Search, Download, Repeat } from 'lucide-react'
import TransactionModal from '@/components/TransactionModal'
import { generateRecurringTransactions } from '@/lib/recurring'
import type { Transaction, Account, Category } from '@/lib/types'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterAccount, setFilterAccount] = useState('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: a }, { data: c }] = await Promise.all([
      supabase.from('transactions').select('*, account:accounts!account_id(*), to_account:accounts!to_account_id(*), category:categories(*)').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ])
    setTransactions(t || [])
    setAccounts(a || [])
    setCategories(c || [])
    setLoading(false)
  }

  useEffect(() => {
    generateRecurringTransactions().then(() => load())
  }, [])

  async function handleDelete(id: string) {
    const supabase = createClient()

    const tx = transactions.find(t => t.id === id)
    if (tx?.type === 'transfer' && tx.account_id && tx.to_account_id) {
      const getBalance = async (accountId: string) => {
        const { data } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
        return data?.balance ?? 0
      }
      const [fromBal, toBal] = await Promise.all([getBalance(tx.account_id), getBalance(tx.to_account_id)])
      await Promise.all([
        supabase.from('accounts').update({ balance: fromBal + tx.amount }).eq('id', tx.account_id),
        supabase.from('accounts').update({ balance: toBal - tx.amount }).eq('id', tx.to_account_id),
      ])
    }

    await supabase.from('transactions').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false
    if (filterAccount !== 'all' && t.account_id !== filterAccount) return false
    if (filterMonth !== 'all') {
      const [y, m] = filterMonth.split('-').map(Number)
      const d = new Date(t.date + 'T00:00:00')
      if (d.getFullYear() !== y || d.getMonth() !== m) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!t.description.toLowerCase().includes(q) && !(t.notes || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const grouped: Record<string, Transaction[]> = {}
  for (const t of filtered) {
    const d = new Date(t.date + 'T00:00:00')
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  }

  const availableMonths = Array.from(new Set(transactions.map(t => {
    const d = new Date(t.date + 'T00:00:00')
    return `${d.getFullYear()}-${d.getMonth()}`
  }))).sort((a, b) => b.localeCompare(a))

  function exportCSV() {
    const headers = ['Date', 'Description', 'Type', 'Amount (£)', 'Category', 'Account', 'Notes']
    const rows = filtered.map(t => {
      const cat = t.category as Category | undefined
      const acc = t.account as Account | undefined
      return [
        t.date,
        t.description,
        t.type,
        t.amount.toFixed(2),
        cat?.name || '',
        acc?.name || '',
        t.notes || '',
      ].map(val => `"${String(val).replace(/"/g, '""')}"`)
    })
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const selectClass = 'border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{transactions.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => { setEditingTx(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white dark:placeholder-slate-400"
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectClass}>
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selectClass}>
            <option value="all">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className={selectClass}>
            <option value="all">All accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All months</option>
            {availableMonths.map(key => {
              const [y, m] = key.split('-').map(Number)
              return <option key={key} value={key}>{MONTHS[m]} {y}</option>
            })}
          </select>
        </div>
      </div>

      {/* Transactions list */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">
            {transactions.length === 0 ? 'No transactions yet. Add your first one!' : 'No transactions match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([key, txns]) => {
            const [y, m] = key.split('-').map(Number)
            const groupIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
            const groupExpenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{MONTHS[m]} {y}</h3>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-600 font-medium">+{formatCurrency(groupIncome)}</span>
                    <span className="text-red-500 font-medium">-{formatCurrency(groupExpenses)}</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {txns.map((t, i) => {
                    const cat = t.category as Category | undefined
                    const acc = t.account as Account | undefined
                    const toAcc = t.to_account as Account | undefined
                    const isTransfer = t.type === 'transfer'
                    const dotColor = isTransfer ? '#3b82f6' : (cat?.color || '#6b7280')
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${i < txns.length - 1 ? 'border-b border-slate-100 dark:border-slate-700/50' : ''}`}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: dotColor + '20' }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.description}</p>
                            {t.recurring_id && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded text-xs font-medium shrink-0">
                                <Repeat size={10} />
                                Auto
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{formatDate(t.date)}</span>
                            {isTransfer && acc && toAcc && (
                              <>
                                <span className="text-slate-200 dark:text-slate-600">·</span>
                                <span className="text-xs text-slate-400">{acc.name} → {toAcc.name}</span>
                              </>
                            )}
                            {!isTransfer && cat && (
                              <>
                                <span className="text-slate-200 dark:text-slate-600">·</span>
                                <span className="text-xs text-slate-400">{cat.name}</span>
                              </>
                            )}
                            {!isTransfer && acc && (
                              <>
                                <span className="text-slate-200 dark:text-slate-600">·</span>
                                <span className="text-xs text-slate-400">{acc.name}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <span className={`text-sm font-bold shrink-0 ${
                          t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-500' : 'text-blue-500'
                        }`}>
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingTx(t); setShowModal(true) }}
                            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(t.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <TransactionModal
          transaction={editingTx}
          accounts={accounts}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete transaction?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
