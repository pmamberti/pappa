const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: jsonHeaders,
  });
}

function badRequest(message) {
  return json({ error: message }, 400);
}

function notFound() {
  return json({ error: "Not found" }, 404);
}

function makeId(prefix) {
  const random = crypto.randomUUID();
  return prefix ? prefix + "_" + random : random;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getRoute(request) {
  const url = new URL(request.url);
  return url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "") || "health";
}

async function handleHealth(env) {
  let database = "unbound";

  if (env.DB) {
    const result = await env.DB.prepare("SELECT 1 AS ok").first();
    database = result?.ok === 1 ? "ok" : "unknown";
  }

  return json({
    ok: true,
    service: "pappa-api",
    database,
  });
}

async function listPlans(env) {
  if (!env.DB) return json({ plans: [], warning: "DB binding missing" });

  const { results } = await env.DB.prepare(
    "SELECT id, title, start_date, end_date, focus, status, version, created_at FROM plans ORDER BY created_at DESC LIMIT 20"
  ).all();

  return json({ plans: results || [] });
}

async function listRecipes(env) {
  if (!env.DB) return json({ recipes: [], warning: "DB binding missing" });

  const { results } = await env.DB.prepare(
    "SELECT id, title, source_url, summary, tags_json, effort, family_notes, created_at, updated_at FROM recipes ORDER BY updated_at DESC LIMIT 50"
  ).all();

  return json({
    recipes: (results || []).map((recipe) => ({
      ...recipe,
      tags: JSON.parse(recipe.tags_json || "[]"),
      tags_json: undefined,
    })),
  });
}

async function listUsers(env, request) {
  if (!env.DB) return json({ users: [], warning: "DB binding missing" });

  const url = new URL(request.url);
  const householdId = url.searchParams.get("householdId") || "household_piero_barbara";

  const { results } = await env.DB.prepare(
    "SELECT id, display_name, role FROM users WHERE household_id = ? ORDER BY role = 'owner' DESC, display_name"
  ).bind(householdId).all();

  return json({ users: results || [] });
}

async function listCheckItems(env, request) {
  if (!env.DB) return json({ items: [], warning: "DB binding missing" });

  const url = new URL(request.url);
  const planId = url.searchParams.get("planId");
  if (!planId) return badRequest("planId is required");

  const sql = [
    "SELECT",
    "  ci.id, ci.scope, ci.label, ci.category, ci.position,",
    "  (",
    "    SELECT te.checked",
    "    FROM tick_events te",
    "    WHERE te.check_item_id = ci.id",
    "    ORDER BY te.created_at DESC",
    "    LIMIT 1",
    "  ) AS checked",
    "FROM check_items ci",
    "WHERE ci.plan_id = ?",
    "ORDER BY ci.scope, ci.position, ci.created_at",
  ].join("\n");

  const { results } = await env.DB.prepare(sql).bind(planId).all();

  return json({
    items: (results || []).map((item) => ({
      ...item,
      checked: Boolean(item.checked),
    })),
  });
}

async function createTick(env, request) {
  if (!env.DB) return json({ error: "DB binding missing" }, 503);

  const body = await readJson(request);
  if (!body) return badRequest("JSON body is required");
  if (!body.checkItemId) return badRequest("checkItemId is required");
  if (!body.userId) return badRequest("userId is required");
  if (typeof body.checked !== "boolean") return badRequest("checked must be boolean");

  const event = {
    id: makeId("tick"),
    checkItemId: body.checkItemId,
    userId: body.userId,
    checked: body.checked ? 1 : 0,
  };

  await env.DB.prepare(
    "INSERT INTO tick_events (id, check_item_id, user_id, checked) VALUES (?, ?, ?, ?)"
  ).bind(event.id, event.checkItemId, event.userId, event.checked).run();

  return json({
    tick: {
      id: event.id,
      checkItemId: event.checkItemId,
      userId: event.userId,
      checked: Boolean(event.checked),
    },
  }, 201);
}

async function createFeedback(env, request) {
  if (!env.DB) return json({ error: "DB binding missing" }, 503);

  const body = await readJson(request);
  if (!body) return badRequest("JSON body is required");
  if (!body.householdId) return badRequest("householdId is required");
  if (!body.kind) return badRequest("kind is required");
  if (!body.note) return badRequest("note is required");

  const feedback = {
    id: makeId("feedback"),
    householdId: body.householdId,
    userId: body.userId || null,
    planId: body.planId || null,
    recipeId: body.recipeId || null,
    kind: body.kind,
    note: body.note,
  };

  const sql = [
    "INSERT INTO feedback (id, household_id, user_id, plan_id, recipe_id, kind, note)",
    "VALUES (?, ?, ?, ?, ?, ?, ?)",
  ].join(" ");

  await env.DB.prepare(sql).bind(
    feedback.id,
    feedback.householdId,
    feedback.userId,
    feedback.planId,
    feedback.recipeId,
    feedback.kind,
    feedback.note
  ).run();

  return json({ feedback }, 201);
}

export async function onRequest(context) {
  const { request, env } = context;
  const route = getRoute(request);

  try {
    if (route === "health" && request.method === "GET") return handleHealth(env);
    if (route === "plans" && request.method === "GET") return listPlans(env);
    if (route === "recipes" && request.method === "GET") return listRecipes(env);
    if (route === "users" && request.method === "GET") return listUsers(env, request);
    if (route === "check-items" && request.method === "GET") return listCheckItems(env, request);
    if (route === "ticks" && request.method === "POST") return createTick(env, request);
    if (route === "feedback" && request.method === "POST") return createFeedback(env, request);

    return notFound();
  } catch (error) {
    return json({
      error: "Internal server error",
      detail: error?.message || String(error),
    }, 500);
  }
}
