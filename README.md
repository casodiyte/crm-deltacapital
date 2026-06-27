# Delta Capital CRM

Delta Capital CRM (adapted from marmelab/atomic-crm) is a private, premium institutional CRM platform tailored for sales tracking, deal structuring, contact center operations, and internal messaging, styled with the **Delta Capital Royal Dark** theme (deep navy background with gold details).

## Features & Modules

1. **Dashboard**: Executive monitoring room displaying real-time KPIs (Total leads, active deals, conversion rate, projected revenue) and Recharts trend analytics.
2. **Prospectos (Leads)**: Advanced directory table of leads with status, source, and agent filters, plus a slide-out drawer for activity logs and notes.
3. **Negociaciones (Deals)**: Kanban pipeline board with drag-and-drop mechanics supporting stages: *Nuevo lead*, *Contactado*, *Interesado*, *Asesoría*, *Depósito pendiente*, *Ganado*, and *Perdido*.
4. **Contactos (Contacts)**: Portfolio grid showing active clients and corporate relationships, with historical notes, calls, and deals timelines.
5. **Contact Center (Calls)**: Actionable queue dialer, active call status tracker, call timer, and disposition logging (Interesado, No interesado, Buzón, Callback, Depósito confirmado) integrated directly into Supabase.
6. **Chat Interno**: Real-time internal communication channels (`general`, `ventas`, `soporte`, `alertas`) powered by Supabase Realtime.
7. **Reglas (Rules)**: Business rules CRUD mapping condition events to commercial actions (e.g. autoassign agents, priority settings).
8. **Automatizaciones**: Flow and webhook trigger CRUD.
9. **Admin Panel**: Role access control, auditing of account statuses, and last-seen activity trackers for SUPERADMINs.

---

## Role Permissions & Security

Delta Capital CRM implements Row-Level Security (RLS) in Supabase via the `profiles` table:
- **SUPERADMIN**: Full system access, CRUD profiles and roles.
- **MANAGER**: Read/edit access to records inside their `team_id`.
- **AGENT**: Strict ownership access — can only interact with records where `agent_id = auth.uid()`.
- **SUPERVISOR**: Team-level read-only access.

---

## Technical Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Routing**: React Router v7
- **Database**: Supabase (PostgreSQL + RLS + Triggers)
- **Charts**: Recharts
- **Icons**: Lucide React

---

## Local Setup

### 1. Installation
Install the required packages:
```bash
npm install
```

### 2. Database Migration
Follow the instructions in the [Supabase README](./supabase/README.md) to apply the database schema.

### 3. Startup
Start the local development server:
```bash
npm run dev
```
Access the application at [http://localhost:5173/](http://localhost:5173/).
