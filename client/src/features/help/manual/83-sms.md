---
title: SMS and WhatsApp
group: Settings
screens: s_messages, customers
---
# SMS and WhatsApp

## SMS - sent by the server, automatically
SMS is created on: **new loan**, **interest / part payment**, **release**, **due reminders** (from Auction List, or every day by the reminder job). Every 30 seconds the server sends the waiting messages through your SMS provider; a failed one is tried 3 times.

### Set up (once)
1. Take an Indian bulk-SMS provider with DLT registration: sender ID and approved templates.
2. Get the provider's send link, for example
   `https://api.provider.com/send?apikey=KEY&sender=ABCDEF&to={phone}&text={message}`
   Keep `{phone}` and `{message}` - the app fills them.
3. **Settings → SMS Settings → Auto SMS Rules**: *Enable SMS* on, paste *Provider URL*, switch on the events you want → **Save settings**.
4. **Templates** tab - make each message the same as the approved template, add the DLT template id. You can use `{name}` `{loan_no}` `{amount}` `{date}` `{weight}` `{due_date}`.
5. Optional - **Daily due reminders**: send every day after (10:00), interest not paid for (3) months, remind loans past settle-before date, do not repeat within (15) days. *Send Reminders Now* sends at once; the table shows who will get one.

### Check
Give a test loan to your own mobile → **Queue & Log** tab:
- *SENT* - working.
- *SKIPPED - Provider URL not set* - do step 3.
- *FAILED* - read the error (wrong link / template mismatch), fix it, **Retry failed**.

## WhatsApp - opened on your phone / computer
No setup. Install WhatsApp or sign in to WhatsApp Web on the counter computer.
- **Customers → customer → WhatsApp** - opens the chat.
- **Customer Ledger → WhatsApp (Ctrl+W)** - chat with the loan details typed in.
- **Auction List → WhatsApp / SMS (Ctrl+W)** - SMS reminder for the ticked loans; with one loan ticked, WhatsApp opens with the due message.
You press *Send* in WhatsApp. These are not kept in the Queue & Log.
