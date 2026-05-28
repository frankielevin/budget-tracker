# Budget Tracker - Setup Guide

## Step 1: Create a Supabase project

1. Go to https://supabase.com and create a free account
2. Click **New Project**
3. Choose a name (e.g. "budget-tracker"), set a strong database password, pick a region close to you
4. Wait ~2 minutes for it to provision

## Step 2: Set up the database

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy the entire contents of `supabase/schema.sql` and paste it in
4. Click **Run**
5. You should see "Success. No rows returned"

## Step 3: Configure environment variables

1. In Supabase, go to **Project Settings → API**
2. Copy your **Project URL** and **anon/public key**
3. In the `budget-app` folder, create a file called `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with your actual values.

## Step 4: Run the app locally

```bash
cd budget-app
npm install    # if you haven't already
npm run dev
```

Open http://localhost:3000 — you'll be redirected to the login page.

## Step 5: Deploy to Vercel (so others can access it)

1. Go to https://vercel.com and create a free account
2. Click **Add New → Project**
3. Import your project (you can drag-and-drop the folder, or push to GitHub first)
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**

Vercel will give you a URL like `https://budget-tracker-xyz.vercel.app` — share this with your family/friends.

## Step 6 (Optional): Custom domain

In Vercel → Project Settings → Domains, you can add a custom domain if you have one.

---

## Notes

- Each user registers their own account — all data is completely private and separate
- Password reset emails are sent from Supabase by default
- The free tier of Supabase and Vercel is more than enough for personal/family use
