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
   `https://api.provider.com/send?apikey=KEY&sender=ABCDEF&to={phone}&text={message}&peid=ENTITY_ID&templateid={template_id}`
   Keep `{phone}`, `{message}` and `{template_id}` - the app fills them for every SMS. `{template_id}` is the **DLT template id** typed on that message in the Templates tab (step 4). Your entity id (PE ID) and sender id never change, so type them straight into the link.
3. **Settings → SMS Settings → Auto SMS Rules**: *Enable SMS* on, paste *Provider URL*, switch on the events you want → **Save settings**.
   *Failure text in the provider answer* (optional) - many gateways answer "OK" (HTTP 200) even when they refuse a message and write the error in the reply. Type the words that mean *not sent*, comma between - e.g. `error, invalid, fail`. A reply with one of them is marked *FAILED* with the provider's words, and tried again up to 3 times.
4. **Templates** tab - every message the app sends is here (10): SMS *New loan, Interest / part payment, Loan closed, Due reminder / auction notice, Birthday wishes, Daily summary to owner* and WhatsApp *New loan, Loan released, Part payment, Interest received*. Make each SMS the same as the approved template and add the DLT template id. While editing, the hint under the text lists the `{words}` that message can use (e.g. `{name}` `{loan_no}` `{amount}` `{date}`). Switching a template **off** stops that message (WhatsApp then uses the built-in text).
5. Optional - **Daily due reminders**: send every day after (10:00), interest not paid for (3) months, remind loans past settle-before date, do not repeat within (15) days. *Send Reminders Now* sends at once; the table shows who will get one.

### Check
Give a test loan to your own mobile → **Queue & Log** tab:
- *SENT* - working.
- *SKIPPED - Provider URL not set* - do step 3.
- *FAILED - No DLT template id on the "…" template* - the link has `{template_id}` but that message has no DLT template id: type it in Templates, then **Retry failed**.
- *FAILED - Provider said: …* - the gateway refused it (wrong template id, text not matching the approved template, sender not approved). Fix it, **Retry failed**.

## BSNL DLT (or any DLT) - step by step
Every business SMS in India must be registered on a DLT portal. A registration on BSNL's DLT works on every network (Jio, Airtel, Vi, BSNL). The DLT portal only registers - the SMS itself goes through an **SMS provider** (bulk-SMS company).

**On the BSNL DLT portal** (the shop's login)
1. **Entity (PE) ID** - you get it when the shop is registered. Keep it for the provider link.
2. **Header** (sender id) - 6 letters, e.g. `SLGFIN`, type *Transactional / Service*.
3. **Content templates** - one for each SMS you switch on, category *Service Implicit*. Write the app's text with every `{word}` changed to `{#var#}` (one `{#var#}` holds up to 30 characters):

| App message | Register on DLT as |
|---|---|
| New loan | Dear {#var#}, your gold loan {#var#} of Rs.{#var#} dated {#var#} is sanctioned. Net wt {#var#} g. Thank you. - Sri Lakshmi Gold Finance |
| Interest received | Dear {#var#}, received Rs.{#var#} towards loan {#var#} on {#var#}. Thank you. - Sri Lakshmi Gold Finance |
| Loan closed | Dear {#var#}, your loan {#var#} is closed on {#var#}. Amount received Rs.{#var#}. Thank you. - Sri Lakshmi Gold Finance |
| Due reminder | Dear {#var#}, your loan {#var#} is overdue. Please pay the interest / renew at the earliest to avoid auction. - Sri Lakshmi Gold Finance |
| Birthday wishes | Dear {#var#}, warm birthday wishes from {#var#}! |

   Use your own shop name. After approval each template gets a **Template ID** (about 19 digits).
4. **Telemarketer / chain** - add your SMS provider as the telemarketer of your entity (the provider tells you its TM id). Without it, messages are blocked even with approved templates.

**In this app** (Settings → SMS Settings)
1. **Auto SMS Rules** - Enable SMS, paste the provider link with `{phone}`, `{message}` and `templateid={template_id}` (the provider's own name for each part, e.g. `mobile=`, `msg=`, `dlt_template_id=`), your PE ID and sender id typed in. Optional *Failure text*. Save.
2. **Templates** - open each SMS template: make the **Message** exactly the approved text, with the app's words in place of `{#var#}` - e.g. `Dear {name}, received Rs.{amount} towards loan {loan_no} on {date}. Thank you. - Sri Lakshmi Gold Finance`. Type its **DLT template id**. Switch **off** every SMS template you did not register.
3. Test with your own mobile and look at **Queue & Log** (above).

> The text must match the approved template **word for word** - one extra space, comma or word and the operator drops it. Change the text in DLT first, then here.
> WhatsApp messages do not need DLT.

## Automations (each one is off until you switch it on)
**Auto SMS Rules → Automations**, then **Save**:
- **Daily summary to owner** - owner mobile(s) (comma between two), *Send the daily summary after* (e.g. 20:00). Once a day: loans, releases, interest, cash, open loans, overdue. The text is the *Daily summary to owner* template.
- **Birthday wishes** - *Send birthday wishes after* (e.g. 09:00) - to customers with an open loan whose date of birth is today (fill the date of birth in the customer form). Text: *Birthday wishes* template.
- **Remind when loans come close to their gold value** (gold-rate watch) - a reminder on the home screen / 🔔 when loan + interest reaches 85% or more of the gold value at today's rate.
- **Customer loan-status link** and *works for (days)* (default 30) - lets staff make a view-only link for a customer (chapter *Records → Customers*). Off = every link stops at once.

All of these need **Enable SMS** on (except the gold-rate watch and the customer link). Each is sent at most once a day. To test safely, leave *Provider URL* empty - the message appears in **Queue & Log** as *Skipped* and nothing is sent.

## WhatsApp - opened on your phone / computer
No setup. Install WhatsApp or sign in to WhatsApp Web on the counter computer.

**Open WhatsApp after saving** - Settings → System Control → Messages: *WhatsApp: new loan / release / part payment / interest*. After the save, WhatsApp opens on the customer's number with the message typed in - the shop name (Company Information) on the first line, amounts in whole rupees (Rs 68,000), and the period of an interest receipt (*for 15 days* or *for 2 month(s)*). The words come from the WhatsApp templates (Templates tab); `{period}` is the period. If the browser blocks the new tab, allow pop-ups for the app.
- **Customers → customer → WhatsApp** - opens the chat.
- **Customer Ledger → WhatsApp (Ctrl+W)** - chat with the loan details typed in.
- **Auction List → WhatsApp / SMS (Ctrl+W)** - SMS reminder for the ticked loans; with one loan ticked, WhatsApp opens with the due message.
You press *Send* in WhatsApp. These are not kept in the Queue & Log.
