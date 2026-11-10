---
title: Backup, Restore, Start Fresh, Year End, Import
group: Settings
screens: s_backup, s_start_fresh, s_year_end, s_import
---
# Backup Database

**Settings → Backup Database**
- **Backup tab** - **Take Full Backup Now (F2)** downloads a `.json.gz` of everything (all branches, users, settings). Keep it on a pen drive / Google Drive. *Export Branch Data* is a readable copy for checking, not for restore.
- **Auto Backup tab** - every day after the set time (21:00) the server saves a full backup in its *backups* folder and keeps the newest 30. If the computer was off, it runs when the server starts that day. *Back Up to Server Now* makes one at once.
- **History** - every backup with rows, size, type, who.

# Restore (owner only)
**Backup Database → Restore**
1. Choose a **server backup file** or **Upload a file** (a full backup).
2. Type **RESTORE** and your password → **Restore Backup**.
3. A safety backup of the current data is saved first. Everything after that backup is replaced. The Audit Trail is kept.

# Start Fresh (owner only)
**Settings → Start Fresh** - once, before real work, to remove practice entries.
- *Will be removed*: loans, releases, interest, bank, vouchers, day end, auction, salary, SMS logs, customers who had practice loans (counts shown).
- *Will be kept*: company, branches, users, items, rates, schemes, settings, bank accounts, employees, customers without loans.
- Next loan no. and start (billing) date → type **START FRESH** + password → **Remove practice entries**. A full backup is saved first.

# Year End Process (owner only)
**Settings → Year End Process** - after 31 March.
1. Checks: billing date is in the new year, Day End done, backup folder ready. Tiles: loans given, released, net profit, pending loans, carried forward; chart given vs released.
2. Tabs: Checks, Accounts, Pending Loans, Log.
3. **Start Year End (Admin)** - the year is closed, the new year starts; open loans continue in the new year. Print pending loans / year end (F9).

# Database Migration (Import)
**Settings → Database Migration** - bring customers and loans from another software using an Excel / CSV file (one row per customer / loan). Loans come in as old (opening) loans. Download the sample file, fill it, import, read the result (imported / skipped with reasons).
