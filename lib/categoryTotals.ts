/**
 * Netting income against expenses, per category.
 *
 * Money arriving in a spending category is normally someone covering part of
 * what you spent — a contribution towards the shop, a refund, a share of a
 * group present. Counting the purchase without the repayment overstates what
 * you spent *and* what you earned, which skews category breakdowns, budget
 * progress and the savings rate all at once. So those categories are reduced to
 * whichever direction they actually came out on.
 *
 * Crucially, that only holds where incoming money is offsetting a cost. A
 * salary, dividends, or a side project's revenue are earnings, and cancelling
 * them against costs would hide real income — so only categories typed
 * 'expense' are netted. See `CategoryType`.
 *
 * Because `max(0, a - b) - max(0, b - a) === a - b`, netting a category leaves
 * the gap between the two totals untouched: it corrects income and expenses
 * without ever moving savings.
 */

import type { CategoryType } from '@/lib/types'
import { withDistinctColors } from '@/lib/utils'

const UNCATEGORISED = 'uncategorized'

/** The least a transaction has to look like for netting to work. */
export interface NettableTransaction {
  type: string
  amount: number | string
  category_id: string | null
  category?: { name: string; color: string; type?: CategoryType | null } | null
}

export interface CategoryTotal {
  id: string
  name: string
  color: string
  /** Net outflow: what this category actually cost you. Zero if you came out ahead. */
  spent: number
  /** Net inflow: real earnings, or a category that repaid more than it cost. */
  received: number
}

/**
 * Category types keyed by id, for callers whose query doesn't join the category
 * (the budgets page selects transaction columns only). Values here are a
 * fallback — a joined `category.type` on the transaction always wins.
 */
export type CategoryTypeLookup = Record<string, CategoryType>

/**
 * Collapse transactions into one netted total per category. Transfers are
 * skipped — moving money between your own accounts is neither spending nor
 * income. Pass only the rows you want counted (e.g. a single month, settled
 * only); this applies no filtering of its own.
 */
export function netByCategory(
  transactions: NettableTransaction[],
  categoryTypes: CategoryTypeLookup = {},
): CategoryTotal[] {
  const acc: Record<string, {
    name: string; color: string; type: CategoryType | null; expense: number; income: number
  }> = {}

  for (const t of transactions) {
    if (t.type !== 'expense' && t.type !== 'income') continue

    const id = t.category_id || UNCATEGORISED
    if (!acc[id]) {
      acc[id] = {
        name: t.category?.name || 'Uncategorised',
        color: t.category?.color || '#6b7280',
        // Uncategorised rows stay null and are left un-netted: with no category
        // there's nothing to say the money is offsetting anything, and hiding
        // unexplained income is worse than showing it.
        type: t.category?.type ?? categoryTypes[id] ?? null,
        expense: 0,
        income: 0,
      }
    }

    const amount = Number(t.amount)
    if (t.type === 'expense') acc[id].expense += amount
    else acc[id].income += amount
  }

  return Object.entries(acc).map(([id, v]) => {
    // Earnings categories report both sides as they stand. Only spending
    // categories let incoming money cancel what went out.
    if (v.type !== 'expense') {
      return { id, name: v.name, color: v.color, spent: v.expense, received: v.income }
    }
    return {
      id,
      name: v.name,
      color: v.color,
      spent: Math.max(0, v.expense - v.income),
      received: Math.max(0, v.income - v.expense),
    }
  })
}

/** Netted income and expense totals for a set of transactions. */
export function netTotals(
  transactions: NettableTransaction[],
  categoryTypes?: CategoryTypeLookup,
): { income: number; expenses: number } {
  const totals = netByCategory(transactions, categoryTypes)
  return {
    income: totals.reduce((s, c) => s + c.received, 0),
    expenses: totals.reduce((s, c) => s + c.spent, 0),
  }
}

/** Net spend keyed by category id — for budget progress. */
export function spentByCategory(
  transactions: NettableTransaction[],
  categoryTypes?: CategoryTypeLookup,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of netByCategory(transactions, categoryTypes)) {
    if (c.spent > 0) out[c.id] = c.spent
  }
  return out
}

/** Categories you net-spent in, largest first — ready for a pie/legend. */
export function spendingBreakdown(
  transactions: NettableTransaction[],
  categoryTypes?: CategoryTypeLookup,
) {
  return withDistinctColors(
    netByCategory(transactions, categoryTypes)
      .filter(c => c.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .map(c => ({ name: c.name, value: c.spent, color: c.color }))
  )
}

/** Categories that net you money, largest first. */
export function incomeBreakdown(
  transactions: NettableTransaction[],
  categoryTypes?: CategoryTypeLookup,
) {
  return withDistinctColors(
    netByCategory(transactions, categoryTypes)
      .filter(c => c.received > 0)
      .sort((a, b) => b.received - a.received)
      .map(c => ({ name: c.name, value: c.received, color: c.color }))
  )
}

/**
 * Spot a 'Money out' category that is probably mistyped.
 *
 * Getting this wrong is silent and costly: earnings landing in a spending
 * category are netted away, so real income disappears from your totals with
 * nothing on screen to explain it. Two signals catch it after the fact, which
 * matters because people pick the type before they have any data to judge by.
 *
 * Returns a human-readable reason, or null if the category looks fine.
 */
export function miscategorisedReason(args: {
  type: CategoryType | null | undefined
  /** Monthly-equivalent value of any active recurring *income* aimed here. */
  recurringIncomePerMonth?: number
  /** Totals over a recent window, for the surplus check. */
  recentIncome?: number
  recentExpense?: number
  formatAmount: (n: number) => string
}): string | null {
  const { type, recurringIncomePerMonth = 0, recentIncome = 0, recentExpense = 0, formatAmount } = args

  // Only spending categories net, so only they can hide income this way.
  if (type !== 'expense') return null

  // Money arriving on a schedule is the strongest signal there is. Someone
  // paying you back is a one-off by nature — a standing payment is earnings.
  if (recurringIncomePerMonth > 0) {
    return `This receives ${formatAmount(recurringIncomePerMonth)} a month on a schedule, which usually means earnings rather than someone paying you back.`
  }

  // A spending category that takes in more than it spends isn't really a
  // spending category. The margin keeps ordinary reimbursement noise out —
  // a category that lands a few pounds ahead is not worth flagging.
  const surplus = recentIncome - recentExpense
  if (surplus > SURPLUS_FLOOR) {
    return `This has taken in ${formatAmount(surplus)} more than it has spent recently, which is unusual for a spending category.`
  }

  return null
}

/** Below this, a category running ahead is just reimbursement noise. */
const SURPLUS_FLOOR = 50

/** Build a lookup from a fetched category list. */
export function categoryTypeLookup(categories: { id: string; type?: CategoryType | null }[]): CategoryTypeLookup {
  const out: CategoryTypeLookup = {}
  for (const c of categories) if (c.type) out[c.id] = c.type
  return out
}
