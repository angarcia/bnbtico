# 07: Publish wizard, nine screens, without photos

**What to build:** an owner taps "Publicar", walks the nine screens on a small phone without scrolling, each "Continuar" moves on at once while the save happens in the background, a failed save brings them back with the server's message and their data intact, a pending draft resumes from any device, and "Enviar a revisión" submits through the database RPC and lands on the "¡Listo!" screen. Photo upload is the next ticket; step 7 shows the grid and count from server data.

**Blocked by:** 06 (Owner zone, read side and simple actions).

**Status:** ready-for-agent

- [ ] Contracts on both adapters: create draft (CT id assigned, null fields), save step for each of the nine steps with validation parity to the old schema tests, save persists every field that normalisation changes (nightly price cleared when nightly mode is off, bathroom flag cleared when not a room), submit requires the same conditions as the RPC and surfaces its Spanish messages, resume finds the pending draft.
- [ ] Nine screens per design v1 and the 2026-10-21 decision: modality and type, where, map with draggable pin inside Costa Rica, capacity with counters and shared bathroom for rooms, features with parking type, name and description that grows, photos grid, price per active modality, send with WhatsApp number read-only and offer text; progress bar of nine segments and "Paso n de 9".
- [ ] One shared form module owns: submit through a mutation with optimistic draft update, navigate-then-save, rollback to the step on error, `keepalive` on the save request, the iPhone keyboard room rule (320 px and scroll margin under the header), `enterKeyHint` per field, and the React 19 uncontrolled-reset workaround.
- [ ] Last step re-reads the draft from the server, validates all, and only then calls submit; the photo count on step 7 comes from the server list, never from a form field.
- [ ] "Corregir y reenviar" from 06 opens the wizard on the draft at step 1 with values filled.
- [ ] Playwright: the nine-screen walk ported (no-scroll assertions at 375×667 with and without keyboard), error on an invalid step, resume of a pending draft; photos step passes with pre-seeded photos.
