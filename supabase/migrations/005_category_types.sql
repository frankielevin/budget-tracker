-- Give categories a type, so the app can tell earnings from reimbursements.
--
-- Money arriving in a spending category is normally someone covering part of
-- what you spent — Izzy contributing to a grocery shop, a refund, a share of a
-- group present. That should reduce what the category cost you.
--
-- But some categories genuinely earn: a salary, dividends, a side project with
-- its own revenue. Cancelling that against the category's costs would hide real
-- income. Only categories marked 'expense' get netted.
--
--   expense  money out; incoming amounts offset the spending (the default)
--   income   money in; never netted
--   both     earns *and* costs, e.g. a side project — shown separately
--
-- Safe to re-run.

alter table public.categories
  add column if not exists type text default 'expense';

-- Anything created before this column existed comes through as null.
update public.categories set type = 'expense' where type is null;

alter table public.categories
  alter column type set default 'expense',
  alter column type set not null;

-- Replace the check constraint (looked up by definition — the original was
-- created inline with no fixed name).
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.categories'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%';
  if c is not null then
    execute format('alter table public.categories drop constraint %I', c);
  end if;
end$$;

alter table public.categories
  add constraint categories_type_check
  check (type in ('income', 'expense', 'both'));

-- ---------------------------------------------------------------------------
-- One-time backfill of existing categories.
--
-- Everything defaults to 'expense', so this only needs to name the exceptions.
-- These are starting points — each one is editable in the category editor.
update public.categories
set type = 'income'
where lower(name) in (
  'salary',
  'other income',
  'side income',
  'investments & dividends',
  'investments and dividends',
  'dividends',
  'interest'
);

-- Side projects: real revenue *and* real costs, so neither side should cancel
-- the other out.
update public.categories
set type = 'both'
where lower(name) in ('babbling irons');
