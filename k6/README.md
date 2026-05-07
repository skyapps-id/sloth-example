# K6 Load Test Suite

Load test suite untuk sloth-example SLO monitoring.

## File

| File | Tujuan |
|---|---|
| `load-test.js` | Generate success traffic ke semua endpoint bisnis |
| `error-test.js` | Trigger error & latency sintetis untuk testing SLO breach |

## load-test.js

Normal traffic test untuk generate success request ke semua endpoint.

- **VUs:** 50
- **Total requests:** 12,000 (12 endpoints x 1,000 per endpoint)
- **Expected response:** 200 OK

## error-test.js

Synthetic failure test untuk trigger SLO breach pada dashboard dan alert.

- **Iterasi:** 1 (4 request sequentially)
- **Tujuan:** Testing alert Discord & dashboard Grafana

## Endpoint Mapping

### Business Endpoints (load-test.js)

| # | Endpoint | Method | Tier | Expected | Requests |
|---|---|---|---|---|---|
| 1 | `/login` | POST | T1 Critical | 200 | 1,000 |
| 2 | `/api/payment` | POST | T1 Critical | 200 | 1,000 |
| 3 | `/api/checkout` | POST | T1 Critical | 200 | 1,000 |
| 4 | `/api/auth/refresh` | POST | T1 Critical | 200 | 1,000 |
| 5 | `/api/users` | GET | T2 Standard | 200 | 1,000 |
| 6 | `/api/products` | GET | T2 Standard | 200 | 1,000 |
| 7 | `/api/orders` | GET | T2 Standard | 200 | 1,000 |
| 8 | `/api/cart` | GET | T2 Standard | 200 | 1,000 |
| 9 | `/api/reports` | GET | T3 Background | 200 | 1,000 |
| 10 | `/api/analytics` | GET | T3 Background | 200 | 1,000 |
| 11 | `/api/notifications` | GET | T3 Background | 200 | 1,000 |
| 12 | `/api/exports` | POST | T3 Background | 200 | 1,000 |

### Test Endpoints (error-test.js)

| # | Endpoint | Method | Tier | Expected | Requests |
|---|---|---|---|---|---|
| 13 | `/error/tier1` | GET | T1 Critical | 500 | 1 |
| 14 | `/error/tier2` | GET | T2 Standard | 502 | 1 |
| 15 | `/error/tier3` | GET | T3 Background | 503 | 1 |
| 16 | `/latency/tier1` | GET | T1 Critical | 200 (800ms) | 1 |

**Total:** 12,004 requests

## Cara Pakai

```bash
k6 run k6/load-test.js                          # default localhost
k6 run k6/load-test.js -e BASE_URL=http://prod  # custom URL
k6 run k6/error-test.js                         # trigger error/latency
```

## Rekomendasi

1. Jalankan `load-test.js` dulu untuk generate baseline traffic
2. Lalu jalankan `error-test.js` untuk trigger SLO breach
3. Pantau dashboard Grafana dan notif Discord
