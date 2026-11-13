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

Manual modes show **amber**. With **Months** and **Days** the box has an **Interest rate** row: a number box and a **unit** list.

- It **follows the mode** until you type: **Months** shows the loan's rate **% / month** (e.g. 1.5), **Days** shows it **% / day** (e.g. 0.05). The small text *loan rate - type to change* means the loan's own rate is used.
- **Type a rate** to charge this entry at your rate - the boxes turn amber and *Use loan rate* appears (click it to go back).
- **Change the unit** any time - the number is converted so the money stays the same (1.2 % / month → 0.04 % / day → 14.4 % / year → ₹20 / day on ₹50,000). Then type your rate in that unit.
- The line under it shows what the rate comes to: **= ₹25.00 a day · ₹750.00 a month**.
- The typed rate and its unit are printed on the receipt (*Interest Rate 0.04% a day*) and shown in Payment history (*10 days at 0.04% a day*). The loan keeps its own rate.

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

## Two rate boxes on New Loan / Re-loan - are they the same?
No - they do different jobs:

| Box | What it is | Used for |
|---|---|---|
| **Loan Int. % P.M.** (top of the Loan panel) | The **loan's own rate**, saved on the loan and printed on the bill | Interest of the loan **every month till release** (Auto everywhere uses it) |
| **Advance rate (only for this advance)** - inside *Advance interest*, with Months / Days | The rate for the **advance taken today** only | The advance deducted now. Nothing else. |
| **Rate for the old loan** - inside *Interest on old loan* (Re-loan) | The rate to settle the **old** loan | The old loan's interest only |

- Until you type in the advance box it **is the loan rate** - it follows the top box live (1.5% a month shows as 0.05% a day) and says *same as Loan Int. % above (1.5% p.m.)*.
- Type a different number there **only** when the advance should be at another rate (e.g. 15 days at 0.04% a day). The loan itself keeps the top rate.
- **Use Loan Int. % above** makes it follow the top box again.
- On Release, Part Payment, Top-up and the Loan Counter there is only the Interest box: the loan's rate is already fixed on the loan (shown at the top of the screen); the rate in the box is for that one entry.

## How to - step by step
**A. Charge some days at a daily rate** (customer closes / pays after a few days)
1. In the Interest box press **Days** (Part Payment: F2 until *Days*).
2. Type the days (or press **7 / 15 / 30**). The rate shows the loan's rate per day.
3. To use your own rate, type it in **Interest rate** - e.g. **0.04** with **% / day**.
4. Check the lines: *= ₹… a day*, *10 days × ₹… a day*, and the bold *Manual · 10 days at 0.04% a day ₹…*. Save.

**B. Charge some days at a monthly rate** (the shop thinks in % a month)
1. **Days**, type the days.
2. Change the unit to **% / month** and type the rate - e.g. **1.25**. The days are charged at 1.25% a month ÷ 30 a day.

**C. Charge rupees a day** (fixed amount a day)
1. **Days**, type the days, unit **₹ / day**, type the rupees - e.g. **20**. 10 days = ₹200.

**D. Charge months at a different rate**
1. **Months**, type the months (+ / −). The rate shows the loan's **% / month**.
2. Type your rate (e.g. **1.25**), or pick **% / year** (e.g. 15) or **₹ / month** (e.g. 700).

**E. Take a fixed interest amount** - **Amount**, type the rupees. No rate is needed.

**F. Advance interest at New Loan / Re-loan** - **Advance interest (F6)**: Auto (scheme months), or **Days** / **Months** with any rate and unit (e.g. 15 days at 0.05% a day), **Amount**, or **None**.

**G. Quote before deciding** - **Loan → Interest Calculator → Quote a customer**: *Manual quote* takes any rate and unit and shows the interest **by days**, **by full months** and **by started months** for the dates you set. Use the same mode, rate and unit in the Interest box.

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
| **Cashier** | Leave it on **Auto** unless the shop agreed otherwise. For a short loan use **Days** (7 / 15 / 30) - the rate box switches to % / day by itself; for a special rate type it (and pick the unit the customer agreed). Check the *= ₹ a day · ₹ a month* line before saving. Closing a loan for less than Auto above the limit asks for a manager's login - ask the manager to type it on your screen. |
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
