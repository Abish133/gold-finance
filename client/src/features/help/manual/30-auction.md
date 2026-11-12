---
title: Auction
group: Auction
screens: auction, auction_sale
---
# Auction List & Notices

**Auction → Auction List & Notices** - loans not released for a long time; print notices and the auction list.

1. Dates start from the billing date: **Pledged from** the oldest open loan **to** 12 months before the billing date. **Older than** 6 / 9 / 12 months moves the "to" date.
2. The list shows as soon as the screen opens. Change Metal, Include (in shop + bank / in shop only) or the dates → **Show (F5)**.
3. All loans are ticked - untick what you do not want (Space / click, Ctrl+A, Ctrl+D). "3 LOANS" means the customer has several loans in the list.
4. Notices to customers:
   - **First Notice (F6)** - a **Pre-Auction Notice** for each customer (Ref No FN/loan no): all the customer's ticked loans in one table (loan no, pledge date, loan amount, items, net weight, total), pay within 15 days, *Note: Last Final Notice*.
   - Every notice heading shows the loan's branch **licence number** and **contact numbers**.
   - **Registered Notice (F7)** - set **Auction date and time** (default 15 days after the billing date). An **Auction Notice (Registered Post)** for each customer (Ref No RN/loan no) with the auction date, time and place in a box; postage is added to the loan.
5. Lists: **Auction List (F9)**, **Cert. of Post List (F10)**, **Regd. Post List (F11)**. *Post split amount* breaks the post list into parts.
6. **WhatsApp / SMS (Ctrl+W)** - queues a reminder SMS for the ticked loans (and opens WhatsApp for one loan).

# Auction Release

**Auction → Auction Release** - two steps, like MyBook.

## Step 1 - Due for Auction tab → mark as auctioned
1. Same dates and filters; **Notice** All / Notice sent / Not sent → **Show (F5)**.
2. Tick the loans (Tick by loan no, Tick All, Tick With Notice).
3. **Auction date** → **Mark N Loans as Auctioned (F10)**.
   - "1 of the ticked loans never got a notice. Auction them anyway?" → Yes / No.
   - "Mark 1 loan (Rs 12,345) as AUCTIONED? These loans will be closed. Only an Admin can undo it." → Yes.
4. The loan is closed. No money yet.

## Step 2 - Auctioned tab → enter the sale
1. Click the loan. Type **Sold for (Rs)** and **Sale date**.
2. **Save Sale (F10)** - the money is booked. **Profit / Loss = sold for − loan amount.**
3. Changing a saved sale: **Change Sale (Admin)**. **Remove Sale (Ctrl+R)** takes the sale back. **Undo Auction (Admin)** re-opens the loan - only after the sale is removed.

Example: loan 2 ₹12,345 auctioned 05/11/2026, sold for ₹20,000 → profit **+₹7,655**.

# Auction Report
**Reports → Auction Report** - by A/c year / dates, metal, sold / not sold. Here **profit / loss = sale − total due (loan + interest)**: ₹20,000 − (12,345 + 3,482) = **+₹4,173**.
