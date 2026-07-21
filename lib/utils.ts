export function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  investment: 'Investment',
  credit: 'Credit Card',
  cash: 'Cash',
  other: 'Other',
}

export const ACCOUNT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6b7280',
]

/**
 * Give every chart slice a colour you can tell apart.
 *
 * Category colours are picked freely from a fixed palette, so collisions are
 * common — two categories both on #ef4444 render as one indistinguishable
 * wedge. The first use of a colour keeps it; repeats are reassigned to an
 * unused palette entry, falling back to golden-angle hue steps (which stay well
 * separated from each other) once the palette runs out.
 */
export function withDistinctColors<T extends { color: string }>(items: T[]): T[] {
  const used = new Set<string>()
  return items.map((item, i) => {
    if (!used.has(item.color)) {
      used.add(item.color)
      return item
    }
    const spare =
      ACCOUNT_COLORS.find(c => !used.has(c)) ??
      `hsl(${Math.round((i * 137.508) % 360)}, 62%, 55%)`
    used.add(spare)
    return { ...item, color: spare }
  })
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
