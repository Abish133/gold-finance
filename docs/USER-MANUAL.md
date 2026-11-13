# Gold Finance - User Manual

Step by step guide to every menu, with examples. The same manual is inside the app: **Help → User Manual** (it shows each person the chapters of their role). First time? Start with **Help → Getting Started**.

## Contents


**Start here**

- [Welcome - how this app works](#welcome)
- [First-time setup (owner)](#first-time-setup)
- [Daily routine](#daily-routine)
- [What's new - quick tour](#what-s-new)

**Loan**

- [New Loan](#new-loan-f1)
- [Release Loan](#release-loan-f2)
- [Part Payment & Interest](#part-payment-interest-f5)
- [Top-up Loan and Re-loan](#top-up-loan)
- [Interest Calculator, Old Loan Entry, Edit Loan](#interest-calculator)
- [Loan Details, Stickers, Duplicate Bill](#loan-details-loan-counter)
- [Interest - Auto or Manual](#interest-auto-or-manual)

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
- [Business Analytics and Advisory](#business-analytics)

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
| **Menu bar** (top) | Loan · Records · Auction · Bank · Accounts · Reports · Masters · Settings · Help · Exit - the same order as MyBook. On the right it shows where you are, e.g. *Loans › Release* |
| **Header** | Company name, A/c year and the selected branch's **licence number** (and its contact numbers on a wide screen) · **Billing date**, **Gold / g**, **Silver / g** (click a rate to update it) · **Search** · **Branch** · full screen, light / dark, 🔔 reminders · your name and role |
| **Search box** (Ctrl+K) | Loan no, customer name, mobile, barcode - or a screen name like *release*. With nothing typed it shows your **recent screens** and **recently opened** loans / customers |
| **Body** | The screen you opened. Its dark **title bar** holds the screen's buttons (e.g. **Save F2**) and **⌨ Keys** - all shortcuts of that screen |
| **Counter screens** (New Loan, Release, Part Payment, Top-up, Re-loan, Edit Loan) | Three columns. When a column has more than fits on the screen it **scrolls on its own** (mouse wheel over it) - nothing is cut off. The **total and the Save button stay at the bottom** of the right column all the time; F2 / F10 save from anywhere. Wide tables (items) scroll sideways on small screens. |
| **Bottom bar** | **Today** loans / releases · **this month** · **Book** (open loans, outstanding, gold weight) · **Attention** (overdue, 12 months+, failed SMS) · Online / Offline · your name, branch, licence no and contact numbers · clock. Click a figure to open its screen |

**Billing date** is the working day of the books. It moves to the next day only when you close the day (**Day End**). If it shows a date before today, the previous day is not closed yet.

**Gold rate in red** = today's rate is not entered. New loans need today's rate.

## 3. Panels and small boxes

**Forms and details** open as a panel that slides in from the right (a "drawer").
- Top right: **Full size** (the panel fills the screen - remembered for that panel) and **Close Esc**.
- **Esc** closes it, **F2** saves it (on most forms), **Enter** moves to the next box.
- Changed something and pressed Cancel? The panel asks **Discard changes / Keep editing** first.

**Short questions** (delete?, sign out?, change password, admin approval, bill book no …) open as a **small box in the middle**. Clicking outside does not close it - press a button or Esc.

**After saving** a loan or release, the message at the top right has buttons - **Print** and **Open loan** - for 8 seconds.

## 3a. Tables
- **Row buttons** at the end of a row (✏ edit, 🗑 delete, 📖 ledger …) do the same as the toolbar buttons, for that row.
- The **columns icon** in the table header hides / shows columns (remembered on this computer).
- Words you type in a search box are **marked yellow** in the table.
- Wide tables: the first column stays in place when you scroll sideways.

## 3b. First sign-in of the day
A **Morning briefing** box opens: yesterday's loans, releases, interest and cash; interest built up on open loans; and a **Needs attention today** list (rate not entered, overdue loans, loans close to their gold value, failed SMS, old backup, cash count not tallied). Click a line to go there, or **Start the day**.

## 3c. Phone and tablet
On a narrow screen the menu becomes a **☰ Menu** button (with search and recent screens), tables turn into cards and nothing scrolls sideways.

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
| Ctrl+K | Search anything - loans, customers, screens |
| Esc | Close / go back |

**Help → Keyboard Shortcuts** lists every key.

## 5. Branches

If you work in more than one branch, the **Branch** box in the header changes branch. Owners can choose **All Branches** to see everything together (entries are always made in one branch).

Every branch has its own **licence number** and **contact numbers** (1 to 5). Point the mouse at the Branch box to see them; the list in the box also shows each branch's licence number. Bills, receipts, notices and printed reports use the numbers of the branch - see *First-time setup, Step 2*.

## 6. Who can see what

Your **role** decides which menus you see. A cashier does not see accounts or settings, a viewer can only look. The chapters of this manual shown to you follow your role.

| Role | Usually does |
|---|---|
| Super Admin (owner) | Everything, all branches, settings, users, year end |
| Branch Manager | Counter + approvals (discounts, interest below Auto) + day end + auction + masters of the branch |
| Cashier | Loans, part payment, release, re-loan, top-up, stickers, cash count; interest Auto or Manual (asks the manager above the limit) |
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
2. Pawn-broker **licence number** - the company default. Each branch has its own licence number (Step 2), and the bill prints the branch's number.
3. Logo (optional) - click the logo box and choose an image.
4. **Save (F2)**.

Example: *Sri Lakshmi Gold Finance, 12 Main Road, Nagercoil 629001, 94430 12345, Licence TN-NGL-0421.*

## Step 2 - Branch and opening cash
**Settings → More → Branches**
1. Edit **Head Office** - code (HO), name, address.
2. **Pawn broker licence no** - must be filled. Printed on every bill of this branch. *Licence valid till* is optional.
3. **Contact numbers** - the first number must be filled; it is the main number. Press **+ Add number** for more (up to 5 in all) and **✕** to remove one. All of them are printed on the bill.
4. **Loan prefix** - letters before the loan number (leave blank for 1, 2, 3 …; "K" gives K1, K2 …).
5. **Opening cash** - the money in the drawer before the first entry. Example ₹2,00,000.
6. Add another branch for every other shop - each with its own licence number and contact numbers.

Example: *HO · Head Office · Licence TN-NGL-0421 · 94430 12345, 04652 231122.*

The branch list shows **Licence no** and **Contact numbers** for every branch; a red **Not set** means it still has to be filled.

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

# What's new

A short tour of the newer parts of the app. Each line says where to find it; the chapters after this one explain the details.

## Every screen
| What | Where | What it does |
|---|---|---|
| **Morning briefing** | Opens by itself on your first sign-in of the day | Yesterday's figures, interest built up, and a "Needs attention today" list - click a line to go there |
| **Buttons in the header** | The dark title bar of each screen | Save, Print, Exit … sit on the right of the title. The key is shown as a small badge, e.g. **Save F2** |
| **Keys list** | **⌨ Keys** button in the title bar | Every keyboard shortcut of that screen |
| **Row buttons** | End of each table row (Users, Customers, Account Master, Vouchers, Bank …) | ✏ Edit, 🗑 Delete, 📖 Ledger … for that row - same as the toolbar buttons |
| **Columns** | Small columns icon in a table header | Hide / show columns - remembered on this computer |
| **Search highlight** | Any list with a search box | The text you typed is marked in yellow |
| **Search & jump (Ctrl+K)** | Search box in the header | Loans, customers, phone, barcode - and screen names; with nothing typed it shows **recent screens** and **recently opened** loans / customers |
| **Bottom bar** | Bottom of the window | Today · this month · loan book · items needing attention - click any figure to open its screen |
| **Drawers and popups** | Forms and questions | Side panels with **Full size** and **Close Esc** buttons; short questions as a small box in the middle |
| **Phone / tablet** | Narrow screens | ☰ Menu button, tables become cards |
| **Counter screens fit any screen** | New Loan, Release, Part Payment, Top-up, Re-loan, Edit Loan | Each column scrolls when it is full; the total and Save button stay in view at the bottom; weight, purity and value boxes are wide enough for big numbers |

## New screens
| Screen | Menu | Chapter |
|---|---|---|
| **Business Analytics** | Reports → Business Analytics | *Business Analytics and Advisory* |
| **Advisory** | Help → Advisory | *Business Analytics and Advisory* |
| **System Health** | Settings → System Health | *Settings* |
| **Appearance** | Settings → Appearance | *Settings* |

## New helpers
- **Item templates** on New Loan - save "Chain + 2 rings" once, use it again (chapter *New Loan*).
- **Save messages with buttons** - after saving a loan / release the message has **Print** and **Open loan**.
- **Unsaved changes** - a form you changed asks *Discard changes / Keep editing* before it closes.
- **Password suggestion** - Change password and New User have a **Suggest** button and a strength bar.

## Branch licence and contact numbers
| What | Where | What it does |
|---|---|---|
| **Licence no for each branch** | Settings → More → Branches | Must be filled for every branch. Printed on that branch's bills and receipts in place of the company licence |
| **Contact numbers for each branch** | Settings → More → Branches | 1 number must be filled, add more with **+ Add number** (up to 5). All are printed on the bill |
| **Shown on screen** | Header, Branch box, bottom bar, Help → About | The selected branch's licence no and numbers |
| **Shown on paper** | Loan bill, pawn ticket, receipts, notices, estimate, printed reports | The loan's own branch - even when you work in *All Branches* |
| **Customer status link** | The customer's phone | One **Call** button for each number of the branch, and the licence no |

Old branches keep their phone as the first contact number. Fill the licence number of each branch once - until then the company licence is printed.

## Interest by days and one bill for interest + part amount
| What | Where | What it does |
|---|---|---|
| **Interest + part amount on one receipt** | Loan → Part Payment | Fill the interest and the part amount together - one receipt, both lines on it |
| **Interest by Months / Days / Amount** | Loan → Part Payment, *Interest* (F2 changes) | Charge whole months, a number of days (7, 15, 21, 30 or any), or type the amount |
| **Loan bill: terms, photos, contact** | Loan bill (A4) | Terms & conditions page prints by default; customer photo falls back to the customer's record; branch contact numbers on the acknowledge card |
| **Interest Auto or Manual everywhere** | New / Old Loan (advance), Part Payment, Top-up, Release, Re-loan, Loan Counter | One *Interest* box: Auto, or Months / Days / Amount with a rate % - chapter *Interest - Auto or Manual* |
| **Penal interest Auto or Manual** | Loan → Release | Penal (late) interest: Auto, a typed Amount, or None; less than Auto needs the manager's approval with the interest and discount |
| **Interest rate box everywhere** | Every Interest box (incl. advance interest), Part Payment, Interest Calculator → Quote | *Days* shows the rate per day, *Months* per month; type any rate; change the unit and the number converts; *= ₹ a day · ₹ a month* shows what it comes to |
| **Rate in any unit** | Every Interest box (Months / Days) and Part Payment | % / month, % / year, % / day, ₹ / day or ₹ / month - printed on the receipt with its unit |
| **Rate % / month for this payment** | Loan → Part Payment (Months / Days), Release (Days) | Type a rate such as 1.25 instead of the loan's 1.5 - used for that receipt only and printed on it |
| **Charge interest at release** | Loan → Release Loan, *Charge interest* | Full (system) / Days / Amount - e.g. closed after 3 days, charge 7 or 15 days |
| **Approval** | Release | Interest below the system figure counts like a discount - above the limit it needs a manager's password |
| **Minimum days** | Settings → System Control → *Interest by days: minimum days* | Staff cannot charge fewer days than this |

## Optional automations (off until switched on)
In **SMS / WhatsApp → Auto SMS Rules → Automations** (chapter *SMS and WhatsApp*):
- **Daily summary to the owner** by SMS.
- **Birthday wishes** to customers with an open loan.
- **Gold-rate watch** - a reminder when loans come close to the value of their gold.
- **Customer loan-status link** - a view-only page the customer opens on their phone.

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
   - **Item templates** - for jewels that often come together. Add the items once, then **Templates ▾ → Save these N items as a template** and give a name (e.g. *Chain + 2 rings*). Next time: **Templates ▾ →** pick it - the first item fills in and the cursor waits in *Gross Wt*; weigh, press Enter, and the next item fills in by itself (a green *Next: …* bar shows what is coming, **Stop** ends it). Templates keep item names, pcs, metal and purity - **never weights**. Every counter shares them; ✕ (on hover) removes one.
4. **Loan amount** - type the amount. The **Loan to value** bar turns green / orange / red. Above the warning limit (85%) the app asks *"Loan is xx% of item value. Continue?"* before saving.
5. **Interest % p.m.** (from the scheme, can be changed) and **Interest type** - *Compound* or *Flat*.
5a. **Loan Int. % P.M.** - the loan's own rate (from the scheme; change it if agreed). It is used every month until release and printed on the bill. The blue **ⓘ line** under it says how the scheme counts the interest - *by months* (MyBook: every started month), *by exact days* or *by half / full months* - with its minimum days. Pick the scheme that matches what you agreed with the customer.
6. **Doc. charges** (if any) and **Advance interest** - **Auto** takes the scheme's advance months now; **Months / Days / Amount** take what you choose (e.g. 15 days); **None** takes nothing. F6 switches Auto ↔ None. The *Advance rate* inside the box follows **Loan Int. %** - type there only if the advance alone needs another rate. See *Interest - Auto or Manual* ("Two rate boxes").
7. **Item photo** - Camera, Browse (choose a file) or Old Photo (the customer's last photo).
8. **Save Loan (F2)** → enter the bill book no (if you use paper bill books) → **Pay customer**: choose Cash / UPI / Card / Cheque and the amount → **Confirm**.
9. The loan bill prints (two copies if set): **page 1** - company logo, name, branch licence no and numbers; customer details; interest table; the **customer photo** (taken with the loan, else the photo in the customer's record), the jewels and the **item photo**; declarations, promissory note and receipt. **Page 2** - terms & conditions. **Page 3** - acknowledge card (customer copy) with the same photos and the working hours / contact line. The message *Loan details saved* has **Print** (print again) and **Open loan** (Loan Counter) buttons. The sticker for the jewel packet can be printed from **Loan → Print → Jewel Packet Sticker (F9)**.

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
| F6 | Advance interest Auto ↔ None |
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
| **Charge interest** | **Auto** (the system figure above) or Manual: **Months**, **Days** or **Amount** - see below |
| **Penal (late) interest** | **Auto** (from the scheme's penal rate, after the due date), **Amount** (type it) or **None** |
| Against ticket / Post / other charge | Type if you collect any |
| Discount | Above ₹500 (System Control) needs a manager's password |
| **Total to receive** | What the customer pays now |

   **Charge interest** - how much interest to take now:
   - **Auto** (usual) - the system figure: every started month.
   - **Months** - months from the loan date at the loan's rate or a typed rate %, less interest already paid.
   - **Days** - type the days or press **7 / 15 / 30**, and the **rate %** (filled with the loan's rate; type e.g. 1.25 to charge a lower rate). Interest = interest per month at that rate ÷ 30 × days, less interest already paid (and advance). A typed rate is printed on the release receipt. Use it when the customer closes early - e.g. after 3 days, charge 7 or 15 days instead of a full month.
   - **Amount** - type the interest to take now.
   - The last line shows the amount taken (*Manual · 7 days ₹175*). If it is **less than Auto**, the line *Less than auto* shows the difference. That difference is counted like a **discount**: together with any discount, above the limit in System Control (e.g. ₹500) it needs a manager's password. It is saved in the audit trail.
   - A *minimum days* set in System Control cannot be gone under.
   **Penal (late) interest** - extra interest after the due date, when the scheme has a *penal rate* (Masters → Loan Schemes). *Auto* shows the figure and the days past due (*not past the due date* = ₹0). **Amount** - type what you take (it can also add a late charge when Auto is 0). **None** - take no penal. Taking less than Auto counts together with the interest reduction and the discount for the manager's approval, and is written in the Audit Trail.
3. **Customer unable to release** - tick it if the customer only signs (amount collected later).
4. **Release Loan (F2)** → **Receive Payment · Loan 6 / Book 103**: Cash / UPI / Card / Cheque - press **Add (Enter)** for each part until Balance is 0.
5. **Released by (F6)**: *Customer (self)* or *Other person* - type the name, mobile and relation / ID of the person who takes the jewels.
6. **Confirm Release (F2)**. The **Release Receipt** prints (No, Loan No · Bill Book, customer, items in capitals with weight, loan amount, interest - "(N months)" or "(N days)" -, less advance, total received in words, paid by). The loan becomes **Released** and its items leave the stock.

*Running* shows months and days (e.g. 22 m 10 d); *Days interest* counts the actual days from the loan date.

## Example
Loan of ₹50,000 at 1.5% p.m. compound, advance ₹750, released after 3 months 10 days:
- Interest · 4 months = 4 × 750 = ₹3,000
- − Advance interest ₹750
- **Total to receive ₹50,000 + 2,250 = ₹52,250**

Same loan closed after **3 days**, charged **7 days** (no advance): ₹750 per month → 750 ÷ 30 × 7 = **₹175** instead of ₹750 - *Less than auto ₹575* (needs the manager's password when the limit is ₹500).

## Good to know
- Only look, no release? Load the loan, read the total, press **New / Clear (Ctrl+N)** - nothing is saved.
- **Loan Details (F7)** shows the whole history of the loan.
- A loan pledged with a bank cannot be released until it is released from the bank (Bank → Release from Bank).
- Release by mistake? A manager can cancel the last entry from **Loan Details** the same day.

---

# Part Payment & Interest (F5)

**Loan → Part Payment** - the customer pays interest, pays back part of the loan amount, or **both on one receipt**, and keeps the loan open.

The **Receive** panel on the right has two parts:
- **Interest** - charged by **Months**, **Days** or a typed **Amount** (the small switch next to *Interest*; F2 changes between them), at the loan's rate or a rate you type in any unit (% / month, % / year, % / day, ₹ / day, ₹ / month).
- **Part amount** - optional (F3 goes to the box). Leave it 0 to take interest only.

**Total to receive** = interest + part amount (when both are taken, the split is shown under the total).

## 1. Load the loan
Type the **loan no** → **Load** (Enter). The **Interest months** strip shows each month: advance, paid, paying now, due, not yet. Next to *Interest* the amount still **due** is shown.

## 2. Interest - choose how to charge
| Mode | How | Amount |
|---|---|---|
| **Months** (usual) | **+ / −**, or *None*, *1 month*, *3 months*, *All due* | interest per month × months |
| **Days** | Type the days, or press **7 / 15 / 21 / 30 days** | interest per month ÷ 30 × days (rounded to the rupee) |
| **Amount** | Type the interest amount | the amount you type |

**Interest rate** and **unit** (under Months / Days) - shows the loan's rate: **% / month** with Months, **% / day** with Days (e.g. 1.5% a month = 0.05% a day). Type another rate (e.g. **0.04** a day or **1.25** a month), or pick another unit - **% / year**, **% / day**, **₹ / day**, **₹ / month** - the number is converted so the money stays the same, then type yours. The boxes turn amber, the line *Rate 0.04% a day for this payment only (loan rate 1.5% p.m.)* appears, and **Use loan rate** (above the box) puts it back. *= ₹ a day · ₹ a month* under the box shows what the rate comes to. See the step-by-step in *Interest - Auto or Manual*.
- The typed rate is used **only for this receipt** and printed on it with its unit (*Interest Rate 1.25% p.m.*, *₹20 a day*). The loan keeps its own rate - to change the rate for good use **Loan → Edit Loan Record**.
- Interest taken at a lower rate is counted as paid; what the loan rate still asks for stays due (it shows as *due* next time and at release, where it can be settled with *Days* / *Amount*).

*Paid up to (after save)* moves on by the months or days charged (for *Amount*, by the days that amount covers).

Use **Days** when a whole month is too much - for example the customer comes after 10 days and the shop decides to take 15 days' interest.

If the owner set a **minimum days** (System Control → *Interest by days: minimum days*), fewer days cannot be saved and the smaller buttons are greyed out.

> Nothing is lost by taking less now: everything paid is counted, and the rest stays due. It shows as *due* next time and at release.

## 3. Part amount (optional)
Type the amount paid back, e.g. ₹5,000. The line under *Part amount* shows *Outstanding ₹55,000 → ₹50,000*.
- Interest **and** part amount → **one receipt** (Part Payment receipt) with both lines.
- Part amount only → set interest to *None* (Months) or 0.
- The part amount must be less than the outstanding; to pay everything use **Release**.

> Like MyBook, **interest stays on the original loan amount** after a part payment. The part amount is taken off what the customer owes at release.

## 4. Payment and save
1. **Payment mode** - Cash / UPI / Card / Cheque, amount, reference → **Add (F4)** until Balance is 0 (no lines = all cash).
2. **Save & Print Receipt (F10)** or **Save only**.

## Examples
Loan ₹55,000 at 1.5% → interest per month ₹825, a day ₹27.50.
- **Months:** 3 months = **₹2,475**.
- **Days:** 15 days = 27.50 × 15 = **₹413**.
- **Typed rate:** 1 month at **1.25%** = 55,000 × 1.25% = **₹688** (instead of ₹825).
- **Rupees a day:** 10 days at **₹20 / day** = **₹200**.
- **Daily %:** loan ₹30,000, 10 days at **0.04% a day** = 30,000 × 0.04% × 10 = **₹120**.
- **Both on one bill:** 15 days interest ₹413 + part amount ₹5,000 = **₹5,413** - one receipt, new outstanding ₹50,000.

## Good to know
- Interest receipts are taken off at release (*Interest already paid*).
- **F5** on this screen clears it for the next customer.
- The receipt shows *Interest Months* (with from–to dates) or *Interest Days* (with the paid-up date), the *Interest Rate* when one was typed, interest received, part amount received, outstanding after it, and the payment modes.
- Paying **by months after an earlier payment by days / amount**: the part of the month already paid is taken off (*Less part of a month already paid*), so nothing is charged twice. *All due* always equals the interest due.
- **Payment history** shows the period (months or days), the typed rate, and *Int + Part* when both were taken on one receipt.
- **Who can do what**: a role with only *Interest Receipt* takes interest only (part amount box is locked); a role with only *Part Payment* takes the part amount only. The screen opens for either.
- A **closed** loan, or **All Branches** selected, cannot take an entry - the panel says why (with a *Switch to branch* button) and Save is locked.
- UPI / Bank / Card / Cheque need a bank account of the branch; if there is none the panel says so (add it in **Bank → Bank Accounts**).
- **+ / −** change the months only when you are not typing in a box (a "-" in a UTR number is typed normally).
- A loan of **another branch** shows *Loan not found in this branch* - check the loan no or switch to the loan's branch.

---

# Top-up Loan

**Loan → Top-up Loan** - give extra money on the same loan number and the same jewels.

Rules (like MyBook):
- Allowed only **within 3 days** of the loan date (System Control → "Top-up allowed within days").
- **Not** allowed on an Old Loan Entry - use Re-loan.

Steps
1. Type the loan no → Enter. The right side shows *Loan amount now*, *Items value today*.
2. **Top-up amount** - e.g. ₹1,000 → *New loan total* ₹51,000, *Interest / month (new total)* ₹765, LTV bar.
3. **Interest deducted now** - **None** by default (the full top-up is paid). Choose **Auto** to deduct the interest due, or **Months / Days / Amount** (with a rate %) to deduct what you agree; it is taken off the amount paid and printed on the receipt.
4. **Give Top-up (F2)** → pay the customer (cash / UPI …). Interest from now is on the new total.

# Re-loan

**Loan → Re-loan** - close the old loan and make a new loan with the same jewels in one step (also called renewal).

Steps
1. Type the **old loan no** → Enter. Top: *Interest · N months*, *Paid before*, *Old loan total*.
2. **New loan amount** - same amount by default; type more or less. Interest % and Flat / Compound come from the old loan (change if needed). **Advance interest (F6)** on the new loan: Auto / Months / Days / Amount / None. **Interest on old loan**: Auto (due + penal) or Manual - months / days from the loan date at a typed rate, or a typed amount. Taking less than Auto needs the manager's login above the discount limit (see *Interest - Auto or Manual*).
3. Add / remove items if the customer takes back or adds a jewel. Gold items are valued at today's gold rate and **silver items at today's silver rate**; a silver loan stays a silver loan.
   - The new loan gets the **next bill book no** when the old loan had one (example: old bill book 2 → new loan bill book 3).
4. The box at the bottom says **Receive from customer** (green) or **Pay to customer**.
5. **Save Re-loan (F2)** → take / give the money → the new loan bill prints. The old loan shows *Re-loaned*.

Example (flat 1.5% on ₹12,345, 22 months, advance ₹185):
- Old loan total = 12,345 + (22 × 185) − 185 = **₹16,230**
- New loan ₹12,345 with advance ₹185
- **Receive from customer = 16,230 − 12,345 + 185 = ₹4,070**

Example (silver, flat 2%, same day): old loan ₹3,000 on a 50 g silver article (92% → 46 g × ₹100 = **₹4,600**), advance ₹60 already taken.
- Old loan total = ₹3,000 (first month covered by the advance)
- New loan ₹3,500, advance 2% = ₹70 → LTV 76.1%
- **Pay to customer = 3,500 − 3,000 − 70 = ₹430**

---

# Interest Calculator

**Loan → Interest Calculator** - interest due on every open loan up to any date (nothing is saved).

1. **Pledged from / to** - which loans (by pledge date). **Interest up to** - the date to work out interest (today, or a future date to tell the customer).
2. Filters: Metal (All / Gold / Silver / Mix), Where (All / In hand / At bank), Older than (Any / 6 / 9 / 12 months), Search (F3).
3. **Calculate (F5)**. Tiles: open loans, loan amount due, interest due, total due, average age.
4. Click a loan - the right panel shows ROI, months, loan amount, part paid, total interest, advance, paid earlier, interest due, total due.
5. **Print Preview (F9)**, **PDF (Ctrl+P)**, **Excel (Ctrl+E)**.

Example: ₹12,345 compound 1.5% pledged 05/01/2025, up to 05/11/2026 = 22 months → interest ₹4,407 − advance ₹185 = **₹4,222 due**.

## Quote a customer - schemes and manual rate
**Quote a customer** tab: loan amount, loan date, *Calculate till*.
- **Calculate schemes** - every scheme side by side (days, charged days, rate, interest, total).
- **Manual quote** - any **Interest rate** in any unit (% / month, % / year, % / day, ₹ / day, ₹ / month). It shows the interest three ways: **By days** (days × a day), **By full months** and **By started months** (every started month, like the scheme). *Default rate* goes back to the default rate in System Control.

Example: ₹50,000 from 13/08/2026 to 13/11/2026 (92 days) at **₹20 / day** → by days **₹1,840**, by months 3 × ₹600 = **₹1,800**.

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

On the Loan Counter, every action (Interest, Part payment, Top-up, Release, Renew) has the **Interest** box: **Auto** or Manual **Months / Days / Amount** with a rate % (see *Interest - Auto or Manual*). A release or renew for less than Auto asks for the manager's login above the discount limit.

**Loan → Loan Details** - everything about one loan in one place.

1. Find the loan (loan no / bill book no / customer).
2. Tabs: **Bill** (items, photo), **Interest / Part payment / Top-up / Renew / Release** buttons go to those screens, **History** - every receipt.
3. In **History**, the printer icon reprints that receipt; the undo icon (manager) **cancels the last entry** of the loan (wrong release, wrong receipt) with a reason.
4. **Bill** button prints the loan bill again.

The bill heading shows the **licence number** and **contact numbers of the loan's branch** (set in Settings → More → Branches); the *Branch* row of the bill lists all the branch's numbers. Receipts (release, part payment, top-up) and the pawn ticket print the same.

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

# Interest - Auto or Manual

Every screen that takes interest has the same **Interest** box. The app works out the interest by itself (**Auto**) from the scheme and the loan's rate - or you take it **Manual**, the way you agree with the customer.

| Mode | What it charges |
|---|---|
| **Auto** (green) | What the app works out - the scheme rules (every started month, compound / flat, advance months). Same as before. |
| **Months** | A number of months × interest per month. |
| **Days** | A number of days × the interest of one day (a month ÷ 30, or the day figure of the unit you pick - see *Rate units*), rounded to the rupee. Quick buttons **7 / 15 / 30**. |
| **Amount** | The rupees you type. |
| **None** | No interest (only where that makes sense: advance interest, interest deducted on a top-up, interest with a part amount). |

Manual modes show **amber**. With **Months** and **Days** the box has an **Interest rate** row: a number box and a **unit** list.

- It **follows the mode** until you type: **Months** shows the loan's rate **% / month** (e.g. 1.5), **Days** shows it **% / day** (e.g. 0.05). The small text *loan rate - type to change* means the loan's own rate is used.
- **Type a rate** to charge this entry at your rate - the boxes turn amber and *Use loan rate* appears (click it to go back).
- **Change the unit** any time - the number is converted so the money stays the same (1.2 % / month → 0.04 % / day → 14.4 % / year → ₹20 / day on ₹50,000). Then type your rate in that unit.
- The line under it shows what the rate comes to: **= ₹25.00 a day · ₹750.00 a month**.
- The typed rate and its unit are printed on the receipt (*Interest Rate 0.04% a day*) and shown in Payment history (*10 days at 0.04% a day*). The loan keeps its own rate.

## Rate units
| Unit | Example | A month | A day |
|---|---|---|---|
| **% / month** (the loan's own) | 1.5% on ₹50,000 | ₹750 | ₹25 (month ÷ 30) |
| **% / year** | 18% on ₹50,000 | ₹750 | ₹24.66 (year ÷ 365) |
| **% / day** | 0.05% on ₹50,000 | ₹750 (× 30) | ₹25 |
| **₹ / day** | ₹20 | ₹600 (× 30) | ₹20 |
| **₹ / month** | ₹700 | ₹700 | ₹23.33 (÷ 30) |

When you change the unit, the box first shows the loan's own rate in that unit (1.5% a month = 18% a year = ₹25 a day on ₹50,000); then type your rate. Months use the monthly figure, Days the daily figure. % / year counts a day as 1/365 of the year, so 30 days come to a little less than a month (₹740 against ₹750).

The line at the bottom always shows what will be charged: *Auto · 4 months ₹3,000* or *Manual · 15 days ₹375*, and **Auto would be ₹…** so you can compare.

## How Auto counts the loan's interest - days or months?
The loan's rate is typed per month (or per year). **How the time is counted** comes from the loan's **scheme** (Masters → Loan Schemes → *Calculate by*). New Loan and Re-loan show it in a blue line under the rate, e.g. *ⓘ GL001 counts interest by exact days - a day = yearly rate ÷ 365 · minimum 7 days*.

| Calculate by | Counts | 40 days is charged as |
|---|---|---|
| **MyBook** | every started month is a full month (minimum 1 month) | 2 months |
| **Exact days** | the actual days; a day = yearly rate ÷ 365 (or monthly rate ÷ 30) | 40 days |
| **Months (half / full)** | half and full months - up to 15 extra days (System Control) = ½ month | 1½ months |

*Minimum days* and *grace days* of the scheme are shown on the same line. To charge one receipt differently, use **Manual → Days / Months** in the Interest box.

## Is interest charged on the advance?
No. **Advance interest is interest paid early.** On a ₹50,000 loan at 1.5% a month with 1 month advance, ₹750 is kept back and the customer gets ₹49,250. The ₹750 counts as **interest already paid** - it is taken off at Part Payment / Release (*− Advance interest*). The loan amount stays ₹50,000 and no interest is charged on the ₹750.

## Two rate boxes on New Loan / Re-loan - are they the same?
No - they do different jobs:

| Box | What it is | Used for |
|---|---|---|
| **Loan Int. % P.M.** (top of the Loan panel) | The **loan's own rate**, saved on the loan and printed on the bill | Interest of the loan **every month till release** (Auto everywhere uses it) |
| **Advance rate (only for this advance)** - inside *Advance interest*, with Months / Days | The rate for the **advance taken today** only | The advance deducted now. Nothing else. |
| **Rate for the old loan** - inside *Interest on old loan* (Re-loan) | The rate to settle the **old** loan | The old loan's interest only |

- Until you type in the advance box it **is the loan rate** - it follows the top box live (1.5% a month shows as 0.05% a day) and says *same as Loan Int. % above (1.5% p.m.)*.
- Type a different number there **only** when the advance should be at another rate (e.g. 15 days at 0.04% a day). The loan itself keeps the top rate.
- **Use Loan Int. % above** makes it follow the top box again.
- On Release, Part Payment, Top-up and the Loan Counter there is only the Interest box: the loan's rate is already fixed on the loan (shown at the top of the screen); the rate in the box is for that one entry.

## How to - step by step
**A. Charge some days at a daily rate** (customer closes / pays after a few days)
1. In the Interest box press **Days** (Part Payment: F2 until *Days*).
2. Type the days (or press **7 / 15 / 30**). The rate shows the loan's rate per day.
3. To use your own rate, type it in **Interest rate** - e.g. **0.04** with **% / day**.
4. Check the lines: *= ₹… a day*, *10 days × ₹… a day*, and the bold *Manual · 10 days at 0.04% a day ₹…*. Save.

**B. Charge some days at a monthly rate** (the shop thinks in % a month)
1. **Days**, type the days.
2. Change the unit to **% / month** and type the rate - e.g. **1.25**. The days are charged at 1.25% a month ÷ 30 a day.

**C. Charge rupees a day** (fixed amount a day)
1. **Days**, type the days, unit **₹ / day**, type the rupees - e.g. **20**. 10 days = ₹200.

**D. Charge months at a different rate**
1. **Months**, type the months (+ / −). The rate shows the loan's **% / month**.
2. Type your rate (e.g. **1.25**), or pick **% / year** (e.g. 15) or **₹ / month** (e.g. 700).

**E. Take a fixed interest amount** - **Amount**, type the rupees. No rate is needed.

**F. Advance interest at New Loan / Re-loan** - **Advance interest (F6)**: Auto (scheme months), or **Days** / **Months** with any rate and unit (e.g. 15 days at 0.05% a day), **Amount**, or **None**.

**G. Quote before deciding** - **Loan → Interest Calculator → Quote a customer**: *Manual quote* takes any rate and unit and shows the interest **by days**, **by full months** and **by started months** for the dates you set. Use the same mode, rate and unit in the Interest box.

## Where it is
| Screen | Box | Months / Days count from |
|---|---|---|
| **New Loan / Old Loan entry** | *Advance interest (F6)* - F6 switches Auto ↔ None | the coming period |
| **Part Payment** | *Interest* (Months / Days / Amount, rate + unit) - see *Part Payment & Interest* | where the paid interest ends |
| **Top-up** | *Interest deducted now* - **None** by default | where the paid interest ends |
| **Release** | *Charge interest*, and *Penal (late) interest* (Auto / Amount / None) | the loan date (interest already paid is taken off) |
| **Re-loan** | *Interest on old loan* and *Advance interest (F6)* on the new loan | old loan: the loan date · advance: the coming period |
| **Loan Counter** | *Interest* on Interest / Part payment / Top-up / Release / Renew | Interest, Part, Top-up: where paid interest ends · Release, Renew: the loan date |

## Taking less than Auto
- **While the loan stays open** (Part Payment, Top-up, Counter interest): what is not taken now **stays due** - it shows next time and at release. No approval needed.
- **When the loan closes** (Release, Re-loan, Counter release / renew): the difference is a concession. The line *Less than auto* shows it. Together with any discount, above the limit in **System Control → Release: discount without admin** (e.g. ₹500) a manager / admin must type their login (**Admin approval**). Every reduction is written in the **Audit Trail** (*INTEREST_REDUCED*: system figure, charged, days, rate).
- **Minimum days** (System Control → *Interest by days: minimum days*): Days cannot go below it.

## By role
| Role | What to know |
|---|---|
| **Cashier** | Leave it on **Auto** unless the shop agreed otherwise. For a short loan use **Days** (7 / 15 / 30) - the rate box switches to % / day by itself; for a special rate type it (and pick the unit the customer agreed). Check the *= ₹ a day · ₹ a month* line before saving. Closing a loan for less than Auto above the limit asks for a manager's login - ask the manager to type it on your screen. |
| **Branch Manager** | Approves reductions (*Admin approval* box: your username and password). Sets **Interest by days: minimum days** and **Release: discount without admin** in **Settings → System Control**. Checks reductions in **Settings → Audit Trail** (action *INTEREST_REDUCED*). |
| **Owner / Super Admin** | Same as Branch Manager, for all branches. Decides which roles may take interest (**Interest Receipt** permission) and part amounts (**Part Payment** permission) in **Users & Roles**. |
| **Accountant** | The accounts show the interest actually taken (interest income = what was received). A reduction is not posted as a discount - it is simply less interest income; only the *Discount* box goes to the discount account. Receipts show the days, rate and unit used. |
| **Viewer** | Payment history (Loan Details, Part Payment) shows the period (*10 days*), the rate (*at 1.25% p.m.*) and *Int + Part* when both were taken on one receipt. |

## Examples
Loan ₹50,000 at 1.5% p.m. → ₹750 a month, ₹25 a day.
- **Release after 3 days**: Auto = ₹750 (1 month). *Days* → **7** → ₹175. *Less than auto ₹575* - needs the manager's login when the limit is ₹500.
- **Re-loan after 4 months at a lower rate**: *Interest on old loan* → *Months* 4, rate **1.2** → 50,000 × 1.2% × 4 = **₹2,400** instead of ₹3,000. The new loan keeps its own rate (Interest % box).
- **New loan, advance for half a month**: *Advance interest* → *Days* **15** → ₹375 instead of ₹750.
- **₹20 a day for 10 days** (special rate): *Days* **10**, unit **₹ / day**, rate **20** → **₹200**.
- **15% a year at release after 196 days** on ₹40,000: *Days* **196**, unit **% / year**, rate **15** → 40,000 × 15% ÷ 365 × 196 = **₹3,222**.
- **Top-up with 10 days' interest deducted**: top-up ₹5,000, *Interest deducted now* → *Days* **10** → ₹250 deducted, ₹4,750 paid out.

---

# Pledge Book

**Records → Pledge Book** - the register of all loans.

- Tiles: **Total loans**, **Pending**, **Released**, **In Bank**, **Auctioned**, **Cancelled** - count and amount.
- Each row: loan no, bill book no, loan date, customer, metal, items (e.g. *CHAIN 1* = item and pieces), weights, **loan amount** (the first amount + any top-up), ROI %, advance interest, item value, settle-before date, **status** and release no.
- Status words: **Pending** (open, in the shop), **In Bank** (open, pledged with a bank), **Released** (closed - also an old loan closed by Re-loan), **Auctioned**, **Cancelled**.
- Filters: date range (loan date or release date), metal, loan amount from - to, search (F3). Oldest loans first.
- Double-click a loan for its details. **Print (F9)**, **PDF (Ctrl+P)**, **Excel (Ctrl+E)**, **Refresh (Ctrl+R)**.

Example (one day of the sample data): 4 loans ₹82,500 - Pending 1 (₹3,500), Released 2 (₹54,000: loan 1 ₹51,000 with its ₹1,000 top-up, loan 2 ₹3,000), In Bank 1 (₹25,000).

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

**Loan status link** (in the ledger, when switched on - chapter *SMS and WhatsApp*): **Make a link** → **Copy link** or **Send on WhatsApp**. The customer opens it on the phone and sees only their open loans - balance, interest due today, amount to close, settle-before date, last payments. It also shows a **Call** button for each contact number of the branch, and the branch licence number. No address, photo, ID or other customers; view only. The box lists the links working now (made by, works till, opened N times) - **Cancel** stops one at once.

**Row buttons** in the customer list: 👁 details · 📒 ledger · ✏ edit.

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
2. The list shows as soon as the screen opens. Change Metal, Include (in shop + bank / in shop only) or the dates → **Show (F5)**.
3. All loans are ticked - untick what you do not want (Space / click, Ctrl+A, Ctrl+D). "3 LOANS" means the customer has several loans in the list.
4. Notices to customers:
   - **First Notice (F6)** - a **Pre-Auction Notice** for each customer (Ref No FN/loan no): all the customer's ticked loans in one table (loan no, pledge date, loan amount, items, net weight, total), pay within 15 days, *Note: Last Final Notice*.
   - Every notice heading shows the loan's branch **licence number** and **contact numbers**.
   - **Registered Notice (F7)** - set **Auction date and time** (default 15 days after the billing date). An **Auction Notice (Registered Post)** for each customer (Ref No RN/loan no) with the auction date, time and place in a box; postage is added to the loan.
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
4. **Save Voucher (F10)**. The next voucher no is shown at the top (V. No).
5. The list on the right shows the day's vouchers with the account name, Cash / Bank and Jama / Nave totals. **Auction sale** receipts are listed too (read only - change them in Auction Release). Double-click your own voucher to edit, **Del** to delete (manager). *All Vouchers* lists every voucher.

Example: Jama · Capital · ₹10,000 · Cash · "Capital introduced" → Jama total ₹10,000, cash effect + ₹10,000.

Example: Payment · Rent · ₹8,000 · Cash · "Shop rent November".

> **Interest in the accounts** - every receipt posts the interest actually taken to *Interest income*: Auto or Manual (months, days, typed amount, typed rate). Taking less than Auto at release / re-loan is not a discount entry - it is simply less interest income. Only the **Discount** box is posted to the *Discount* account.

## Account Master
**Accounts → Account Master** - add accounts (ledgers) under a group: Rent, Electricity, Capital A/c (owner), Staff advance …

## Account Ledger, Cash Book / Day Book
- **Account Ledger** - one account between two dates with opening and running balance.
- **Cash Book / Day Book** - every cash entry of the day / period (F4 switches).

## Bank Reconciliation
**Accounts → Bank Reconciliation** - choose the bank account, tick the entries that appear in the bank statement and give the bank date. The bottom shows *as per books*, *not yet in bank*, *should be in bank*.

## Final Accounts
**Accounts → Final Accounts** - **Trial Balance**, **Profit & Loss**, **Balance Sheet** for any dates (F5 show, F9 print, Left / Right = next report).

**Books** - choose how the accounts are grouped (the app remembers your choice):
- **MyBook heads** (default) - the same heads as the Day Report and the desktop app: 1 Girvi, 2 Interest, 4 Document Charges, 5 Ashal Jama (part amounts), 6 Interest Jama, 8 Auction, 9 Potali, 10 Potali Interest, 11 Bank Loan Charges, 13 Old Loan Opening, your own accounts (Capital, Rent …) and Cash in hand.
- **Detailed ledgers** - every account of the books (Gold Loans to Customers, Interest Received, Bank Gold Loan …). The money is the same; part payments are taken off the loan balance and old loans sit in Capital.

Example (one day: loans ₹50,000 + ₹3,000 + re-loan ₹3,500 + top-up ₹1,000, old loans ₹12,345 + ₹25,000, part payment ₹5,000, interest ₹555, bank pledge ₹15,000, auction sale ₹20,000, capital ₹10,000):

| Trial Balance (MyBook heads) | Nave (Dr) | Jama (Cr) |
|---|---|---|
| 1 Girvi | 28,500 | |
| 2 Interest | | 895 |
| 5 Ashal Jama | | 5,000 |
| 6 Interest Jama | | 555 |
| 7 / 14 Capital | | 10,000 |
| 8 Auction | | 7,655 |
| 9 Potali | | 15,000 |
| 11 Bank Loan Charges | 100 | |
| 13 Old Loan Opening | | 37,345 |
| Cash in hand | 47,850 | |
| **Total** | **76,450** | **76,450** |

Profit & Loss: income 895 + 555 = ₹1,450, expenses ₹100, **net profit ₹1,350**. Balance Sheet: ₹76,350 on both sides (Capital 10,000 + profit 1,350 + Ashal Jama + Auction + Potali + Old Loan Opening = Girvi 28,500 + Cash 47,850).

> Cash in hand in the Trial Balance must equal the Day End *Pote Baki* (right tile). If it does not, an entry is missing from the Day Report.

## Tally Export
**Accounts → Tally Export** - send the accounts to Tally / TallyPrime.
- What is sent (like MyBook): each **Day Report row of a closed day** as Payment / Receipt vouchers, **old loan** opening journals, **auction sale** receipts. Close the day (Day End) first.
- **Ledgers tab** - rename each ledger and choose its Tally group to match your Tally company → **Save Ledger Names**. Tally address (localhost : 9000) → **Test Tally**.
- **Send to Tally (F2)** - TallyPrime must be open with *TallyPrime acts as Server* on. **Save XML Files (F6)** - import later in Tally (Gateway → Import Data).
- **Export History** - what was sent and when.

## Cash Denomination
**Accounts → Cash Denomination** (or **F6** on Day Report / Day End) - count the drawer: number of ₹2000, ₹500, ₹200, ₹100 … notes and coins (Enter = next note, F2 = save). The difference with *cash should be in drawer* is shown on Day End.

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
2. **Count Cash (F6)** if not done - the *Cash Count* drawer opens over the report: type the number of ₹2000, ₹500, ₹200 … ₹1 notes / coins (**Enter** = next note), then **Save Count (F2)**. *Difference* shows **Cash Tally** when the drawer matches.
   - Example: Pote Baki ₹47,850 → 95 × ₹500 + 3 × ₹100 + 1 × ₹50 = ₹47,850 → *Cash Tally*.
3. Untick *Print Day Report before closing* if you do not want the print.
4. **Close Day & Move to next date (F10)** → "Everything is OK. Close 10/11/2026 and move to 11/11/2026?" → **Yes, close the day**.
   - *Account posting: N rows will be written* counts the loan-counter rows (Girvi, Interest, Ashal Jama, Interest Jama, Potali, bank charges). Auction sales and your own vouchers are already in the books.
   - If the cash was not counted: "Day End check failed - Cash has not been counted" → **Open Day Report** / **Close the day anyway** / **Go back**.
5. The day is locked, the billing date moves to the next day and **Gold / Silver Rate** opens for the new date.
   - Work goes on in the new date straight away: a customer who comes after Day End (say at 7 pm) is entered on **tomorrow's date**, as in the desktop app. The header, dashboard and every new entry use the billing date.
   - Enter (or copy - **Copy Previous Rate (F5)**) the rate for the new date before giving a new loan.

# Day Close

**Settings → Day Close** - the billing date (OPEN) on top, then the closed days (**Last 60 days / All**): date, status, closed on, by, cash expected, cash in hand (counted), Pote Baki. The top right shows the billing date and how many days were re-opened.
1. Click a day - the panel on the right shows it.
2. **Day Details (F5)** opens the Day Report of that day.
3. **Reopen Day (F3)** - only the last closed day, admin only: type the **reason** (e.g. *wrong release amount*) → Yes. Entries on that day are allowed again.
4. Correct the entry, then **Close Again (F2)** - Day End.

> A backup is taken by itself at every Day End (Backup → history shows *Auto (Day End)*).

> Entries are not allowed on a closed day (System Control → *Lock closed days*). Back-dated entries need the *loan_backdate* permission.

---

# Reports

Interest figures in the reports are the amounts actually received - Auto or Manual. A receipt taken by days or at a typed rate shows it in Loan Details / Payment history (*10 days at ₹20 a day*).

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

# Business Analytics

**Reports → Business Analytics** (also from the home screen → *Business overview* tab → *Open*).

## Choose what to see
1. **Period** - *This month, Last month, 3 months, 6 months, A/c year, 12 months*, or type **From** and **To**.
2. **Show by** - *Auto, Day, Week, Month* (Auto picks days up to a month, weeks up to 4 months, months after that).
3. **Metal** - *All, Gold, Silver, Mix*. Every chart follows it, including the rate charts.
4. **Show** loads the figures again (the quick buttons load at once).

## What it shows
**Six headline figures** - loan amount given, recovered, interest collected, new loans, releases, average loan. Each shows the change against the **same number of days just before** (e.g. +12.5% vs before) - green when it is good for the business, red when not.

**Charts** - each card has a **Chart / Table** switch to see the exact numbers:
- *Loan amount given vs recovered* · *Interest collected* · *New loans vs releases* - per day / week / month.
- *Open loans by age* (0-3, 3-6, 6-9, 9-12, over 12 months) - older loans need follow-up.
- *Loan sizes given*, *Open loans by metal*, *Loan amount by scheme*, *by branch* (when you see more than one branch).

**Loan book health** (as on the To date - the interest figures are estimates):
- *Interest built up, not yet paid* · *Expected interest per month* · *Metal value today* (at today's rate) · *Loans close to their value* (loan + interest is 85% or more of the gold value).
- *Average days to release*, *Released before due date*, *New* and *Returning customers*.

**More**
- *Gold rate* and *Silver rate* in the period (separate charts - their prices are too far apart for one).
- *Busiest days of the week* · *Top areas*.
- *Loans to watch* - loans using 75% or more of today's metal value; click to open the loan.
- *Next 30 days* - loans reaching their settle date per day.
- *Cash count differences* - excess / short per counted day.
- *Best customers* - most interest paid and how many released on time.
- *Branch league* - branches side by side (All Branches).
- *Unusual activity* - loans far above the customer's usual, 3 or more loans for one customer in a day, deletes / voids by user, logins before 7 AM or after 10 PM (the last two only for users who may open the User Log).
- *Top 10 customers* by outstanding - click to open the customer.

## Excel with charts
**Excel with charts** (in the title bar) saves one Excel file with sheets *Summary, Trend, Loan book, Insights, Plan & watch, Top customers*. Each table has its chart as a picture beside it.
> Only charts showing as a chart are drawn; a card switched to *Table* goes in as numbers only.

# Advisory

**Help → Advisory** - what to act on today, in order of urgency.
- **Health score** in the title bar: 100, minus 20 for each *Act now*, 10 for each *Soon*, 4 for each *Good to know*. 85+ Healthy, 60+ Needs attention, below that Act now.
- **Act now** (money or work blocked today), **Soon** (this week), **Good to know**. Each point has an **Open** button to the right screen - e.g. *Enter today's gold rate*, *Day End pending*, *loans past due date*, *loans with little margin left*.
- **Largest open exposures** - the top customers with their **share of the loan book**. A warning shows when one customer holds 20% or more.
- **Look deeper** - Business Analytics, System Health, Interest Calculator.

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
**Masters → Company Information** - name, address, licence, phones, logo, bill heading (see *First-time setup*). The licence number and phones here are the **default**: when a branch has its own licence number and contact numbers (Settings → More → Branches), the branch's are shown and printed.

# Employees, Attendance, Salary, Designations
- **Masters → Employees** - staff records: code, name, phone, address, designation, joining date, basic salary, photos; give a login (username / password) to an employee.
- **Masters → Attendance** - pick the date, mark each person P (present), A (absent), H (half day), L (leave), WO (week off), in / out time → Save.
- **Masters → Salary** - month, basic, allowances, deductions, advance recovery → net → pay by cash / bank (posted to the Salary account).
- **Masters → Designations** - Manager, Cashier, Appraiser …

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
| Release: discount without admin (RDAL) | ₹500 - also covers interest taken below the system figure at release |
| LTV safe / warning % | 75 / 85 |
| Old loan warning (months) | 12 |
| Auction overdue after (months) | 12 |
| Release grace days | 0 |
| Interest by days: minimum days (IMND) | 7 - Part Payment / Release cannot charge fewer days (0 = no minimum) |
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
  - **Terms & conditions** (page 2 of the loan bill) - filled with the standard 20 Tamil clauses (விதிமுறைகளும் நிபந்தனைகளும்), one clause per line; the bill numbers them 1, 2, 3 … Change them here. Left blank, the standard clauses print again; to print no terms page, switch off *Print terms page*.
  - **Acknowledge card footer** - working hours and holidays. The branch's contact numbers are added as *தொடர்புக்கு: …* by themselves, unless the footer already has a contact line.

# Branches
**Settings → More → Branches** - one row for each shop: code, name, city, **Licence no**, **Contact numbers**, manager, loan prefix, opening cash, status.
- **Add Branch** / click a row to edit. **Branch code**, **Branch name** and **Pawn broker licence no** must be filled.
- **Contact numbers (printed on bill)** - the first box must be filled (main number). **+ Add number** adds another box (up to 5); **✕** removes one. Only digits, spaces and + - ( ); the same number cannot be typed twice.
- The licence number and all contact numbers are printed on the branch's loan bill, pawn ticket, receipts, notices and reports, and shown in the header.
- A red **Not set** in the list means the licence number or contact number is still missing.

# Change Company / Branch
**Settings → Change Company / Branch** - switch the working branch (same as the Branch box in the header).

# User Log and Audit Trail
- **User Log** - sign-ins and sign-outs.
- **Audit Trail** - every save, edit, delete, backup, restore … with user, time and details. Filter by user, action, date.
  - **INTEREST_REDUCED** - a release or re-loan that took less interest than Auto: system figure, interest charged, days, rate and unit. **APPROVAL** - who approved it and the amount.

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
4. **Templates** tab - every message the app sends is here (10): SMS *New loan, Interest / part payment, Loan closed, Due reminder / auction notice, Birthday wishes, Daily summary to owner* and WhatsApp *New loan, Loan released, Part payment, Interest received*. Make each SMS the same as the approved template and add the DLT template id. While editing, the hint under the text lists the `{words}` that message can use (e.g. `{name}` `{loan_no}` `{amount}` `{date}`). Switching a template **off** stops that message (WhatsApp then uses the built-in text).
5. Optional - **Daily due reminders**: send every day after (10:00), interest not paid for (3) months, remind loans past settle-before date, do not repeat within (15) days. *Send Reminders Now* sends at once; the table shows who will get one.

### Check
Give a test loan to your own mobile → **Queue & Log** tab:
- *SENT* - working.
- *SKIPPED - Provider URL not set* - do step 3.
- *FAILED* - read the error (wrong link / template mismatch), fix it, **Retry failed**.

## Automations (each one is off until you switch it on)
**Auto SMS Rules → Automations**, then **Save**:
- **Daily summary to owner** - owner mobile(s) (comma between two), *Send the daily summary after* (e.g. 20:00). Once a day: loans, releases, interest, cash, open loans, overdue. The text is the *Daily summary to owner* template.
- **Birthday wishes** - *Send birthday wishes after* (e.g. 09:00) - to customers with an open loan whose date of birth is today (fill the date of birth in the customer form). Text: *Birthday wishes* template.
- **Remind when loans come close to their gold value** (gold-rate watch) - a reminder on the home screen / 🔔 when loan + interest reaches 85% or more of the gold value at today's rate.
- **Customer loan-status link** and *works for (days)* (default 30) - lets staff make a view-only link for a customer (chapter *Records → Customers*). Off = every link stops at once.

All of these need **Enable SMS** on (except the gold-rate watch and the customer link). Each is sent at most once a day. To test safely, leave *Provider URL* empty - the message appears in **Queue & Log** as *Skipped* and nothing is sent.

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

**New Loan has "Loan Int. % P.M." and another rate inside Advance interest - which one counts?**
Both, for different things. *Loan Int. %* is the loan's rate for every month until release. The rate inside *Advance interest* is only for the advance taken today; it copies the loan rate until you type a different one. See *Interest - Auto or Manual*.

**Is a loan's interest only by months, or also by days?**
It depends on the scheme. *MyBook* schemes count every started month; *Exact days* schemes (e.g. GL001 / GL002) count the actual days; *Months (half / full)* count half months. The blue ⓘ line on New Loan / Re-loan tells you. Any single receipt can still be taken by days with Manual → Days.

**Is interest charged on the advance interest?**
No. The advance is interest paid early - it is deducted from the amount paid out and counted as interest already paid. Interest is always on the loan amount.
