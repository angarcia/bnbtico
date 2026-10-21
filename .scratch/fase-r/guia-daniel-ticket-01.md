# Guide for Daniel · what to do before ticket 01 can deploy

Everything in this guide is a one-time action in a dashboard that only you can do. Nothing here touches code. Total time: about 40 minutes of clicks plus a DNS wait of up to 24 h that runs in the background.

The order matters only in part D (nameservers) which must come after part C (records copied). Parts A, B and E can run in any order.

When you finish, tell me "guide done" and the exact names of the secrets you created if you deviated from the names below.

---

## What I found already

- Registrar of `bnbtico.com`: **GoDaddy**. Nameservers today: `ns35.domaincontrol.com`, `ns36.domaincontrol.com`. So DNS is **not** on Cloudflare yet.
- `bnbtico.com` and `pruebas.bnbtico.com` point at Vercel today. They must keep working until the cutover (ticket 13).
- You already have a Cloudflare account from the earlier attempt (commit `3c609b6`). If not, create one at dash.cloudflare.com with your normal email.

---

## A · GitHub: allow Actions and prepare the secrets area (5 min)

1. Open `https://github.com/angarcia/bnbtico/settings/actions`. Under "Actions permissions" make sure "Allow all actions and reusable workflows" is selected. Under "Workflow permissions" leave "Read repository contents and packages permissions" and tick "Allow GitHub Actions to create and approve pull requests" (needed to post preview URLs on pull requests).
2. Open `https://github.com/angarcia/bnbtico/settings/secrets/actions`. You will add secrets here in parts B, C and E. Keep the tab open.

Secrets are per repository, encrypted, and never printed in logs.

---

## B · Cloudflare: account id and API token (10 min)

### B1 · Account id

1. Sign in at `https://dash.cloudflare.com`.
2. In the left menu open **Workers & Pages**. On the overview page, the right column shows **Account ID** (32 hex characters). Copy it.
3. In GitHub secrets, add **`CLOUDFLARE_ACCOUNT_ID`** with that value.

### B2 · API token

1. Top right, click your profile icon → **My Profile** → left menu **API Tokens** → **Create Token** → at the bottom, **Create Custom Token** → **Get started**.
2. Name: `bnbtico-github-actions`.
3. Permissions. Add these rows exactly (the menu order is Scope · Service · Level):
   - Account · **Workers Scripts** · Edit
   - Account · **Account Settings** · Read
   - Account · **Workers Tail** · Read (lets me stream logs with `wrangler tail`; optional but useful)
   - Zone · **Workers Routes** · Edit
   - Zone · **DNS** · Edit (needed so `wrangler` can create the custom domain records)
   - Zone · **Cache Purge** · Purge (needed by ticket 03 to purge a listing page)
4. Account Resources: **Include · your account**.
5. Zone Resources: **Include · Specific zone · bnbtico.com**. If `bnbtico.com` is not in the list yet, do part C first and come back, or choose **All zones** for now and narrow it later.
6. Client IP filtering: leave empty. TTL: leave empty.
7. **Continue to summary** → **Create Token**. Copy the token now; Cloudflare shows it once.
8. In GitHub secrets, add **`CLOUDFLARE_API_TOKEN`** with the token.

If the permission names differ slightly in your dashboard (Cloudflare renames things), pick the closest match with the same meaning and tell me which.

---

## C · Cloudflare: add the zone `bnbtico.com` and copy the current records (10 min)

This step does **not** change where the sites are served. It only prepares Cloudflare to answer DNS with the same records GoDaddy answers today.

1. Dashboard home → **Add a domain** (the button may read "Onboard a domain"). Type `bnbtico.com`. Choose the **Free** plan. Choose "Quick scan for DNS records".
2. Cloudflare shows the records it found. Compare with GoDaddy: open `https://dcc.godaddy.com/control/bnbtico.com/dns` in another tab and make sure every record there exists in Cloudflare. The ones that matter:
   - `A` for `@` (root) pointing at Vercel, usually `76.76.21.21`.
   - `CNAME` for `pruebas` pointing at Vercel, usually `cname.vercel-dns.com`.
   - `CNAME` for `www` if it exists.
   - Any `MX` and `TXT` records (mail, domain verification, Google Search Console). Copy them all; a missing TXT breaks a verification, a missing MX breaks mail.
   Add anything missing with **Add record**.
3. **Proxy status**: for the two Vercel records (`@` and `pruebas`) set the cloud icon to **DNS only** (grey). Vercel terminates TLS itself; a proxied (orange) record in front of Vercel causes redirect loops or certificate errors. `MX` and `TXT` records have no proxy option.
4. Click **Continue**. Cloudflare shows two nameservers of the form `xxxx.ns.cloudflare.com`. Copy both. Do **not** change anything at GoDaddy yet.
5. Skip the "quick start guide" (SSL settings etc.); defaults are fine. Then in the zone, open **SSL/TLS** → **Overview** and confirm the mode is **Full** (not Flexible). Full works for both the Vercel records (DNS only) and the future worker.

