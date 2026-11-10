---
title: Pledge Book, Customers, Stock
group: Records
screens: loan_list, customers, stock
---
# Pledge Book

**Records → Pledge Book** - the register of all loans.

- Tiles: **Total loans**, **Pending**, **Released**, **In Bank**, **Auctioned**, **Cancelled** - count and amount.
- Each row: loan no, bill book no, loan date, customer, metal, items (e.g. *CHAIN 1* = item and pieces), weights, **loan amount** (the first amount + any top-up), ROI %, advance interest, item value, settle-before date, **status** and release no.
- Status words: **Pending** (open, in the shop), **In Bank** (open, pledged with a bank), **Released** (closed - also an old loan closed by Re-loan), **Auctioned**, **Cancelled**.
- Filters: date range (loan date or release date), metal, loan amount from - to, search (F3). Oldest loans first.
- Double-click a loan for its details. **Print (F9)**, **PDF (Ctrl+P)**, **Excel (Ctrl+E)**, **Refresh (Ctrl+R)**.

Example (one day of the sample data): 4 loans ₹82,500 - Pending 1 (₹3,500), Released 2 (₹54,000: loan 1 ₹51,000 with its ₹1,000 top-up, loan 2 ₹3,000), In Bank 1 (₹25,000).

# Customers (F3)

**Records → Customers** - all customers with their loans.

## Add a customer
1. **New Customer** (on the home screen or here).
2. Fill: title (Mr / Mrs …), **Customer name**, relation (S/o, D/o, W/o, C/o) and **Father / Husband name**, door no, street, area, city, pincode, **Mobile (10 digits)**, alternate mobile, ID proof type and number, nominee.
3. Photos: customer photo (camera / file), ID proof front and back, signature.
4. **Save Customer (F2)**. **Enter** goes to the next box, **Ctrl+N** clears the form.
   - Names are saved in Proper Case.
   - If the mobile number already exists the app shows the matching customers - open that one instead of making a duplicate.

Example: Mr Ravi Kumar S/o Mani Kumar, 5-43 Main Road, Kappiyarai 629157, mobile 98765 43210, Aadhaar Card 1234 5678 9012.

## Customer ledger
Open a customer → **Ledger** - all loans, interest paid, due today. **WhatsApp (Ctrl+W)** opens WhatsApp with the customer's loan details typed in.

## Other
- **Blocked customers** - block a customer who should not get new loans.
- **Merge customers** - two records of the same person → one.

# Stock

**Records → Stock**
- **Stock Check** - scan or type each packet's loan no; the list ticks it. Packets not found can be marked *missing*. *New check* clears the day's scans.
- **Stock Analysis** - value of every open loan at today's rate against the amount due, the margin, and loans "at risk" (margin below System Control % ).
- **Reports → Current Stock Report** - pledged items still with you (in hand and at bank), by age.

# Bill Book Check

**Records → Bill Book Check** - finds missing / repeated loan numbers and bill book numbers in a range.
