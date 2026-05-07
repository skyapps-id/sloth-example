import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export const options = {
  iterations: 1,
};

export default function () {
  const ENDPOINTS = [
    { path: '/error/tier1', method: 'GET' },
    { path: '/error/tier2', method: 'GET' },
    { path: '/error/tier3', method: 'GET' },
    { path: '/latency/tier1', method: 'GET' },
  ];
  for (const ep of ENDPOINTS) {
    http.request(ep.method, `${BASE_URL}${ep.path}`);
  }
}
