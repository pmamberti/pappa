# Pappa D1 MVP

This is the first backend direction for Pappa v2.

## Goal

Keep the current Cloudflare Pages frontend, then add a small Pages Functions API backed by Cloudflare D1.

The first useful backend should support:

- synced checklist state across Piero and Barbara
- recipe discovery/library data
- plan history
- feedback that can influence the next generated plan

## Proposed Cloudflare Shape

- Frontend: Cloudflare Pages
- API: Pages Functions under functions/api
- Database: Cloudflare D1 bound as DB
- Schema: schema.sql

## First Endpoints

- GET /api/health
- GET /api/plans
- GET /api/recipes
- GET /api/users
- GET /api/check-items?planId=...
- POST /api/ticks
- POST /api/feedback

## Tick Model

Use append-only tick events rather than only storing current state.

This preserves useful signal:

- who ticked something
- what changed
- when it changed
- whether something was later unticked

The current checked state can be derived by selecting the latest event for each checklist item.

## Auth MVP

Do not start with heavy auth.

Recommended first version:

- invite token creates a session cookie
- invite links last 7 days and allow up to 3 uses
- device sessions last 180 days with sliding renewal
- sessions and invite links can be manually revoked
- users belong to one household
- API writes derive authenticated user_id from the session cookie
- browser clients do not send or choose userId for writes once auth is enabled

Later:

- email magic links
- Telegram-mediated access links
- proper OAuth only if the app grows beyond family use

## Local/Cloudflare Setup Sketch

Create the database:

    npx wrangler d1 create pappa

Apply schema:

    npx wrangler d1 execute pappa --file=schema.sql

Optional example seed data:

    npx wrangler d1 execute pappa --file=seed.example.sql

Bind the database to the Pages project as DB in Cloudflare dashboard or Wrangler config.
After database creation, replace REPLACE_WITH_D1_DATABASE_ID in wrangler.jsonc.

Run Pages locally with the binding:

    npm run d1:local:apply
    npm run d1:local:seed
    npm run dev

The dev script uses .wrangler/state/v3 so local Pages Functions see the same D1 data created by wrangler d1 execute --local.

Check function syntax:

    npm run check:functions

The current static index.html is intentionally left intact while backend shape is explored.

## Current Status

Wrangler/Cloudflare setup is complete enough for the current preview branch.

- Remote D1 database exists.
- Remote schema and seed have been applied.
- Preview branch `pappa-v2-d1` is deployed at https://pappa-v2-d1.pappa.pages.dev.
- Main branch and `pappa.mamberti.it` are intentionally untouched.

## Remote D1

Created remote D1 database:

- Name: pappa
- Region: EEUR
- Database ID: cf73f2e7-6da7-4dc4-82b7-52bd33030e6c
- Binding in wrangler.jsonc: DB

Remote schema and seed were applied successfully.

Verification:

- recipes: 4
- check_items: 44
- `POST /api/ticks` works for preview users
- `GET /api/users` returns Piero and Barbara

## Next Auth Slice

Implement the auth MVP before treating the preview as a family app:

1. Add `invite_tokens` to schema.sql.
2. Add login/token validation endpoint: `GET /api/login?token=...`.
3. Set an HttpOnly Secure SameSite=Lax session cookie.
4. Add `GET /api/me`.
5. Require authenticated sessions for tick and feedback writes.
6. Remove browser-supplied `userId` from write requests.
7. Add manual revocation for invite links and sessions.

Generate invite SQL:

    npm run invite:sql -- --user=user_piero

Apply the auth migration to the existing remote D1 database before deploying the auth code:

    npx wrangler d1 execute pappa --remote --file=migrations/0001-auth.sql

Revoke manually:

    UPDATE invite_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = 'invite_...';
    UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = 'session_...';
