# 08: Photos, variants and direct upload

**What to build:** on step 7 an owner picks several photos at once, sees each one resized on the phone and uploaded in parallel with progress, reorders them and sets the cover, removes one, and cannot exceed fifteen. Uploads go straight from the browser to Storage with the owner's session; the database assigns positions and enforces the limits.

**Blocked by:** 07 (Publish wizard, nine screens, without photos).

**Status:** ready-for-agent

- [ ] Migration `cliente_directo`, part two: RPCs to add a photo (position computed in SQL, limit of fifteen enforced), remove a photo, and reorder photos in one transaction (cover is position 0); Storage insert policy caps objects per listing folder at 45; owner insert policy caps open drafts at five. Database tests for each cap and for an intruder.
- [ ] Browser produces three JPEG variants (480, 800, 1600 px long side, quality 0.8) from the original, rejects HEIC with the existing message, and uploads the three in parallel with concurrency 3 to `<listing>/<uuid>/<size>.jpg` with a one-year cache header.
- [ ] Photo contracts on both adapters: add registers the three paths under one photo, remove deletes row then objects, reorder and set cover, limit reached message.
- [ ] Uploader UI: progress per photo, reorder, cover tag, remove, "Añada al menos 5" guidance; no client-side mirroring of server reordering.
- [ ] `Picture` from 04 and the hero from 03 use the variants when present.
- [ ] Playwright: wizard with real photo upload against local Supabase, cover change, remove, limit.
- [ ] Old photos (single 1600 px path) keep rendering; no backfill in this ticket.
