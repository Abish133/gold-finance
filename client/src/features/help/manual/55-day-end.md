---
title: Day Report, Day End, Day Close
group: Accounts
screens: day_close, acc_cashbook, cash_denomination
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
