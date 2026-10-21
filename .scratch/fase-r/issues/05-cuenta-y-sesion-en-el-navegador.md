# 05: Account and session in the browser

**What to build:** a person registers with name and WhatsApp number, receives the code, enters it, and stays signed in across app restarts until "Cerrar sesión". The flow runs entirely in the browser against Supabase Auth. Cuenta, Ayuda and the Favoritos placeholder work; a private route without session sends the user to the account flow and back to where they were going.

**Blocked by:** 02 (Domain foundation and public reads).

**Status:** ready-for-agent

- [ ] supabase-js client with session persistence behind a storage adapter (localStorage now; swappable later); a session store exposed to the router and screens; token refresh automatic.
- [ ] `AuthApi` contract on the fake and on local Supabase with the test numbers: start (register and sign-in modes, WhatsApp channel), verify, resend with the 30 s cooldown and the Supabase rate-limit message, cancel, profile read and update (name, email, description only), logout that revokes the session.
- [ ] Screens ported to design v1 and usted copy: register/sign-in, code entry (pending number and name kept for ten minutes in session storage), profile, list of accounts, recover; Ayuda per role with the two WhatsApp numbers; Favoritos placeholder.
- [ ] Pathless private layout: no session redirects to the account flow with the intended destination; after sign-in the user lands there.
- [ ] Role (client/owner) switch is client state plus profile flag; the tab bar reflects it.
- [ ] Error mapping shows the Spanish messages for wrong code, expired code, too many attempts, rate limit.
- [ ] Playwright: the `cuenta` suite ported (register, code, profile, logout, role switch, help) with session injected through storage for tests that start signed in.
- [ ] No cookie of any kind is set by the app.
