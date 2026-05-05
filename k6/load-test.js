import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

const errorRate = new Rate('errors');
const tier1Rate = new Rate('tier1_errors');
const tier2Rate = new Rate('tier2_errors');
const tier3Rate = new Rate('tier3_errors');

const tier1Trend = new Trend('tier1_latency');
const tier2Trend = new Trend('tier2_latency');
const tier3Trend = new Trend('tier3_latency');

const requestsByTier = new Counter('requests_by_tier');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.05'],
    tier1_errors: ['rate<0.005'],
    tier2_errors: ['rate<0.02'],
    tier3_errors: ['rate<0.05'],
  },
};

const TIER1_ENDPOINTS = [
  { path: '/login', method: 'POST' },
  { path: '/api/payment', method: 'POST' },
  { path: '/api/checkout', method: 'POST' },
  { path: '/api/auth/refresh', method: 'POST' },
];

const TIER2_ENDPOINTS = [
  { path: '/api/users', method: 'GET' },
  { path: '/api/products', method: 'GET' },
  { path: '/api/orders', method: 'GET' },
  { path: '/api/cart', method: 'GET' },
];

const TIER3_ENDPOINTS = [
  { path: '/api/reports', method: 'GET' },
  { path: '/api/analytics', method: 'GET' },
  { path: '/api/notifications', method: 'GET' },
  { path: '/api/exports', method: 'POST' },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hitEndpoint(endpoint, tier) {
  const res = http.request(endpoint.method, `${BASE_URL}${endpoint.path}`, null, {
    tags: { tier: tier, endpoint: endpoint.path },
  });

  const isOk = check(res, {
    'status 200': (r) => r.status === 200,
  });

  errorRate.add(!isOk);
  requestsByTier.add(1, { tier: tier });

  if (tier === 'tier1') {
    tier1Rate.add(!isOk);
    tier1Trend.add(res.timings.duration);
  } else if (tier === 'tier2') {
    tier2Rate.add(!isOk);
    tier2Trend.add(res.timings.duration);
  } else {
    tier3Rate.add(!isOk);
    tier3Trend.add(res.timings.duration);
  }

  return res;
}

export default function () {
  group('Tier 1 - Critical', () => {
    const ep = pickRandom(TIER1_ENDPOINTS);
    hitEndpoint(ep, 'tier1');
  });

  group('Tier 2 - Standard', () => {
    const ep = pickRandom(TIER2_ENDPOINTS);
    hitEndpoint(ep, 'tier2');
  });

  group('Tier 3 - Background', () => {
    const ep = pickRandom(TIER3_ENDPOINTS);
    hitEndpoint(ep, 'tier3');
  });

  const allEndpoints = [
    ...TIER1_ENDPOINTS.map((e) => ({ ...e, tier: 'tier1' })),
    ...TIER2_ENDPOINTS.map((e) => ({ ...e, tier: 'tier2' })),
    ...TIER3_ENDPOINTS.map((e) => ({ ...e, tier: 'tier3' })),
  ];

  group('Random Mix', () => {
    const ep = pickRandom(allEndpoints);
    hitEndpoint(ep, ep.tier);
  });
}

export function handleSummary(data) {
  const summary = {
    'stdout': '',
  };

  const t1 = data.metrics.tier1_errors?.values || {};
  const t2 = data.metrics.tier2_errors?.values || {};
  const t3 = data.metrics.tier3_errors?.values || {};

  const t1Lat = data.metrics.tier1_latency?.values || {};
  const t2Lat = data.metrics.tier2_latency?.values || {};
  const t3Lat = data.metrics.tier3_latency?.values || {};

  summary['stdout'] = `
╔══════════════════════════════════════════════════════╗
║              SLO Load Test Results                  ║
╠══════════════════════════════════════════════════════╣
║  Total Requests: ${String(data.metrics.http_reqs?.values?.count || 0).padStart(8)}                            ║
║  Total Errors:   ${String(data.metrics.errors?.values?.passes || 0).padStart(8)}                            ║
║  Error Rate:     ${(t1.rate || 0).toFixed(2)}%                           ║
╠══════════════════════════════════════════════════════╣
║  TIER             ERR RATE    SLO TARGET    STATUS   ║
╠══════════════════════════════════════════════════════╣
║  Tier 1 Critical   ${(t1.rate || 0).toFixed(3)}%     <0.100%      ${(t1.rate < 0.001 ? '  PASS' : '  FAIL')}   ║
║  Tier 2 Standard   ${(t2.rate || 0).toFixed(3)}%     <0.500%      ${(t2.rate < 0.005 ? '  PASS' : '  FAIL')}   ║
║  Tier 3 Background ${(t3.rate || 0).toFixed(3)}%     <1.000%      ${(t3.rate < 0.01 ? '  PASS' : '  FAIL')}   ║
╠══════════════════════════════════════════════════════╣
║  TIER             p50(ms)     p95(ms)     p99(ms)   ║
╠══════════════════════════════════════════════════════╣
║  Tier 1 Critical   ${String((t1Lat['p(50)'] || 0).toFixed(0)).padStart(6)}      ${String((t1Lat['p(95)'] || 0).toFixed(0)).padStart(6)}      ${String((t1Lat['p(99)'] || 0).toFixed(0)).padStart(6)}   ║
║  Tier 2 Standard   ${String((t2Lat['p(50)'] || 0).toFixed(0)).padStart(6)}      ${String((t2Lat['p(95)'] || 0).toFixed(0)).padStart(6)}      ${String((t2Lat['p(99)'] || 0).toFixed(0)).padStart(6)}   ║
║  Tier 3 Background ${String((t3Lat['p(50)'] || 0).toFixed(0)).padStart(6)}      ${String((t3Lat['p(95)'] || 0).toFixed(0)).padStart(6)}      ${String((t3Lat['p(99)'] || 0).toFixed(0)).padStart(6)}   ║
╚══════════════════════════════════════════════════════╝
`;

  return summary;
}
