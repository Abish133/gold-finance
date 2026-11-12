---
title: Part Payment & Interest
group: Loan
screens: loan_part_payment, loan_interest
---
# Part Payment & Interest (F5)

**Loan → Part Payment** - the customer pays interest, pays back part of the loan amount, or **both on one receipt**, and keeps the loan open.

The **Receive** panel on the right has two parts:
- **Interest** - charged by **Months**, **Days** or a typed **Amount** (the small switch next to *Interest*; F2 changes between them), at the loan's rate or a **rate % / month** you type.
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

**Rate % / month** (next to Months / Days) - filled with the loan's rate (e.g. 1.5). Type another rate to charge this payment at that rate, e.g. **1.25**. The box turns amber and the line *Rate 1.25% for this payment only (loan rate 1.5%)* appears; **Use loan rate** puts it back.
- The typed rate is used **only for this receipt** and printed on it (*Interest Rate 1.25% per month*). The loan keeps its own rate - to change the rate for good use **Loan → Edit Loan Record**.
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
