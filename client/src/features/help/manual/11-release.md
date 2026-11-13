---
title: Release Loan
group: Loan
screens: loan_release
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
