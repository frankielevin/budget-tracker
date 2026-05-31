import { createClient } from '@/lib/supabase/client'
import { transactionDeltas, mergeDeltas, applyBalanceDeltas } from '@/lib/balances'
import type { RecurringTransaction } from '@/lib/types'

let generating = false

/**
 * For each active recurring template, generate any transactions that are
 * missing up to and including the current month.
 */
export async function generateRecurringTransactions() {
  if (generating) return
  generating = true
  try {
    await _generate()
  } finally {
    generating = false
  }
}

async function _generate() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: templates } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)

  if (!templates?.length) return

  // Fetch existing recurring-generated transaction identifiers
  const { data: existing } = await supabase
    .from('transactions')
    .select('recurring_id, date')
    .not('recurring_id', 'is', null)

  // Build a Set of "recurringId|YYYY-MM" for quick lookup
  const generated = new Set<string>()
  for (const tx of existing || []) {
    if (tx.recurring_id) {
      const d = new Date(tx.date + 'T00:00:00')
      generated.add(`${tx.recurring_id}|${d.getFullYear()}-${d.getMonth()}`)
    }
  }

  const now = new Date()
  const inserts: object[] = []
  // Net balance change per account from every newly generated transaction.
  let balanceDeltas: Record<string, number> = {}

  function buildInsert(t: RecurringTransaction, dateStr: string) {
    const to_account_id = t.type === 'transfer' ? t.to_account_id : null
    balanceDeltas = mergeDeltas(balanceDeltas, transactionDeltas({
      type: t.type,
      amount: t.amount,
      account_id: t.account_id,
      to_account_id,
    }))
    return {
      user_id: user!.id,
      account_id: t.account_id,
      to_account_id,
      category_id: t.type === 'transfer' ? null : t.category_id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      date: dateStr,
      recurring_id: t.id,
    }
  }

  for (const t of templates as RecurringTransaction[]) {
    if (t.frequency === 'monthly') {
      // Generate for every month from start through current month
      let year = t.start_year
      let month = t.start_month - 1 // 0-indexed

      while (
        year < now.getFullYear() ||
        (year === now.getFullYear() && month <= now.getMonth())
      ) {
        const key = `${t.id}|${year}-${month}`
        if (!generated.has(key)) {
          // Clamp day to last day of month
          const lastDay = new Date(year, month + 1, 0).getDate()
          const day = Math.min(t.day_of_month, lastDay)
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          inserts.push(buildInsert(t, dateStr))
        }
        month++
        if (month > 11) { month = 0; year++ }
      }
    } else if (t.frequency === 'yearly') {
      // Generate for every year from start through current year
      for (let year = t.start_year; year <= now.getFullYear(); year++) {
        const month = t.start_month - 1 // 0-indexed
        // Don't generate future months in the current year
        if (year === now.getFullYear() && month > now.getMonth()) continue

        const key = `${t.id}|${year}-${month}`
        if (!generated.has(key)) {
          const lastDay = new Date(year, month + 1, 0).getDate()
          const day = Math.min(t.day_of_month, lastDay)
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          inserts.push(buildInsert(t, dateStr))
        }
      }
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('transactions').insert(inserts)
    // Only move balances once the generated transactions are safely persisted.
    if (!error) await applyBalanceDeltas(supabase, balanceDeltas)
  }
}
