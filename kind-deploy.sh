# #!/usr/bin/env bash
# set -euo pipefail

# CLUSTER_NAME=${1:-kind}

# echo "Building and loading images for kind cluster '${CLUSTER_NAME}'..."

# docker build -t reduce-my-url-api:dev apps/api

# docker build -t reduce-my-url-web:dev apps/web

# kind load docker-image --name "${CLUSTER_NAME}" reduce-my-url-api:dev
# kind load docker-image --name "${CLUSTER_NAME}" reduce-my-url-web:dev

# kubectl apply -f k8s/namespace.yaml
# kubectl apply -f k8s/secret.yaml -f k8s/configmap.yaml
# kubectl apply -f k8s/postgres.yaml -f k8s/redis.yaml
# kubectl apply -f k8s/api.yaml -f k8s/web.yaml
# kubectl apply -f k8s/ingress.yaml

# echo "Deployment applied. Verify with:"
# echo "kubectl get pods -n reduce-my-url"
# echo "kubectl get svc -n reduce-my-url"
# echo "kubectl get ingress -n reduce-my-url"
