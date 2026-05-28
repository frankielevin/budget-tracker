-- Remove month and year columns from budgets.
-- Budgets are recurring monthly limits — the per-month spending is derived
-- from transactions, so storing month/year on the budget itself is wrong.

alter table public.budgets drop column if exists month;
alter table public.budgets drop column if exists year;

-- Ensure RLS is on (safe to run even if already enabled)
alter table public.budgets enable row level security;

-- Add policy if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'budgets' and policyname = 'Users manage own budgets'
  ) then
    create policy "Users manage own budgets"
      on public.budgets for all using (auth.uid() = user_id);
  end if;
end$$;
