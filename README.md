# Planify Team Task Manager

## Overview

Planify is a Team Task Manager built with React, Vite, TypeScript, Tailwind CSS, and Supabase. It supports email/password authentication, protected app routes, project boards, project members, tasks, priorities, due dates, and dashboard reporting.

The app uses Supabase Auth for user sessions and Supabase Postgres with row-level security for project, member, task, profile, and activity data.

## Features

- Email/password signup, login, logout, password reset, and protected routes
- Project creation, editing, deletion, and member management
- Automatic admin membership for the user who creates a project
- Kanban task board with drag-and-drop status updates
- Task creation, editing, deletion, assignee selection, priorities, due dates, descriptions, and tags
- Task search and filtering by text, status, and priority
- Dashboard cards for total projects, completed tasks, overdue tasks, and completion rate
- Project progress chart and task status chart
- Profile dropdown, loading states, empty states, form validation, and toast messages

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- React Router
- React Hook Form
- Zod
- Recharts
- React Beautiful DnD

## Role-Based Access

Project access is controlled through the `project_members` table and Supabase RLS policies.

Admin users can:

- create, edit, and delete projects they own or administer
- add and remove project members
- create, edit, move, and delete tasks in their projects

Member users can:

- view projects where they are listed as members
- view project tasks
- update assigned tasks where allowed by the project policies

When a project is created, a Supabase trigger automatically inserts the creator into `project_members` with the `admin` role. The frontend expects this trigger to exist, so the SQL migrations must be applied before testing project and task flows.

## Supabase Setup

Run the SQL migration files in the Supabase SQL Editor, in this order:

1. `supabase/migrations/20260514222852_create_core_tables_v1.sql`
2. `supabase/migrations/20260516013000_fix_project_membership_rls.sql`
3. `supabase/migrations/20260516024500_strict_assignment_role_policies.sql`

The first migration creates the main database structure:

- `profiles`
- `projects`
- `project_members`
- `tasks`
- `activity_log`
- core constraints
- signup profile trigger

The second migration fixes the final access behavior:

- automatic admin membership for project creators
- project member RLS policies
- project CRUD permissions
- task CRUD permissions
- duplicate membership protection

The third migration tightens the final assignment rules:

- only admins can create and delete tasks
- only admins can manage project members
- members can update only tasks assigned to themselves
- members can move assigned tasks without changing task ownership or project details

SQL setup steps:

1. Open the Supabase project dashboard.
2. Go to SQL Editor.
3. Paste and run `20260514222852_create_core_tables_v1.sql`.
4. Paste and run `20260516013000_fix_project_membership_rls.sql`.
5. Paste and run `20260516024500_strict_assignment_role_policies.sql`.
6. Confirm that the tables exist in Table Editor.
7. Confirm that RLS is enabled on the project tables.
8. Create a test account through the app and verify that a profile row is created.

If email confirmation is enabled in Supabase Auth, users must confirm their email before login works.

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Use the Supabase project base URL. The recommended value should not include `/rest/v1/`.

## Local Installation

Install dependencies:

```bash
npm install
```

## Running Locally

Start the Vite dev server:

```bash
npm run dev
```

The local app usually runs at:

```text
http://localhost:5173
```

Useful checks before submission:

```bash
npm run typecheck
npm run lint
npm run build
```

## Deployment

This project is a Vite frontend deployment. It can be deployed to Vercel as a static frontend app.

Vercel setup:

1. Import the repository into Vercel.
2. Set the framework preset to Vite if Vercel does not detect it automatically.
3. Add these environment variables in Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

4. Use this build command:

```bash
npm run build
```

5. Use this output folder:

```text
dist
```

Before deploying, run both Supabase migrations on the Supabase project that the deployed site will use.

## Folder Structure

```text
src/
  components/
    auth/
    layout/
    projects/
    tasks/
    ui/
  contexts/
  lib/
  pages/
  pages/auth/
supabase/
  migrations/
```

Important files:

- `src/lib/supabase.ts` creates the Supabase client from the Vite environment variables.
- `src/contexts/AuthContext.tsx` manages auth session state.
- `src/contexts/ProjectContext.tsx` handles project and member data.
- `src/contexts/TaskContext.tsx` handles task CRUD and status movement.
- `src/pages/DashboardPage.tsx` renders dashboard metrics and charts from live Supabase data.

## Notes

- The frontend depends on Supabase RLS policies for access control.
- Project creators become admins through the database trigger, not through manual frontend insertion.
- Dashboard numbers are based on live project and task data visible to the current user.
- If project or task creation fails after signup, recheck that all migrations were run in order.
