# Briefing and Leverframe apps

**Leverframe** embeds https://kxko4b.github.io/custom-leverframe-diagrams/ in a window.

**Briefing** is shown (desktop + start menu) only after signing in as haleannson@gmail.com.
- Sign-in: Supabase Auth email link (no signups: `create_user:false`). Add the KXKOS URL
  under Supabase Auth, URL Configuration, Redirect URLs.
- Data: Edge Function `briefing-view` (verify_jwt on, owner email checked server-side, read-only).
- The browser only holds the public publishable key; the real access control is the function.
- Hiding the icon is cosmetic; the server enforces the owner check.
