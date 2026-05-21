import { createHash, randomBytes } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || true];
  })
);

const userId = args.user || args.userId;
const householdId = args.household || "household_piero_barbara";
const days = Number(args.days || 7);
const maxUses = Number(args.uses || 3);
const token = args.token || randomBytes(32).toString("base64url");

if (!userId) {
  console.error("Usage: node scripts/make-invite-token.mjs --user=user_piero [--household=household_piero_barbara] [--days=7] [--uses=3]");
  process.exit(1);
}

const tokenHash = createHash("sha256").update(token).digest("hex");
const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  .toISOString()
  .replace("T", " ")
  .replace(/\.\d{3}Z$/, "");
const id = "invite_" + randomBytes(12).toString("hex");

console.log("Invite URL path:");
console.log("/api/login?token=" + encodeURIComponent(token));
console.log("");
console.log("SQL:");
console.log([
  "INSERT INTO invite_tokens (id, household_id, user_id, token_hash, max_uses, expires_at)",
  "VALUES (",
  "  '" + id + "',",
  "  '" + householdId.replaceAll("'", "''") + "',",
  "  '" + String(userId).replaceAll("'", "''") + "',",
  "  '" + tokenHash + "',",
  "  " + maxUses + ",",
  "  '" + expiresAt + "'",
  ");",
].join("\n"));