---

## D · GoDaddy: switch the nameservers (5 min, then up to 24 h of waiting)

Do this only after part C shows all records present.

1. Open `https://dcc.godaddy.com/control/bnbtico.com/dns` → **Nameservers** → **Change** → **I'll use my own nameservers**.
2. Enter the two Cloudflare nameservers from C4. Save. GoDaddy asks for confirmation; confirm.
3. Propagation takes minutes to 24 h. During that time some resolvers answer from GoDaddy and some from Cloudflare; because the records are identical, both sites keep working.
4. How you know it is done: the Cloudflare zone overview changes from "Pending nameserver update" to **Active** and sends you an email. You can also check `https://www.whatsmydns.net/#NS/bnbtico.com`.

Until the zone is Active, `wrangler` cannot create the custom domain `nueva.bnbtico.com`. Ticket 01 can still deploy to the temporary `*.workers.dev` address in the meantime, so this wait does not block me.

---

## E · Supabase: the keys for the `pruebas` project (5 min)

1. Open `https://supabase.com/dashboard/project/bpxiggdzgzolcazaaboj/settings/api` (project `bnbtico-pruebas`).
2. Copy three values. Supabase is in the middle of a key format change, so the page shows one of two layouts:
   - Legacy layout: **Project URL**, **anon public** key, **service_role** key (click "Reveal").
   - New layout ("API Keys" tab): **Project URL**, the **publishable** key (plays the anon role), and a **secret** key (plays the service role; create one named `worker` if none exists).
3. In GitHub, add:
   - Variable (not secret; tab "Variables"): **`SUPABASE_URL`** = the project URL, `https://bpxiggdzgzolcazaaboj.supabase.co`.
   - Variable: **`SUPABASE_ANON_KEY`** = the anon/publishable key. It is designed to be public; it ends up in the browser bundle.
   - Secret: **`SUPABASE_SERVICE_ROLE_KEY`** = the service_role/secret key. This one never leaves GitHub and the worker's environment.

Nothing else changes in Supabase for ticket 01. MFA (ticket 09), Turnstile and `db-max-rows` (ticket 11) come later with their own notes.

---

## F · Cloudflare Zero Trust: protect `nueva.bnbtico.com` (5 min, after the zone is Active)

This replaces the password in the old `proxy.ts`. It is free up to 50 users. Cloudflare may ask for a payment method when you enable Zero Trust; the free plan is not charged.

1. Dashboard left menu → **Zero Trust**. First time: choose a team name, for example `bnbtico` (gives you `bnbtico.cloudflareaccess.com`), pick the **Free** plan, confirm.
2. In Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name: `bnbtico nueva`. Session duration: **1 month** (so your phone does not ask every day). Application domain: subdomain `nueva`, domain `bnbtico.com`. Leave the rest default.
4. Policies → **Add a policy**: name `Daniel`, action **Allow**, under "Include" choose **Emails** and type your email (and any tester's email). Save.
5. Identity providers: the default **One-time PIN** is enough; Cloudflare emails a code when you open the site.
6. Save the application. From now on opening `nueva.bnbtico.com` asks for your email and a PIN once per month per device.

Crawlers: WhatsApp's preview bot cannot pass Access. For the WhatsApp preview check in ticket 03 I will add a **Bypass** policy for the path `/casa/*` with the WhatsApp and Facebook user agents, the same exception the old proxy had. You do not need to do anything for that.

---

## G · What you do not need to do

- No `wrangler login` or `wrangler` install on your machine. The workflow deploys from GitHub with the token.
- No Cloudflare Workers paid plan. Free plan first; I will tell you if a trigger fires.
- No change to Vercel. It keeps serving the old app until ticket 13.
- No Twilio changes.

---

## Checklist to send me

- [ ] A · Actions allowed; workflow permissions set.
- [ ] B · `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in GitHub secrets.
- [ ] C · Zone `bnbtico.com` added, records compared with GoDaddy, Vercel records set to DNS only, SSL mode Full.
- [ ] D · Nameservers changed at GoDaddy (and the date/time you did it).
- [ ] E · `SUPABASE_URL`, `SUPABASE_ANON_KEY` variables and `SUPABASE_SERVICE_ROLE_KEY` secret in GitHub.
- [ ] F · Access application for `nueva.bnbtico.com` with your email (can wait until the zone is Active).

With A, B and E done I can start ticket 01 and deploy to the temporary `workers.dev` address the same day. With C, D and F done the deploy moves to `nueva.bnbtico.com`.
