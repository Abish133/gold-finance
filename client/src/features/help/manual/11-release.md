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
