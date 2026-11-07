# Working agreement

Read `docs/STATUS.md`, `docs/SOP.md` and `docs/RUNBOOK.md` before changing or deploying this project. Indonesian is the user's working language.

- Explain the goal and exact scope before an application change. Follow the authorization already recorded in the conversation; do not infer permission to push/merge/deploy from an audit-only request. Do not repeatedly seek permission for steps already approved.
- Develop on a short-lived task branch. Inspect dirty work first and preserve the user's changes. The VPS is a release target; do not edit running application code or execute destructive tests there.
- Runtime: Ubuntu24.04, Node24, Express plus built-in SQLite, React/Vite, Nginx, PM2 as `lpapp`. One backend fork process only: the application caches state in memory.
- Code and data are separate. Deployment never resets/restores the database. Any intentional data removal or incompatible migration needs its own approved plan.
- Use `python3 ops/ci.py` for the complete validation path. It creates disposable backend/database copies; the HTTP security suite mutates/restores state and must never point to the VPS.
- Build packages on Linux using the pinned Node version; use lockfiles. CI packages the exact reviewed commit, both frontend and backend, without credentials/data/Git metadata.
- Installed privileged operations are root-owned and updated only through reviewed operator installation. Runtime archives cannot update the privileged controller.
- Never print `.env`, tokens, private keys, cookie values or `pm2 env`/`pm2 jlist`. Store deployment secrets through GitHub environment settings, not chat or commits.
- Deployment status comes from `doctor`/the actual process and release manifest, not the folder name or an old chat message. Record tests actually executed and distinguish local tests, GitHub workflow runs and VPS verification.
- Keep `docs/STATUS.md`, release notes and the runbook current. State remaining work and the exact command/UI action needed to resume after a chat interruption.

- Go-live work: protect primary Super Admin and CEO (CEO uses super_admin), Agung keeps the current role and is explicitly reactivated as confirmed by the owner, and retain every admin_ops/admin_branch account. Preserve other inactive accounts' status. Select accounts by exact ID/email, never fuzzy name matching; actual selectors belong only in the private policy.
- Production customer-data cleanup is a separate reviewed cutover. ops/production.py prepares a new candidate only; never run tests/reset/restore against shared/data. Never commit a live roster, private policy or temporary passwords.
