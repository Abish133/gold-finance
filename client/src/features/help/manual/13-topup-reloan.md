---
title: Top-up Loan and Re-loan
group: Loan
screens: loan_topup, loan_renewal
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
