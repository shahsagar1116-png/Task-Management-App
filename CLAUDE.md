# Task Management App — Requirements

## 1. Purpose and scope

An internal web app for Sagar B Shah & Associates that auto-creates statutory compliance tasks for each client, tracks them to filing, and chases clients for pending data. Version 1 is for our office only; the design keeps a path open to serve other firms later.

| Item | In scope for v1 | Out of scope for v1 |
| --- | --- | --- |
| Clients | Client master, Excel import, compliance mapping | Client login or portal |
| Tasks | Manual and recurring tasks, assignment, status, comments | Timesheets, billing, invoicing |
| Follow-ups | Document checklists, WhatsApp click-to-chat, email reminders, follow-up log | WhatsApp Business API, bulk campaigns |
| Reporting | Partner dashboard, staff-wise view, daily summary email | Profitability and billing reports |
| Users | Partner, manager, staff roles | Multiple firms, subscriptions |
| Other | Editable due-date calendar | DSC register, document storage, mobile app |

## 2. Users and roles

Three roles control what each person sees and changes. Only the partner creates user accounts; there is no public signup.

| Action | Partner | Manager | Staff |
| --- | --- | --- | --- |
| Add or remove users | Yes | No | No |
| Add, edit, import clients | Yes | Yes | No |
| Edit compliance mapping and due-date calendar | Yes | Yes | No |
| See tasks | All | All | Own tasks only |
| Create and assign tasks | Yes | Yes | Own tasks only |
| Change task status | Yes | Yes | Own tasks, up to "Ready for review" |
| Mark task "Filed / Completed" | Yes | Yes | No |
| Send follow-ups and log them | Yes | Yes | Yes, for own tasks |
| Delete clients or tasks | Yes (soft delete) | No | No |
| See dashboard | Full firm | Full firm | Own workload |

## 3. Tech stack and project rules

The app uses a standard, well-documented stack so Claude Code can build and maintain it reliably.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router) with TypeScript | One codebase for screens and server logic |
| UI | Tailwind CSS + shadcn/ui | Clean tables and forms; desktop-first, usable on mobile |
| Database, login, roles | Supabase (Postgres, Auth, Row Level Security) | Mumbai (ap-south-1) region |
| Scheduled jobs | Vercel Cron or Supabase pg_cron | Daily at 7:00 AM IST |
| Email | Firm Outlook account via SMTP, or Resend | Sender: firm email address |
| WhatsApp | wa.me click-to-chat links with pre-filled text | No API, no cost |
| Hosting | Vercel | Free tier to start |
| Code storage | Private GitHub repository | Commit after each working feature |

**Rules Claude Code must follow**

- Every table has a `firm_id` column, and Row Level Security filters by it, so more firms can be added later.
- Use Supabase Row Level Security for role permissions; never rely only on hiding buttons.
- All dates are stored as dates and shown as DD-MM-YYYY in Indian Standard Time.
- Amounts, if any, are shown in Indian format (1,00,000).
- Never hard-delete clients or tasks; use an `is_deleted` flag.
- Keep an audit log of status changes (who, when, from, to).
- No secrets in code; use environment variables.
- Build one phase at a time (Section 8) and stop for testing after each.
- The owner is not a programmer: explain every step he must do himself (creating accounts, copying keys) in plain, numbered steps.

## 4. Data model

Ten tables hold everything. Every table also has `id`, `firm_id`, `created_at`, `updated_at` and `is_deleted`.

