-- =============================================
-- Budget Tracker - Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  created_at timestamp with time zone default now()
);

-- Accounts table
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'investment', 'credit', 'cash', 'joint', 'other')),
  balance decimal(12,2) default 0,
  currency text default 'GBP',
  color text default '#6366f1',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Categories table
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  color text default '#6366f1',
  icon text default 'circle',
  type text default 'expense' check (type in ('income', 'expense', 'both')),
  created_at timestamp with time zone default now()
);

-- Recurring transaction templates (auto-generate transactions each period)
create table if not exists public.recurring_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.accounts on delete set null,
  to_account_id uuid references public.accounts on delete set null,
  category_id uuid references public.categories on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount decimal(12,2) not null check (amount > 0),
  description text not null,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'yearly')),
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  start_month int not null check (start_month between 1 and 12),
  start_year int not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Transactions table
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.accounts on delete set null,
  to_account_id uuid references public.accounts on delete set null,
  category_id uuid references public.categories on delete set null,
  recurring_id uuid references public.recurring_transactions on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount decimal(12,2) not null check (amount > 0),
  description text not null,
  date date not null default current_date,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Budgets table (recurring monthly limits per category)
create table if not exists public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references public.categories on delete cascade not null,
  amount decimal(12,2) not null check (amount > 0),
  created_at timestamp with time zone default now(),
  unique (user_id, category_id)
);

-- =============================================
-- Row Level Security
-- =============================================

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Accounts
create policy "Users manage own accounts"
  on public.accounts for all using (auth.uid() = user_id);

-- Categories
create policy "Users manage own categories"
  on public.categories for all using (auth.uid() = user_id);

-- Recurring transactions
create policy "Users manage own recurring"
  on public.recurring_transactions for all using (auth.uid() = user_id);

-- Transactions
create policy "Users manage own transactions"
  on public.transactions for all using (auth.uid() = user_id);

-- Budgets
create policy "Users manage own budgets"
  on public.budgets for all using (auth.uid() = user_id);

-- =============================================
-- Auto-create profile on signup
-- =============================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
