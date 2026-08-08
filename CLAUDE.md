# PropPalace

## Git workflow

This is a solo project deployed from Vercel, which builds **production from `master`**.
Work directly on `master`.

When Alex says "commit", "push", or "commit and push", commit to `master` and push to
`origin master` — do not create a feature branch first, and do not ask which branch.
Pushing `master` triggers a live production deploy that Alex shares publicly, so run
`npm run build` before pushing: a build failure means Vercel's deploy fails and the
live site silently keeps serving the previous version.

Background: in Aug 2026 four commits (including the Prop Ledger → PropPalace rebrand)
sat on a feature branch while the shared link kept serving stale code from `master`.
