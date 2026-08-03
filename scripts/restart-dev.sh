#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3001}"
LOG_FILE="${LOG_FILE:-/tmp/oma-demo-vite.log}"
PID_FILE="${PID_FILE:-$ROOT_DIR/.data/dev-server.pid}"

mkdir -p "$(dirname "$PID_FILE")"
: > "$LOG_FILE"

echo "Restarting OMA demo dev server on http://$HOST:$PORT/"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping previous PID $OLD_PID"
    kill "$OLD_PID" 2>/dev/null || true
  fi
fi

PORT_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PORT_PIDS" ]]; then
  echo "Stopping listeners on port $PORT: $PORT_PIDS"
  kill $PORT_PIDS 2>/dev/null || true
fi

sleep 1

(
  cd "$ROOT_DIR"
  # Force Bun runtime so server code can use bun:sqlite (Node 20 has no node:sqlite).
  nohup bun --bun "$ROOT_DIR/node_modules/.bin/vite" dev --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
)

NEW_PID="$(cat "$PID_FILE")"
echo "Started PID $NEW_PID"
echo "Log: $LOG_FILE"

for _ in {1..30}; do
  if curl -fsS "http://$HOST:$PORT/" >/dev/null 2>&1; then
    echo "Ready: http://$HOST:$PORT/"
    exit 0
  fi

  if ! kill -0 "$NEW_PID" 2>/dev/null; then
    echo "Dev server exited before becoming ready. Recent log:"
    tail -n 80 "$LOG_FILE" || true
    exit 1
  fi

  sleep 1
done

echo "Timed out waiting for http://$HOST:$PORT/. Recent log:"
tail -n 80 "$LOG_FILE" || true
exit 1
