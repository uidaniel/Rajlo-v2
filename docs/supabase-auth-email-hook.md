# Supabase Auth Email Hook — setup

> This routes every Supabase auth email (signup confirmation, password
> reset, magic link, invite, email change, reauthentication) through
> Rajlo's own Resend integration via `renderEmail()` so they match the
> rest of the platform's brand. One source of truth in code instead
> of templates living in two places.

## What's wired in code

| Piece | Where |
|---|---|
| Webhook endpoint | [`src/app/api/auth/email-hook/route.ts`](../src/app/api/auth/email-hook/route.ts) |
| Standard Webhooks signature verification | same file, `verifyStandardWebhookSignature` |
| Six branded email templates | bottom of [`src/lib/email-templates.ts`](../src/lib/email-templates.ts) — `authSignupConfirmTemplate`, `authMagicLinkTemplate`, `authPasswordRecoveryTemplate`, `authInviteTemplate`, `authEmailChangeTemplate`, `authReauthenticationTemplate` |
| Env var | `SUPABASE_AUTH_HOOK_SECRET` in `.env.local` (placeholder, populate from Supabase Dashboard) |

## Your one-time setup (5 min)

### 1. Configure the hook in Supabase

1. Open **supabase.com** → Rajlo project
2. Left sidebar → **Authentication** → **Hooks**
3. Find **"Send Email Hook"** → click **Enable** / **Configure**
4. **Hook URL**:
   ```
   https://rajlo-v2.vercel.app/api/auth/email-hook
   ```
   *(swap for `https://rajlo.com/...` once you point your domain at Vercel)*
5. **HTTP method** → POST (should already be the default)
6. Click **Save**
7. After saving, Supabase shows the **Signing secret** — starts with `v1,whsec_…`. Click **Reveal** → copy the whole string.

### 2. Drop the secret into env

1. Open `.env.local` → find `SUPABASE_AUTH_HOOK_SECRET=` → paste the value (the whole `v1,whsec_…` string)
2. Open **Vercel** → Project Settings → Environment Variables → add **new var**:
   - Name: `SUPABASE_AUTH_HOOK_SECRET`
   - Value: the same `v1,whsec_…` value
   - Environments: All (Production, Preview, Development)
3. Save and **redeploy**

### 3. Verify the hook is firing

Send yourself a test password reset:

1. Open `https://rajlo-v2.vercel.app/auth/rider/login` → click "Forgot password?" → enter your email → submit
2. The reset email should arrive in **30-60 seconds**
3. **Confirm it's the branded Rajlo design** — red header band with the white wordmark, red CTA button, dark footer with "Let's go!" tagline. NOT Supabase's default plain-text template.

If you get the plain Supabase template instead → the hook isn't firing. Check:
- Supabase Dashboard → Auth → Hooks → Send Email Hook → Logs (right side of the page). Look for the latest event. The response code tells you what went wrong:
  - **401** = signing secret mismatch (Vercel env var doesn't match Supabase's secret)
  - **500** = code error — open Vercel Function logs for `/api/auth/email-hook`
  - **No event at all** = hook isn't enabled or URL is wrong

## What each auth event triggers

| Trigger | Action type | Template |
|---|---|---|
| User signs up | `signup` | "Welcome to Rajlo · Confirm your email" |
| User clicks "Forgot password?" | `recovery` | "Reset your password" |
| User requests passwordless sign-in | `magiclink` | "Your Rajlo sign-in link" |
| Admin invites a user via dashboard or `inviteUserByEmail` | `invite` | "You're invited to Rajlo" |
| User changes their email address | `email_change` / `email_change_current` | "Confirm your new email" |
| Sensitive op requires re-auth | `reauthentication` | "Confirm it's you" (with 6-digit code) |

All six templates use the same renderer (`renderEmail()` in `src/lib/email-render.ts`), so a brand tweak there propagates everywhere.

## Maintenance — adding new copy or templates later

To change wording on any auth email:

1. Open `src/lib/email-templates.ts`
2. Find the function for the email type (e.g. `authSignupConfirmTemplate`)
3. Edit the `subject`, `preheader`, `title`, or section text
4. Push → Vercel redeploys → next auth email of that type uses the new copy

No changes needed in Supabase Dashboard — Supabase keeps calling the webhook with the same payload regardless of what we render.

## Rollback

If something breaks the auth email pipeline (e.g. a Resend outage):

- Disable the hook in Supabase Dashboard → Auth → Hooks → Send Email Hook → toggle off
- Supabase immediately falls back to its built-in unbranded templates
- Users still get their emails (just plain-looking) — no service interruption

Re-enable when you've fixed the issue.

## Why we route every auth event through this

Even templates we don't customize heavily (e.g. reauthentication) go through the hook so:

1. **Single brand source of truth** — every email Rajlo sends has the same letterhead
2. **Centralized observability** — Sentry catches send failures across all auth emails
3. **Easier domain reputation management** — every email leaves from `noreply@rajlo.com`, no Supabase intermediate hostnames

If we ever want to disable the hook for one specific email type (say recovery emails to use Supabase's default), we'd just remove that `case` from the switch in `email-hook/route.ts` — Supabase falls back automatically when the hook returns 500 or doesn't respond.
