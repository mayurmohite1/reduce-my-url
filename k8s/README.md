# Kubernetes deployment for reduce-my-url

## What is included

This folder contains Kubernetes manifests for:

- `namespace.yaml` - isolated namespace
- `secret.yaml` - app secrets for Postgres and JWT
- `configmap.yaml` - shared runtime configuration
- `postgres.yaml` - Postgres `StatefulSet` + `Service`
- `redis.yaml` - Redis `Deployment` + `Service` + PVC
- `api.yaml` - API `Deployment` + `Service`
- `web.yaml` - web frontend `Deployment` + `Service`
- `ingress.yaml` - ingress routing for `http://localhost`

## Local deployment instructions

1. Start a local cluster:
   - `minikube start --driver=docker`
   - or `kind create cluster` with an ingress addon

2. Enable an ingress controller if needed:
   - `minikube addons enable ingress`
   - or install an ingress controller for `kind`

3. Build the container images locally and load them into kind:
   - `docker build -t reduce-my-url-api:dev apps/api`
   - `docker build --build-arg VITE_API_BASE_URL=http://localhost/api -t reduce-my-url-web:dev apps/web`
   - `kind load docker-image reduce-my-url-api:dev`
   - `kind load docker-image reduce-my-url-web:dev`

4. Apply the manifests:
   - `kubectl apply -f k8s/namespace.yaml`
   - `kubectl apply -f k8s/secret.yaml -f k8s/configmap.yaml`
   - `kubectl apply -f k8s/postgres.yaml -f k8s/redis.yaml`
   - `kubectl apply -f k8s/api.yaml -f k8s/web.yaml`
   - `kubectl apply -f k8s/ingress.yaml`

5. If you do not have an ingress controller installed in kind, install one first. For example:
   - `kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.14.1/deploy/static/provider/kind/deploy.yaml`
   - `kubectl -n ingress-nginx rollout status deployment ingress-nginx-controller --timeout=180s`

5. Verify:
   - `kubectl get pods -n reduce-my-url`
   - `kubectl get svc -n reduce-my-url`
   - `kubectl get ingress -n reduce-my-url`
   - Open `http://localhost` in your browser

## Notes

- The `web` frontend is built with `VITE_API_BASE_URL=http://localhost/api` so it calls the API through ingress.
- The API uses `PUBLIC_BASE_URL=http://localhost` for generated short URLs.
- For production, replace `change-this-in-production` in `k8s/secret.yaml` and consider managed Postgres/Redis.
