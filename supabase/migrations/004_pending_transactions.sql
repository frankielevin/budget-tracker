-- Pending (future-dated) transactions.
--
-- A transaction whose date is in the future should be visible but must NOT
-- affect account balances until its date arrives. We track that with a
-- `pending` flag meaning "this transaction's balance effect has not been
-- applied yet". When the date arrives the app activates it: it applies the
-- balance effect and clears the flag.
--
-- Existing rows are historic/active, so they default to not-pending.

alter table public.transactions
  add column if not exists pending boolean not null default false;

-- Speeds up the activation query: "pending rows whose date has arrived".
create index if not exists transactions_pending_date_idx
  on public.transactions (pending, date)
  where pending = true;

-- ---------------------------------------------------------------------------
-- One-time backfill.
--
-- Under the old logic every transaction applied its balance effect the moment
-- it was created, including future-dated ones. Those balances are now wrong:
-- the money shouldn't have moved until the transaction's date. So for every
-- still-active transaction dated in the future, reverse the effect it had on
-- account balances and mark it pending. The app will re-apply the effect when
-- the date arrives.
--
-- This block is safe to re-run: it only touches rows still marked active
-- (pending = false), and the final statement flips them to pending = true, so
-- a second run matches nothing.
do $$
begin
  -- income had been added to its account — subtract it back out.
  update public.accounts a
  set balance = a.balance - x.amt
  from (
    select account_id, sum(amount) amt from public.transactions
    where pending = false and date > current_date
      and type = 'income' and account_id is not null
    group by account_id
  ) x
  where a.id = x.account_id;

  -- expense had been subtracted from its account — add it back.
  update public.accounts a
  set balance = a.balance + x.amt
  from (
    select account_id, sum(amount) amt from public.transactions
    where pending = false and date > current_date
      and type = 'expense' and account_id is not null
    group by account_id
  ) x
  where a.id = x.account_id;

  -- transfer had left the from-account — add it back.
  update public.accounts a
  set balance = a.balance + x.amt
  from (
    select account_id, sum(amount) amt from public.transactions
    where pending = false and date > current_date
      and type = 'transfer' and account_id is not null
    group by account_id
  ) x
  where a.id = x.account_id;

  -- transfer had landed in the to-account — take it back out.
  update public.accounts a
  set balance = a.balance - x.amt
  from (
    select to_account_id, sum(amount) amt from public.transactions
    where pending = false and date > current_date
      and type = 'transfer' and to_account_id is not null
    group by to_account_id
  ) x
  where a.id = x.to_account_id;

  -- Mark them pending last: the reversals above selected them by pending = false.
  update public.transactions
  set pending = true
  where pending = false and date > current_date;
end$$;
