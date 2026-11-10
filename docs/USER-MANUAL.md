# Gold Finance - User Manual

Step by step guide to every menu, with examples. The same manual is inside the app: **Help → User Manual** (it shows each person the chapters of their role). First time? Start with **Help → Getting Started**.

## Contents


**Start here**

- [Welcome - how this app works](#welcome)
- [First-time setup (owner)](#first-time-setup)
- [Daily routine](#daily-routine)

**Loan**

- [New Loan](#new-loan-f1)
- [Release Loan](#release-loan-f2)
- [Part Payment & Interest](#part-payment-interest-f5)
- [Top-up Loan and Re-loan](#top-up-loan)
- [Interest Calculator, Old Loan Entry, Edit Loan](#interest-calculator)
- [Loan Details, Stickers, Duplicate Bill](#loan-details-loan-counter)

**Records**

- [Pledge Book, Customers, Stock](#pledge-book)

**Auction**

- [Auction](#auction-list-notices)

**Bank**

- [Bank (Potali)](#bank-pledging-your-loans-with-a-bank-potali)

**Accounts**

- [Accounts](#accounts)
- [Day Report, Day End, Day Close](#day-report-f7)

**Reports**

- [Reports](#reports)

**Masters**

- [Masters](#gold-silver-rate)

**Settings**

- [Settings](#users-roles)
- [SMS and WhatsApp](#sms-and-whatsapp)
- [Backup, Restore, Start Fresh, Year End, Import](#backup-database)

**Help**

- [Problems and questions](#problems-and-questions)

---

# Welcome

This app runs a gold / silver loan (pawn broker) shop: loans, interest, release, bank pledge (potali), auction, accounts, reports and Tally - for one shop or many branches.

You only need a web browser (Chrome or Edge). Nothing to install on the counter computers.

## 1. Sign in

1. Open the app link your administrator gave you (for example `http://shop-pc:5000`).
2. Type your **username** and **password**. Click the eye icon to see what you typed.
3. Press **Sign In** (Enter).

> Forgot your password? Ask the owner / Branch Manager - they reset it in **Settings → Users & Roles → Users**.

After many wrong passwords (20 within 15 minutes) sign-in is blocked for 15 minutes - this protects the shop.

## 2. The screen

| Part | What it shows |
|---|---|
| **Menu bar** (top, black) | Loan · Records · Auction · Bank · Accounts · Reports · Masters · Settings · Help · Exit - the same order as MyBook |
| **Header** | Company name, A/c year, **Billing date**, **Gold rate**, **Silver rate**, **Branch**, your name |
| **Search box** (Ctrl+K) | Type a loan no, customer name, mobile or scan a barcode - opens it straight away |
| **Body** | The screen you opened. The home screen has the day's tiles and quick action buttons |
| **Status bar** (bottom) | This month's loans, releases, open loans, loans unsettled for over 12 months |

**Billing date** is the working day of the books. It moves to the next day only when you close the day (**Day End**). If it shows a date before today, the previous day is not closed yet.

**Gold rate in red** = today's rate is not entered. New loans need today's rate.

## 3. Slide-in panels (no popups)

Forms open as a panel that slides in from the right (a "drawer").
- **Esc** closes it, **F2** saves it (on most forms), **Enter** moves to the next box.
- Questions like "Save this?" also appear as a panel - press the button you want.

## 4. Keyboard - the most used keys

| Key | Does |
|---|---|
| F1 | New Loan |
| F2 | Release Loan (on the home screen) · Save (inside a form) |
| F3 | Customers |
| F4 | Day End |
| F5 | Part Payment / Interest |
| F6 | Voucher Entry |
| F7 | Day Report |
| F8 | Duplicate Bill |
| F9 | Sticker / Print |
| Ctrl+K | Search anything |
| Esc | Close / go back |

**Help → Keyboard Shortcuts** lists every key.

## 5. Branches

If you work in more than one branch, the **Branch** box in the header changes branch. Owners can choose **All Branches** to see everything together (entries are always made in one branch).

## 6. Who can see what

Your **role** decides which menus you see. A cashier does not see accounts or settings, a viewer can only look. The chapters of this manual shown to you follow your role.

| Role | Usually does |
|---|---|
| Super Admin (owner) | Everything, all branches, settings, users, year end |
| Branch Manager | Counter + approvals + day end + auction + masters of the branch |
| Cashier | Loans, part payment, release, re-loan, top-up, stickers, cash count |
| Accountant | Vouchers, cash book, ledgers, final accounts, bank, salary |
| Viewer | Look up loans, customers and reports only |

## 7. Where to start

- **Owner, first time:** open **Help → Getting Started** and do the 12 steps.
- **Everyone, every day:** read the chapter **Daily routine**.

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

---

# Daily routine

## Morning (Branch Manager / owner)
1. **Sign in.** Look at the header: **Billing date** should be today. If it shows an older date, yesterday was not closed - do **Day End** for that day first (Settings → Day End).
2. **Enter today's rate** - Masters → Gold / Silver Rate → type the fine (100%) gold and silver rate → **Auto from 100% Rate** → **Save Today's Rate (F2)**. The header rate turns from red to normal.
3. Look at the home screen **Reminders** (loans due, unsettled for 12 months, day not closed) and **Help → Advisory**.

## During the day (Cashier)
| Customer wants to … | Screen | Key |
|---|---|---|
| Pledge jewels for money | Loan → New Loan | F1 |
| Pay interest only, or part of the loan | Loan → Part Payment | F5 |
| Take the jewels back | Loan → Release Loan | F2 |
| Get more money on the same jewels (within 3 days) | Loan → Top-up Loan | - |
| Close the old loan and take a new one in one step | Loan → Re-loan | - |
| Know how much to pay today | Loan → Interest Calculator, or Release screen (do not save) | - |
| A copy of the bill | Loan → Print → Duplicate Bill | F8 |

Every save prints a receipt if the printer is set. Payments can be split between Cash, UPI / online, card and cheque.

## Expenses (Accountant / Manager)
Rent, salary, electricity, tea … → **Accounts → Voucher Entry (F6)** → Payment.

## Evening (Branch Manager)
1. **Count the cash** - Accounts → Cash Denomination - type the number of each note and coin. The app compares it with "cash should be in drawer".
2. **Day Report (F7)** - check the totals.
3. **Day End (F4)** → **Close Day & Move to next date (F10)**. The billing date moves to tomorrow and that day is locked.
4. Backup runs by itself at night (Settings → Backup Database). Once a week copy the latest file to a pen drive.

## Month end / year end
- Reports → Loan & Release Summary, Accounts → Final Accounts (Profit & Loss, Balance Sheet).
- Once a year after 31 March: **Settings → Year End Process** (owner).

---

# New Loan (F1)

**Loan → New Loan** - give money against gold / silver jewels and print the loan bill.

Before you start: today's rate must be entered (header gold rate not red).

## Step by step

1. **Find the customer** - the cursor is in the customer box. Choose how to search: **Mobile / Name / A/c No / Loan No**, type, press **Enter**, pick the customer from the list.
   - New customer? Press **F1** (or *New Customer*) and fill the form - chapter *Customers*.
   - The left panel then shows the customer's photo, open loans and interest due today. A warning appears if a loan of this customer is open for more than 12 months - ask for interest first.
2. **Loan on** - **Gold**, **Silver** or **Mix** (gold and silver items in one loan).
3. **Add each item**
   - Item (type a new name to add it to the list), Pcs, Gross Wt (g), Less Wt (stone / wax), Purity %.
   - Net Wt and Value are worked out: value = fine weight (net × purity) × today's 100% rate, rounded to the nearest ₹100.
   - **Add Item** (or Enter in the last box). The item goes into the list and the boxes clear for the next item. The × on a row removes it.
4. **Loan amount** - type the amount. The **Loan to value** bar turns green / orange / red. Above the warning limit (85%) the app asks *"Loan is xx% of item value. Continue?"* before saving.
5. **Interest % p.m.** (from the scheme, can be changed) and **Interest type** - *Compound* or *Flat*.
6. **Doc. charges** (if any) and **Advance interest** - with advance on, the first month's interest is taken now (F6 switches advance on / off).
7. **Item photo** - Camera, Browse (choose a file) or Old Photo (the customer's last photo).
8. **Save Loan (F2)** → enter the bill book no (if you use paper bill books) → **Pay customer**: choose Cash / UPI / Card / Cheque and the amount → **Confirm**.
9. The loan bill prints (two copies if set). The sticker for the jewel packet can be printed from **Loan → Print → Jewel Packet Sticker (F9)**.

## Example
Ravi Kumar S/o Mani Kumar brings a chain.

| Box | Entry |
|---|---|
| Item | Chain, 1 pcs, gross 10.000 g, less 0, purity 91.6 |
| Value | 9.160 g fine × ₹7,900 = ₹72,364 → **₹72,400** |
| Loan amount | ₹50,000 (69% of value - green) |
| Interest | 1.5% p.m., Compound |
| Interest / month | ₹750 |
| Advance interest | ₹750 (on) |
| **Pay to customer** | **₹49,250** |

Due date is 12 months from the loan date.

## Keys on this screen
| Key | Does |
|---|---|
| F1 | New customer |
| F2 | Save loan |
| F6 | Advance interest on / off |
| Ctrl+E | Print a loan estimate for the customer (before saving) |
| Ctrl+N | Clear the screen |
| F5 | Customer ledger (all loans of this customer) |
| Esc | Back to home |

## Good to know
- Every started month is charged: a loan released after 3 months 2 days pays 4 months.
- Compound: each full year's interest is added to the loan amount for the next year.
- The loan number comes by itself (header). Old paper loans go in **Old Loan Entry**, not here.
- Made a mistake? **Loan → Edit Loan Record** (Branch Manager), or cancel the last entry from **Loan Details**.

---

# Release Loan (F2)

**Loan → Release Loan** - the customer pays the loan amount and interest and takes the jewels back.

## Step by step
1. **Find loan** - type the loan no and press **Enter** (or scan the barcode on the sticker). **F3** = search by bill book no. A list appears if several loans match - click one.
2. Check the screen:
   - **Customer** (photo, other open loans) - press **F5** for the full customer ledger.
   - **Items** with today's value, **Payments already received**.
   - **Settlement as on** the billing date:

| Line | Meaning |
|---|---|
| Loan amount | Original loan (with top-ups) |
| Interest · N months | Every started month (compound or flat) |
| Days interest · info | For information only (day-wise at the default rate) |
| − Advance interest | Taken when the loan was given |
| − Interest already paid | Interest receipts (Part Payment screen) |
| − Part amount paid | Loan amount already paid back |
| Against ticket / Post / other charge | Type if you collect any |
| Discount | Above ₹500 (System Control) needs a manager's password |
| **Total to receive** | What the customer pays now |

3. **Customer unable to release** - tick it if the customer only signs (amount collected later). **Released to another person** - name and ID of the person who takes the jewels.
4. **Release Loan (F2)** → **Receive Payment**: Cash / UPI / Card / Cheque - press **Add (Enter)** for each part until Balance is 0 → **Confirm Release (F2)**.
5. The release receipt prints. The loan becomes **Released** and its items leave the stock.

## Example
Loan of ₹50,000 at 1.5% p.m. compound, advance ₹750, released after 3 months 10 days:
- Interest · 4 months = 4 × 750 = ₹3,000
- − Advance interest ₹750
- **Total to receive ₹50,000 + 2,250 = ₹52,250**

## Good to know
- Only look, no release? Load the loan, read the total, press **New / Clear (Ctrl+N)** - nothing is saved.
- **Loan Details (F7)** shows the whole history of the loan.
- A loan pledged with a bank cannot be released until it is released from the bank (Bank → Release from Bank).
- Release by mistake? A manager can cancel the last entry from **Loan Details** the same day.

---

# Part Payment & Interest (F5)

**Loan → Part Payment** - the customer pays interest, or pays back part of the loan amount, and keeps the loan open.

## Pay interest (F2 tab)
1. Type the **loan no** → **Load** (Enter).
2. The **Interest months** strip shows each month: advance, paid, paying now, due, not yet.
3. **Months to pay** - press **+ / −**, or the buttons *1 month*, *3 months*, *All due*.
   Amount = interest per month × months. "Paid up to (after save)" shows the new paid-up date.
4. **Payment mode** - Cash / UPI / Card / Cheque, amount, reference → **Add (F4)** until Balance is 0.
5. **Save & Print Receipt (F10)** or **Save only**.

Example: loan ₹12,345 at 1.5% → interest per month ₹185. Paying 3 months = **₹555**, paid up to 05/05/2025.

## Pay part of the loan amount (F3 tab)
1. Load the loan → **Part Amount (F3)**.
2. **Amount received** - e.g. ₹5,000. *New outstanding* = loan − amount.
3. Add the payment mode(s) → **Save & Print Receipt (F10)**.

> Like MyBook, **interest stays on the original loan amount** after a part payment. The part amount is taken off what the customer owes at release.

## Good to know
- Interest receipts are taken off at release (*Interest already paid*).
- **F5** on this screen clears it for the next customer.
- The receipt shows months, from–to dates, interest per month and the payment modes.

---

# Top-up Loan

**Loan → Top-up Loan** - give extra money on the same loan number and the same jewels.

Rules (like MyBook):
- Allowed only **within 3 days** of the loan date (System Control → "Top-up allowed within days").
- **Not** allowed on an Old Loan Entry - use Re-loan.

Steps
1. Type the loan no → Enter. The right side shows *Loan amount now*, *Items value today*.
2. **Top-up amount** - e.g. ₹1,000 → *New loan total* ₹51,000, *Interest / month (new total)* ₹765, LTV bar.
3. **Give Top-up (F2)** → pay the customer (cash / UPI …). The full amount is paid; interest from now is on the new total.

# Re-loan

**Loan → Re-loan** - close the old loan and make a new loan with the same jewels in one step (also called renewal).

Steps
1. Type the **old loan no** → Enter. Top: *Interest · N months*, *Paid before*, *Old loan total*.
2. **New loan amount** - same amount by default; type more or less. Interest % and Flat / Compound come from the old loan (change if needed). Advance interest on new loan (F6).
3. Add / remove items if the customer takes back or adds a jewel.
4. The box at the bottom says **Receive from customer** (green) or **Pay to customer**.
5. **Save Re-loan (F2)** → take / give the money → the new loan bill prints. The old loan shows *Re-loaned*.

Example (flat 1.5% on ₹12,345, 22 months, advance ₹185):
- Old loan total = 12,345 + (22 × 185) − 185 = **₹16,230**
- New loan ₹12,345 with advance ₹185
- **Receive from customer = 16,230 − 12,345 + 185 = ₹4,070**

---

# Interest Calculator

**Loan → Interest Calculator** - interest due on every open loan up to any date (nothing is saved).

1. **Pledged from / to** - which loans (by pledge date). **Interest up to** - the date to work out interest (today, or a future date to tell the customer).
2. Filters: Metal (All / Gold / Silver / Mix), Where (All / In hand / At bank), Older than (Any / 6 / 9 / 12 months), Search (F3).
3. **Calculate (F5)**. Tiles: open loans, loan amount due, interest due, total due, average age.
4. Click a loan - the right panel shows ROI, months, loan amount, part paid, total interest, advance, paid earlier, interest due, total due.
5. **Print Preview (F9)**, **PDF (Ctrl+P)**, **Excel (Ctrl+E)**.

Example: ₹12,345 compound 1.5% pledged 05/01/2025, up to 05/11/2026 = 22 months → interest ₹4,407 − advance ₹185 = **₹4,222 due**.

# Old Loan Entry

**Loan → Old Loan Entry** - enter loans that were given on paper before you started the software. They are **opening entries** - today's cash does not change.

1. Find the customer (or F1 new customer).
2. **Bill book no** (required - the paper bill number) and **Pledge date (F4)** - the original date.
3. Gold / silver rate of that day (or today's), items, loan amount, interest % p.m., type, advance interest (Yes if it was taken).
4. **Save Old Loan (F2)**. The till-today panel shows months running and interest due.
5. **Mark Old Loans (Ctrl+M)** - turn many normal loans into old-entry loans at once (used when you move from another software).

Example: Bill T1, 05/01/2025, Chain 10 g 91.6%, ₹12,345, 1.5% compound, advance Yes → interest/month ₹185, due 05/01/2026.

# Edit Loan Record

**Loan → Edit Loan Record** (Branch Manager) - correct a saved loan.

1. Type the loan no → load.
2. Change items (Insert = add item row), customer (**F4** change customer), amount, rate, dates, photo.
3. The yellow box lists *what changed* compared with the saved loan.
4. **Save (F2)**, or **Ctrl+Z** to undo your changes.

Changing the amount or rate reposts the accounts of that loan. Every edit is kept in the **Audit Trail**.

---

# Loan Details (Loan Counter)

**Loan → Loan Details** - everything about one loan in one place.

1. Find the loan (loan no / bill book no / customer).
2. Tabs: **Bill** (items, photo), **Interest / Part payment / Top-up / Renew / Release** buttons go to those screens, **History** - every receipt.
3. In **History**, the printer icon reprints that receipt; the undo icon (manager) **cancels the last entry** of the loan (wrong release, wrong receipt) with a reason.
4. **Bill** button prints the loan bill again.

# Jewel Packet Sticker (F9)

**Loan → Print → Jewel Packet Sticker** - labels for the jewel packets (loan no, barcode, customer, weight).

1. Choose by date (Today / Yesterday / Week) or loan numbers, **Search (Ctrl+R)**.
2. Tick loans (Ctrl+A all, Ctrl+U none) - "not printed" loans are ticked first.
3. Sheet: A4 (several per page) or thermal (one per label) - set in Printer Setup.
4. **Print (F10)**.

# Duplicate Bill (F8)

**Loan → Print → Duplicate Bill** - print the loan bill again (marked DUPLICATE).

1. Find by date, loan no or customer → **Search (F5)**.
2. Tick the loans (Ctrl+A), options *Include released loans*, *Show bill book no*.
3. **Preview & Print (F10)**.

---

# Pledge Book

**Records → Pledge Book** - the register of all loans.

- Tiles: pending (open) / released / auctioned / at bank with amounts.
- Filters: date range, status, metal, scheme, search (F3).
- Double-click a loan for its details. **Print (F9)**, **Excel (Ctrl+E)**, **Refresh (F5)**.

# Customers (F3)

**Records → Customers** - all customers with their loans.

## Add a customer
1. **New Customer** (on the home screen or here).
2. Fill: title (Mr / Mrs …), **Customer name**, relation (S/o, D/o, W/o, C/o) and **Father / Husband name**, door no, street, area, city, pincode, **Mobile (10 digits)**, alternate mobile, ID proof type and number, nominee.
3. Photos: customer photo (camera / file), ID proof front and back, signature.
4. **Save Customer (F2)**. **Enter** goes to the next box, **Ctrl+N** clears the form.
   - Names are saved in Proper Case.
   - If the mobile number already exists the app shows the matching customers - open that one instead of making a duplicate.

Example: Mr Ravi Kumar S/o Mani Kumar, 5-43 Main Road, Kappiyarai 629157, mobile 98765 43210, Aadhaar Card 1234 5678 9012.

## Customer ledger
Open a customer → **Ledger** - all loans, interest paid, due today. **WhatsApp (Ctrl+W)** opens WhatsApp with the customer's loan details typed in.

## Other
- **Blocked customers** - block a customer who should not get new loans.
- **Merge customers** - two records of the same person → one.

# Stock

**Records → Stock**
- **Stock Check** - scan or type each packet's loan no; the list ticks it. Packets not found can be marked *missing*. *New check* clears the day's scans.
- **Stock Analysis** - value of every open loan at today's rate against the amount due, the margin, and loans "at risk" (margin below System Control % ).
- **Reports → Current Stock Report** - pledged items still with you (in hand and at bank), by age.

# Bill Book Check

**Records → Bill Book Check** - finds missing / repeated loan numbers and bill book numbers in a range.

---

# Auction List & Notices

**Auction → Auction List & Notices** - loans not released for a long time; print notices and the auction list.

1. Dates start from the billing date: **Pledged from** the oldest open loan **to** 12 months before the billing date. **Older than** 6 / 9 / 12 months moves the "to" date.
2. Metal, Include (in shop + bank / in shop only) → **Show (F5)**.
3. All loans are ticked - untick what you do not want (Space / click, Ctrl+A, Ctrl+D). "3 LOANS" means the customer has several loans in the list.
4. Notices to customers:
   - **First Notice (F6)** - letters for the ticked loans.
   - **Registered Notice (F7)** - set **Auction date and time** (default 15 days after the billing date), letters + postage.
5. Lists: **Auction List (F9)**, **Cert. of Post List (F10)**, **Regd. Post List (F11)**. *Post split amount* breaks the post list into parts.
6. **WhatsApp / SMS (Ctrl+W)** - queues a reminder SMS for the ticked loans (and opens WhatsApp for one loan).

# Auction Release

**Auction → Auction Release** - two steps, like MyBook.

## Step 1 - Due for Auction tab → mark as auctioned
1. Same dates and filters; **Notice** All / Notice sent / Not sent → **Show (F5)**.
2. Tick the loans (Tick by loan no, Tick All, Tick With Notice).
3. **Auction date** → **Mark N Loans as Auctioned (F10)**.
   - "1 of the ticked loans never got a notice. Auction them anyway?" → Yes / No.
   - "Mark 1 loan (Rs 12,345) as AUCTIONED? These loans will be closed. Only an Admin can undo it." → Yes.
4. The loan is closed. No money yet.

## Step 2 - Auctioned tab → enter the sale
1. Click the loan. Type **Sold for (Rs)** and **Sale date**.
2. **Save Sale (F10)** - the money is booked. **Profit / Loss = sold for − loan amount.**
3. Changing a saved sale: **Change Sale (Admin)**. **Remove Sale (Ctrl+R)** takes the sale back. **Undo Auction (Admin)** re-opens the loan - only after the sale is removed.

Example: loan 2 ₹12,345 auctioned 05/11/2026, sold for ₹20,000 → profit **+₹7,655**.

# Auction Report
**Reports → Auction Report** - by A/c year / dates, metal, sold / not sold. Here **profit / loss = sale − total due (loan + interest)**: ₹20,000 − (12,345 + 3,482) = **+₹4,173**.

---

# Bank - pledging your loans with a bank (potali)

When the shop needs money, it pledges customers' jewel packets with a bank as one **bank loan**. Those loans show *At bank* until you release them from the bank.

## Bank Accounts
**Bank → Bank Accounts** - New Bank (Ctrl+N): bank name, branch, address, phone, bank customer ID, account name / number, IFSC, opening date, **Used for**: Potali / Online-Card-Cheque / Both. A ledger is created by itself. Edit (F2), Delete (Del), **Bank Pledge Book (F6)**.

## Pledge to Bank (Bank Loan)
1. **Bank / branch**, **Bank loan no**, **Date**, **Bank loan amount**, **Interest % / year** (% / month fills itself), **Bank charges**. *Cash received* = amount − charges.
2. Add loans: scan / type each loan no → **Add Loan (Enter)**, or **Pick from List (F4)** - filter metal, dates, search, Tick All, **Add Ticked Loans**.
3. Tiles: loans added, our loan amount, weight, market value (board rate), bank amount (% of our loan, % of value). Click a loan to see its items.
4. **Save Bank Loan (F2)** → confirm. The loans now show *At bank*.

Example: TEST BANK, bank loan 1, ₹30,000 at 12% / year, charges ₹100 → cash received ₹29,900; loans 3 and 4 (₹37,345, 19.990 g).

## Release from Bank
1. Choose the bank → type the **bank loan no** → Enter.
2. Release calculation: days (at least 1), per-day interest, total interest, interest due, **payable to bank**. Type what you actually paid.
3. **Release from Bank (F2)** → confirm. The customer loans are *In hand* again.

Example: same day → 1 day × ₹9.86 = **₹10**, payable ₹30,010 (12.17% a year).

## Bank Pledge Book / Bank Reports
- **Bank Pledge Book** - every bank loan, at bank / released, interest due.
- **Bank Reports** - *Bank Loans Taken*, *Bank Loans Released* (days, interest calc. vs paid, paid % / year, **our interest** earned meanwhile, **our margin**), *Month-wise Summary* (opening, taken, released, interest, closing at bank).

---

# Accounts

Every loan, receipt, release, bank and auction entry is posted to the accounts **by itself** (double entry). You only enter the other money - expenses, income, capital, transfers.

## Voucher Entry (F6)
**Accounts → Voucher Entry**
1. Type: **Payment** (money out - rent, salary, tea), **Receipt** (money in - other income), **Journal** (adjustment, no cash), **Contra** (cash ↔ bank).
2. Date, account (type to search - e.g. *Rent*), amount, Cash or Bank, narration.
3. Journal / Contra: one line per account, debit = credit.
4. **Save**. *All Vouchers* lists and deletes (manager) vouchers.

Example: Payment · Rent · ₹8,000 · Cash · "Shop rent November".

## Account Master
**Accounts → Account Master** - add accounts (ledgers) under a group: Rent, Electricity, Capital A/c (owner), Staff advance …

## Account Ledger, Cash Book / Day Book
- **Account Ledger** - one account between two dates with opening and running balance.
- **Cash Book / Day Book** - every cash entry of the day / period (F4 switches).

## Bank Reconciliation
**Accounts → Bank Reconciliation** - choose the bank account, tick the entries that appear in the bank statement and give the bank date. The bottom shows *as per books*, *not yet in bank*, *should be in bank*.

## Final Accounts
**Accounts → Final Accounts** - **Trial Balance**, **Profit & Loss**, **Balance Sheet** for any dates (F5 show, F9 print).

## Tally Export
**Accounts → Tally Export** - send the accounts to Tally / TallyPrime.
- What is sent (like MyBook): each **Day Report row of a closed day** as Payment / Receipt vouchers, **old loan** opening journals, **auction sale** receipts. Close the day (Day End) first.
- **Ledgers tab** - rename each ledger and choose its Tally group to match your Tally company → **Save Ledger Names**. Tally address (localhost : 9000) → **Test Tally**.
- **Send to Tally (F2)** - TallyPrime must be open with *TallyPrime acts as Server* on. **Save XML Files (F6)** - import later in Tally (Gateway → Import Data).
- **Export History** - what was sent and when.

## Cash Denomination
**Accounts → Cash Denomination** - count the drawer: number of ₹500, ₹200, ₹100 … notes and coins. The difference with *cash should be in drawer* is shown on Day End.

---

# Day Report (F7)

**Reports → Day Report** (or F7) - the day's money by account, the cash tally and how the money came / went.

| Row | Jama (received) | Nave (paid) |
|---|---|---|
| 1 Girvi (Loan / Release) | loan amount coming back at release | new loans, top-ups |
| 2 Interest | advance interest, interest at release | |
| 4 Document Charges | charges at loan time | |
| 5 Ashal Jama (Part Amount) | part payments | |
| 6 Interest Jama (Part Payment) | interest receipts | |
| 8 Auction | auction sale money | loan closed by auction |
| 9 Potali (Bank Girvi) | bank loan received | bank loan repaid |
| 10 Potali Interest | | interest paid to bank |
| Other accounts | income vouchers | expense vouchers |

**Closing balance (Pote Baki)** = opening + jama − nave. **Cash should be in drawer** = Pote Baki − online / card / cheque received + online paid.

# Day End (F4)

**Settings → Day End** - check and close the billing date.

1. The checks on the right: gold / silver rate entered, cash counted (F6), cash tally, rows to post.
2. **Count Cash (F6)** if not done - Cash Denomination.
3. Untick *Print Day Report before closing* if you do not want the print.
4. **Close Day & Move to next date (F10)**.
   - If the cash was not counted: "Day End check failed - Cash has not been counted" → **Open Day Report** / **Close the day anyway** / **Go back**.
5. The day is locked, the billing date moves to the next day and **Gold / Silver Rate** opens for the new date.

# Day Close

**Settings → Day Close** - list of closed days (last 60 days / all), who closed them, cash expected / counted. A Super Admin can **Reopen** the last closed day with a reason (to correct an entry) and close it again.

> Entries are not allowed on a closed day (System Control → *Lock closed days*). Back-dated entries need the *loan_backdate* permission.

---

# Reports

Every report has: date range with quick buttons (Today, This month, Last month, A/c year), filters, tiles with totals, a table, a side panel for the selected row, **Print Preview (F9)**, **PDF (Ctrl+P)**, **Excel (Ctrl+E)** (real .xlsx with totals).

| Report | Menu | Shows |
|---|---|---|
| Day Report | Reports → Day Report (F7) | money by account, cash tally |
| Loan Report | Reports → Loan Reports → Loan Report | loans given between dates, status today, gold / silver / mix totals, advance and charges |
| Release Report | → Release Report | releases: loan amount back, interest, discount, charges, received, reverse % p.m. / year, paid by |
| Loan & Release Item Details | → Loan & Release Item Details | each release with its full interest break-up |
| Part Payment Report | → Part Payment Report | interest and part amounts received before release (grouped by loan) |
| Loan & Release Summary | Reports → Summary | month-wise / day-wise: given, released, auctioned, part paid, **balance** (loan amounts) and **outstanding** (after part payments) |
| Loan & Release Comparison | → Summary | two periods side by side |
| Current Stock Report | Reports → Current Stock Report | pledged items still with you, by age, in hand / at bank |
| Auction Report | Reports → Auction Report | auctioned loans, dues, sale, profit / loss |
| All Reports | Reports → All Reports | 27 more: day-wise loans, maturity, area-wise, scheme-wise, top customers, user activity, bank … |

Example - Loan & Release Summary for 2026-27: opening ₹49,690, November given ₹50,000, released ₹50,000, part paid ₹6,000 → balance ₹49,690, outstanding ₹43,690.

Double-click a month in the Summary to see that month day by day.

---

# Gold / Silver Rate

**Masters → Gold / Silver Rate** - enter every morning.

1. **Rate date** - today (opens by itself after Day End).
2. Type the **Fine Gold (100%)** and **Fine Silver (100%)** rate in the *Today* column.
3. **Auto from 100% Rate** fills the ornament rows: 92% = fine × 92 / 100.
4. **Copy Previous Rate (F5)** - same as yesterday.
5. **Save Today's Rate (F2)**. Rate card: **Print (F9)** or **PDF (Ctrl+P)**; history chart on the right.

Example: Fine Gold 7,900 → Gold Ornament 92% **7,268**; Fine Silver 100 → Silver Ornament 92.

Item value always uses the fine rate: 10 g at 91.6% = 9.160 g × 7,900 = ₹72,364 → **₹72,400** (nearest ₹100).

# Loan Schemes

**Masters → Loan Schemes** - the default interest and LTV for new loans.

| Field | Meaning |
|---|---|
| Code / name | e.g. GL000 · Gold Loan (MyBook) |
| Metal | blank = any |
| LTV % | eligible amount = item value × LTV % |
| Rate type | per month or per year |
| Calculate by | **MyBook** (every started month), Exact days, Months (half / full) |
| Slabs | rate by age (3, 6, 12 months …) - used by slab schemes |
| Min days, grace days, tenure, penal %, doc charges | other rules |

New loans pick the first scheme; the cashier can change the rate on the loan.

# Items, Metals & Purity
- **Masters → Items** - jewel names, gold / silver, Tamil name.
- **Masters → Metal & Purity** - metals (Gold, Silver) and purities (Fine 100, Ornament 92 …).

# Company Information
**Masters → Company Information** - name, address, licence, phones, logo, bill heading (see *First-time setup*).

# Employees, Attendance, Salary, Designations
- **Masters → Employees** - staff records: code, name, phone, address, designation, joining date, basic salary, photos; give a login (username / password) to an employee.
- **Masters → Attendance** - pick the date, mark each person P (present), A (absent), H (half day), L (leave), WO (week off), in / out time → Save.
- **Masters → Salary** - month, basic, allowances, deductions, advance recovery → net → pay by cash / bank (posted to the Salary account).
- **Masters → Designations** - Manager, Cashier, Appraiser …

---

# Users & Roles

**Settings → Users & Roles → Users**
- **Add User**: full name, username, password (eye shows it), role, mobile, e-mail, Active, **Branch access** (tick each branch). Edit: leave the password blank to keep it.
- A user who forgot the password: edit → type a new one → Save.

**Settings → Users & Roles → Roles & Permissions**
- Each role has a tick list of screens with *view / add / edit / delete / export*.
- *All branches* lets a role see every branch together.
- Default roles: Super Admin, Branch Manager, Cashier, Accountant, Viewer. Add your own (e.g. *Appraiser*).

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
Background image of the home screen, light / dark theme (moon icon in the header).

---

# SMS and WhatsApp

## SMS - sent by the server, automatically
SMS is created on: **new loan**, **interest / part payment**, **release**, **due reminders** (from Auction List, or every day by the reminder job). Every 30 seconds the server sends the waiting messages through your SMS provider; a failed one is tried 3 times.

### Set up (once)
1. Take an Indian bulk-SMS provider with DLT registration: sender ID and approved templates.
2. Get the provider's send link, for example
   `https://api.provider.com/send?apikey=KEY&sender=ABCDEF&to={phone}&text={message}`
   Keep `{phone}` and `{message}` - the app fills them.
3. **Settings → SMS Settings → Auto SMS Rules**: *Enable SMS* on, paste *Provider URL*, switch on the events you want → **Save settings**.
4. **Templates** tab - make each message the same as the approved template, add the DLT template id. You can use `{name}` `{loan_no}` `{amount}` `{date}` `{weight}` `{due_date}`.
5. Optional - **Daily due reminders**: send every day after (10:00), interest not paid for (3) months, remind loans past settle-before date, do not repeat within (15) days. *Send Reminders Now* sends at once; the table shows who will get one.

### Check
Give a test loan to your own mobile → **Queue & Log** tab:
- *SENT* - working.
- *SKIPPED - Provider URL not set* - do step 3.
- *FAILED* - read the error (wrong link / template mismatch), fix it, **Retry failed**.

## WhatsApp - opened on your phone / computer
No setup. Install WhatsApp or sign in to WhatsApp Web on the counter computer.
- **Customers → customer → WhatsApp** - opens the chat.
- **Customer Ledger → WhatsApp (Ctrl+W)** - chat with the loan details typed in.
- **Auction List → WhatsApp / SMS (Ctrl+W)** - SMS reminder for the ticked loans; with one loan ticked, WhatsApp opens with the due message.
You press *Send* in WhatsApp. These are not kept in the Queue & Log.

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

---

# Problems and questions

| You see | Do this |
|---|---|
| "New loan blocked - enter today's rate" / gold rate red | Masters → Gold / Silver Rate → Save today's rate |
| Billing date is behind today | Settings → Day End - close the old day(s) one by one |
| "Day is closed up to dd-mm-yyyy. Entries are locked." | The day is closed. A Super Admin can reopen it in Settings → Day Close |
| "You are not allowed to make back-dated entries" | Your role has no back-date permission - ask the manager |
| "Loan amount is above the eligible amount" | Lower the amount, or the scheme LTV is small (MyBook scheme only warns above 85%) |
| "Top-up is allowed only within 3 days" | Use Re-loan |
| "This is an Old Loan Entry - Top-up is not allowed" | Use Re-loan |
| "Loan is pledged in bank" | Bank → Release from Bank first |
| Discount asks for a password | Discount above the System Control limit - a manager types their username and password |
| Menu / screen missing | Your role does not have it - Settings → Users & Roles → Roles & Permissions |
| Printer does not print | Check the printer in Windows, Settings → Printer Setup → test print; the browser print box must have the right printer |
| SMS not going | SMS chapter → Queue & Log - read the status / error |
| Wrong entry saved | Loan Details → History → cancel the last entry (manager), or Loan → Edit Loan Record |
| Lost data / computer changed | Settings → Backup Database → Restore (owner) |

## Interest - how it is worked out
- **Every started month is one month** (grace days 0). 7 days = 1 month, 1 month 1 day = 2 months. Minimum 1 month.
- **Flat**: interest per month (rounded to the rupee) × months.
- **Compound**: each full 12 months, that year's interest is added to the amount. Rounded at the end.
- **Due = total interest − advance interest − interest already paid.** Part payments do not lower the interest (it stays on the loan amount).

Example ₹12,345 at 1.5% p.m.: per month ₹185. 22 months flat = 22 × 185 − 185 advance = **₹3,885**. Compound = 2,222 (year 1) + 14,567 × 1.5% × 10 = 2,185 → 4,407 − 185 = **₹4,222**.

## Item value
Fine weight (net × purity ÷ 100, 3 decimals) × fine (100%) rate, rounded to the nearest ₹100.
