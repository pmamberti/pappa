const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const sessionCookieName = "pappa_session";
const sessionDays = 180;

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

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toSqlDate(date) {
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [name, ...rest] = cookie.split("=");
        return [name, decodeURIComponent(rest.join("="))];
      })
  );
}

function sessionCookie(token, expiresAt, request) {
  const url = new URL(request.url);
  const parts = [
    sessionCookieName + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=" + expiresAt.toUTCString(),
  ];

  if (url.protocol === "https:") parts.push("Secure");
  return parts.join("; ");
}

function clearSessionCookie() {
  return [
    sessionCookieName + "=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

function wantsJson(request) {
  return (request.headers.get("accept") || "").includes("application/json");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getSession(env, request) {
  if (!env.DB) return null;

  const token = parseCookies(request)[sessionCookieName];
  if (!token) return null;

  const tokenHash = await sha256(token);
  const session = await env.DB.prepare([
    "SELECT",
    "  s.id, s.user_id, s.expires_at, s.revoked_at,",
    "  u.household_id, u.display_name, u.role",
    "FROM sessions s",
    "JOIN users u ON u.id = s.user_id",
    "WHERE s.token_hash = ?",
    "LIMIT 1",
  ].join("\n")).bind(tokenHash).first();

  if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
    return null;
  }

  return session;
}

async function requireSession(env, request) {
  const session = await getSession(env, request);
  if (!session) return { response: json({ error: "Authentication required" }, 401) };

  const newExpiry = addDays(new Date(), sessionDays);
  await env.DB.prepare(
    "UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP, expires_at = ? WHERE id = ?"
  ).bind(toSqlDate(newExpiry), session.id).run();

  return { session, refreshedCookie: sessionCookie(parseCookies(request)[sessionCookieName], newExpiry, request) };
}

function jsonAuthed(data, auth, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...jsonHeaders,
      "set-cookie": auth.refreshedCookie,
    },
  });
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

async function listPlans(env, request) {
  if (!env.DB) return json({ plans: [], warning: "DB binding missing" });

  const auth = await requireSession(env, request);
  if (auth.response) return auth.response;

  const { results } = await env.DB.prepare(
    "SELECT id, title, start_date, end_date, focus, status, version, created_at FROM plans ORDER BY created_at DESC LIMIT 20"
  ).all();

  return jsonAuthed({ plans: results || [] }, auth);
}

async function listRecipes(env, request) {
  if (!env.DB) return json({ recipes: [], warning: "DB binding missing" });

  const auth = await requireSession(env, request);
  if (auth.response) return auth.response;

  const { results } = await env.DB.prepare(
    "SELECT id, title, source_url, summary, tags_json, effort, family_notes, created_at, updated_at FROM recipes ORDER BY updated_at DESC LIMIT 50"
  ).all();

  return jsonAuthed({
    recipes: (results || []).map((recipe) => ({
      ...recipe,
      tags: JSON.parse(recipe.tags_json || "[]"),
      tags_json: undefined,
    })),
  }, auth);
}

async function listUsers(env, request) {
  if (!env.DB) return json({ users: [], warning: "DB binding missing" });

  const auth = await requireSession(env, request);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const householdId = url.searchParams.get("householdId") || auth.session.household_id;

  const { results } = await env.DB.prepare(
    "SELECT id, display_name, role FROM users WHERE household_id = ? ORDER BY role = 'owner' DESC, display_name"
  ).bind(householdId).all();

  return jsonAuthed({ users: results || [] }, auth);
}

async function handleLogin(env, request) {
  if (!env.DB) return json({ error: "DB binding missing" }, 503);

  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  if (request.method === "POST" && !token) {
    const form = await request.formData();
    token = String(form.get("token") || "");
  }
  if (!token) return badRequest("token is required");

  const tokenHash = await sha256(token);
  const invite = await env.DB.prepare([
    "SELECT",
    "  it.id, it.household_id, it.user_id, it.token_hash, it.max_uses, it.use_count, it.expires_at, it.revoked_at,",
    "  u.display_name, u.role",
    "FROM invite_tokens it",
    "JOIN users u ON u.id = it.user_id",
    "WHERE it.token_hash = ?",
    "LIMIT 1",
  ].join("\n")).bind(tokenHash).first();

  if (
    !invite ||
    invite.revoked_at ||
    invite.use_count >= invite.max_uses ||
    new Date(invite.expires_at) <= new Date()
  ) {
    return json({ error: "Invite link is invalid or expired" }, 401);
  }

  if (!timingSafeEqual(invite.token_hash || tokenHash, tokenHash)) {
    return json({ error: "Invite link is invalid or expired" }, 401);
  }

  if (request.method === "GET") {
    if (wantsJson(request)) {
      return json({
        invite: {
          userId: invite.user_id,
          displayName: invite.display_name,
          expiresAt: invite.expires_at,
          usesRemaining: invite.max_uses - invite.use_count,
        },
      });
    }

    return new Response([
      "<!doctype html>",
      "<html lang=\"it\">",
      "<head>",
      "<meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>Entra in Pappa</title>",
      "<style>body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf8f2;color:#25231f;display:grid;min-height:100vh;place-items:center;padding:20px}.box{width:min(420px,100%);background:#fffdf7;border:1px solid #ded7c8;border-radius:8px;padding:22px;box-shadow:0 18px 45px rgba(54,43,26,.12)}h1{margin:0 0 10px;font-size:28px}p{color:#676157;line-height:1.45}button{width:100%;min-height:44px;border:0;border-radius:8px;background:#315c45;color:white;font:inherit;font-weight:700;cursor:pointer}</style>",
      "</head>",
      "<body><main class=\"box\">",
      "<h1>Entra in Pappa</h1>",
      "<p>Questo invito attivera' la sessione per " + escapeHtml(invite.display_name) + " su questo dispositivo.</p>",
      "<form method=\"post\" action=\"/api/login\">",
      "<input type=\"hidden\" name=\"token\" value=\"" + escapeHtml(token) + "\">",
      "<button type=\"submit\">Continua</button>",
      "</form>",
      "</main></body></html>",
    ].join(""), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const rawSessionToken = crypto.randomUUID() + "." + crypto.randomUUID();
  const sessionTokenHash = await sha256(rawSessionToken);
  const expiresAt = addDays(new Date(), sessionDays);
  const sessionId = makeId("session");

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, last_seen_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
    ).bind(sessionId, invite.user_id, sessionTokenHash, toSqlDate(expiresAt)),
    env.DB.prepare(
      "UPDATE invite_tokens SET use_count = use_count + 1 WHERE id = ?"
    ).bind(invite.id),
  ]);

  const body = {
    user: {
      id: invite.user_id,
      householdId: invite.household_id,
      displayName: invite.display_name,
      role: invite.role,
    },
    session: {
      id: sessionId,
      expiresAt: toSqlDate(expiresAt),
    },
  };

  if (!wantsJson(request)) {
    return new Response(null, {
      status: 303,
      headers: {
        "location": "/",
        "cache-control": "no-store",
        "set-cookie": sessionCookie(rawSessionToken, expiresAt, request),
      },
    });
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      ...jsonHeaders,
      "set-cookie": sessionCookie(rawSessionToken, expiresAt, request),
    },
  });
}

