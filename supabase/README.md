# Delta Capital CRM - Supabase Configuration

This directory contains database schemas and migrations to configure Supabase for **Delta Capital CRM**.

## How to execute SQL on Supabase

Follow these steps to apply the schema migration directly to your Supabase project:

1. Go to the **Supabase Dashboard**: [https://supabase.com](https://supabase.com)
2. Log in and select your project (`kzemdiggdpxfceiecbat`).
3. In the left navigation sidebar, click on **SQL Editor**.
4. Click on **New query** (or choose an empty SQL sheet).
5. Copy all the SQL content from the schema file: [001_delta_capital_schema.sql](migrations/001_delta_capital_schema.sql).
6. Paste the SQL content into the SQL Editor editor.
7. Click the **Run** button (or press `Ctrl + Enter` / `Cmd + Enter`).
8. Ensure the query runs successfully with no errors.

## Synchronizing Auth Users to Profiles

The schema automatically sets up a Postgres trigger `on_auth_user_created` that listens to Supabase Auth's user registration and creates a corresponding record in the `public.profiles` table with the role specified in metadata (defaulting to `'AGENT'`).

To customize the role of a user, update their role column in the `profiles` table:
```sql
UPDATE profiles SET role = 'SUPERADMIN' WHERE email = 'admin@deltacapital.com';
```

Available roles:
- `SUPERADMIN`
- `MANAGER`
- `AGENT`
- `SUPERVISOR`
