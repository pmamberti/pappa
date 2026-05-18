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
- users belong to one household
- API writes include authenticated user_id

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

## Current Blocker

Wrangler must be authenticated before creating the real D1 database or applying schema remotely.

Options:

- run npx wrangler login interactively on this host
- provide a Cloudflare API token with the required Workers/Pages/D1 permissions via CLOUDFLARE_API_TOKEN
