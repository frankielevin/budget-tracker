import { createClient } from '@/lib/supabase/client'
import type { TransactionType } from '@/lib/types'

type SupabaseClient = ReturnType<typeof createClient>

/** Today's local date as a `YYYY-MM-DD` string (matches how dates are stored). */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Whether a transaction dated `dateStr` is still in the future, i.e. it
 * hasn't happened yet and so should not affect balances. Dates are stored as
 * `YYYY-MM-DD`, which sorts chronologically as plain strings. A transaction
 * dated today counts as active (not pending).
 */
export function isPendingDate(dateStr: string): boolean {
  return dateStr > todayStr()
}

/** Minimal shape needed to know how a transaction moves account balances. */
export interface BalanceEffect {
  type: TransactionType
  amount: number
  account_id: string | null
  to_account_id: string | null
}

/**
 * How much each account's balance should change as a result of this
 * transaction existing. Returns a map of account id -> signed delta.
 *
 *   income   -> money lands in `account_id`            (+amount)
 *   expense  -> money leaves `account_id`              (-amount)
 *   transfer -> leaves `account_id`, lands in `to_account_id`
 */
export function transactionDeltas(tx: BalanceEffect): Record<string, number> {
  const deltas: Record<string, number> = {}
  const add = (id: string | null, d: number) => {
    if (!id || !d) return
    deltas[id] = (deltas[id] || 0) + d
  }
  if (tx.type === 'income') add(tx.account_id, tx.amount)
  else if (tx.type === 'expense') add(tx.account_id, -tx.amount)
  else if (tx.type === 'transfer') {
    add(tx.account_id, -tx.amount)
    add(tx.to_account_id, tx.amount)
  }
  return deltas
}

/** Combine several delta maps into one (summing per account). */
export function mergeDeltas(...maps: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of maps) {
    for (const [id, d] of Object.entries(m)) out[id] = (out[id] || 0) + d
  }
  return out
}

/** Flip the sign of every delta — i.e. undo an effect. */
export function negateDeltas(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, d] of Object.entries(map)) out[id] = -d
  return out
}

/**
 * Apply a set of per-account balance deltas to the stored `accounts.balance`.
 * Reads current balances once and writes the new values. Zero-deltas and
 * unknown accounts are skipped. Safe to call with an empty map.
 */
export async function applyBalanceDeltas(supabase: SupabaseClient, deltas: Record<string, number>) {
  const ids = Object.keys(deltas).filter(id => deltas[id] !== 0)
  if (ids.length === 0) return

  const { data } = await supabase.from('accounts').select('id, balance').in('id', ids)
  await Promise.all((data || []).map(a =>
    supabase.from('accounts').update({ balance: Number(a.balance) + deltas[a.id] }).eq('id', a.id)
  ))
}
