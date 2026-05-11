# Supabase Auth — branded email templates

> Six HTML templates to paste into Supabase's built-in email template
> editor so signup confirmation, password reset, magic link, invite,
> email change, and reauthentication emails all match Rajlo's brand
> instead of looking like Supabase defaults.

## Quick setup (~15 min total — 2-3 min per template)

1. Make sure the **Send Email Hook** in Supabase Dashboard is **disabled**
   (Authentication → Hooks → Send Email Hook → toggle off).
   The hook intercepts emails before they reach the template engine, so
   if it's on these templates won't be used.

2. Go to **Supabase Dashboard → Authentication → Email Templates**.

3. For each tab, open the matching HTML file in this folder, copy the
   whole thing, and paste into Supabase's template editor:

   | Supabase tab            | File in this folder                | Subject (set above the editor)        |
   |-------------------------|------------------------------------|---------------------------------------|
   | Confirm signup          | `confirm-signup.html`              | `Confirm your Rajlo account · Let's go!` |
   | Invite user             | `invite.html`                      | `You're invited to Rajlo · Let's go!` |
   | Magic Link              | `magic-link.html`                  | `Your Rajlo sign-in link`             |
   | Change Email Address    | `change-email.html`                | `Confirm your new Rajlo email`        |
   | Reset Password          | `reset-password.html`              | `Reset your Rajlo password`           |
   | Reauthentication        | `reauthentication.html`            | `Your Rajlo confirmation code`        |

4. Click **Save changes** after each.

5. Test by triggering a fresh password reset or signup — the email
   should arrive looking like the rest of Rajlo's transactional emails
   (red header band with white wordmark, dark footer with "Let's go!").

## What's inside each template

Standard Rajlo design system, inlined for max email-client compatibility:

- **Hero band** — dark gradient with the white Rajlo wordmark image
- **Title block** — red uppercase eyebrow + bold dark headline
- **Body** — muted body copy with a brand-red pill CTA button
- **Footer** — dark band with the "Let's go!" tagline + © line

Templates use Supabase's Go template variables — see Supabase docs at
<https://supabase.com/docs/guides/auth/auth-email-templates>:

- `{{ .ConfirmationURL }}` — the magic link the user taps
- `{{ .Email }}` — recipient address
- `{{ .Token }}` — 6-digit OTP (reauthentication only)
- `{{ .SiteURL }}` — your app's base URL

## Tweaking copy later

Open the relevant `.html` file, edit the text between tags (leave the
`{{ .Variable }}` bits alone), paste back into Supabase, save. Done.

## When you'd want to switch to Option B (the hook) later

Once your templates settle and you don't want to maintain HTML in two
places (Supabase Dashboard + a Git repo somewhere), revisit the
webhook approach. For beta, keep these simple Supabase-hosted
templates and iterate via the Dashboard.
