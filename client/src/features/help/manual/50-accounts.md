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
