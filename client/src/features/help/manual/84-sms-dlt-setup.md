---
title: SMS setup with BSNL DLT and BSNL Bulk SMS - step by step
group: Settings
screens: s_messages
---
# SMS setup with BSNL DLT and BSNL Bulk SMS

This chapter is for the **owner**. Follow it once, from top to bottom, and the app will send SMS to customers by itself: when a loan is given, when interest is paid, when a loan is closed, and for due reminders.

Take your time. Each step says **which website**, **which menu to click**, **what to type** and **what you should see**. A full worked example is at the end.

## First, understand the three places

| Place | Think of it as | What you do there |
|---|---|---|
| **BSNL DLT portal** - `ucc-bsnl.co.in` | The **permission office** | Register your sender name and the exact words of every SMS. Nothing is sent from here. |
| **BSNL Bulk SMS (BRPS)** - `bulksms.bsnl.in` | The **post office** | Holds your SMS balance and actually sends the SMS. Gives the app its sending link. |
| **This app** - Settings → SMS Settings | The **clerk who writes the letters** | Fills in the customer's name, loan no, amount and date, and hands the SMS to the post office. |

The post office sends an SMS only if the permission office has approved **the same words**, from **the same sender name**, with **the same template ID**. That is the whole secret. Almost every SMS problem is one word that does not match.

## What you need before you start

- ☐ The **DLT login** (ucc-bsnl.co.in) - username and password.
- ☐ The **Bulk SMS login** (bulksms.bsnl.in) - username and password.
- ☐ Some **SMS balance** on the Bulk SMS account (shown as *TOTAL BALANCE* on its Dashboard).
- ☐ Your own mobile number, for testing.
- ☐ A notebook (or a text file) to write down IDs. You will copy long numbers - copy them, do not type them by hand.

Words you will meet:

