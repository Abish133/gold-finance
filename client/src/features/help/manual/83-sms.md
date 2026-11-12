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
4. **Templates** tab - every message the app sends is here (10): SMS *New loan, Interest / part payment, Loan closed, Due reminder / auction notice, Birthday wishes, Daily summary to owner* and WhatsApp *New loan, Loan released, Part payment, Interest received*. Make each SMS the same as the approved template and add the DLT template id. While editing, the hint under the text lists the `{words}` that message can use (e.g. `{name}` `{loan_no}` `{amount}` `{date}`). Switching a template **off** stops that message (WhatsApp then uses the built-in text).
5. Optional - **Daily due reminders**: send every day after (10:00), interest not paid for (3) months, remind loans past settle-before date, do not repeat within (15) days. *Send Reminders Now* sends at once; the table shows who will get one.

### Check
Give a test loan to your own mobile → **Queue & Log** tab:
- *SENT* - working.
- *SKIPPED - Provider URL not set* - do step 3.
- *FAILED* - read the error (wrong link / template mismatch), fix it, **Retry failed**.

## Automations (each one is off until you switch it on)
**Auto SMS Rules → Automations**, then **Save**:
- **Daily summary to owner** - owner mobile(s) (comma between two), *Send the daily summary after* (e.g. 20:00). Once a day: loans, releases, interest, cash, open loans, overdue. The text is the *Daily summary to owner* template.
- **Birthday wishes** - *Send birthday wishes after* (e.g. 09:00) - to customers with an open loan whose date of birth is today (fill the date of birth in the customer form). Text: *Birthday wishes* template.
- **Remind when loans come close to their gold value** (gold-rate watch) - a reminder on the home screen / 🔔 when loan + interest reaches 85% or more of the gold value at today's rate.
- **Customer loan-status link** and *works for (days)* (default 30) - lets staff make a view-only link for a customer (chapter *Records → Customers*). Off = every link stops at once.

All of these need **Enable SMS** on (except the gold-rate watch and the customer link). Each is sent at most once a day. To test safely, leave *Provider URL* empty - the message appears in **Queue & Log** as *Skipped* and nothing is sent.

## WhatsApp - opened on your phone / computer
No setup. Install WhatsApp or sign in to WhatsApp Web on the counter computer.
- **Customers → customer → WhatsApp** - opens the chat.
- **Customer Ledger → WhatsApp (Ctrl+W)** - chat with the loan details typed in.
- **Auction List → WhatsApp / SMS (Ctrl+W)** - SMS reminder for the ticked loans; with one loan ticked, WhatsApp opens with the due message.
You press *Send* in WhatsApp. These are not kept in the Queue & Log.
