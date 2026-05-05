# Error Budget Report ke CTO

## Cara Baca Dashboard

### Step 1: Lihat Gauge per Tier (Executive Summary)

Gauge di row tengah dashboard menunjukkan error budget tersisa per tier.

| Warna | Arti |
|-------|------|
| Hijau | > 90% budget tersisa — aman |
| Kuning | 50-90% budget tersisa — perlu perhatian |
| Merah | < 50% budget tersisa — bahaya, investigasi sekarang |

CTO cukup lihat 3 gauge ini untuk tahu kondisi overall.

### Step 2: Kalau Merah, Scroll ke Drill-Down

Di bawah gauge ada 3 baris stat per-endpoint. Baris ini menunjukkan error budget per endpoint dalam tier.

Contoh: Gauge Tier 1 merah → scroll ke "Tier 1 - Error Budget per Endpoint" → lihat mana endpoint yang merah/kuning.

### Step 3: Investigasi di Panel Lain

- **Error Budget Remaining by Tier** (timeseries) → tren error budget dari waktu ke waktu
- **Burn Rate (Tier 1)** → seberapa cepat error budget terbakar (1x = normal, >3x = critical)
- **Raw Error Rate per Endpoint** → error rate mentah per service Traefik
- **SLO Error Ratio by Endpoint** → error ratio vs SLO target

## Error Budget per Tier

```
Tier 1 - Critical (99.9%)    Error Budget = 0.1%
├── /login              → error budget tersisa
├── /api/payment        → error budget tersisa
├── /api/checkout       → error budget tersisa
└── /api/auth/*         → error budget tersisa

Tier 2 - Standard (99.5%)   Error Budget = 0.5%
├── /api/users          → error budget tersisa
├── /api/products       → error budget tersisa
├── /api/orders         → error budget tersisa
└── /api/cart           → error budget tersisa

Tier 3 - Background (99.0%) Error Budget = 1.0%
├── /api/reports        → error budget tersisa
├── /api/analytics      → error budget tersisa
├── /api/notifications  → error budget tersisa
└── /api/exports        → error budget tersisa
```

## Rumus Error Budget

```
error_budget = 1 - SLO_target
error_budget_remaining = 1 - (actual_error_rate / error_budget)

Contoh Tier 1 (SLO 99.9%):
  error_budget = 1 - 0.999 = 0.001 (0.1%)
  
  Jika actual_error_rate = 0.0005 (0.05%):
    remaining = 1 - (0.0005 / 0.001) = 0.5 → 50% budget tersisa (kuning)
  
  Jika actual_error_rate = 0.0001 (0.01%):
    remaining = 1 - (0.0001 / 0.001) = 0.9 → 90% budget tersisa (hijau)
```

## Mock Error Rates (app/main.py)

Endpoint dengan error rate berbeda-beda supaya drill-down terlihat jelas:

| Endpoint | Error Rate | SLO Error Budget | Status |
|----------|-----------|-----------------|--------|
| `/login` | 0.05% | 0.1% | Hijau |
| `/api/auth/refresh` | 0.02% | 0.1% | Hijau |
| `/api/checkout` | 0.3% | 0.1% | Merah |
| `/api/payment` | 0.8% | 0.1% | Merah |
| `/api/users` | 0.2% | 0.5% | Hijau |
| `/api/cart` | 0.3% | 0.5% | Hijau |
| `/api/products` | 0.6% | 0.5% | Kuning |
| `/api/orders` | 1.2% | 0.5% | Merah |
| `/api/reports` | 2.0% | 1.0% | Merah |
| `/api/analytics` | 4.0% | 1.0% | Merah |
| `/api/notifications` | 2.5% | 1.0% | Merah |
| `/api/exports` | 5.0% | 1.0% | Merah |

Ada juga **error burst** (2% chance → 50% error rate) untuk simulasi incident.

## Template Report ke CTO

```
Subject: SLO Report - [Minggu/Bulan]

Ringkasan:
- Tier 1 (Critical):    [hijau/kuning/merah] — [X]% budget tersisa
- Tier 2 (Standard):    [hijau/kuning/merah] — [X]% budget tersisa
- Tier 3 (Background):  [hijau/kuning/merah] — [X]% budget tersisa

Detail per Endpoint:
- [Endpoint yang merah] → [sebab] → [action plan]
- [Endpoint yang merah] → [sebab] → [action plan]

Incident (jika ada):
- [Tanggal] → [Endpoint] → [Durasi] → [Dampak ke error budget]
```

## Generate Traffic untuk Testing

```bash
# Ringan (cepat muncul data)
for ep in login api/payment api/checkout api/auth/refresh api/users api/products api/orders api/cart api/reports api/analytics api/notifications api/exports; do
  curl -s -X POST http://localhost/$ep > /dev/null 2>&1
done

# Load test (50 round, ~2 menit)
for i in $(seq 1 50); do
  for ep in login api/payment api/checkout api/auth/refresh api/users api/products api/orders api/cart api/reports api/analytics api/notifications api/exports; do
    curl -s -X POST http://localhost/$ep -o /dev/null 2>&1
  done
  sleep 1
done
```

Tunggu ~30 detik setelah load test agar `rate5m` terisi data point.