| Table | Key fields | Links to |
| --- | --- | --- |
| firms | name, address, email, phone | — |
| users | name, email, mobile, role (partner / manager / staff), active | firms |
| clients | name, client_code, type (individual / HUF / firm / LLP / company / trust), PAN, GSTIN(s), TAN, CIN/LLPIN, contact_person, mobile, whatsapp_number, email, group_name, default_staff_id, remarks, active | users |
| compliance_types | code (e.g. GSTR3B), name, category (GST / TDS / Income Tax / ROC / Audit / Other), frequency (monthly / quarterly / half-yearly / annual / one-time), default_due_rule, default_checklist | — |
| client_compliances | client_id, compliance_type_id, assigned_to, start_period, end_period, active | clients, compliance_types, users |
| due_dates | compliance_type_id, period_label (e.g. Nov-2026, Q3 FY 2026-27, AY 2027-28), period_start, period_end, due_date, extended_due_date, notes | compliance_types |
| tasks | client_id, compliance_type_id (blank for ad-hoc), period_label, title, assigned_to, reviewer_id, status, priority (low / normal / high), due_date, completed_on, acknowledgement_no, remarks, source (recurring / manual) | clients, compliance_types, users |
| task_documents | task_id, document_name, received (yes/no), received_on | tasks |
| follow_ups | task_id, client_id, channel (WhatsApp / email / call), message, sent_by, sent_on, client_response, next_follow_up_on | tasks, clients, users |
| task_activity | task_id, user_id, action (created / status change / comment / reassigned / due date change), old_value, new_value, comment, at | tasks, users |

**Uniqueness rule:** one task per client + compliance type + period_label. The recurring engine must never create duplicates.

## 5. Compliance master and due-date calendar

The app ships with the compliance list below as seed data. Due dates are defaults only: partners and managers edit them in the app (Section 6.8), and any government extension is entered in `extended_due_date`, which then overrides the original for every open task.

| Code | Compliance | Category | Frequency | Default due date (verify before go-live) |
| --- | --- | --- | --- | --- |
| GSTR1 | GSTR-1 (monthly) | GST | Monthly | 11th of next month |
| GSTR1Q | GSTR-1 / IFF (QRMP) | GST | Quarterly | 13th after quarter end |
| GSTR3B | GSTR-3B (monthly) | GST | Monthly | 20th of next month |
| GSTR3BQ | GSTR-3B (QRMP, Gujarat) | GST | Quarterly | 22nd after quarter end |
| PMT06 | GST PMT-06 payment (QRMP) | GST | Monthly (first two months of quarter) | 25th of next month |
| GSTR9 | GSTR-9 / 9C annual return | GST | Annual | 31 December after FY end |
| TDSPAY | TDS / TCS payment | TDS | Monthly | 7th of next month (30 April for March) |
| TDSRET | TDS return 24Q / 26Q / 27Q | TDS | Quarterly | 31 Jul, 31 Oct, 31 Jan, 31 May |
| TCSRET | TCS return 27EQ | TDS | Quarterly | 15 Jul, 15 Oct, 15 Jan, 15 May |
| ADVTAX | Advance tax instalment | Income Tax | Quarterly | 15 Jun, 15 Sep, 15 Dec, 15 Mar |
| ITR | Income tax return (non-audit) | Income Tax | Annual | 31 July |
| TAR | Tax audit report | Audit | Annual | 30 September |
| ITRA | Income tax return (audit cases) | Income Tax | Annual | 31 October |
| AOC4 | AOC-4 financial statements | ROC | Annual | 30 days from AGM |
| MGT7 | MGT-7 / 7A annual return | ROC | Annual | 60 days from AGM |
| PFESI | PF / ESI payment | Payroll | Monthly | 15th of next month |
| ADHOC | Any other work (notices, certificates, registrations) | Other | One-time | Set manually |

**Period labels** follow one format so the app can match tasks: `Nov-2026` for months, `Q3 FY 2026-27` for quarters, `FY 2026-27` or `AY 2027-28` for annual items.

**Default document checklists** (editable per compliance type), for example GSTR-3B: sales register, purchase register, GSTR-2B reconciliation confirmation, bank statement. Each new task copies its checklist into `task_documents`.

## 6. Functional requirements

Eight modules, each with the screens and behaviour below.

### 6.1 Client master

| Ref | Requirement |
| --- | --- |
| C1 | Client list with search (name, code, PAN, GSTIN) and filters (type, group, assigned staff, active) |
| C2 | Add / edit client form; PAN and GSTIN format validation |
| C3 | Import clients from Excel using a downloadable template; show errors row by row before saving |
| C4 | Client detail page with tabs: profile, compliances, open tasks, completed tasks, follow-up history |
| C5 | Export client list to Excel |

### 6.2 Compliance mapping

