#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${1:-reduce-my-url}
KIND_CONFIG=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/kind-config.yaml

if ! command -v kind >/dev/null 2>&1; then
  echo "kind is not installed. Install kind to continue."
  exit 1
fi

echo "Deleting kind cluster '${CLUSTER_NAME}' (if it exists)..."
kind delete cluster --name "${CLUSTER_NAME}" || true

echo "Creating kind cluster '${CLUSTER_NAME}' with port mappings..."
kind create cluster --name "${CLUSTER_NAME}" --config "${KIND_CONFIG}"

echo "Deploying application to cluster '${CLUSTER_NAME}'..."
bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/kind-deploy.sh" "${CLUSTER_NAME}"

echo "Cluster created. Frontend available at http://localhost:5137"
echo "API available at http://localhost:4000"
