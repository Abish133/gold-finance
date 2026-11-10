---
title: Accounts
group: Accounts
screens: acc_voucher, acc_cashbook, acc_ledger_report, acc_ledgers, acc_final, acc_bank_reco, acc_tally
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
**Accounts → Cash Denomination** (or **F6** on Day Report / Day End) - count the drawer: number of ₹2000, ₹500, ₹200, ₹100 … notes and coins (Enter = next note, F2 = save). The difference with *cash should be in drawer* is shown on Day End.
