#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8787}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/.runtime}"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
FRONTEND_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}/frontend/"

if [[ -n "${NODE_BIN:-}" ]]; then
  NODE_BIN="$NODE_BIN"
elif [[ -x "$ROOT_DIR/.node/bin/node" ]]; then
  NODE_BIN="$ROOT_DIR/.node/bin/node"
else
  NODE_BIN="$(command -v node || true)"
fi

if [[ -n "${PYTHON_BIN:-}" ]]; then
  PYTHON_BIN="$PYTHON_BIN"
elif [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
else
  PYTHON_BIN="$(command -v python3 || true)"
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "找不到 Node.js。请先进入项目环境，或设置 NODE_BIN。" >&2
  exit 1
fi
if [[ -z "$PYTHON_BIN" ]]; then
  echo "找不到 Python 3。请先进入项目环境，或设置 PYTHON_BIN。" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "找不到 curl，无法检查服务是否就绪。" >&2
  exit 1
fi

port_in_use() {
  command -v lsof >/dev/null 2>&1 || return 1
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

fail_if_port_in_use() {
  local port="$1"
  local service="$2"
  if port_in_use "$port"; then
    echo "$service 端口 $port 已被占用；为避免误杀已有进程，启动脚本不会自动终止它。" >&2
    echo "请先停止占用进程后重试。" >&2
    exit 1
  fi
}

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
    if [[ -n "$pid" ]]; then
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done

  exit "$exit_code"
}

wait_for_http() {
  local url="$1"
  local pid="$2"
  local service="$3"

  for _ in {1..50}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      echo "$service 启动失败，请查看日志：$RUN_DIR" >&2
      return 1
    fi
    sleep 0.2
  done

  echo "$service 启动超时，请查看日志：$RUN_DIR" >&2
  return 1
}

trap cleanup EXIT
trap 'exit 130' INT TERM

cd "$ROOT_DIR"
mkdir -p "$RUN_DIR"
fail_if_port_in_use "$BACKEND_PORT" "后端"
fail_if_port_in_use "$FRONTEND_PORT" "前端"

echo "启动问道浮生开发环境"
echo "数据库：无需独立服务（后端内存存档 + 浏览器 localStorage）"
echo "后端：$BACKEND_URL"
echo "前端：$FRONTEND_URL"
echo "日志：$RUN_DIR"

HOST="$BACKEND_HOST" PORT="$BACKEND_PORT" "$NODE_BIN" backend/src/server.js >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

"$PYTHON_BIN" -m http.server "$FRONTEND_PORT" --bind "$FRONTEND_HOST" --directory "$ROOT_DIR" >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

wait_for_http "$BACKEND_URL/api/v1/game/state" "$BACKEND_PID" "后端"
wait_for_http "$FRONTEND_URL" "$FRONTEND_PID" "前端"

echo "服务已就绪，打开：$FRONTEND_URL"
if [[ "${OPEN_BROWSER:-0}" == "1" ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$FRONTEND_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$FRONTEND_URL" >/dev/null 2>&1 || true
  fi
fi
echo "按 Ctrl-C 停止前端和后端。"

while true; do
  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    echo "后端进程已退出，请查看：$BACKEND_LOG" >&2
    exit 1
  fi
  if ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    echo "前端进程已退出，请查看：$FRONTEND_LOG" >&2
    exit 1
  fi
  sleep 1
done