| Ref | Requirement |
| --- | --- |
| M1 | On the client page, tick applicable compliances and set assigned staff for each |
| M2 | Bulk mapping: select many clients and apply a compliance in one step |
| M3 | Set start period (and optional end period) so tasks begin and stop at the right time |

### 6.3 Tasks

| Ref | Requirement |
| --- | --- |
| T1 | Task list with filters: status, staff, client, compliance, period, due this week, overdue |
| T2 | Views: list view and a board view grouped by status |
| T3 | Create ad-hoc task: client, title, assignee, reviewer, due date, priority |
| T4 | Task detail: document checklist, comments, activity history, follow-up log, acknowledgement number |
| T5 | Bulk actions: reassign, change status, change due date |
| T6 | Overdue tasks shown in red; due in 3 days in amber |
| T7 | Export task list to Excel |

### 6.4 Recurring task engine

| Ref | Requirement |
| --- | --- |
| R1 | Runs daily at 7:00 AM IST and on demand via a "Generate tasks" button (partner / manager) |
| R2 | For each active client compliance, create a task for every period whose due date falls within the next 30 days, if not already created |
| R3 | Task gets title (e.g. "GSTR-3B – Nov-2026"), assignee from mapping, due date from calendar, and the document checklist |
| R4 | If a due date is extended, update open tasks of that compliance and period |
| R5 | Show a preview of tasks to be created when run manually |

### 6.5 Client follow-up

| Ref | Requirement |
| --- | --- |
| F1 | On a task, "Request documents" builds a message listing pending checklist items |
| F2 | WhatsApp button opens wa.me with the client's number and the message pre-filled; the app logs it as sent when clicked |
| F3 | Email button sends the same message from the firm email and logs it |
| F4 | Editable message templates in English and Gujarati, with fields like {client_name}, {period}, {documents}, {due_date} |
| F5 | Setting the status to "Waiting on client" asks for the next follow-up date |
| F6 | "Follow-ups due today" list on the dashboard |
| F7 | Optional automatic email reminder every N days (default 3) while status is "Waiting on client" |
| F8 | Client-wise follow-up history |

### 6.6 Dashboard

| Ref | Requirement |
| --- | --- |
| D1 | Counts: overdue, due this week, waiting on client, ready for review, completed this month |
| D2 | Compliance-wise status grid: clients as rows, months as columns, cell colour by status (e.g. GSTR-3B for the year) |
| D3 | Staff-wise workload: open tasks and overdue tasks per person |
| D4 | Follow-ups due today |
| D5 | Click any count to open the filtered task list |

### 6.7 Notifications

| Ref | Requirement |
| --- | --- |
| N1 | Daily 8:00 AM email to each staff member: their tasks due in 7 days and overdue |
| N2 | Daily 8:00 AM email to partner: firm summary (counts from D1 plus overdue list) |
| N3 | In-app notice when a task is assigned to you or sent back from review |

### 6.8 Settings: due-date calendar

| Ref | Requirement |
| --- | --- |
| S1 | Due-date calendar screen (partner / manager): list by compliance and period, with filters |
| S2 | Edit any due date, or enter an extended due date with a note (e.g. CBDT / CBIC notification reference) |
| S3 | Saving an extension updates all open tasks of that compliance and period, and shows how many tasks changed |
| S4 | Set the default rule per compliance type (e.g. "20th of next month") so the app fills next year's calendar automatically |
| S5 | Add new compliance types and checklists without code changes |
| S6 | Every change is logged: who, when, old date, new date |

## 7. Task statuses and workflow rules

Every task moves through five statuses, plus "Not applicable" for periods where no work is needed. Staff move work forward; only a partner or manager closes it.

Allowed status changes:

- Not started → In progress
- Not started → Waiting on client
- In progress → Waiting on client (documents pending)
- Waiting on client → In progress (data received)
- In progress → Ready for review
- Ready for review → In progress (sent back for correction)
- Ready for review → Filed / Completed (partner or manager only)
- Any open status → Not applicable (partner or manager only)

