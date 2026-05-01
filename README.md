# Sloth Example - SLO Monitoring Stack

A complete monitoring stack with **Traefik**, **Prometheus**, **Sloth**, and **Grafana** demonstrating tiered SLOs for a service.

## Why Metrics at the Proxy (Traefik)?

Metrics are measured at the **Traefik level**, not at the app level. This is critical because:

- If the **app is down** → Traefik records **502 Bad Gateway**
- If the **app times out** → Traefik records **504 Gateway Timeout**
- If the **app is slow** → Traefik records the total latency (including backend wait time)
- **Single source of truth** — all traffic goes through Traefik, no data is missed

Traefik has built-in Prometheus metrics — no plugins or Lua scripting required.

## Why Traefik?

| | Traefik | Nginx (vanilla) | OpenResty + Lua | Envoy/Istio |
|--|---------|-----------------|-----------------|-------------|
| Built-in Prometheus metrics | Per-service & per-router | Requires exporter | Requires lua module | Built-in |
| Per-route metrics | Via router rules | No | Manual (Lua script) | Built-in |
| Detect 502 on app down | Automatic | Requires exporter | Manual | Automatic |
| Setup complexity | Low | Medium | High | High |
| Docker native | Yes (label/file provider) | No | No | No |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

```bash
docker compose run --rm sloth && docker compose up -d --build
```

## Services & Ports

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Traefik** | 80 | http://localhost | Reverse proxy + built-in Prometheus metrics |
| **Traefik Dashboard** | 8080 | http://localhost:8080 | Traefik monitoring dashboard |
| **Mock App** | 5000 (internal) | - | Flask app with dummy endpoints |
| **Prometheus** | 9090 | http://localhost:9090 | Metrics storage & query engine |
| **Grafana** | 3000 | http://localhost:3000 | Dashboard visualization (`admin` / `admin`) |

## Project Structure

```
sloth-example/
├── docker-compose.yml
├── app/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py                       # Mock API (Flask, no metrics instrumentation)
├── traefik/
│   ├── traefik.yml                   # Static config (entrypoints, metrics, providers)
│   └── dynamic.yml                   # Dynamic config (routers & services per tier)
├── prometheus/
│   └── prometheus.yml                # Scrape: traefik, self
├── sloth/
│   ├── slo.yaml                      # SLO definitions (6 SLOs, 2 per tier)
│   └── generated/                    # Generated Prometheus rules (output from Sloth)
└── grafana/
    ├── provisioning/
    │   ├── datasources/prometheus.yml # Auto-connect datasource
    │   └── dashboards/dashboards.yml  # Auto-load dashboards
    └── dashboards/
        └── overview/slo-dashboard.json # SLO tier overview (homepage)
```

## Architecture Flow

```
                     sloth/slo.yaml
                     (SLO definitions)
                          │
                          ▼
                    ┌──────────┐
                    │  Sloth   │ ──generate──▶ Prometheus rules
                    └──────────┘              (recording + alerting)
                                                      │
                                                      ▼
┌────────┐    ┌────────────────────────────────┐    ┌────────────┐
│ Client │───▶│  Traefik :80                   │    │ Prometheus │
│        │    │                                │    │  :9090     │
└────────┘    │  ┌──────────────────────────┐  │    └─────┬──────┘
              │  │  Built-in Prometheus     │  │          │
              │  │  Metrics per Service:    │  │──scrape──│
              │  │                          │  │  :8080   │
              │  │  tier1-svc → /login,     │  │  /metrics│          ┌────────────┐
              │  │    /api/payment, ...     │  │          │          │  Grafana   │
              │  │  tier2-svc → /api/users, │  │          │─────────▶│  :3000     │
              │  │    /api/products, ...    │  │          │  query   └────────────┘
              │  │  tier3-svc → /api/reports│  │          │
              │  │                          │  │          │
              │  │  App DOWN → 502 logged ✓ │  │          │
              │  │  App slow → timeout ✓    │  │          │
              │  └──────────────────────────┘  │          │
              │                                │          │
              │         proxy_pass             │          │
              └──────────────┬─────────────────┘          │
                             │                            │
                    ┌────────▼────────┐                   │
                    │  Mock App :5000 │                   │
                    │  (Flask)        │                   │
                    └─────────────────┘                   │
```

### Flow Explanation

1. **Client** sends request to Traefik (port 80)
2. **Traefik** matches the request against router rules in `dynamic.yml`:
   - `/login`, `/api/payment` → `tier1-svc`
   - `/api/users`, `/api/products` → `tier2-svc`
   - `/api/reports`, `/api/analytics` → `tier3-svc`
3. Traefik forwards the request to the Mock App (`app:5000`) via `proxy_pass`
4. **Traefik records metrics** for every request:
   - Status code (200, 500, **502 when app is down**, **504 on timeout**)
   - Latency (total time including backend wait time)
   - Per-service (per-tier) — available in built-in Prometheus metrics
5. **Sloth** reads `slo.yaml` and generates Prometheus recording & alerting rules
6. **Prometheus** scrapes metrics from `traefik:8080/metrics` and evaluates SLO rules
7. **Grafana** queries data from Prometheus and displays visualization dashboards

