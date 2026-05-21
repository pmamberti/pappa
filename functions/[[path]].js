const sessionCookieName = "pappa_session";

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hasValidSession(env, request) {
  if (!env.DB) return false;

  const token = parseCookies(request)[sessionCookieName];
  if (!token) return false;

  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    "SELECT id, expires_at, revoked_at FROM sessions WHERE token_hash = ? LIMIT 1"
  ).bind(tokenHash).first();

  return Boolean(session && !session.revoked_at && new Date(session.expires_at) > new Date());
}

function accessScreen() {
  return [
    "<!doctype html>",
    "<html lang=\"it\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "<title>Pappa</title>",
    "<style>body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf8f2;color:#25231f;display:grid;min-height:100vh;place-items:center;padding:20px}.box{width:min(440px,100%);background:#fffdf7;border:1px solid #ded7c8;border-radius:8px;padding:22px;box-shadow:0 18px 45px rgba(54,43,26,.12)}h1{margin:0 0 10px;font-size:30px}p{margin:0;color:#676157;line-height:1.45}</style>",
    "</head>",
    "<body><main class=\"box\">",
    "<h1>Pappa</h1>",
    "<p>Apri il link invito su questo dispositivo per accedere al piano condiviso.</p>",
    "</main></body></html>",
  ].join("");
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    if (!(await hasValidSession(env, request))) {
      return html(accessScreen());
    }
  }

  return env.ASSETS.fetch(request);
}
