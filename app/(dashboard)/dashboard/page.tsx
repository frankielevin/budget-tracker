'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, AlertTriangle, AlertCircle, CheckCircle, Info, Clock } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Transaction, Account, Category, Budget } from '@/lib/types'
import { netTotals, spendingBreakdown, spentByCategory } from '@/lib/categoryTotals'
import { syncTransactions } from '@/lib/recurring'
import Link from 'next/link'

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // Generate due recurring transactions and activate any that have matured
      // so balances/totals below reflect everything that has actually happened.
      await syncTransactions()
      // Categories aren't fetched separately — every transaction already carries
      // its own via the join, and budgets carry theirs.
      const [{ data: t }, { data: a }, { data: b }] = await Promise.all([
        supabase.from('transactions').select('*, account:accounts!account_id(*), to_account:accounts!to_account_id(*), category:categories(*)').order('date', { ascending: false }),
        supabase.from('accounts').select('*').order('name'),
        supabase.from('budgets').select('*, category:categories(*)'),
      ])
      setTransactions(t || [])
      setAccounts(a || [])
      setBudgets(b || [])
      setLoading(false)
    }
    load()
  }, [])

  const isYear = viewMode === 'year'

  // Pending (future-dated) transactions haven't happened yet, so they're
  // excluded from every total, chart and insight below. They only surface on
  // the Transactions page until their date arrives.
  const settled = transactions.filter(t => !t.pending)

  const inPeriod = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    if (isYear) return d.getFullYear() === selectedYear
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  }

  const periodTxns = settled.filter(t => inPeriod(t.date))

  // Income and expenses are netted per category, so money paid back to you
  // cancels the purchase it reimburses instead of inflating both sides.
  const { income: monthIncome, expenses: monthExpenses } = netTotals(periodTxns)
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0)
  const savings = monthIncome - monthExpenses

  const pieData = spendingBreakdown(periodTxns)

  // The equivalent period before this one, for the at-a-glance comparisons on
  // the stat cards. A bare total says little; the direction of travel says a lot.
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
  const prevMonthYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear
  const prevTxns = settled.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    if (isYear) return d.getFullYear() === selectedYear - 1
    return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear
  })
  const prev = netTotals(prevTxns)
  const prevSavings = prev.income - prev.expenses
  const hasPrev = prevTxns.length > 0
  const periodWord = isYear ? 'year' : 'month'
  const compare = (previous: number) =>
    hasPrev ? `vs ${formatCurrency(previous)} last ${periodWord}` : `No last-${periodWord} data`
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${formatCurrency(Math.abs(n))}`

  // Money already scheduled but not yet applied. Excluded from every total
  // above — correctly, since it hasn't happened — but it's the most decision-
  // relevant thing on the page, so it gets its own card rather than vanishing.
  const upcoming = transactions
    .filter(t => t.pending && inPeriod(t.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  const upcomingSpend = upcoming.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const upcomingTransfers = upcoming.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0)
  const upcomingIncome = upcoming.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const upcomingLeaving = upcomingSpend + upcomingTransfers

  interface Insight {
    id: string
    type: 'danger' | 'warning' | 'success' | 'info'
    title: string
    detail: string
  }
  const insights: Insight[] = []

  // Budgets are monthly limits, so budget insights only make sense in month
  // view. Everything after this block works for either period.
  if (!isYear) {
    const spentByCat = spentByCategory(periodTxns)

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
  }

  if (monthIncome > 0) {
    const rate = Math.round((monthIncome - monthExpenses) / monthIncome * 100)
    insights.push(rate >= 0
      ? { id: 'savings', type: 'info', title: `Saving ${rate}% of your income`, detail: `${formatCurrency(savings)} saved out of ${formatCurrency(monthIncome)} earned` }
      : { id: 'savings', type: 'warning', title: 'Spending more than you earn', detail: `${formatCurrency(Math.abs(savings))} more spent than earned this ${periodWord}` }
    )
  }

  if (pieData.length > 0 && monthExpenses > 0) {
    const top = pieData[0]
    const pct = Math.round(top.value / monthExpenses * 100)
    insights.push({ id: 'top-cat', type: 'info', title: `${top.name} is your biggest expense`, detail: `${formatCurrency(top.value)} — ${pct}% of total spending` })
  }

  if (prev.expenses > 0 && monthExpenses > 0) {
    const diff = monthExpenses - prev.expenses
    const pct = Math.abs(Math.round(diff / prev.expenses * 100))
    insights.push({
      id: 'mom',
      type: diff > 0 ? 'warning' : 'success',
      title: `Spending ${diff > 0 ? 'up' : 'down'} ${pct}% vs last ${periodWord}`,
      detail: `${formatCurrency(monthExpenses)} this ${periodWord} vs ${formatCurrency(prev.expenses)} last ${periodWord}`,
    })
  }

  // Year view has no budgets to report on, so it gets its own headline: which
  // month cost the most.
  if (isYear) {
    const byMonth = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      expenses: netTotals(settled.filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        return d.getMonth() === i && d.getFullYear() === selectedYear
      })).expenses,
    })).filter(m => m.expenses > 0)

    if (byMonth.length > 1) {
      const peak = byMonth.reduce((a, b) => (b.expenses > a.expenses ? b : a))
      const average = byMonth.reduce((s, m) => s + m.expenses, 0) / byMonth.length
      insights.push({
        id: 'peak-month',
        type: 'info',
        title: `${MONTHS[peak.month]} was your priciest month`,
        detail: `${formatCurrency(peak.expenses)} spent — average is ${formatCurrency(average)}`,
      })
    }
  }

  const sortedInsights = [
    ...insights.filter(i => i.type === 'danger'),
    ...insights.filter(i => i.type === 'warning'),
    ...insights.filter(i => i.type === 'success'),
    ...insights.filter(i => i.type === 'info'),
  ].slice(0, 4)

  // Scoped to the selected period like everything else on the page — showing
  // globally-latest rows here made the card quietly disagree with its neighbours.
  const recentTxns = periodTxns.slice(0, 8)

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Your financial overview</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
        <StatCard label="Net Worth" value={formatCurrency(netWorth)} icon={<Wallet size={20} />} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400" sub={`${signed(savings)} this ${periodWord} · ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`} />
        <StatCard label={isYear ? 'Year Income' : 'Month Income'} value={formatCurrency(monthIncome)} icon={<TrendingUp size={20} />} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400" sub={compare(prev.income)} valueColor="text-green-600" />
        <StatCard label={isYear ? 'Year Expenses' : 'Month Expenses'} value={formatCurrency(monthExpenses)} icon={<TrendingDown size={20} />} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-600 dark:text-red-400" sub={compare(prev.expenses)} valueColor="text-red-600" />
        <StatCard label={isYear ? 'Year Savings' : 'Month Savings'} value={formatCurrency(savings)} icon={savings >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />} iconBg={savings >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'} iconColor={savings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'} valueColor={savings >= 0 ? 'text-blue-600' : 'text-orange-600'} sub={compare(prevSavings)} />
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
        {/* Upcoming — the only forward-looking thing on the page. Replaced the
            6-month bar chart, which duplicated the Reports page. */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Still to come — {isYear ? selectedYear : MONTHS[selectedMonth]}
            </h3>
            <Link href="/transactions" className="text-xs text-indigo-600 hover:text-indigo-500">View all</Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-center text-slate-400 text-sm px-4">
              Nothing scheduled for the rest of {isYear ? selectedYear : MONTHS[selectedMonth]}.
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
                  {formatCurrency(upcomingLeaving)}
                </span>
                <span className="text-xs text-slate-400">leaving your accounts</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {formatCurrency(upcomingSpend)} spending
                {upcomingTransfers > 0 && <> · {formatCurrency(upcomingTransfers)} transfers</>}
                {upcomingIncome > 0 && <> · {formatCurrency(upcomingIncome)} due in</>}
              </p>

              {/* Tall enough for five rows before scrolling — a cap that clips
                  mid-row reads as broken rather than scrollable. */}
              <div className="mt-4 space-y-0.5 max-h-60 overflow-y-auto">
                {upcoming.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock size={13} className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate leading-tight">{t.description}</p>
                        <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${
                      t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Spending by Category — {isYear ? selectedYear : MONTHS[selectedMonth]}
          </h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No expense data this month</div>
          ) : (
            <div className="flex items-start gap-4">
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
              {/* Every category with spend is listed — the chart draws them all,
                  so capping the legend just hid slices with no way to identify them. */}
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {pieData.map((d, i) => (
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
              {accounts.map(account => (
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
