# 07: Admin Casas list (design 23)

**What to build:** `/admin/casas` (today «Muy pronto») with search, chips Todas / Activas / Por pagar / Inactivas and subscription lines. Read only. See spec § Screens.

**Blocked by:** 02

**Status:** blocked

- [ ] `AdminListingsApi.houses()` (aal2 only) with contract on fake and local Supabase (aal1 admin and non-admin get nothing).
- [ ] Screen inside the admin chunk (limit 12 KB); search by name, CT-#### or owner; counts per chip.
- [ ] Playwright with the local admin (8899 0001, TOTP).
- [ ] Green: all batteries.
