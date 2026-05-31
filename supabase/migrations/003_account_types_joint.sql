-- The app offers a 'joint' account type (and the full set below), but older
-- databases were created with a check constraint that omitted it, so saving a
-- Joint account fails. Replace the constraint with the complete set.
--
-- Safe to run repeatedly: the old constraint is looked up by definition and
-- dropped before the new one is added.

do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.accounts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%';
  if c is not null then
    execute format('alter table public.accounts drop constraint %I', c);
  end if;
end$$;

alter table public.accounts
  add constraint accounts_type_check
  check (type in ('checking', 'savings', 'investment', 'credit', 'cash', 'joint', 'other'));
