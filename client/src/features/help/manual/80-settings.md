---
title: Settings
group: Settings
screens: s_users, s_system, s_print, s_company, s_audit
---
# Users & Roles

**Settings → Users & Roles → Users** (User Accounts)
- Search, Show *All / Active / Inactive*, Role filter; tiles Users / Active / Inactive / Roles.
- **New User (Ctrl+N)**: full name, username, password (eye shows it), role, mobile, e-mail, Active, **Branch access** (tick each branch). **Edit User (F2)** - leave the password blank to keep it. **Delete User (Del)**. **Roles & Permissions (F6)**, **Print (F9)**.
- A user who forgot the password: edit → type a new one → Save. **Suggest** fills a strong, easy-to-type password (shown so you can note it); the bar shows Weak / Fair / Good / Strong.
- **Row buttons** ✏ / 🗑 at the end of each user row (you cannot delete yourself).
- **Your own password**: click your name (top right) → **Change password** - current password, new password (with **Suggest**), confirm.
- Three wrong passwords lock that user name for 30 seconds (System Control → Other).

**Settings → Users & Roles → Roles & Permissions**
- Left: the roles with users, menus and status. Under it: users in the role, role name, Active / Inactive, *Can view all branches*.
- Right: the **menu tree** - every menu (Loan, Records, Auction, Bank, Accounts, Reports, Masters, Settings) with a tick for each screen. Tick a menu = all its screens; open the arrow of a screen for *view / add / edit / delete / print / export*.
- **Tick All**, **Clear All**, **Expand All**, **Copy from Role** (start from another role), **New Role (Ctrl+N)**, **Save (F2)**, **Delete Role**.
- Default roles: Super Admin (always everything), Branch Manager, Cashier, Accountant, Viewer. Add your own (e.g. *Appraiser*).

# System Control
**Settings → System Control** - how the app behaves (same codes as MyBook):

| Setting | Example |
|---|---|
| Advance interest (AI) | Yes - first month taken at loan time |
| Default interest rate (GROI) | 1 - used for the day-wise info line |
| Allow back-date billing | Yes / No |
| Release: discount without admin (RDAL) | ₹500 |
| LTV safe / warning % | 75 / 85 |
| Old loan warning (months) | 12 |
| Auction overdue after (months) | 12 |
| Release grace days | 0 |
| Lock closed days | Yes |
| Top-up allowed within days | 3 |

Groups (same as MyBook): **Loan**, **Bill book**, **Print**, **Payment**, **Messages**, **Home page**, **Employee**, **Other**. Some useful ones:

| Group | Setting (code) | What it does |
|---|---|---|
| Bill book | Manual bill book number (MBLN) | Ask for the hand-written bill book no with every loan (off = not asked) |
| Bill book | Auto manual number (MLNG) | A new loan / re-loan gets the next bill book no by itself (1, 2, 3 …) |
| Bill book | Prefix / digits / starts from (BBPX / BBDG / NBST) | e.g. prefix A, 4 digits → A0001; a separate series for new loans |
| Bill book | Bill book no. on loan receipt (PMBN) | The receipt prints the bill book no instead of the loan no |
| Bill book | Release by bill book no. (RBMLN) | Release opens with the Bill Book No search |
| Print | Print after loan / release / top-up, part payment (PLR …) | Off = only saved, print later from Duplicate Bill |
| Print | Preview before print (LRBP) | Off = straight to the printer |
| Print | Duplicate: preview / DUPLICATE mark / copies (DB..) | How Duplicate Bill reprints |
| Print | Sticker layout (STKL), stickers per row (STKC) | Desktop sticker or your own label fields |
| Messages | WhatsApp: new loan / release / part payment / interest | WhatsApp opens with the message ready after saving |
| Home page | Home: New Loan … Re-loan, Cash in hand, Loans today … | Show / hide each button and tile on the home page |
| Employee | Cut salary for absent days, block same mobile, stop login when left | Salary Sheet and employee rules |
| Other | Login tries / lock seconds, backup warning days, year end reminder | Security and reminders on the home page |

Search (F3), Save Changes (F2), Print settings (F9).

# Printer Setup and Print settings
- **Printer Setup** - paper size and copies for loan bill, receipts, stickers (A4 / thermal), test print.
- **Print settings** - **Loan bill layout** (Branch bill A4 / MyBook pawn ticket), bill language Tamil / English, receipt notes, terms, footer, sticker size and columns. **Label designer** - what is printed on stickers.

# Change Company / Branch
**Settings → Change Company / Branch** - switch the working branch (same as the Branch box in the header).

# User Log and Audit Trail
- **User Log** - sign-ins and sign-outs.
- **Audit Trail** - every save, edit, delete, backup, restore … with user, time and details. Filter by user, action, date.

# Appearance
**Settings → Appearance** - the look of the app. Changes apply at once.
- **Accent colour** - 40 colours in groups (default **Gold Finance** = the sign-in page colours) or **Your own colour** (picker or a code like #1E3A8A). A light colour shows a warning - white text may be hard to read.
- **Font** - 16 Windows fonts (*Nirmala UI* is best with Tamil). **Text size** - Compact to Huge (everything gets bigger).
- **Look & feel** - Theme (Light / Dark / Follow Windows), Main buttons (Theme / Gold / Accent colour), Table rows (Compact / Normal / Comfortable), Zebra rows, Corners, Text weight, Selection colour, Totals colour, Number grouping (1,25,000 or 125,000), Money sign (₹ / Rs. / none).
- **Keep my look on my login** - your look follows you to any counter you sign in on (off = this computer only).
- **Save as shop default** (admin) - new users and computers start with this look; **Use shop default**, **Remove shop default**, **Reset**.

# System Health
**Settings → System Health** (admin) - refreshes every minute.
- **Day End checklist** for the selected branch: today's rate, cash count, packet stickers for new loans, failed SMS, backup in the last 24 hours, last Day End - green *Done* / amber *To do*; click a line to go there.
- **Server** (running for, memory), **Backups** (last backup), **SMS / WhatsApp** (sent, waiting, failed - 7 days), **Database** (tables, rows, size).
- **User activity** - each user's actions, sign-ins, deletes / voids, screens used and last seen (30 days).
