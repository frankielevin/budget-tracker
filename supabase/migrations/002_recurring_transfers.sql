-- Add support for recurring transfers between accounts.
--
-- Recurring templates previously only supported 'income' and 'expense'.
-- A transfer moves money from one account to another, so it needs a second
-- account reference (to_account_id) and the type check must allow 'transfer'.

-- Destination account for transfer templates (null for income/expense).
alter table public.recurring_transactions
  add column if not exists to_account_id uuid references public.accounts on delete set null;

-- Replace the type check constraint so it permits 'transfer'.
-- The original constraint was created inline with no fixed name, so look it
-- up dynamically before dropping it.
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.recurring_transactions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%';
  if c is not null then
    execute format('alter table public.recurring_transactions drop constraint %I', c);
  end if;
end$$;

alter table public.recurring_transactions
  add constraint recurring_transactions_type_check
  check (type in ('income', 'expense', 'transfer'));
