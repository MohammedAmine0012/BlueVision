#!/usr/bin/env bash
# Starts API + dashboard. Ctrl+C stops both.
cd "$(dirname "$0")"
(cd backend && uvicorn main:app --port 8000) &
API=$!
(cd frontend && npm run dev) &
WEB=$!
trap "kill $API $WEB 2>/dev/null" EXIT
sleep 3 && echo -e "\n  ➜  Ouvrir http://localhost:5173\n"
wait
