# Collected Files - nginx

> **Nguồn:** `/mnt/d/01.WORKS/WWW/AI-Projects/AIChat/infrastructure/nginx`
> **Bộ lọc:** chỉ collect source/config/script text; bỏ qua dependency, env, build cache, media và binary

---

## `nginx.conf`

```conf
# Omni AI Chat — nginx reverse proxy
# Single public entry point on port 80.
# Traffic flow:
#   Browser → nginx:80 → frontend:3000 (Next.js)
#   Next.js server rewrites /api/* → backend:8000/v1/* internally

upstream frontend {
    server frontend:3000;
}

# Expose backend directly only within the Docker network (not to the internet)
upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 25M;   # Covers the 20MB file upload limit (R01)

    # ── Health check (for load balancers / k8s probes) ─────────────────────
    location = /health {
        proxy_pass http://backend/health;
        proxy_set_header Host $host;
        access_log off;
    }

    # ── Next.js app (handles /api/* rewrites server-side) ──────────────────
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;

        # WebSocket upgrade (Next.js HMR in dev, future WS features)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / streaming: disable buffering so chunks reach the browser immediately
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 300s;   # Covers max LLM response time (NFR-05: 30s + buffer)
    }
}

```

---


<!-- Tổng: 1 file(s) được tổng hợp, 0 file(s) bị bỏ qua (binary), 0 file(s) bị bỏ qua (non-source) -->
