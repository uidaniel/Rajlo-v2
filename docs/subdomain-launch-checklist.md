# Subdomain launch checklist

The proxy at `src/proxy.ts` is already host-aware. To activate the split in
production, do the following one-time setup on Vercel + DNS.

## 1. Vercel — add the three subdomains as project domains

In the project's **Settings → Domains**, add (in order):

- `rajlo.com` (apex — the marketing landing)
- `www.rajlo.com` (redirect to `rajlo.com`, set via Vercel UI)
- `rider.rajlo.com`
- `driver.rajlo.com`
- `admin.rajlo.com`

Vercel will show DNS records for each — typically a single `A` record
pointing the apex at `76.76.21.21` and `CNAME`s pointing each subdomain at
`cname.vercel-dns.com`.

Alternative (faster): add a wildcard `*.rajlo.com` and you only need one
`CNAME` record at your registrar. The proxy still routes correctly.

## 2. DNS — at your domain registrar

Whatever Vercel told you to add in step 1. After saving, propagation is
usually <5 minutes; HTTPS certs auto-issue via Let's Encrypt within
~1 minute of DNS resolving.

## 3. Supabase — add each subdomain as an allowed redirect URL

In Supabase **Authentication → URL Configuration → Redirect URLs**, add:

- `https://rajlo.com/auth/callback`
- `https://rider.rajlo.com/auth/callback`
- `https://driver.rajlo.com/auth/callback`
- `https://admin.rajlo.com/auth/callback`

Without this, Google OAuth + email-confirmation links will fail on
subdomain hosts because Supabase rejects redirects to unknown origins.

## 4. Google Cloud (for Maps + Directions API)

If your Maps API key is restricted by HTTP referrer, add the new
subdomains to the allowed list:

- `https://rajlo.com/*`
- `https://*.rajlo.com/*`

## 5. Test

Hit each URL in production:

| URL                                  | Expected                                  |
| ------------------------------------ | ----------------------------------------- |
| `rajlo.com/`                         | Marketing landing                         |
| `rider.rajlo.com/`                   | Marketing landing (same as apex for now)  |
| `driver.rajlo.com/`                  | Redirects to `/auth/driver/login`         |
| `admin.rajlo.com/`                   | Redirects to `/auth/admin/login`          |
| `rider.rajlo.com/driver/dashboard`   | Redirects to `driver.rajlo.com/driver/dashboard` |
| `driver.rajlo.com/admin/safety`      | Redirects to `admin.rajlo.com/admin/safety`      |

## Vercel preview URLs

Preview deploys (e.g. `rajlo-v2-git-feat-x.vercel.app`) don't have a
known portal prefix, so the proxy falls through to normal routing —
all paths accessible. No special handling needed for previews.
