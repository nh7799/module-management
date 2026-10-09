# Academic Hub

Vite + React frontend, Supabase (Auth, Postgres, private Storage), deployed on Vercel.

## Run locally
1. `npm install`
2. Create a Supabase project. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. Copy `.env.example` to `.env` and add your project URL and anon key (Project Settings > API).
4. `npm run dev`

## Deploy
1. Push to GitHub and import the repo in Vercel (framework: Vite).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Environment Variables.
3. In Supabase, Auth > URL Configuration: set your Vercel URL as Site URL.

## Built (untested)
Sign up/in, notes, search, image upload (original + WebP display + thumbnail), private storage with RLS, orphan cleanup, delete.

## Not built yet
Module/lecture/task screens, OCR, export/import, health page, automated tests, caption editing, reordering.
# module-management
