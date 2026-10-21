# 06: Owner zone, read side and simple actions

**What to build:** an owner opens the owner home and Mis casas and sees their houses at once from cache, with status and the admin's note; opens a house detail, shares the public link with the native share sheet, flips "Disponible para consultas" and sees it respond immediately, reopens a house for correction, and discards a never-reviewed draft. Every rule is enforced by the database and mirrored by `can`.

**Blocked by:** 05 (Account and session in the browser).

**Status:** ready-for-agent

- [ ] Owner contracts on both adapters: list own listings, get own listing, set available (only active), reopen for edit (active/changes/rejected to draft), delete draft (only never-reviewed; the message says why otherwise), another owner's listing is invisible.
- [ ] Owner home per design v1: single action by status (publish / in review / share), offer card with real remaining slots, new inquiries count placeholder.
- [ ] Mis casas with summary boxes and light cards; house detail with share, edit, availability switch, "Corregir y reenviar", discard; "enviada" screen.
- [ ] Availability switch is optimistic with rollback and the DB's message on failure; editing an active house asks confirmation with the "dejará de verse" warning before calling reopen.
- [ ] Share uses the Web Share API with the public URL and falls back to copy.
- [ ] Queries per screen (owner listings 30 s stale, persisted; detail seeded from the list) refetch on focus and on app resume.
- [ ] Playwright: owner detail, availability, reopen and discard flows ported.