| Word | Means | Example |
|---|---|---|
| **Entity ID (PE ID)** | Your business's number on DLT | 1401xxxxxxxxxxxxxxx (19 digits) |
| **Header (Sender ID)** | The 6-letter name customers see as the sender | MCRFIN → the phone shows *VM-MCRFIN* |
| **Content template** | The exact words of one SMS, with blanks | Dear {#var#}, received Rs.{#var#} … |
| **{#var#}** | A blank the app fills in (name, amount, date …). One blank holds up to 30 letters | {#var#} → *Ravi Kumar* |
| **Template ID** | The number DLT gives an approved template | 1207xxxxxxxxxxxxxxx (19 digits) |
| **TM ID** | The number of the company that sends your SMS (here BSNL itself) | 1402537140000015510 (BSNL KERALA) |
| **PE-TM chain** | The link that says "this TM may send my SMS" | Entity → BSNL KERALA |

---

# Part A - BSNL DLT portal (ucc-bsnl.co.in)

Sign in. The **DASHBOARD** shows your *EntityID*, *EntityName* and how many headers and templates are approved. The menu at the top has: **DASHBOARD · HEADERS · TEMPLATES · TELEMARKETERS · PE-TM CHAINS · CTA WHITELISTING**.

### Step A1 - Write down your Entity ID and Entity Name
1. Stay on **DASHBOARD**.
2. Copy the number after **EntityID-** and the name after **EntityName-** into your notebook.
3. **The Entity Name matters:** the SMS should end with this name (or the brand name your approved templates already use). Example: if the Entity Name is *MICRO FINANCE*, end every SMS with *- MICRO FINANCE*.

### Step A2 - Choose the sender name (HEADERS)
1. Click **HEADERS**.
2. You see a list with a status for each: *Approved*, *Pending* or *Rejected*.
3. Pick one **Approved** header of type *Transactional / Service* (*Service Implicit* also works). Write it down, e.g. **MCRFIN**.
4. No approved header? Click **Add / Register Header**, type 6 capital letters that look like your business name (e.g. *RJMGLD*), choose *Transactional* / *Service*, and submit. Wait for approval (usually 1-2 working days).

### Step A3 - Get the SMS words approved (TEMPLATES)
The app sends four kinds of SMS. Each one needs **one approved content template**.

1. Click **TEMPLATES** → open the list of **Content Templates** (not *Consent* templates).
2. **First look at what is already approved.** If an approved template already says the same thing (e.g. *"Dear {#var#}, received Rs.{#var#} towards loan {#var#} …"*), you can use it - write down its **Template ID** and copy its **exact text**.
3. For each of the four that is missing, click **Add / Create Content Template** and fill in:

| Field on DLT | What to choose / type |
|---|---|
| Template type | **Service Implicit** |
| Header | The header from Step A2 (e.g. MCRFIN) |
| Category | Banking / Insurance / Financial products (or the nearest one) |
| Template name | Any name you will recognise, e.g. *Loan interest received* |
| Template content | The text from the table below - **copy it, then change only the name at the end** to your Entity Name |

| App message | Text to register on DLT (change *MICRO FINANCE* to your Entity Name) |
|---|---|
| **New loan** | `Dear {#var#}, your gold loan {#var#} of Rs.{#var#} dated {#var#} is sanctioned. Net wt {#var#} g. Thank you. - MICRO FINANCE` |
| **Interest received** | `Dear {#var#}, received Rs.{#var#} towards loan {#var#} on {#var#}. Thank you. - MICRO FINANCE` |
| **Loan closed** | `Dear {#var#}, your loan {#var#} is closed on {#var#}. Amount received Rs.{#var#}. Thank you. - MICRO FINANCE` |
| **Due reminder** | `Dear {#var#}, your loan {#var#} is overdue. Please pay the interest / renew at the earliest to avoid auction. - MICRO FINANCE` |

4. Submit each one. After approval (usually 1-2 working days) each gets a **Template ID**. Write it down **next to its message name**:

| App message | Template ID (write yours here) |
|---|---|
| New loan | 1207……………… |
| Interest received | 1207……………… |
| Loan closed | 1207……………… |
| Due reminder | 1207……………… |

> Do not add a phone number or a website link in the text. If you ever do, it must first be approved in **CTA WHITELISTING**.

### Step A4 - Link BSNL as your sender (PE-TM CHAINS) - do not skip
1. Click **PE-TM CHAINS**.
2. Look for a chain that has **BSNL KERALA** with TM ID **1402537140000015510** (the ID BSNL Bulk SMS asks for on its Dashboard notice).
3. If it is there and active - done.
4. If not, click **Add / Create Chain**, enter TM ID **1402537140000015510** (choose BSNL KERALA when it shows), and save / submit.
5. Without this chain **every SMS is blocked**, even with approved templates.

You can ignore **TELEMARKETERS** (only a list) and **CTA WHITELISTING** (only for links / phone numbers inside an SMS).

---

# Part B - BSNL Bulk SMS (bulksms.bsnl.in)

Sign in. The **Dashboard** shows your business name, address and **TOTAL BALANCE**, and a notice about the PE-TM chain. The left menu has: **Dashboard · Plans & Recharge · Template Details · Instant SMS · Common SMS · Individual SMS · View Campaigns · API Details · Help**.

### Step B1 - Check the balance (Dashboard / Plans & Recharge)
- **TOTAL BALANCE** is how many SMS you can still send. One SMS of up to 160 letters uses about one credit; a longer one uses two.
- To add more, use **Plans & Recharge**.

### Step B2 - Check the templates came across (Template Details)
1. Click **Template Details**.
2. The templates approved in Step A3 should be listed with the same **Template ID** and header.
3. If one is missing, use the add / sync option on this screen (or wait - new approvals can take a few hours to appear).

### Step B3 - Send one test SMS by hand (Instant SMS)
This proves Part A is right **before** the app is involved.
1. Click **Instant SMS**.
2. Choose the **header** (e.g. MCRFIN) and the **Interest received** template.
3. Fill the blanks with test words, e.g. *Test*, *100*, *K1*, *16/11/2026*.
4. Mobile number: **your own**. Press **Send**.
5. The SMS arrives on your phone → Part A is correct. Go on.
   It does not arrive → **View Campaigns** shows the status and reason. The usual reasons: chain missing (A4), template text changed, wrong header.

### Step B4 - Get the sending link for the app (API Details)
1. Click **API Details**.
2. You see an **API URL / link** and an **API key** (a secret, like a password). Keep the key private.
3. The app needs a link it can open for every SMS, with these parts in it:

| Part of the link | What it is | You put in the app |
|---|---|---|
| Key / username / password | Your account | Type your real key here |
| Sender / header | The header from A2 | Type it, e.g. `MCRFIN` |
| Entity ID / PE ID | From A1 | Type it |
| Mobile number | Changes every SMS | Type **{phone}** |
| Message text | Changes every SMS | Type **{message}** |
| Template ID | Changes every SMS | Type **{template_id}** |

4. Copy the example link shown on API Details into your notebook. In Part C you will replace the mobile number, the message and the template ID in it with `{phone}`, `{message}` and `{template_id}`.

> If **API Details** shows only a "POST / JSON" method and no link that can be opened in a browser, stop here and contact your software support with a screenshot of API Details (key covered). The app sends SMS by opening a link.

---

# Part C - inside this app (Settings → SMS Settings)

Sign in as the owner. Open **Settings → SMS Settings**. It has three tabs: **Queue & Log**, **Templates**, **Auto SMS Rules**.

### Step C1 - Put the approved words and IDs in the app (Templates tab)
1. Click **Templates**. Each row has a coloured tag: **SMS** (blue) or **WhatsApp** (green). Work only on the **SMS** ones.
2. Click the **New loan (SMS)** row to open it.
3. **Message** - make it **exactly** the DLT text, with the app's words in place of each `{#var#}`, in the same order:

| Message | Type this in the app (with your Entity Name at the end) |
|---|---|
| New loan | `Dear {name}, your gold loan {loan_no} of Rs.{amount} dated {date} is sanctioned. Net wt {weight} g. Thank you. - MICRO FINANCE` |
| Interest received | `Dear {name}, received Rs.{amount} towards loan {loan_no} on {date}. Thank you. - MICRO FINANCE` |
| Loan closed | `Dear {name}, your loan {loan_no} is closed on {date}. Amount received Rs.{amount}. Thank you. - MICRO FINANCE` |
| Due reminder | `Dear {name}, your loan {loan_no} is overdue. Please pay the interest / renew at the earliest to avoid auction. - MICRO FINANCE` |

   The app's own text ends with `- {company}` (it fills in the name from Company Information). If your DLT templates end with a **different** name (e.g. the Entity Name *MICRO FINANCE* while the company is *RJM Gold Finance*), **type the DLT name itself** instead of `{company}`, as in the table.
4. **DLT template id** - paste the Template ID of that message (from A3).
5. **Active** - on. **Save (F2)**.
6. Do the same for **Interest received**, **Loan closed** and **Due reminder**.
7. Switch **off** (Active off) every SMS template you did **not** register: *Birthday wishes* and *Daily summary to owner*, unless you registered them too.

### Step C2 - Connect the app to the post office (Auto SMS Rules tab)
1. Click **Auto SMS Rules**.
2. **Enable SMS** - on.
3. **Provider URL** - paste the link from B4, with `{phone}`, `{message}` and `{template_id}` in their places.
4. **Failure text in the provider answer** - type the words BSNL uses when it refuses, e.g. `error, invalid, fail` (comma between). Then a refused SMS shows as *FAILED* in the app instead of *SENT*.
5. Switch on the events you want: **On new loan**, **On interest / part payment**, **On release**, **Due reminders**.
6. Optional - **Daily due reminders**: send after *10:00*, interest not paid for *3* months, also loans past the settle date, not again within *15* days.
7. **Save**.

### Step C3 - Test from the app (Queue & Log tab)
1. Take a small test entry for a customer whose mobile is **your own** - e.g. an interest receipt of Rs 100 on a test loan.
2. Within a minute open **Queue & Log**:

| You see | Means | Do |
|---|---|---|
| **SENT** and the SMS arrives | Everything works | Done |
| **SENT** but no SMS | BSNL accepted it, the operator dropped it | Bulk SMS → **View Campaigns** for the reason; usually the text does not match DLT word for word, or the chain (A4) is missing |
| **FAILED - No DLT template id on the "…" template** | C1 step 4 missed | Paste the Template ID, then **Retry failed** |
| **FAILED - Provider said: …** | BSNL refused it | Read the words; wrong key / header / template ID. Fix, then **Retry failed** |
| **FAILED - HTTP 401 / 404** | Wrong link or key | Check the Provider URL (B4) |
| **SKIPPED - Provider URL not set** | C2 not saved | Paste the link, Save |

3. Cancel the test entry if it was only a test (Loan Details → History → undo).

---

# A complete worked example (one message, start to finish)

Shop: entity **MICRO FINANCE**, header **MCRFIN**. Message: **Interest received**. (The IDs below are examples - use your own.)

**1. On DLT (A3)** - register:
`Dear {#var#}, received Rs.{#var#} towards loan {#var#} on {#var#}. Thank you. - MICRO FINANCE`
→ approved, Template ID **1207171234567890123**.

**2. On DLT (A4)** - chain with BSNL KERALA **1402537140000015510** is active.

**3. On Bulk SMS (B3)** - Instant SMS with *Test / 100 / K1 / 16/11/2026* to your own mobile → it arrives.

**4. On Bulk SMS (B4)** - API Details shows a link like:
`https://bulksms.bsnl.in/…/send?key=AB12CD34&sender=MCRFIN&mobile=9876543210&message=Hello&peid=1401…&templateid=1207…`

**5. In the app (C2)** - Provider URL becomes:
`https://bulksms.bsnl.in/…/send?key=AB12CD34&sender=MCRFIN&mobile={phone}&message={message}&peid=1401…&templateid={template_id}`

**6. In the app (C1)** - *Interest received (SMS)*:
- Message: `Dear {name}, received Rs.{amount} towards loan {loan_no} on {date}. Thank you. - MICRO FINANCE`
- DLT template id: `1207171234567890123`

**7. At the counter** - Ravi Kumar (mobile 9876543210) pays Rs 1,500 interest on loan K12 on 16/11/2026. The app opens the link with:
- `{phone}` = 9876543210
- `{message}` = Dear Ravi Kumar, received Rs.1500 towards loan K12 on 16/11/2026. Thank you. - MICRO FINANCE
- `{template_id}` = 1207171234567890123

**8. Ravi's phone shows**, from *VM-MCRFIN*:
> Dear Ravi Kumar, received Rs.1500 towards loan K12 on 16/11/2026. Thank you. - MICRO FINANCE

**9. Queue & Log** shows the row as **SENT**, and the Bulk SMS balance goes down by one.

---

## Quick checklist

- ☐ A1 Entity ID and Entity Name written down
- ☐ A2 One approved header (e.g. MCRFIN)
- ☐ A3 Four approved content templates, Template IDs written down
- ☐ A4 PE-TM chain with BSNL KERALA 1402537140000015510
- ☐ B1 Balance available
- ☐ B2 Templates visible in Template Details
- ☐ B3 Instant SMS test reached your phone
- ☐ B4 API link copied
- ☐ C1 Four SMS templates in the app: same words, Template IDs, others switched off
- ☐ C2 Enable SMS, Provider URL with {phone} {message} {template_id}, events on, Saved
- ☐ C3 Test entry → SENT and SMS received

## If something goes wrong

| Problem | Most likely cause |
|---|---|
| No SMS at all, even from Instant SMS | PE-TM chain missing (A4), or balance is 0 |
| Instant SMS works, app SMS does not arrive | App text differs from DLT text (C1) - compare letter by letter, including spaces, commas and the name at the end |
| "Template not found" / "invalid template" | Wrong Template ID in the app, or the template belongs to another header |
| Some SMS arrive, some do not | One template is not approved or has a different text |
| Long names cut or rejected | A value longer than 30 letters in one `{#var#}` |

> WhatsApp messages from the app need none of this - they open WhatsApp on the counter computer.
> Changing the shop name later? Change the DLT templates first, wait for approval, then change the app.