### How Traefik Solves the App-Down Problem

```
                    ❌ Metrics at App Level          ✅ Metrics at Traefik Level

Client → Traefik → App                   Client → Traefik → App
          │          ↓                              │          ↓
          │       metrics                         built-in  (dead)
          │       (fails)                         metrics
          │          ↓                              │          ↓
        502 ???    (no data)                       502 logged ✓
                                                     (traefik_service_requests_total{code="502"})
```

## SLO Tiers

| Tier | Service | Endpoints | Availability | Latency Target |
|------|---------|-----------|-------------|----------------|
| **1 - Critical** | `tier1-svc@file` | `/login`, `/api/payment`, `/api/checkout`, `/api/auth/*` | 99.9% | p99 < 500ms |
| **2 - Standard** | `tier2-svc@file` | `/api/users`, `/api/products`, `/api/orders`, `/api/cart` | 99.5% | p99 < 1s |
| **3 - Background** | `tier3-svc@file` | `/api/reports`, `/api/analytics`, `/api/notifications`, `/api/exports` | 99.0% | p99 < 5s |

Each tier has 2 SLOs:
- **Availability SLO** — percentage of successful requests (non-5xx), including 502/504 from Traefik
- **Latency SLO** — percentage of requests completed below the latency threshold

## Dummy Endpoints

### Tier 1 - Critical

```bash
curl -X POST http://localhost/login
curl -X POST http://localhost/api/payment
curl -X POST http://localhost/api/checkout
curl -X POST http://localhost/api/auth/refresh
```

### Tier 2 - Standard

```bash
curl http://localhost/api/users
curl http://localhost/api/products
curl http://localhost/api/orders
curl http://localhost/api/cart
```

### Tier 3 - Background

```bash
curl http://localhost/api/reports
curl http://localhost/api/analytics
curl http://localhost/api/notifications
curl -X POST http://localhost/api/exports
```

### Utility

```bash
curl http://localhost/health
```

## Testing: App Down Scenario

```bash
# Stop the app
docker compose stop app

# Send requests — Traefik returns 502, metrics are still recorded
curl -v http://localhost/api/users
curl -v http://localhost/login

# Check Traefik metrics — 502 appears in per-service metrics
curl -s http://localhost:8080/metrics | grep 'traefik_service_requests_total.*code="502"'

# Start the app again
docker compose start app
```

## Grafana Dashboard

### SLO Tier Overview (Homepage)

- **SLO Status** per tier (stat panels with green/yellow/red thresholds)
- **Error Budget** gauge (Tier 1)
- **Traefik Health** — proxy scrape status (UP/DOWN)
- **Request Rate** per tier + status code (timeseries)
- **Error Rate** per tier vs SLO target (timeseries)
- **Latency p99** per tier vs latency target (timeseries)
- **Burn Rate** Tier 1 (5m, 30m, 6h)
- **Open Connections** per service
- **Requests by Status Code** (donut chart)

## Metrics

### Traefik Built-in (`traefik_service_*`)

```
traefik_service_requests_total{code, method, protocol, service}
traefik_service_request_duration_seconds_bucket{le, service}
traefik_service_request_duration_seconds_count{service}
traefik_service_request_duration_seconds_sum{service}
traefik_service_open_connections{service}
traefik_service_retries_total{service}
```

Service labels: `tier1-svc@file`, `tier2-svc@file`, `tier3-svc@file`

### Sloth Generated Rules (`slo:*`)

```
slo:sloth_example:tier1_availability:error_ratio:5m
slo:sloth_example:tier1_availability:burn_rate:5m
slo:sloth_example:tier1_availability:burn_rate:30m
slo:sloth_example:tier1_availability:burn_rate:6h
slo:sloth_example:tier1_latency:error_ratio:5m
... (same pattern for tier2, tier3)
```

## Useful Commands

```bash
# Start all services
docker compose run --rm sloth && docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v

# View logs
docker compose logs -f
docker compose logs -f traefik
docker compose logs -f app

# Re-generate SLO rules (after editing slo.yaml)
docker compose run --rm sloth && docker compose restart prometheus

# Generate traffic load
while true; do curl -s http://localhost/api/users > /dev/null; done

# Test app down scenario
docker compose stop app && curl -s http://localhost/api/users
docker compose start app
```

## Customize

### Adding a New Endpoint

1. Add a route in `app/main.py`:

```python
"tier1": {
    "routes": [
        ("/login", "POST"),
        ("/api/new-endpoint", "GET"),
    ],
},
```

2. Add a router rule in `traefik/dynamic.yml`:

```yaml
tier1:
  rule: "Path(`/login`) || Path(`/api/payment`) || Path(`/api/new-endpoint`)"
  service: tier1-svc
```

3. Rebuild:

```bash
docker compose up -d --build
```

### Changing SLO Target

Edit `sloth/slo.yaml` — change the `objective`, then:

```bash
docker compose run --rm sloth && docker compose restart prometheus
```

### Adding a New Dashboard

Place a `.json` file in `grafana/dashboards/<folder>/` and Grafana will auto-load it.
