---
title: Problems and questions
group: Help
screens: *
---
# Problems and questions

| You see | Do this |
|---|---|
| "New loan blocked - enter today's rate" / gold rate red | Masters → Gold / Silver Rate → Save today's rate |
| Billing date is behind today | Settings → Day End - close the old day(s) one by one |
| "Day is closed up to dd-mm-yyyy. Entries are locked." | The day is closed. A Super Admin can reopen it in Settings → Day Close |
| "You are not allowed to make back-dated entries" | Your role has no back-date permission - ask the manager |
| "Loan amount is above the eligible amount" | Lower the amount, or the scheme LTV is small (MyBook scheme only warns above 85%) |
| "Top-up is allowed only within 3 days" | Use Re-loan |
| "This is an Old Loan Entry - Top-up is not allowed" | Use Re-loan |
| "Loan is pledged in bank" | Bank → Release from Bank first |
| Discount asks for a password | Discount above the System Control limit - a manager types their username and password |
| Menu / screen missing | Your role does not have it - Settings → Users & Roles → Roles & Permissions |
| Printer does not print | Check the printer in Windows, Settings → Printer Setup → test print; the browser print box must have the right printer |
| SMS not going | SMS chapter → Queue & Log - read the status / error |
| Wrong entry saved | Loan Details → History → cancel the last entry (manager), or Loan → Edit Loan Record |
| Lost data / computer changed | Settings → Backup Database → Restore (owner) |

## Interest - how it is worked out
- **Every started month is one month** (grace days 0). 7 days = 1 month, 1 month 1 day = 2 months. Minimum 1 month.
- **Flat**: interest per month (rounded to the rupee) × months.
- **Compound**: each full 12 months, that year's interest is added to the amount. Rounded at the end.
- **Due = total interest − advance interest − interest already paid.** Part payments do not lower the interest (it stays on the loan amount).

Example ₹12,345 at 1.5% p.m.: per month ₹185. 22 months flat = 22 × 185 − 185 advance = **₹3,885**. Compound = 2,222 (year 1) + 14,567 × 1.5% × 10 = 2,185 → 4,407 − 185 = **₹4,222**.

## Item value
Fine weight (net × purity ÷ 100, 3 decimals) × fine (100%) rate, rounded to the nearest ₹100.
