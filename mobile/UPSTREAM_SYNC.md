# Upstream Sync Log

`mobile/backend` is a file copy of `backend/`, not a git fork — it has no
shared history, so `git diff` against it directly won't work. Instead this
file tracks the last upstream commit we've reviewed, and every session should
check `backend/` and `frontend/` for commits after that point before doing
new mobile work.

**How to check for drift:**
```
git log --oneline <last-synced-commit>..HEAD -- backend/ frontend/
git diff --stat <last-synced-commit>..HEAD -- backend/ frontend/
```

**Last synced commit:** `96f357c` (2026-09-28)

## Log

| Date | Upstream commit | What changed | Mobile impact | Status |
|---|---|---|---|---|
| 2026-08-30 | `0162718` (session start) | Baseline — `mobile/backend` copied from `backend/` at this commit | Fork point | Baseline |
| 2026-09-28 | `4912d4e` feat: Announcement Section for admins | `backend/{models,controllers,routes,validators,tests}/*announcement*`, `frontend/src/api/announcements.api.js`, `frontend/src/data/announcementTemplates.js`, `frontend/src/pages/admin/AdminAnnouncements.jsx` — richer admin announcement authoring (templates, expanded fields, `critical`/`user` targeted audiences) | Backend: **Ported** — `mobile/backend/{models,controllers,routes,validators,tests}/*announcement*` now match upstream (19/19 tests passing, full suite 315/315). Kept the admin create/broadcast/critical-preview/delete endpoints too, even though mobile has no admin UI yet, so the backend stays merge-ready. Consumer UI: **Pending** — a read-only notification-bell screen in `mobile/app` is deferred to Phase 5 (mobile app foundation), since there's no navigation shell/screens yet to attach it to. No admin authoring UI is planned for `mobile/app` — admins keep using the web admin dashboard for that. | Backend ported; UI pending Phase 5 |
| 2026-09-28 | `96f357c` feat: Announcement Section updated | `frontend/src/data/announcementTemplates.js`, `frontend/src/pages/admin/AdminAnnouncements.jsx` only — fixes a UX bug where picking a compose template silently overrode the admin's chosen "Send to" audience; a template's `audience` is now just a display hint in the dropdown | No backend change, no consumer-facing change — this is purely a fix inside the web admin compose form, which `mobile/app` doesn't have (and isn't planned to). | **Skipped** (web-admin-only UI fix, nothing to port) |

## Process going forward
1. At the start of any mobile work session, run the diff commands above against the recorded "last synced commit."
2. Any new upstream commits get a row here immediately, marked `Pending`, even before they're ported — so nothing detected gets silently dropped.
3. When a change is ported into `mobile/backend` (or reflected in `mobile/app`), update its row to `Ported` with the mobile file(s) touched, and bump "Last synced commit" once everything up to that commit is resolved.
4. If a change is deliberately not relevant to mobile (e.g. an admin-only web feature), mark it `Skipped (reason)` rather than leaving it unresolved.
