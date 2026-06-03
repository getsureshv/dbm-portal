#!/usr/bin/env bash
# Usage: TOKEN=eyJ... bash scripts/smoke-authed.sh
# Get TOKEN from browser DevTools after logging in:
#   copy(await firebase.auth().currentUser.getIdToken())
set -euo pipefail
API="${API:-https://dbm-portal-api.onrender.com}"
: "${TOKEN:?Set TOKEN env var: export TOKEN=<firebase-id-token>}"

H=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "→ GET /auth/me"
curl -sS -w "\nHTTP %{http_code}\n" "${H[@]}" "$API/auth/me"

echo
echo "→ GET /projects"
curl -sS -w "\nHTTP %{http_code}\n" "${H[@]}" "$API/projects"

echo
echo "→ POST /projects (create)"
RESP=$(curl -sS "${H[@]}" -X POST "$API/projects" \
  -d '{"name":"smoke-test","description":"created by smoke script"}')
echo "$RESP"
PID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ -n "$PID" ]; then
  echo
  echo "→ GET /projects/$PID"
  curl -sS -w "\nHTTP %{http_code}\n" "${H[@]}" "$API/projects/$PID"

  echo
  echo "→ POST /uploads/presign (R2 test — fails here if AWS_REGION wrong)"
  curl -sS -w "\nHTTP %{http_code}\n" "${H[@]}" -X POST "$API/uploads/presign" \
    -d "{\"projectId\":\"$PID\",\"filename\":\"smoke.txt\",\"contentType\":\"text/plain\"}"

  echo
  echo "→ DELETE /projects/$PID (cleanup)"
  curl -sS -w "\nHTTP %{http_code}\n" "${H[@]}" -X DELETE "$API/projects/$PID"
fi