| Status | Meaning | Who sets it | Rule |
| --- | --- | --- | --- |
| Not started | Task created, no work yet | System or creator | Default for every new task |
| Waiting on client | Documents or data pending from client | Assignee | Must enter next follow-up date |
| In progress | Work being done in office | Assignee | — |
| Ready for review | Prepared, waiting for check | Assignee | Reviewer gets an in-app notice |
| Filed / Completed | Filed or work delivered | Partner or manager | Acknowledgement number required for returns; completed_on saved |
| Not applicable | No work this period (e.g. client closed, nil not required) | Partner or manager | Reason required; excluded from overdue counts |

A task is **overdue** when today is past its due date (or extended due date) and its status is not "Filed / Completed" or "Not applicable".

## 8. Build phases and acceptance tests

Build in eight phases, in order. A phase is done only when every acceptance test passes in Sagar's own testing.

| Phase | Build | Requirements | Acceptance test |
| --- | --- | --- | --- |
| 1 | Project setup, database, login, roles | Sections 2, 3, 4 | Partner and a staff user log in; staff cannot open the user settings page |
| 2 | Client master and Excel import | C1–C5 | Import the firm's real client list; errors shown for bad PAN/GSTIN rows |
| 3 | Compliance types, due-date calendar, mapping | Section 5, M1–M3, S1–S6 | GSTR-3B mapped to 20 clients in one bulk action; an extension updates the calendar |
| 4 | Manual tasks, statuses, activity log | T1–T7, Section 7 | Staff sees only own tasks; staff cannot mark "Filed / Completed" |
| 5 | Recurring task engine | R1–R5 | Running it twice creates no duplicates; extension updates open tasks |
| 6 | Dashboard | D1–D5 | Counts match the filtered task lists |
| 7 | Follow-ups and templates | F1–F8 | WhatsApp opens with correct number and message; email arrives; both logged |
| 8 | Daily emails and in-app notices | N1–N3 | Morning emails arrive at 8:00 AM IST with correct items |

After Phase 8: run the app alongside Turia for one full month (one GST cycle) before relying on it alone.

## 9. Security, backups and other requirements

Client PAN, GSTIN and contact data is confidential, so access control and backups are built in from Phase 1.

| Area | Requirement |
| --- | --- |
| Access | Login by email and password; password reset by email; session ends after 12 hours |
| Permissions | Enforced in the database (Row Level Security), not only on screen |
| Data location | Supabase project in the Mumbai region |
| Backups | Daily automatic backup; monthly Excel export of clients and tasks kept in the firm's drive |
| Audit | Every status change, reassignment, due-date change and delete recorded |
| Deletion | Soft delete only; partner can restore |
| Performance | Task list loads in under 2 seconds for 5,000 tasks |
| Devices | Works on Chrome and Edge desktop; usable on mobile browser |
| Language | Screens in English; follow-up templates in English and Gujarati |
| Users | Up to 25 users without changes |

## 10. Future scope (not for v1)

WhatsApp Business API, client portal for document upload, billing and timesheets, DSC register, multi-firm subscription version.

## 11. Notes for working in this repository

- **Run locally:** copy `.env.example` to `.env.local`, fill in the Supabase values, then `npm install` and `npm run dev`.
- **Checks before every commit:** `npm run lint`, `npm run typecheck`, `npm run test:db`, `npm run build`.
- **Database changes** go in a new numbered file in `supabase/migrations/` (never edit one that has already been run). The owner runs each new file once in the Supabase SQL Editor, so tell him exactly which file to run. Add tests for new rules to `supabase/tests/rls.test.mjs` (runs on an in-memory Postgres, no Supabase needed).
- **Supabase clients:** `src/lib/supabase/server.ts` acts as the signed-in user (RLS applies) and is the default. `src/lib/supabase/admin.ts` uses the secret key and bypasses RLS: use it only after checking the role in code, and only for Auth admin work such as creating logins.
- **Roles in code:** `src/lib/session.ts` (`requireSession`) gives the signed-in user and role. Pages still check the role so users see a clear "Not allowed" message, but the database is what actually enforces it.
- **Dates and amounts:** use `formatDate` and `formatAmount` from `src/lib/format.ts`.
- **Session length:** `src/middleware.ts` signs users out 12 hours after they signed in.
- **Phase status:** Phase 1 (setup, login, roles) built. Next: Phase 2, client master and Excel import.
