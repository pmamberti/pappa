#!/usr/bin/env bash
set -euo pipefail

api="https://api.cloudflare.com/client/v4"
zone_name="\${CF_ZONE_NAME:-mamberti.it}"
token_name="\${CF_TOKEN_NAME:-pappa-d1-deploy}"
expires_on="\${CF_TOKEN_EXPIRES_ON:-}"
out_file="\${CF_TOKEN_OUT:-.cf-pappa-token}"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require curl
require jq

if [[ -z "\${CF_EMAIL:-}" || -z "\${CF_GLOBAL_API_KEY:-}" ]]; then
  cat >&2 <<'EOF'
Set CF_EMAIL and CF_GLOBAL_API_KEY first.

Example:
  export CF_EMAIL="you@example.com"
  export CF_GLOBAL_API_KEY="..."
  scripts/create-cloudflare-pappa-token.sh

Do not paste the Global API Key in chat.
EOF
  exit 1
fi

cf_get() {
  curl -fsS "$api/$1" \
    -H "X-Auth-Email: $CF_EMAIL" \
    -H "X-Auth-Key: $CF_GLOBAL_API_KEY" \
    -H "Content-Type: application/json"
}

cf_post_json() {
  curl -fsS "$api/$1" \
    -H "X-Auth-Email: $CF_EMAIL" \
    -H "X-Auth-Key: $CF_GLOBAL_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @-
}

pick_permission_id() {
  local groups_json="$1"
  shift

  for name in "$@"; do
    local id
    id="$(jq -r --arg name "$name" '.result[] | select(.name == $name) | .id' <<<"$groups_json" | head -n 1)"
    if [[ -n "$id" && "$id" != "null" ]]; then
      echo "$id"
      return 0
    fi
  done

  echo "Could not find any permission group matching: $*" >&2
  echo "Nearby groups:" >&2
  jq -r '.result[] | .name' <<<"$groups_json" | grep -Ei 'D1|Workers Scripts|Pages|Account Settings|Zone Read|DNS Read|DNS Write' >&2 || true
  return 1
}

account_json="$(cf_get "accounts?per_page=50")"
account_id="\${CF_ACCOUNT_ID:-$(jq -r '.result[0].id' <<<"$account_json")}"
account_name="$(jq -r --arg id "$account_id" '.result[] | select(.id == $id) | .name' <<<"$account_json")"

if [[ -z "$account_id" || "$account_id" == "null" ]]; then
  echo "Could not determine Cloudflare account id. Set CF_ACCOUNT_ID." >&2
  exit 1
fi

zone_json="$(cf_get "zones?name=$zone_name&per_page=1")"
zone_id="$(jq -r '.result[0].id // empty' <<<"$zone_json")"

groups_json="$(cf_get "user/tokens/permission_groups?per_page=5000")"

account_settings_read_id="$(pick_permission_id "$groups_json" "Account Settings Read")"
d1_write_id="$(pick_permission_id "$groups_json" "D1 Write" "D1 Edit")"
workers_scripts_write_id="$(pick_permission_id "$groups_json" "Workers Scripts Write" "Workers Scripts Edit")"
pages_write_id="$(pick_permission_id "$groups_json" "Pages Write" "Cloudflare Pages Write" "Pages Edit" "Cloudflare Pages Edit")"

account_permission_groups="$(
  jq -n \
    --arg account_settings_read_id "$account_settings_read_id" \
    --arg d1_write_id "$d1_write_id" \
    --arg workers_scripts_write_id "$workers_scripts_write_id" \
    --arg pages_write_id "$pages_write_id" \
    '[
      {id: $account_settings_read_id},
      {id: $d1_write_id},
      {id: $workers_scripts_write_id},
      {id: $pages_write_id}
    ]'
)"

policies="$(
  jq -n \
    --arg account_id "$account_id" \
    --argjson permission_groups "$account_permission_groups" \
    '[{
      effect: "allow",
      permission_groups: $permission_groups,
      resources: {("com.cloudflare.api.account." + $account_id): "*"}
    }]'
)"

if [[ -n "$zone_id" ]]; then
  zone_read_id="$(pick_permission_id "$groups_json" "Zone Read")"
  dns_read_id="$(pick_permission_id "$groups_json" "DNS Read")"

  zone_policy="$(
    jq -n \
      --arg zone_id "$zone_id" \
      --arg zone_read_id "$zone_read_id" \
      --arg dns_read_id "$dns_read_id" \
      '{
        effect: "allow",
        permission_groups: [{id: $zone_read_id}, {id: $dns_read_id}],
        resources: {("com.cloudflare.api.account.zone." + $zone_id): "*"}
      }'
  )"

  policies="$(jq --argjson zone_policy "$zone_policy" '. + [$zone_policy]' <<<"$policies")"
else
  echo "Zone $zone_name not found; creating account-only token." >&2
fi

body="$(
  jq -n \
    --arg name "$token_name" \
    --arg expires_on "$expires_on" \
    --argjson policies "$policies" \
    '{
      name: $name,
      policies: $policies
    }
    | if $expires_on == "" then . else . + {expires_on: $expires_on} end'
)"

response="$(cf_post_json "user/tokens" <<<"$body")"

if [[ "$(jq -r '.success' <<<"$response")" != "true" ]]; then
  echo "$response" | jq . >&2
  exit 1
fi

token="$(jq -r '.result.value // empty' <<<"$response")"

if [[ -z "$token" || "$token" == "null" ]]; then
  echo "Token was created, but Cloudflare did not return a token value." >&2
  echo "$response" | jq '{id: .result.id, name: .result.name, status: .result.status}' >&2
  exit 1
fi

umask 077
printf '%s\n' "$token" > "$out_file"

cat <<EOF
Created Cloudflare API token: $token_name
Account: $account_name ($account_id)
Zone: $zone_name ($zone_id)
Saved token to: $out_file

Use it for this shell with:
  export CLOUDFLARE_API_TOKEN="\$(cat "$out_file")"

Revoke it from Cloudflare after the Pappa D1 setup is complete.
EOF
