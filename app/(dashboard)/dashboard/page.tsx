'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import type { Transaction, Account, Category, Budget } from '@/lib/types'
import Link from 'next/link'

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: t }, { data: a }, { data: c }, { data: b }] = await Promise.all([
        supabase.from('transactions').select('*, account:accounts!account_id(*), to_account:accounts!to_account_id(*), category:categories(*)').order('date', { ascending: false }),
        supabase.from('accounts').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('budgets').select('*, category:categories(*)'),
      ])
      setTransactions(t || [])
      setAccounts(a || [])
      setCategories(c || [])
      setBudgets(b || [])
      setLoading(false)
    }
    load()
  }, [])

  const isYear = viewMode === 'year'

  const periodTxns = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    if (isYear) return d.getFullYear() === selectedYear
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  })

  const monthIncome = periodTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpenses = periodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0)
  const savings = monthIncome - monthExpenses

  const expenseTxns = periodTxns.filter(t => t.type === 'expense')
  const categoryMap: Record<string, { name: string; value: number; color: string }> = {}
  for (const t of expenseTxns) {
    const catId = t.category_id || 'uncategorized'
    const cat = t.category as Category | undefined
    const name = cat?.name || 'Uncategorised'
    const color = cat?.color || '#6b7280'
    if (!categoryMap[catId]) categoryMap[catId] = { name, value: 0, color }
    categoryMap[catId].value += t.amount
  }
  const pieData = Object.values(categoryMap).sort((a, b) => b.value - a.value)

  const barData = isYear
    ? Array.from({ length: 12 }, (_, i) => {
        const txns = transactions.filter(t => {
          const td = new Date(t.date + 'T00:00:00')
          return td.getMonth() === i && td.getFullYear() === selectedYear
        })
        return {
          month: MONTHS[i].slice(0, 3),
          income: txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expenses: txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        }
      })
    : Array.from({ length: 6 }, (_, i) => {
        const d = new Date(selectedYear, selectedMonth - 5 + i, 1)
        const m = d.getMonth()
        const y = d.getFullYear()
        const txns = transactions.filter(t => {
          const td = new Date(t.date + 'T00:00:00')
          return td.getMonth() === m && td.getFullYear() === y
        })
        return {
          month: MONTHS[m].slice(0, 3),
          income: txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expenses: txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        }
      })

  interface Insight {
    id: string
    type: 'danger' | 'warning' | 'success' | 'info'
    title: string
    detail: string
  }
  const insights: Insight[] = []

  if (!isYear) {
    const spentByCat: Record<string, number> = {}
    for (const t of periodTxns.filter(tx => tx.type === 'expense')) {
      if (t.category_id) spentByCat[t.category_id] = (spentByCat[t.category_id] || 0) + t.amount
    }

    const overBudget = budgets.filter(b => (spentByCat[b.category_id] || 0) > b.amount)
    const nearingLimit = budgets.filter(b => {
      const pct = (spentByCat[b.category_id] || 0) / b.amount
      return pct >= 0.75 && pct <= 1
    })

    if (overBudget.length === 1) {
      const b = overBudget[0]
      const cat = b.category as Category | undefined
      const spent = spentByCat[b.category_id] || 0
      insights.push({ id: 'over-1', type: 'danger', title: `Over budget on ${cat?.name}`, detail: `${formatCurrency(spent)} spent — ${formatCurrency(spent - b.amount)} over your ${formatCurrency(b.amount)} limit` })
    } else if (overBudget.length > 1) {
      insights.push({ id: 'over-multi', type: 'danger', title: `${overBudget.length} categories over budget`, detail: overBudget.map(b => (b.category as Category | undefined)?.name).filter(Boolean).join(', ') })
    }

    for (const b of nearingLimit.slice(0, 2)) {
      const cat = b.category as Category | undefined
      const spent = spentByCat[b.category_id] || 0
      const pct = Math.round(spent / b.amount * 100)
      insights.push({ id: `nearing-${b.id}`, type: 'warning', title: `${cat?.name} at ${pct}% of budget`, detail: `${formatCurrency(spent)} of ${formatCurrency(b.amount)} used` })
    }

    if (budgets.length > 0 && overBudget.length === 0 && nearingLimit.length === 0) {
      insights.push({ id: 'on-track', type: 'success', title: 'All budgets on track', detail: `${budgets.length} budget${budgets.length !== 1 ? 's' : ''} within limits this month` })
    }

    if (monthIncome > 0) {
      const rate = Math.round((monthIncome - monthExpenses) / monthIncome * 100)
      insights.push(rate >= 0
        ? { id: 'savings', type: 'info', title: `Saving ${rate}% of your income`, detail: `${formatCurrency(savings)} saved out of ${formatCurrency(monthIncome)} earned` }
        : { id: 'savings', type: 'warning', title: 'Spending more than you earn', detail: `${formatCurrency(Math.abs(savings))} more spent than earned this month` }
      )
    }

    if (pieData.length > 0) {
      const top = pieData[0]
      const pct = Math.round(top.value / monthExpenses * 100)
      insights.push({ id: 'top-cat', type: 'info', title: `${top.name} is your biggest expense`, detail: `${formatCurrency(top.value)} — ${pct}% of total spending` })
    }

    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear
    const prevExpenses = transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return d.getMonth() === prevMonth && d.getFullYear() === prevYear && t.type === 'expense' })
      .reduce((s, t) => s + t.amount, 0)
    if (prevExpenses > 0 && monthExpenses > 0) {
      const diff = monthExpenses - prevExpenses
      const pct = Math.abs(Math.round(diff / prevExpenses * 100))
      insights.push({ id: 'mom', type: diff > 0 ? 'warning' : 'success', title: diff > 0 ? `Spending up ${pct}% vs last month` : `Spending down ${pct}% vs last month`, detail: `${formatCurrency(monthExpenses)} this month vs ${formatCurrency(prevExpenses)} last month` })
    }
  }

  const sortedInsights = [
    ...insights.filter(i => i.type === 'danger'),
    ...insights.filter(i => i.type === 'warning'),
    ...insights.filter(i => i.type === 'success'),
    ...insights.filter(i => i.type === 'info'),
  ].slice(0, 4)

  const recentTxns = transactions.slice(0, 8)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const dateSelectClass = 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Your financial overview</p>
        </div>
        <div className="flex items-center gap-3">
          {!isYear && (
            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className={dateSelectClass}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          )}
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className={dateSelectClass}>
            {Array.from({ length: 41 }, (_, i) => 2026 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex items-center bg-indigo-100 dark:bg-indigo-900/40 rounded-lg p-1 gap-1 text-sm">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${viewMode === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200'}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${viewMode === 'year' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200'}`}
            >
              Year
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Net Worth" value={formatCurrency(netWorth)} icon={<Wallet size={20} />} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400" sub={`${accounts.length} account${accounts.length !== 1 ? 's' : ''}`} />
        <StatCard label={isYear ? 'Year Income' : 'Month Income'} value={formatCurrency(monthIncome)} icon={<TrendingUp size={20} />} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400" sub={`${periodTxns.filter(t => t.type === 'income').length} transactions`} valueColor="text-green-600" />
        <StatCard label={isYear ? 'Year Expenses' : 'Month Expenses'} value={formatCurrency(monthExpenses)} icon={<TrendingDown size={20} />} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-600 dark:text-red-400" sub={`${periodTxns.filter(t => t.type === 'expense').length} transactions`} valueColor="text-red-600" />
        <StatCard label={isYear ? 'Year Savings' : 'Month Savings'} value={formatCurrency(savings)} icon={savings >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />} iconBg={savings >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'} iconColor={savings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'} valueColor={savings >= 0 ? 'text-blue-600' : 'text-orange-600'} sub="Income minus expenses" />
      </div>

      {/* Insights */}
      {sortedInsights.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Insights</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sortedInsights.map(insight => {
              const styles = {
                danger: { card: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', title: 'text-red-800 dark:text-red-300', detail: 'text-red-600 dark:text-red-400', icon: <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" /> },
                warning: { card: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', title: 'text-amber-800 dark:text-amber-300', detail: 'text-amber-600 dark:text-amber-400', icon: <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" /> },
                success: { card: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', title: 'text-green-800 dark:text-green-300', detail: 'text-green-600 dark:text-green-400', icon: <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" /> },
                info: { card: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800', title: 'text-indigo-800 dark:text-indigo-300', detail: 'text-indigo-600 dark:text-indigo-400', icon: <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" /> },
              }[insight.type]
              return (
                <div key={insight.id} className={`border rounded-xl p-4 ${styles.card}`}>
                  <div className="flex items-start gap-2">
                    {styles.icon}
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-snug ${styles.title}`}>{insight.title}</p>
                      <p className={`text-xs mt-0.5 leading-snug ${styles.detail}`}>{insight.detail}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{isYear ? `Income vs Expenses — ${selectedYear}` : 'Income vs Expenses — Last 6 Months'}</h3>
          {barData.every(d => d.income === 0 && d.expenses === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Spending by Category — {isYear ? selectedYear : MONTHS[selectedMonth]}
          </h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No expense data this month</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {pieData.slice(0, 7).map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-600 dark:text-slate-300 truncate">{d.name}</span>
                    </div>
                    <span className="text-slate-900 dark:text-white font-medium shrink-0">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Accounts + Recent transactions */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Accounts</h3>
            <Link href="/accounts" className="text-xs text-indigo-600 hover:text-indigo-500">View all</Link>
          </div>
          {accounts.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              <p>No accounts yet.</p>
              <Link href="/accounts" className="text-indigo-500 hover:text-indigo-400 mt-1 inline-block">Add your first account</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.slice(0, 5).map(account => (
                <div key={account.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: account.color }}>
                      {account.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{account.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{account.type === 'checking' ? 'Current' : account.type}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${account.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Transactions</h3>
            <Link href="/transactions" className="text-xs text-indigo-600 hover:text-indigo-500">View all</Link>
          </div>
          {recentTxns.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              <p>No transactions yet.</p>
              <Link href="/transactions" className="text-indigo-500 hover:text-indigo-400 mt-1 inline-block">Add your first transaction</Link>
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentTxns.map(t => {
                const cat = t.category as Category | undefined
                return (
                  <div key={t.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (cat?.color || '#6b7280') + '20' }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat?.color || '#6b7280' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.description}</p>
                        <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ml-2 ${
                      t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon, iconBg, iconColor, sub, valueColor = 'text-slate-900 dark:text-white',
}: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
        <div className={`${iconBg} ${iconColor} p-2 rounded-lg`}>{icon}</div>
      </div>
      <p className={`text-xl font-bold ${valueColor} leading-none`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </div>
  )
}
