'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'
import { Plus, Edit, Trash2, Search, Download, Repeat, Clock } from 'lucide-react'
import TransactionModal from '@/components/TransactionModal'
import { syncTransactions } from '@/lib/recurring'
import { transactionDeltas, negateDeltas, applyBalanceDeltas } from '@/lib/balances'
import { netTotals } from '@/lib/categoryTotals'
import type { Transaction, Account, Category } from '@/lib/types'

/** Month-section key for a date: `YYYY-M` with a 0-indexed month. */
function monthKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${d.getMonth()}`
}

const now = new Date()
const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`

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
  // Default to the current month — the page opens on what you're spending now,
  // not on your entire history.
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthKey)

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: a }, { data: c }] = await Promise.all([
      // Descending so the most recent activity sits at the top of each month
      // section. Upcoming (pending) rows are moved to the end of their section
      // when the groups are built below.
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
    syncTransactions().then(() => load())
  }, [])

  async function handleDelete(id: string) {
    const supabase = createClient()

    const tx = transactions.find(t => t.id === id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    // Deleting undoes whatever it did to account balances. A pending
    // transaction never touched any balance, so there's nothing to undo.
    if (!error && tx && !tx.pending) await applyBalanceDeltas(supabase, negateDeltas(transactionDeltas(tx)))

    setDeleteId(null)
    load()
  }

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false
    // Match either side of a transfer, so filtering by an account also shows
    // money moving *into* it.
    if (filterAccount !== 'all' && t.account_id !== filterAccount && t.to_account_id !== filterAccount) return false
    if (filterMonth !== 'all' && monthKey(t.date) !== filterMonth) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.description.toLowerCase().includes(q) && !(t.notes || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const grouped: Record<string, Transaction[]> = {}
  for (const t of filtered) {
    const key = monthKey(t.date)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  }
  // `filtered` is newest-first. Within each month show settled rows that way,
  // then park upcoming (pending) rows at the end, soonest first — they haven't
  // happened yet, so they shouldn't head the list.
  for (const key of Object.keys(grouped)) {
    const rows = grouped[key]
    grouped[key] = [
      ...rows.filter(t => !t.pending),
      ...rows.filter(t => t.pending).reverse(),
    ]
  }

  // Always offer the current month, even before anything is recorded in it —
  // it's the default selection, so it must exist as an option.
  const availableMonths = Array.from(
    new Set([currentMonthKey, ...transactions.map(t => monthKey(t.date))])
  ).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number)
    const [by, bm] = b.split('-').map(Number)
    return by - ay || bm - am
  })

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {filtered.length === transactions.length
              ? `${transactions.length} total`
              : `${filtered.length} shown of ${transactions.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            <Download size={16} />
            <span>Export<span className="hidden sm:inline"> CSV</span></span>
          </button>
          <button
            onClick={() => { setEditingTx(null); setShowModal(true) }}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span className="whitespace-nowrap">Add<span className="hidden sm:inline"> transaction</span></span>
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
          {Object.entries(grouped).sort(([a], [b]) => {
            // Newest month section first. Compare numerically — the keys use an
            // un-padded 0-indexed month, so a string compare would mis-order.
            const [ay, am] = a.split('-').map(Number)
            const [by, bm] = b.split('-').map(Number)
            return by - ay || bm - am
          }).map(([key, txns]) => {
            const [y, m] = key.split('-').map(Number)
            // Pending (future) transactions haven't happened yet, so they don't
            // count. Totals are netted per category to match the rest of the
            // app, so a reimbursed purchase isn't counted on both sides — which
            // is why these won't equal a raw sum of the rows below.
            const { income: groupIncome, expenses: groupExpenses } = netTotals(txns.filter(t => !t.pending))

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
                    const isPending = t.pending

                    // One truncating meta line instead of separate spans with
                    // dot separators — on a narrow screen those wrapped mid-date
                    // ("25 Jul" / "2026") and clustered. Joining lets it ellipsis.
                    const metaParts: string[] = [formatDate(t.date)]
                    if (isTransfer && acc && toAcc) metaParts.push(`${acc.name} → ${toAcc.name}`)
                    else {
                      if (cat) metaParts.push(cat.name)
                      if (acc) metaParts.push(acc.name)
                    }

                    return (
                      <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${i < txns.length - 1 ? 'border-b border-slate-100 dark:border-slate-700/50' : ''} ${isPending ? 'opacity-55' : ''}`}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: dotColor + '20' }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.description}</p>
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-xs font-medium shrink-0">
                                <Clock size={10} />
                                Pending
                              </span>
                            )}
                            {t.recurring_id && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded text-xs font-medium shrink-0">
                                <Repeat size={10} />
                                Auto
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{metaParts.join(' · ')}</p>
                        </div>

                        {/* Amount over actions in one narrow column, freeing width
                            for the text on the left. */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-sm font-bold whitespace-nowrap ${
                            t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-500' : 'text-blue-500'
                          }`}>
                            {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                          </span>
                          <div className="flex items-center gap-0.5 -mr-1.5">
                            <button
                              onClick={() => { setEditingTx(t); setShowModal(true) }}
                              aria-label="Edit transaction"
                              className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteId(t.id)}
                              aria-label="Delete transaction"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
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
