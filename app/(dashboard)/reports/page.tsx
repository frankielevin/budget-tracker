'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, MONTHS } from '@/lib/utils'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'
import type { Transaction, Account } from '@/lib/types'
import { netTotals, spendingBreakdown, incomeBreakdown } from '@/lib/categoryTotals'

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
  const isYear = viewMode === 'year'

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: t }, { data: a }] = await Promise.all([
        // Pending (future-dated) transactions haven't happened yet, so reports ignore them.
        supabase.from('transactions').select('*, account:accounts!account_id(*), to_account:accounts!to_account_id(*), category:categories(*)').eq('pending', false).order('date', { ascending: true }),
        supabase.from('accounts').select('*'),
      ])
      setTransactions(t || [])
      setAccounts(a || [])
      setLoading(false)
    }
    load()
  }, [])

  const monthTxns = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    if (isYear) return d.getFullYear() === selectedYear
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  })

  // Every figure below nets income against expenses within each category, so a
  // reimbursed purchase doesn't count as both spending and earnings.
  const pieData = spendingBreakdown(monthTxns)
  const incomePieData = incomeBreakdown(monthTxns)

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(selectedYear, selectedMonth - 11 + i, 1)
    const m = d.getMonth()
    const y = d.getFullYear()
    const txns = transactions.filter(t => {
      const td = new Date(t.date + 'T00:00:00')
      return td.getMonth() === m && td.getFullYear() === y
    })
    return { month: MONTHS[m].slice(0, 3) + " '" + String(y).slice(2), ...netTotals(txns) }
  })

  const baseNetWorth = accounts.reduce((s, a) => s + a.balance, 0)

  // Earliest transaction on record. Months before this are genuine unknowns —
  // account balances only tell us where things stand *now*.
  const firstTxDate = transactions.reduce<string | null>(
    (min, t) => (min === null || t.date < min ? t.date : min), null
  )

  const netWorthData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(selectedYear, selectedMonth - 11 + i, 1)
    const m = d.getMonth()
    const y = d.getFullYear()
    const label = MONTHS[m].slice(0, 3) + " '" + String(y).slice(2)
    const monthEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`

    // Leave a gap rather than projecting today's balance back into months we
    // have no record of — a flat line there reads as "stable", not "unknown".
    if (!firstTxDate || monthEnd < firstTxDate) return { month: label, value: null }

    // Net worth at this month's end = today's total, minus everything that has
    // happened since. Derived from the full transaction set rather than just
    // the visible window, so it stays correct for any selected month.
    //
    // Raw amounts are fine here: netting only moves an equal sum off both the
    // income and expense side, so the difference this relies on is identical.
    let since = 0
    for (const t of transactions) {
      if (t.date <= monthEnd) continue
      if (t.type === 'income') since += t.amount
      else if (t.type === 'expense') since -= t.amount
    }
    return { month: label, value: baseNetWorth - since }
  })

  const yoyData = Array.from({ length: 12 }, (_, i) => {
    const m = i
    const getTotals = (y: number) => netTotals(
      transactions.filter(t => { const td = new Date(t.date + 'T00:00:00'); return td.getMonth() === m && td.getFullYear() === y })
    )
    const cur = getTotals(selectedYear)
    const prev = getTotals(selectedYear - 1)
    return {
      month: MONTHS[m].slice(0, 3),
      [`${selectedYear} Income`]: cur.income,
      [`${selectedYear} Expenses`]: cur.expenses,
      [`${selectedYear - 1} Income`]: prev.income,
      [`${selectedYear - 1} Expenses`]: prev.expenses,
    }
  })

  const yoyHasData = yoyData.some(d =>
    (d[`${selectedYear} Income`] as number) > 0 || (d[`${selectedYear} Expenses`] as number) > 0 ||
    (d[`${selectedYear - 1} Income`] as number) > 0 || (d[`${selectedYear - 1} Expenses`] as number) > 0
  )

  const yoyCurIncome = yoyData.reduce((s, d) => s + (d[`${selectedYear} Income`] as number), 0)
  const yoyCurExpenses = yoyData.reduce((s, d) => s + (d[`${selectedYear} Expenses`] as number), 0)
  const yoyPrevIncome = yoyData.reduce((s, d) => s + (d[`${selectedYear - 1} Income`] as number), 0)
  const yoyPrevExpenses = yoyData.reduce((s, d) => s + (d[`${selectedYear - 1} Expenses`] as number), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const { income: totalIncome, expenses: totalExpenses } = netTotals(monthTxns)
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0'

  const dateSelectClass = 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Visual breakdown of your finances</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            {isYear ? selectedYear : MONTHS[selectedMonth]} Income
          </p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            {isYear ? selectedYear : MONTHS[selectedMonth]} Expenses
          </p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Savings Rate</p>
          <p className={`text-2xl font-bold ${parseFloat(savingsRate) >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
            {savingsRate}%
          </p>
        </div>
      </div>

      {/* Pie charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title={`Expense Breakdown — ${isYear ? selectedYear : `${MONTHS[selectedMonth]} ${selectedYear}`}`}>
          {pieData.length === 0 ? <EmptyChart text="No expense data this period" /> : <PieChartWithLegend data={pieData} />}
        </ChartCard>
        <ChartCard title={`Income Breakdown — ${isYear ? selectedYear : `${MONTHS[selectedMonth]} ${selectedYear}`}`}>
          {incomePieData.length === 0 ? <EmptyChart text="No income data this period" /> : <PieChartWithLegend data={incomePieData} />}
        </ChartCard>
      </div>

      {/* Monthly overview */}
      <ChartCard title="Monthly Overview — Last 12 Months" className="mb-4">
        {monthlyData.every(d => d.income === 0 && d.expenses === 0) ? (
          <EmptyChart text="No data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Net worth trend */}
      <ChartCard title="Net Worth Trend — Last 12 Months" className="mb-4">
        {netWorthData.every(d => d.value === null) ? (
          <EmptyChart text="Add accounts and transactions to see your net worth trend" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={netWorthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} name="Net Worth" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Year-over-Year */}
      <ChartCard title={`Year-over-Year — ${selectedYear} vs ${selectedYear - 1}`}>
        {!yoyHasData ? (
          <EmptyChart text="No data to compare yet" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <YoYStat label="Income" current={yoyCurIncome} previous={yoyPrevIncome} currentYear={selectedYear} previousYear={selectedYear - 1} positive />
              <YoYStat label="Expenses" current={yoyCurExpenses} previous={yoyPrevExpenses} currentYear={selectedYear} previousYear={selectedYear - 1} positive={false} />
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={yoyData} barSize={8} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey={`${selectedYear} Income`} fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey={`${selectedYear - 1} Income`} fill="#86efac" radius={[2, 2, 0, 0]} />
                <Bar dataKey={`${selectedYear} Expenses`} fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey={`${selectedYear - 1} Expenses`} fill="#fca5a5" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </ChartCard>
    </div>
  )
}

function YoYStat({ label, current, previous, currentYear, previousYear, positive }: {
  label: string; current: number; previous: number; currentYear: number; previousYear: number; positive: boolean
}) {
  const diff = previous > 0 ? ((current - previous) / previous * 100) : null
  const isUp = diff !== null && diff > 0
  const isDown = diff !== null && diff < 0
  const changeColor = diff === null ? 'text-slate-400'
    : positive
      ? (isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-slate-400')
      : (isUp ? 'text-red-500' : isDown ? 'text-green-600' : 'text-slate-400')

  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(current)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{currentYear}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatCurrency(previous)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{previousYear}</p>
        </div>
      </div>
      {diff !== null && (
        <div className={`mt-2 text-xs font-semibold ${changeColor}`}>
          {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(diff).toFixed(1)}% vs {previousYear}
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{title}</h3>
      {children}
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">{text}</div>
  )
}

function PieChartWithLegend({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="flex items-start gap-4">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      {/* Full list, matching the dashboard — the pie already draws every slice. */}
      <div className="flex-1 space-y-1.5 overflow-hidden">
        {data.map((d, i) => (
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
  )
}
