---
title: Interest - Auto or Manual
group: Loan
screens: loan_new, loan_old, loan_interest, loan_part_payment, loan_topup, loan_release, loan_renewal
---
# Interest - Auto or Manual

Every screen that takes interest has the same **Interest** box. The app works out the interest by itself (**Auto**) from the scheme and the loan's rate - or you take it **Manual**, the way you agree with the customer.

| Mode | What it charges |
|---|---|
| **Auto** (green) | What the app works out - the scheme rules (every started month, compound / flat, advance months). Same as before. |
| **Months** | A number of months × interest per month. |
| **Days** | A number of days × interest per month ÷ 30 (rounded to the rupee). Quick buttons **7 / 15 / 30**. |
| **Amount** | The rupees you type. |
| **None** | No interest (only where that makes sense: advance interest, interest deducted on a top-up, interest with a part amount). |

Manual modes show **amber**. With **Months** and **Days** there is a **Rate % / m** box, filled with the loan's rate - type another rate (e.g. **1.25** instead of 1.5) to charge this entry at that rate. The typed rate is printed on the receipt.

The line at the bottom always shows what will be charged: *Auto · 4 months ₹3,000* or *Manual · 15 days ₹375*, and **Auto would be ₹…** so you can compare.

## Where it is
| Screen | Box | Months / Days count from |
|---|---|---|
| **New Loan / Old Loan entry** | *Advance interest (F6)* - F6 switches Auto ↔ None | the coming period |
| **Part Payment** | *Interest* (Months / Days / Amount, rate %) - see *Part Payment & Interest* | where the paid interest ends |
| **Top-up** | *Interest deducted now* - **None** by default | where the paid interest ends |
| **Release** | *Charge interest* | the loan date (interest already paid is taken off) |
| **Re-loan** | *Interest on old loan* and *Advance interest (F6)* on the new loan | old loan: the loan date · advance: the coming period |
| **Loan Counter** | *Interest* on Interest / Part payment / Top-up / Release / Renew | Interest, Part, Top-up: where paid interest ends · Release, Renew: the loan date |

## Taking less than Auto
- **While the loan stays open** (Part Payment, Top-up, Counter interest): what is not taken now **stays due** - it shows next time and at release. No approval needed.
- **When the loan closes** (Release, Re-loan, Counter release / renew): the difference is a concession. The line *Less than auto* shows it. Together with any discount, above the limit in **System Control → Release: discount without admin** (e.g. ₹500) a manager / admin must type their login (**Admin approval**). Every reduction is written in the **Audit Trail** (*INTEREST_REDUCED*: system figure, charged, days, rate).
- **Minimum days** (System Control → *Interest by days: minimum days*): Days cannot go below it.

## Examples
Loan ₹50,000 at 1.5% p.m. → ₹750 a month, ₹25 a day.
- **Release after 3 days**: Auto = ₹750 (1 month). *Days* → **7** → ₹175. *Less than auto ₹575* - needs the manager's login when the limit is ₹500.
- **Re-loan after 4 months at a lower rate**: *Interest on old loan* → *Months* 4, rate **1.2** → 50,000 × 1.2% × 4 = **₹2,400** instead of ₹3,000. The new loan keeps its own rate (Interest % box).
- **New loan, advance for half a month**: *Advance interest* → *Days* **15** → ₹375 instead of ₹750.
- **Top-up with 10 days' interest deducted**: top-up ₹5,000, *Interest deducted now* → *Days* **10** → ₹250 deducted, ₹4,750 paid out.
