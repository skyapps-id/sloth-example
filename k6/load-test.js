import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

const errorRate = new Rate('errors');

const ENDPOINTS = [
  { path: '/login',             method: 'POST' },
  { path: '/api/payment',       method: 'POST' },
  { path: '/api/checkout',      method: 'POST' },
  { path: '/api/auth/refresh',  method: 'POST' },
  { path: '/api/users',         method: 'GET'  },
  { path: '/api/products',      method: 'GET'  },
  { path: '/api/orders',        method: 'GET'  },
  { path: '/api/cart',          method: 'GET'  },
  { path: '/api/reports',       method: 'GET'  },
  { path: '/api/analytics',     method: 'GET'  },
  { path: '/api/notifications', method: 'GET'  },
  { path: '/api/exports',       method: 'POST' },
];

export const options = {
  vus: 50,
  iterations: ENDPOINTS.length * 1000,
};

export default function () {
  const ep = ENDPOINTS[__VU % ENDPOINTS.length];
  const res = http.request(ep.method, `${BASE_URL}${ep.path}`, null, {
    tags: { endpoint: ep.path },
  });

  check(res, { 'status 200': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
}
