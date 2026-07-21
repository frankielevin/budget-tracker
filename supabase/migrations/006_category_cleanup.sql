-- Category tidy-up.
--
-- 1. 'Savings/Investment' holds savings interest received, so it earns rather
--    than spends. Left as 'expense' it gets flagged on the Categories page,
--    and any future spending recorded there would silently cancel the interest.
--
-- 2. 'Investments & Dividends' duplicates 'Savings/Investment' and has no
--    transactions against it, so removing it loses nothing.
--
-- Safe to re-run.

update public.categories
set type = 'income'
where lower(name) = 'savings/investment';

-- Guarded on being genuinely unused: if anything was filed here after this was
-- written, the category stays and its transactions keep their category.
delete from public.categories c
where lower(c.name) in ('investments & dividends', 'investments and dividends')
  and not exists (select 1 from public.transactions t where t.category_id = c.id)
  and not exists (select 1 from public.recurring_transactions r where r.category_id = c.id)
  and not exists (select 1 from public.budgets b where b.category_id = c.id);
