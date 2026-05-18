# Pappa

![Pappa logo](assets/pappa-logo.svg)

Pappa is a small family meal-planning app for turning real-life constraints into practical meal plans and grocery lists.

Current direction:

- simple shared meal plans
- grocery lists that work on a phone
- baby/family-friendly notes without overcomplicating dinner
- future support for favourites, multiuser planning, and shared checklist state

This repo is intentionally small while the first version takes shape.

## Backend Direction

Pappa v1 is static HTML. Pappa v2 is expected to use:

- Cloudflare Pages for the frontend
- Pages Functions for a small API
- Cloudflare D1 for plans, recipes, synced ticks, and feedback

See docs/d1-mvp.md and schema.sql.
Example seed data lives in seed.example.sql.

## Development

Install dependencies:

    npm install

Check Pages Function syntax:

    npm run check:functions

Run locally with D1 binding:

    npm run dev
