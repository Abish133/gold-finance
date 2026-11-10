---
title: First-time setup (owner)
group: Start here
screens: s_company
---
# First-time setup

Do this **once**, before the shop starts real work. The same list is in **Help → Getting Started**, where each step ticks itself when it is done.

Sign in as the owner (Super Admin). The first sign-in on a new install opens Getting Started by itself.

## Step 1 - Company details
**Masters → Company Information**
1. Company name, address lines 1-3, mobile, phone, e-mail.
2. Pawn-broker **licence number** (printed on the bill).
3. Logo (optional) - click the logo box and choose an image.
4. **Save (F2)**.

Example: *Sri Lakshmi Gold Finance, 12 Main Road, Nagercoil 629001, 94430 12345, Licence TN-NGL-0421.*

## Step 2 - Branch and opening cash
**Settings → More → Branches**
1. Edit **Head Office** - code (HO), name, phone, address.
2. **Loan prefix** - letters before the loan number (leave blank for 1, 2, 3 …; "K" gives K1, K2 …).
3. **Opening cash** - the money in the drawer before the first entry. Example ₹2,00,000.
4. Add another branch for every other shop.

## Step 3 - Today's rate
**Masters → Gold / Silver Rate** - see the chapter *Gold / Silver Rate*. Do it every morning.

## Step 4 - Interest rate (scheme)
**Masters → Loan Schemes** - open **GL000 · Gold Loan (MyBook)**:
- Rate per month (example **1.5**), LTV % (example **75**), tenure 12 months.
- "Calculate by: MyBook" = every started month is charged, interest on the loan amount, compound every 12 months (or flat), exactly like MyBook.

The other schemes (GL001, GL002 …) are slab schemes for the printed slab table; keep them or switch them off.

## Step 5 - Items
**Masters → Items** - 88 common names are already there. Add your own (for example *Kasu Malai*).

## Step 6 - Staff logins
**Settings → Users & Roles → Users → Add User**
1. Full name, username, password (the eye shows it), mobile.
2. Role - Cashier / Branch Manager / Accountant / Viewer.
3. Tick the branches the person works in. Active on. **Save**.

## Step 7 - Printer and bill
**Settings → Printer Setup** (paper, copies) and **Settings → More → Print settings**:
- Loan bill layout: **Branch bill (A4)** or **MyBook pawn ticket**.
- Bill language Tamil / English, receipt notes and terms.

Give a test loan later and print it to check.

## Step 8 - Bank accounts (optional)
**Bank → Bank Accounts → New Bank (Ctrl+N)** - name, branch, account no, IFSC, *Used for*: Potali (bank pledge), Online / Card / Cheque, or Both.

## Step 9 - SMS (optional)
See the chapter *SMS and WhatsApp*.

## Step 10 - Backup
**Settings → Backup Database → Auto Backup** - on, 21:00, keep 30. Take one **Full Backup Now** and keep it on a pen drive.

## Step 11 - Old paper loans (optional)
Enter the loans you already have with **Loan → Old Loan Entry** (chapter *Old Loan Entry*). They do not change today's cash.

## Step 12 - First loan
**Loan → New Loan (F1)** - chapter *New Loan*. Check the bill, then the **Day Report (F7)**.

> Practised with dummy entries? **Settings → Start Fresh** removes them (loans, receipts, vouchers …) and keeps your company, users, items and rates.
