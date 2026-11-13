---
title: Interest - Auto or Manual
group: Loan
screens: loan_new, loan_old, loan_interest, loan_part_payment, loan_topup, loan_release, loan_renewal, loan_list, reports_collection, admin_approval, s_system, s_audit
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

Manual modes show **amber**. With **Months** and **Days** there is a **Rate** box and a **unit** list next to it, filled with the loan's rate (e.g. 1.5 % / month). Type another rate, or pick another unit, to charge this entry that way. The typed rate and its unit are printed on the receipt (*Interest Rate ₹20 a day*) and shown in Payment history (*10 days at ₹20 a day*). The loan keeps its own rate.

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

## Where it is
| Screen | Box | Months / Days count from |
|---|---|---|
| **New Loan / Old Loan entry** | *Advance interest (F6)* - F6 switches Auto ↔ None | the coming period |
| **Part Payment** | *Interest* (Months / Days / Amount, rate + unit) - see *Part Payment & Interest* | where the paid interest ends |
| **Top-up** | *Interest deducted now* - **None** by default | where the paid interest ends |
| **Release** | *Charge interest* | the loan date (interest already paid is taken off) |
| **Re-loan** | *Interest on old loan* and *Advance interest (F6)* on the new loan | old loan: the loan date · advance: the coming period |
| **Loan Counter** | *Interest* on Interest / Part payment / Top-up / Release / Renew | Interest, Part, Top-up: where paid interest ends · Release, Renew: the loan date |

## Taking less than Auto
- **While the loan stays open** (Part Payment, Top-up, Counter interest): what is not taken now **stays due** - it shows next time and at release. No approval needed.
- **When the loan closes** (Release, Re-loan, Counter release / renew): the difference is a concession. The line *Less than auto* shows it. Together with any discount, above the limit in **System Control → Release: discount without admin** (e.g. ₹500) a manager / admin must type their login (**Admin approval**). Every reduction is written in the **Audit Trail** (*INTEREST_REDUCED*: system figure, charged, days, rate).
- **Minimum days** (System Control → *Interest by days: minimum days*): Days cannot go below it.

## By role
| Role | What to know |
|---|---|
| **Cashier** | Leave it on **Auto** unless the shop agreed otherwise. For a short loan use **Days** (7 / 15 / 30); for a special rate type it with the right unit. Closing a loan for less than Auto above the limit asks for a manager's login - ask the manager to type it on your screen. |
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
