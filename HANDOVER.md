# Venuely.co.za — Website Contributor Handover

For the business partner working on the **marketing website only**. The product
dashboard (anything under `/venue/*`, `/admin/*`, `/portal/*`) is out of scope.

---

## 1. There is no "server" to log into

Venuely runs on managed services. There's no SSH and no root password.

| Service | What it is | URL |
|---|---|---|
| **GitHub** | Source code (single source of truth) | https://github.com/shaunvand/venuely |
| **Render** | Hosting — auto-deploys on push to `master` | https://dashboard.render.com/web/srv-d81odllckfvc73fpe0p0 |
| **Supabase** | Database + auth (read-only access for you) | https://supabase.com/dashboard/project/njhlmucwdsmzlswjlhmf |
| **Live site** | https://venuely.co.za | |

---

## 2. How you get access (the safe way)

Don't ask for API keys. Instead, accept these invites:

1. **GitHub** — Shaun will invite you as a *Collaborator* with **Write** access on `shaunvand/venuely`. You sign in with your own GitHub account.
2. **Render** — Shaun will invite you to the workspace as a **Developer** (not Admin). You'll be able to view logs, redeploy, and manage env vars on the `venuely` service. You cannot touch other services.
3. **Supabase** — Shaun will invite you to the org as a **Developer**. Read-only by default; ask before running SQL.

You should never be sent a plain-text API key by chat or email. If something requires a credential, ask Shaun directly.

---

## 3. Local setup (one time)

Open Claude Code in your terminal and paste this prompt:

> *"Clone https://github.com/shaunvand/venuely.git into ~/Projects/venuely. The Next.js app lives in the `app/` subfolder. Run `cd app && npm install`. Then ask me for the `.env.local` file — I'll paste it. Don't try to run `supabase` CLI commands; the database is managed remotely."*

After the install, ask Shaun to send you the `.env.local` over a secure channel (1Password share or Signal). Save it as `app/.env.local`. **Never commit this file** (it's already in `.gitignore`).

Run the dev server:

```
cd app
npm run dev
```

Open http://localhost:3000 — that's the live marketing site running on your machine.

---

## 4. What you can edit

| Folder / File | Yes / No |
|---|---|
| `app/app/page.tsx` | ✅ The main marketing homepage |
| `app/app/signup/` | ✅ Signup page + envelope confirmation |
| `app/app/login/page.tsx` | ✅ Login page styling |
| `app/components/Logo.tsx` | ✅ Brand mark + wordmark |
| `app/components/Reveal.tsx` | ✅ Scroll-reveal animation helper |
| `app/components/WelcomeImportModal.tsx` | ✅ Marketing-adjacent — ask first if changing logic |
| `app/app/globals.css` | ✅ Brand palette, fonts, animations |
| `app/public/` | ✅ Static images and assets used on the marketing site |

## 5. What is OFF-LIMITS

Do not edit any of the following. They power the paying-customer dashboard.

| Folder | Why |
|---|---|
| `app/app/venue/*` | Venue admin dashboard (the product itself) |
| `app/app/admin/*` | Internal owner-only admin |
| `app/app/portal/*` and `app/app/[wedding]/route.ts` | Couple portal — every paying customer sees this |
| `app/app/api/*` | Backend API routes — touching these can break live data |
| `app/lib/*` | Shared libraries used by the dashboard |
| `app/templates/*` | Couple-portal HTML template |
| `supabase/migrations/*` | Database schema — never modify directly |
| `next.config.ts` and `package.json` | Build configuration — ask before changing dependencies |

If something on the marketing page imports from `app/lib/` or `app/components/` and you need to tweak that shared component, ask Shaun first — those changes can ripple into the dashboard.

---

## 6. Brand reference (so you don't have to guess)

```
Poppy        #FA523C    primary call-to-action
Poppy-deep   #E03E28    hover state
Peach        #FFC6AD    soft accent / icon backgrounds
Sage         #D5DBCC    secondary accent
Cream        #FFF6F0    backgrounds
Daisy        #FAF2E8    section bands
Ink          #1c1917    body text
```

```
Fraunces    — headings (serif, weights 600/700/900 + italic)
Satoshi     — body text (loaded from Fontshare CDN)
```

Tagline: **"Everything wedding, handled."**
Single accent word per headline, styled in Poppy + italic Fraunces.

---

## 7. Deploy flow

Every push to `master` auto-deploys to https://venuely.co.za via Render.

```
git add -A
git commit -m "your message"
git push
```

That's it. The deploy takes ~2 minutes. You can watch it on the Render dashboard. **Always run `npm run build` locally first** to catch type errors before pushing.

If a deploy fails on Render, open the build log from the dashboard, share the error with Shaun, and don't keep pushing fixes blindly.

---

## 8. Prompt to keep pinned in Claude Code

> *"I'm working on the Venuely.co.za marketing website only. Brand palette: Poppy #FA523C, Peach #FFC6AD, Sage #D5DBCC, Cream #FFF6F0. Fonts: Fraunces (headings) + Satoshi (body). Everything I edit is in `app/app/page.tsx`, `app/app/signup/`, `app/components/`, `app/public/`, or `app/app/globals.css`. I do not touch anything under `app/app/venue/`, `app/app/admin/`, `app/app/portal/`, `app/app/api/`, `app/lib/`, `supabase/migrations/`, or `next.config.ts` without asking Shaun first. After any change: `npm run build` to verify, then commit and push to master — Render auto-deploys."*

---

## 9. Emergencies / contacts

- **Build breaks live site**: revert the last commit (`git revert HEAD && git push`) and message Shaun.
- **You accidentally edit something off-limits**: don't commit. Run `git restore <file>` to undo.
- **You need a credential**: ask Shaun. Don't search Slack/email/chat history for old tokens.

---

*Document location: `C:\Users\shaun\Documents\Claude\Projects\PatBusch-Portal\app\HANDOVER.md`*
*Last updated: 2026-05-21*
