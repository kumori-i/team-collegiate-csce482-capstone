#!/usr/bin/env bash
set -u

BASE_URL="${BASE_URL:-http://localhost:5001}"
MODE="${1:-quick}" # quick | full

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  local body="${5:-}"

  local tmp
  tmp=$(mktemp)

  local status
  if [ -n "$body" ]; then
    status=$(curl -sS -o "$tmp" -w "%{http_code}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$BASE_URL$path")
  else
    status=$(curl -sS -o "$tmp" -w "%{http_code}" \
      -X "$method" \
      "$BASE_URL$path")
  fi

  if [[ "$expected" == *"|"* ]]; then
    IFS='|' read -r -a codes <<< "$expected"
    local matched=0
    for code in "${codes[@]}"; do
      if [ "$status" = "$code" ]; then
        matched=1
        break
      fi
    done
    if [ "$matched" -eq 1 ]; then
      echo "[PASS] $name -> $status"
      PASS=$((PASS + 1))
    else
      echo "[FAIL] $name -> got $status expected one of $expected"
      cat "$tmp"
      FAIL=$((FAIL + 1))
    fi
  else
    if [ "$status" = "$expected" ]; then
      echo "[PASS] $name -> $status"
      PASS=$((PASS + 1))
    else
      echo "[FAIL] $name -> got $status expected $expected"
      cat "$tmp"
      FAIL=$((FAIL + 1))
    fi
  fi

  rm -f "$tmp"
}

echo "Running backend smoke tests against: $BASE_URL (mode=$MODE)"

run_test "health endpoint" "GET" "/health" "200"
run_test "openapi spec" "GET" "/api/openapi.json" "200"
run_test "swagger docs" "GET" "/api/docs" "200"
run_test "auth register invalid body" "POST" "/api/auth/register" "400" "{}"
run_test "auth google missing token" "POST" "/api/auth/google" "400" "{}"
run_test "auth profile missing token" "GET" "/api/auth/profile" "401"
run_test "chat missing message" "POST" "/api/chat" "400" "{}"
run_test "agent chat missing message" "POST" "/api/agent/chat" "400" "{}"
run_test "agent report missing inputs" "POST" "/api/agent/report" "400" "{}"
run_test "players report missing payload" "POST" "/api/players/report" "400" "{}"
run_test "scouting missing required fields" "POST" "/api/scouting/generate" "400" "{}"

if [ "$MODE" = "full" ]; then
  echo "Running optional full-mode integration checks"
  # These rely on Supabase/env data. Accept 200 or 500 to show route is wired.
  run_test "players search wired" "GET" "/api/players/search?limit=1" "200|500"
fi

echo
echo "Summary: pass=$PASS fail=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
