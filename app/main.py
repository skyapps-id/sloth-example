import random
import time
import logging
from flask import Flask, jsonify

app = Flask(__name__)

ENDPOINTS = {
    "tier1": {
        "routes": [
            ("/login", "POST"),
            ("/api/payment", "POST"),
            ("/api/checkout", "POST"),
            ("/api/auth/refresh", "POST"),
        ],
    },
    "tier2": {
        "routes": [
            ("/api/users", "GET"),
            ("/api/products", "GET"),
            ("/api/orders", "GET"),
            ("/api/cart", "GET"),
        ],
    },
    "tier3": {
        "routes": [
            ("/api/reports", "GET"),
            ("/api/analytics", "GET"),
            ("/api/notifications", "GET"),
            ("/api/exports", "POST"),
        ],
    },
}

ERROR_RATES = {
    "tier1": 0.002,
    "tier2": 0.01,
    "tier3": 0.03,
}

LATENCY_RANGE = {
    "tier1": (0.02, 0.15),
    "tier2": (0.05, 0.4),
    "tier3": (0.1, 2.0),
}


def handle_request(method, endpoint, tier):
    if random.random() < ERROR_RATES[tier]:
        r = random.random()
        if r < 0.5:
            code, reason = 500, "internal server error"
        elif r < 0.8:
            code, reason = 502, "bad gateway"
        else:
            code, reason = 503, "service unavailable"
        return jsonify({"endpoint": endpoint, "tier": tier, "status": "error", "error": reason}), code

    lo, hi = LATENCY_RANGE[tier]
    latency = random.expovariate(1.0 / ((lo + hi) / 2.0))
    latency = min(latency, hi * 2)
    time.sleep(latency)

    return jsonify({
        "endpoint": endpoint,
        "tier": tier,
        "status": "ok",
        "latency_ms": round(latency * 1000, 2),
    }), 200


for tier, config in ENDPOINTS.items():
    for endpoint, method in config["routes"]:
        def make_handler(ep, m, t):
            def handler():
                return handle_request(m, ep, t)
            return handler
        app.add_url_rule(endpoint, endpoint.replace("/", "_"), make_handler(endpoint, method, tier))


@app.route("/health")
def health():
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    app.run(host="0.0.0.0", port=5000)
