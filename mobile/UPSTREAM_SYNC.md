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

**Last synced commit:** `4912d4e` (2026-09-28)

## Log

| Date | Upstream commit | What changed | Mobile impact | Status |
|---|---|---|---|---|
| 2026-08-30 | `0162718` (session start) | Baseline — `mobile/backend` copied from `backend/` at this commit | Fork point | Baseline |
| 2026-09-28 | `4912d4e` feat: Announcement Section for admins | `backend/{models,controllers,routes,validators,tests}/*announcement*`, `frontend/src/api/announcements.api.js`, `frontend/src/data/announcementTemplates.js`, `frontend/src/pages/admin/AdminAnnouncements.jsx` — richer admin announcement authoring (templates, expanded fields) | `mobile/backend` still has the old `Announcement` model/controller. Not yet ported. | **Pending — needs a decision**: is admin-authored announcements even in scope for the mobile app, or web-admin-only? |

## Process going forward
1. At the start of any mobile work session, run the diff commands above against the recorded "last synced commit."
2. Any new upstream commits get a row here immediately, marked `Pending`, even before they're ported — so nothing detected gets silently dropped.
3. When a change is ported into `mobile/backend` (or reflected in `mobile/app`), update its row to `Ported` with the mobile file(s) touched, and bump "Last synced commit" once everything up to that commit is resolved.
4. If a change is deliberately not relevant to mobile (e.g. an admin-only web feature), mark it `Skipped (reason)` rather than leaving it unresolved.
