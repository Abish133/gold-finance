---
title: What's new - quick tour
group: Start here
screens: *
---
# What's new

A short tour of the newer parts of the app. Each line says where to find it; the chapters after this one explain the details.

## SMS and WhatsApp
| What | Where | What it does |
|---|---|---|
| **DLT template id** in the SMS link | Settings → SMS Settings → Auto SMS Rules, Templates | `{template_id}` in the provider link sends each SMS with its DLT template id (BSNL / any DLT). A message with no id is marked FAILED with the reason |
| **Failure text** | Settings → SMS Settings → Auto SMS Rules | Words in the provider's answer that mean "not sent" - such SMS are marked FAILED and retried |
| WhatsApp after saving | Settings → System Control → Messages | The message now starts with the shop name, shows whole rupees and says *for 15 days* when interest was taken by days |

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
| **Analytics: money flow, metal and branches** | Reports → Business Analytics | Net lent (given − recovered), loan book over time, cash in / out, interest sources, payment modes; gold and silver held by branch, value today, loan used of value, top-up room, branch comparison |
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
