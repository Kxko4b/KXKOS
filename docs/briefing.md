# Briefing and Leverframe apps

**Leverframe** embeds https://kxko4b.github.io/custom-leverframe-diagrams/ in a window.

**Briefing** is always in the start menu (to sign in); the desktop icon appears only after signing in as haleannson@gmail.com.
- Sign-in: Supabase Auth email link (no signups: `create_user:false`). Add the KXKOS URL
  under Supabase Auth, URL Configuration, Redirect URLs.
- Data: Edge Function `briefing-view` (verify_jwt on, owner email checked server-side, read-only).
- The browser only holds the public publishable key; the real access control is the function.
- Hiding the icon is cosmetic; the server enforces the owner check.

## daily-briefing is no longer public
`daily-briefing` (sends the push notification) rejects calls without the header `x-cron-secret`.
The function stores only the SHA-256 of the secret; the pg_cron jobs 4-9 send the secret.
