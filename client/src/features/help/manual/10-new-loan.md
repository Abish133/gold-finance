---
title: New Loan
group: Loan
screens: loan_new
---
# New Loan (F1)

**Loan → New Loan** - give money against gold / silver jewels and print the loan bill.

Before you start: today's rate must be entered (header gold rate not red).

## Step by step

1. **Find the customer** - the cursor is in the customer box. Choose how to search: **Mobile / Name / A/c No / Loan No**, type, press **Enter**, pick the customer from the list.
   - New customer? Press **F1** (or *New Customer*) and fill the form - chapter *Customers*.
   - The left panel then shows the customer's photo, open loans and interest due today. A warning appears if a loan of this customer is open for more than 12 months - ask for interest first.
2. **Loan on** - **Gold**, **Silver** or **Mix** (gold and silver items in one loan).
3. **Add each item**
   - Item (type a new name to add it to the list), Pcs, Gross Wt (g), Less Wt (stone / wax), Purity %.
   - Net Wt and Value are worked out: value = fine weight (net × purity) × today's 100% rate, rounded to the nearest ₹100.
   - **Add Item** (or Enter in the last box). The item goes into the list and the boxes clear for the next item. The × on a row removes it.
   - **Item templates** - for jewels that often come together. Add the items once, then **Templates ▾ → Save these N items as a template** and give a name (e.g. *Chain + 2 rings*). Next time: **Templates ▾ →** pick it - the first item fills in and the cursor waits in *Gross Wt*; weigh, press Enter, and the next item fills in by itself (a green *Next: …* bar shows what is coming, **Stop** ends it). Templates keep item names, pcs, metal and purity - **never weights**. Every counter shares them; ✕ (on hover) removes one.
4. **Loan amount** - type the amount. The **Loan to value** bar turns green / orange / red. Above the warning limit (85%) the app asks *"Loan is xx% of item value. Continue?"* before saving.
5. **Interest % p.m.** (from the scheme, can be changed) and **Interest type** - *Compound* or *Flat*.
6. **Doc. charges** (if any) and **Advance interest** - **Auto** takes the scheme's advance months now; **Months / Days / Amount** take what you choose (e.g. 15 days); **None** takes nothing. F6 switches Auto ↔ None. See *Interest - Auto or Manual*.
7. **Item photo** - Camera, Browse (choose a file) or Old Photo (the customer's last photo).
8. **Save Loan (F2)** → enter the bill book no (if you use paper bill books) → **Pay customer**: choose Cash / UPI / Card / Cheque and the amount → **Confirm**.
9. The loan bill prints (two copies if set). The message *Loan details saved* has **Print** (print again) and **Open loan** (Loan Counter) buttons. The sticker for the jewel packet can be printed from **Loan → Print → Jewel Packet Sticker (F9)**.

## Example
Ravi Kumar S/o Mani Kumar brings a chain.

| Box | Entry |
|---|---|
| Item | Chain, 1 pcs, gross 10.000 g, less 0, purity 91.6 |
| Value | 9.160 g fine × ₹7,900 = ₹72,364 → **₹72,400** |
| Loan amount | ₹50,000 (69% of value - green) |
| Interest | 1.5% p.m., Compound |
| Interest / month | ₹750 |
| Advance interest | ₹750 (on) |
| **Pay to customer** | **₹49,250** |

Due date is 12 months from the loan date.

## Keys on this screen
| Key | Does |
|---|---|
| F1 | New customer |
| F2 | Save loan |
| F6 | Advance interest Auto ↔ None |
| Ctrl+E | Print a loan estimate for the customer (before saving) |
| Ctrl+N | Clear the screen |
| F5 | Customer ledger (all loans of this customer) |
| Esc | Back to home |

## Good to know
- Every started month is charged: a loan released after 3 months 2 days pays 4 months.
- Compound: each full year's interest is added to the loan amount for the next year.
- The loan number comes by itself (header). Old paper loans go in **Old Loan Entry**, not here.
- Made a mistake? **Loan → Edit Loan Record** (Branch Manager), or cancel the last entry from **Loan Details**.
