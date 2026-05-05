# SLO Monitoring Report

## Executive Summary

Kita memantau **14 SLO** di **3 tier** menggunakan Grafana dashboard yang terhubung ke Prometheus + Traefik. Dashboard utama: **"SLO Per-Endpoint Overview"** (`slo-tier-overview`).

| Tier | Kategori | Target | Error Budget | Jumlah SLO |
|------|----------|--------|--------------|------------|
| 1 | Critical | 99.9% | 0.1% | 6 (4 availability + 2 latency) |
| 2 | Standard | 99.5% | 0.5% | 4 availability |
| 3 | Background | 99.0% | 1.0% | 4 availability |

---

## Arsitektur Monitoring

```
Client → Traefik (reverse proxy) → Mock App
              │
              ├── Metrics: traefik_service_requests_total, traefik_service_request_duration_seconds_*
              ├── Deteksi app down: 502 Bad Gateway (otomatis)
              └── Scrape Prometheus (setiap 15s)
                      │
                      ├── Sloth: generate recording + alerting rules dari slo.yaml
                      └── Grafana: visualisasi dashboard
```

**Kenapa metrics di Traefik, bukan di app?** Jika app down, app tidak bisa emit metrics. Traefik tetap mencatat 502/504, sehingga SLO tetap terukur.

---

## Dashboard Layout

Dashboard: `http://localhost:3000` → **SLO Per-Endpoint Overview**

### Row 1: SLO Error Ratio by Endpoint (Timeseries)

Menampilkan error ratio per endpoint dalam 5 menit terakhir. Digabung per tier (Tier 1/2/3). Semakin rendah garis = semakin baik.

### Row 2: Error Budget Remaining by Tier (Timeseries)

Tren sisa error budget per tier dari waktu ke waktu.

| Warna | Arti |
|-------|------|
| Hijau | > 90% budget tersisa |
| Kuning | 50-90% budget tersisa |
| Merah | < 50% budget tersisa |

### Row 3: Error Rate per Endpoint (Stat Panels)

4 panel stat menampilkan error rate per-endpoint secara real-time:

| Panel | Endpoint | Threshold Kuning | Threshold Merah |
|-------|----------|-----------------|-----------------|
| Tier 1 - Critical | /login, /api/payment, /api/checkout, /api/auth/* | 0.1% | 1% |
| Tier 2 - Standard | /api/users, /api/products, /api/orders, /api/cart | 0.5% | 2% |
| Tier 3 - Background | /api/reports, /api/analytics, /api/notifications, /api/exports | 1% | 3% |
| Traefik / App Health | UP/DOWN | - | - |

### Row 4: Burn Rate per Tier (Timeseries)

Burn rate mengukur kecepatan konsumsi error budget:

| Panel | Threshold Hijau | Threshold Kuning | Threshold Merah |
|-------|----------------|-----------------|-----------------|
| Burn Rate (Tier 1) | < 1x | 1-3x | > 3x |
| Burn Rate (Tier 2) | < 1x | 1-3x | > 3x |
| Burn Rate (Tier 3) | < 1x | 1-3x | > 3x |

- **Burn rate 1x** = budget habis tepat di akhir window (normal)
- **Burn rate 3x** = budget habis 3x lebih cepat dari ekspektasi (perlu investigasi)

### Row 5: SLO Compliance per Tier (Stat Panels)

Menampilkan persentase availability aktual per tier:

| Panel | Target | Hijau | Kuning | Merah |
|-------|--------|-------|--------|-------|
| Tier 1 | 99.9% | >= 99.95% | >= 99.8% | < 99.8% |
| Tier 2 | 99.5% | >= 99.5% | >= 99.4% | < 99.4% |
| Tier 3 | 99.0% | >= 99.0% | >= 98.9% | < 98.9% |

### Row 6: SLO Status per Endpoint (Table)

Tabel lengkap menampilkan **semua endpoint** dengan SLO compliance aktual. Kolom:

| Kolom | Isi |
|-------|-----|
| SLO Name | Nama SLO (mis. `tier1-login-availability`) |
| Current SLO | Persentase availability saat ini (warna background: merah/kuning/hijau) |

Threshold warna: red < 98%, orange < 99%, yellow < 99.5%, green >= 99.5%.

### Row 7: Raw Error Rate + Latency p99 (Timeseries)

| Panel | Metric | Kegunaan |
|-------|--------|----------|
| Raw Error Rate per Endpoint | `rate(traefik_service_requests_total{code=~"5.."})` | Error rate mentah 5xx per service |
| Latency p99 per Endpoint | `histogram_quantile(0.99, ...)` | Latency persentil ke-99 per service |

### Row 8: Traffic Distribution (Charts)

| Panel | Tipe | Kegunaan |
|-------|------|----------|
| Requests by Status Code | Donut chart | Distribusi status code (2xx vs 5xx) |
| Requests per Endpoint | Bar chart | Volume request per service |

---

## SLO Definitions

### Tier 1 - Critical (99.9%)

| SLO Name | Endpoint | Tipe | Alert | Severity |
|----------|----------|------|-------|----------|
| tier1-login-availability | /login | Availability (non-5xx) | LoginHighErrorRate | critical |
| tier1-login-latency | /login | Latency (p99 < 500ms) | LoginHighLatency | critical |
| tier1-payment-availability | /api/payment | Availability | PaymentHighErrorRate | critical |
| tier1-payment-latency | /api/payment | Latency (p99 < 500ms) | PaymentHighLatency | critical |
| tier1-checkout-availability | /api/checkout | Availability | CheckoutHighErrorRate | critical |
| tier1-auth-availability | /api/auth/* | Availability | AuthHighErrorRate | critical |

### Tier 2 - Standard (99.5%)

| SLO Name | Endpoint | Alert | Severity |
|----------|----------|-------|----------|
| tier2-users-availability | /api/users | UsersHighErrorRate | warning |
| tier2-products-availability | /api/products | ProductsHighErrorRate | warning |
| tier2-orders-availability | /api/orders | OrdersHighErrorRate | warning |
| tier2-cart-availability | /api/cart | CartHighErrorRate | warning |

### Tier 3 - Background (99.0%)

| SLO Name | Endpoint | Alert | Severity |
|----------|----------|-------|----------|
| tier3-reports-availability | /api/reports | ReportsHighErrorRate | info |
| tier3-analytics-availability | /api/analytics | AnalyticsHighErrorRate | info |
| tier3-notifications-availability | /api/notifications | NotificationsHighErrorRate | info |
| tier3-exports-availability | /api/exports | ExportsHighErrorRate | info |

---

## Cara Baca Dashboard (Untuk CTO)

### 1 Lihat SLO Compliance (Row 5)

3 angka besar di tengah dashboard. Ini adalah ringkasan tercepat:

- **Hijau** = semua endpoint di tier tersebut memenuhi target SLO
- **Kuning** = mendekati batas target, perlu perhatian
- **Merah** = SLO tidak terpenuhi, investigasi segera

### 2 Cek SLO Status Table (Row 6)

Tabel menunjukkan status per-endpoint. Cari baris yang berwarna merah/oranye.

### 3 Kalau Ada yang Merah, Cek Burn Rate (Row 4)

Burn rate > 1x artinya error budget terbakar lebih cepat dari normal. Jika > 3x, prioritaskan investigasi.

### 4 Investigasi Lebih Dalam (Row 7-8)

- **Raw Error Rate** → lihat error rate mentah per service
- **Latency p99** → cek apakah masalah latency atau availability
- **Requests by Status Code** → lihat distribusi 2xx vs 5xx

---

## Template Report Mingguan/Bulanan

```
Subject: SLO Report - [Minggu/Bulan]

Ringkasan:
- Tier 1 (Critical):    [hijau/kuning/merah] — current SLO: [X]%
- Tier 2 (Standard):    [hijau/kuning/merah] — current SLO: [X]%
- Tier 3 (Background):  [hijau/kuning/merah] — current SLO: [X]%

Endpoint Bermasalah:
- [Endpoint] → error rate [X]% vs target [Y]% → [sebab] → [action plan]
- [Endpoint] → error rate [X]% vs target [Y]% → [sebab] → [action plan]

Incident:
- [Tanggal] → [Endpoint] → [Durasi] → [Dampak ke error budget]

Burn Rate Highlights:
- Tier 1: [X]x (normal/critical)
- Tier 2: [X]x (normal/critical)
- Tier 3: [X]x (normal/critical)
```

---

## Glossary

| Istilah | Definisi |
|---------|----------|
| **SLO** | Service Level Objective — target keandalan layanan |
| **SLI** | Service Level Indicator — metrik yang mengukur keandalan (error ratio, latency) |
| **Error Budget** | Jumlah error yang "diperbolehkan" (100% - SLO target) |
| **Burn Rate** | Kecepatan konsumsi error budget (1x = normal, >3x = critical) |
| **Availability** | Persentase request yang berhasil (non-5xx) |
| **p99** | Persentil ke-99 dari latency — 1% request paling lambat |

---

## Akses

| Tool | URL | Credentials |
|------|-----|-------------|
| Grafana Dashboard | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| Traefik Dashboard | http://localhost:8080 | - |
