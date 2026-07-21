export type AccountType = 'checking' | 'savings' | 'investment' | 'credit' | 'cash' | 'joint' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
/**
 * What a category is for. Only 'expense' categories net incoming money against
 * their spending — see `lib/categoryTotals.ts`.
 */
export type CategoryType = 'income' | 'expense' | 'both'

export interface Profile {
  id: string
  username: string
  full_name: string | null
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  color: string
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  created_at: string
  category?: Category
}

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  type: CategoryType
  created_at: string
}

export interface RecurringTransaction {
  id: string
  user_id: string
  account_id: string | null
  to_account_id: string | null
  category_id: string | null
  type: TransactionType
  amount: number
  description: string
  frequency: 'monthly' | 'yearly'
  day_of_month: number
  start_month: number
  start_year: number
  is_active: boolean
  created_at: string
  account?: Account
  to_account?: Account
  category?: Category
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string | null
  to_account_id: string | null
  category_id: string | null
  type: TransactionType
  amount: number
  description: string
  date: string
  notes: string | null
  recurring_id: string | null
  pending: boolean
  created_at: string
  updated_at: string
  account?: Account
  to_account?: Account
  category?: Category
}