async function handleMe(env, request) {
  if (!env.DB) return json({ user: null, warning: "DB binding missing" });

  const auth = await requireSession(env, request);
  if (auth.response) return auth.response;

  return new Response(JSON.stringify({
    user: {
      id: auth.session.user_id,
      householdId: auth.session.household_id,
      displayName: auth.session.display_name,
      role: auth.session.role,
    },
    session: {
      id: auth.session.id,
      expiresAt: auth.session.expires_at,
    },
  }, null, 2), {
    status: 200,
    headers: {
      ...jsonHeaders,
      "set-cookie": auth.refreshedCookie,
    },
  });
}

async function handleLogout(env, request) {
  if (!env.DB) return json({ ok: true });

  const token = parseCookies(request)[sessionCookieName];
  if (token) {
    const tokenHash = await sha256(token);
    await env.DB.prepare(
      "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?"
    ).bind(tokenHash).run();
  }

  return new Response(JSON.stringify({ ok: true }, null, 2), {
    status: 200,
    headers: {
      ...jsonHeaders,
      "set-cookie": clearSessionCookie(),
    },
  });
}

async function listCheckItems(env, request) {
  if (!env.DB) return json({ items: [], warning: "DB binding missing" });

  const auth = await requireSession(env, request);
  if (auth.response) return auth.response;

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
    "    ORDER BY te.created_at DESC, te.rowid DESC",
    "    LIMIT 1",
    "  ) AS checked",
    "FROM check_items ci",
    "WHERE ci.plan_id = ?",
    "ORDER BY ci.scope, ci.position, ci.created_at",
  ].join("\n");

  const { results } = await env.DB.prepare(sql).bind(planId).all();

  return jsonAuthed({
    items: (results || []).map((item) => ({
      ...item,
      checked: Boolean(item.checked),
    })),
  }, auth);
}

async function createTick(env, request) {
  if (!env.DB) return json({ error: "DB binding missing" }, 503);

  const auth = await requireSession(env, request);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return badRequest("JSON body is required");
  if (!body.checkItemId) return badRequest("checkItemId is required");
  if (typeof body.checked !== "boolean") return badRequest("checked must be boolean");

  const event = {
    id: makeId("tick"),
    checkItemId: body.checkItemId,
    userId: auth.session.user_id,
    checked: body.checked ? 1 : 0,
  };

  await env.DB.prepare(
    "INSERT INTO tick_events (id, check_item_id, user_id, checked) VALUES (?, ?, ?, ?)"
  ).bind(event.id, event.checkItemId, event.userId, event.checked).run();

  return new Response(JSON.stringify({
    tick: {
      id: event.id,
      checkItemId: event.checkItemId,
      userId: event.userId,
      checked: Boolean(event.checked),
    },
  }, null, 2), {
    status: 201,
    headers: {
      ...jsonHeaders,
      "set-cookie": auth.refreshedCookie,
    },
  });
}

async function createFeedback(env, request) {
  if (!env.DB) return json({ error: "DB binding missing" }, 503);

  const auth = await requireSession(env, request);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return badRequest("JSON body is required");
  if (!body.kind) return badRequest("kind is required");
  if (!body.note) return badRequest("note is required");

  const feedback = {
    id: makeId("feedback"),
    householdId: auth.session.household_id,
    userId: auth.session.user_id,
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

  return new Response(JSON.stringify({ feedback }, null, 2), {
    status: 201,
    headers: {
      ...jsonHeaders,
      "set-cookie": auth.refreshedCookie,
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const route = getRoute(request);

  try {
    if (route === "health" && request.method === "GET") return handleHealth(env);
    if (route === "login" && (request.method === "GET" || request.method === "POST")) return handleLogin(env, request);
    if (route === "me" && request.method === "GET") return handleMe(env, request);
    if (route === "logout" && request.method === "POST") return handleLogout(env, request);
    if (route === "plans" && request.method === "GET") return listPlans(env, request);
    if (route === "recipes" && request.method === "GET") return listRecipes(env, request);
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
