# Gold Finance – Multi-branch Gold Loan Management

A fast, modern web application for gold loan / pawn broking businesses with multiple branches.

**Stack:** React 19 + Vite (JavaScript) · TanStack Query · Tailwind CSS 4 · Node.js + Express 5 · MySQL 8

---

## Features

### Loan counter
- **New loan** – customer search / quick add, jewel entry (gross, stone, net, purity), live gold rate, eligibility by scheme LTV, doc charges, advance interest, split payment (Cash / UPI / Bank), jewel & customer photos via webcam or upload
- **Loan Counter** (one screen, scan barcode or type loan no) – Interest receipt · Part payment · Top-up · Renewal / Re-loan · Release (incl. released-to-other-person) · history with receipt reprint & void
- **Old loan entry**, **Edit pledged record**, **Cancel loan**, **Duplicate print** (tracked as ORIGINAL / DUPLICATE)
- **Pledge book** with filters, totals and Excel export
- **Interest calculator** with side-by-side scheme comparison
- **Jewel packet stickers** with barcode
- **Loan bill** printed on A4 exactly in the branch format: header, branch/customer grid, interest-slab table, photo + jewel table, declarations, signatures, demand promissory note, இரசீது, terms page and acknowledge card (Tamil or English) + QR code

### Interest engine
- % per year or % per month · exact days or months (half / full month rounding)
- Slabs (e.g. ≤3m 15 %, ≤6m 18 %, ≤12m 20 %, above 24 %) applied **from loan date** or **stepped**
- Minimum days, grace days, penal interest after due date (never compounded), part payments on reducing principal
- Slabs are frozen on each loan, so changing a scheme never changes old loans

### Multi-branch & security
- Every record belongs to a branch; users see **only their branches** (enforced in every SQL query)
- Owners / admins switch branch from the top bar or choose **All Branches** for a consolidated view
- **Roles & permissions per screen and per action** (view, add, edit, delete, print, export)
- Back-dated entries need a separate permission; **Day Close** locks closed dates
- Full **audit trail** (logins, entries, edits, prints, deletes)

### Vault, bank & auction
- Stock check by barcode scanning · bank re-pledge with bank interest · overdue list, notices (letters + SMS), auction sale with surplus / loss accounting

### Accounts (automatic double entry)
- Every loan, receipt, salary and voucher posts automatically · Day book, cash book, account ledger, trial balance, P&L, balance sheet · cash denomination · day close · financial year end

### Reports (25+)
Day-wise loans, pledge register, outstanding with interest due, maturity / overdue, current stock, stock analysis, area-wise, scheme-wise, releases, released items, renewals, interest collection, part payments, top-ups, payment modes, customer dues, customer list, top customers, loan & release summary, owner (branch-wise) summary, monthly trend, user-wise transactions – each with print and Excel export.

### Also
Dashboard with charts · Ctrl + K global search · F2 new loan · F3 loan counter · dark mode · employees, attendance & salary · SMS templates & gateway · JSON backup · slide-in drawers everywhere (no popups)

---

## Setup

Requirements: **Node.js 20+** and **MySQL 8**.

```bash
npm run install:all
```

Create `server/.env` from `server/.env.example` and set `DB_PASSWORD`, `JWT_SECRET` and `ADMIN_PASSWORD`.

```bash
npm run db:setup      # creates database, tables and master data
npm run dev:server    # API  -> http://localhost:5000
npm run dev:client    # UI   -> http://localhost:5173
```

Login with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` (default `admin`).

### First steps after login
1. **Company** – name, licence no, address, logo (printed on bills)
2. **Branches** – add each branch (code, phone, loan prefix, opening cash)
3. **Gold Rate** – today's market and loan rate per gram
4. **Loan Schemes** – LTV and interest slabs
5. **Print & Receipt** – bill language, notes, terms & conditions, footer
6. **Roles & Permissions** → **Users** – create staff logins and assign branches

### Production
```bash
npm run build         # builds client into client/dist
npm start             # server serves API + built client on PORT
```

### Backup & restore
- **Settings → Backup Database → Take Full Backup Now** downloads a `.json.gz` of every table (super admin). Only full backups can be restored.
- **Auto Backup**: every day after the set time (default 21:00) the server writes a full backup to `server/backups/` and keeps the newest 30. Set `BACKUP_DIR` in `server/.env` to use another folder; copy it to a pen drive / cloud drive now and then.
- **Restore** (super admin, password, type RESTORE) puts a server backup file or an uploaded full backup back over all data. A safety backup is saved first; the audit trail is never overwritten.
- Start Fresh also saves a full backup on the server before removing practice entries.

### SMS due reminders
Settings → SMS Settings → Auto SMS Rules: once SMS is on and a provider URL is set, the server sends due-reminder SMS every day after the set time to loans past their settle-before date or with no interest paid for N months, and not to the same loan again within the set days. "Send Reminders Now" runs it for the current branch.

### Tests
With the dev server running (`npm run dev:server`), on the **dev database**:
```bash
npm test                  # all API tests (smoke, parity, desk, flows, sweep, backup)
npm test -- flows sweep   # only some
```
The tests make their own test branches, customers and loans. `backup.test` restores the data it changed when it ends.

---

## Project structure

```
server/
  src/
    config/        env, db pool, logger, screen registry (permissions)
    db/            schema.sql, migrate.js, seed.js
    middleware/    auth (JWT cookie + permissions), branch scope, upload, validation, errors
    services/      interest engine, accounting (double entry), numbering, settings, audit, SMS, day control
    utils/         CRUD factory, pagination, money/date helpers
    modules/       auth, admin, masters, customers, loans, accounts, reports, dashboard, employees, bank, auction
client/
  src/
    components/    ui (design system), form (schema driven), layout, common (ResourcePage, pickers)
    config/        navigation (menu = routes = permissions)
    context/       auth + branch
    hooks/         generic TanStack Query hooks
    features/      one folder per module (pages + drawers)
    features/print loan bill, receipts, stickers, notices
    lib/           api client, formatting, print, export
```
