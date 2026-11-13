#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

restart=0
for arg in "$@"; do
  case "$arg" in
    --restart) restart=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./k8s.sh [--restart]" >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env and set OPENAI_API_KEY." >&2
  exit 1
fi

mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"

arch="$(uname -m)"
case "$arch" in
  x86_64) k8s_arch="amd64" ;;
  aarch64|arm64) k8s_arch="arm64" ;;
  *)
    echo "Unsupported architecture: $arch" >&2
    exit 1
    ;;
esac

if ! command -v kubectl >/dev/null 2>&1; then
  version="$(curl -fsSL https://dl.k8s.io/release/stable.txt)"
  curl -fsSL -o "$HOME/.local/bin/kubectl" "https://dl.k8s.io/release/${version}/bin/linux/${k8s_arch}/kubectl"
  chmod +x "$HOME/.local/bin/kubectl"
fi

if ! command -v helm >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | HELM_INSTALL_DIR="$HOME/.local/bin" USE_SUDO=false bash
fi

if ! command -v k3d >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | K3D_INSTALL_DIR="$HOME/.local/bin" USE_SUDO=false bash
fi

if ! k3d cluster list -o json | grep -q '"name":"ai-chat"'; then
  k3d cluster create ai-chat --port "3000:80@loadbalancer" --port "3001:3001@loadbalancer" --wait
fi

k3d kubeconfig merge ai-chat --kubeconfig-switch-context

docker build -t ai-chat:local .
k3d image import ai-chat:local --cluster ai-chat

env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" .env | tail -1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf "%s" "$line"
}

jwt_secret="$(env_value JWT_SECRET)"
seed_password="$(env_value SEED_PASSWORD)"

kubectl create secret generic ai-chat-env \
  --from-literal=OPENAI_API_KEY="$(env_value OPENAI_API_KEY)" \
  --from-literal=JWT_SECRET="${jwt_secret:-dev-only-change-me}" \
  --from-literal=SEED_PASSWORD="${seed_password:-password}" \
  --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install ai-chat ./helm --wait --timeout 15m

# The image tag stays ai-chat:local, so a chart that did not change leaves old pods running.
if [[ "$restart" -eq 1 ]]; then
  deployments=(backend chat-consumer memory-consumer realtime relay fanout)
  kubectl rollout restart "${deployments[@]/#/deployment/}"
  kubectl rollout status "${deployments[@]/#/deployment/}" --timeout=15m
fi

echo "App: http://localhost:3000"
echo "Sockets: ws://localhost:3001"
