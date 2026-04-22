# Atlas Onboarding Email — Zapier Webhook Setup

Triggered automatically when a new hire's Google Workspace account is created.
The app POSTs JSON to your Zapier Catch Hook URL, and Zapier sends a credentials email to the employee's personal inbox.

---

## 1. Env Variable

Add this to Vercel (and `.env.local` for local dev):

```
ATLAS_ONBOARDING_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/XXXXXXX/YYYYYYY/
```

---

## 2. Zapier Trigger — Webhooks by Zapier (Catch Hook)

1. Create a new Zap → **Trigger**: `Webhooks by Zapier` → `Catch Hook`
2. Copy the generated webhook URL → paste as `ATLAS_ONBOARDING_WEBHOOK_URL`
3. Test the trigger by running a workflow in dev (or use curl — see §5)

### Payload shape the app sends

```json
{
  "to": "john.doe@gmail.com",
  "firstName": "John",
  "lastName": "Doe",
  "companyEmail": "john.doe@calimingo.com",
  "tempPassword": "johndoe-2026"
}
```

---

## 3. Zapier Action — Gmail / Send Email

| Zapier field | Value / mapping |
|---|---|
| From | `onboarding@calimingo.com` (or your verified sender) |
| To | `{{to}}` |
| Subject | `Welcome to Calimingo — Your Account Is Ready` |
| Body type | HTML |
| Body | See template below |

### Email HTML template

```html
<p>Hi {{firstName}},</p>

<p>Your Calimingo Google Workspace account has been created. Here are your login credentials:</p>

<table cellpadding="6" cellspacing="0" border="0">
  <tr>
    <td><strong>Email</strong></td>
    <td>{{companyEmail}}</td>
  </tr>
  <tr>
    <td><strong>Temporary Password</strong></td>
    <td>{{tempPassword}}</td>
  </tr>
</table>

<p>
  <a href="https://accounts.google.com">Sign in at accounts.google.com</a>
  and change your password immediately after your first login.
</p>

<p>
  If you have any trouble, reply to this email or reach out to IT.
</p>

<p>Welcome aboard!<br>Calimingo People Ops</p>
```

---

## 4. Zapier Field Mappings Summary

| App field | Zapier variable |
|---|---|
| `to` | `{{to}}` — recipient personal email |
| `firstName` | `{{firstName}}` |
| `lastName` | `{{lastName}}` |
| `companyEmail` | `{{companyEmail}}` |
| `tempPassword` | `{{tempPassword}}` |

---

## 5. Test with curl

```bash
curl -X POST "$ATLAS_ONBOARDING_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-personal@gmail.com",
    "firstName": "Test",
    "lastName": "User",
    "companyEmail": "test.user@calimingo.com",
    "tempPassword": "testuser-2026"
  }'
```

---

## 6. Notes

- The webhook call is **fire-and-forget** — a delivery failure does not block the workflow step.
- If `personalEmail` is not set on the employee record, the webhook is silently skipped.
- The webhook fires only after the Google account is confirmed created (not on retry attempts that fail).
- `ATLAS_ONBOARDING_WEBHOOK_URL` being unset also silently skips the call (safe for local dev without Zapier).
