import logging
import time
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



def handle_request(method, endpoint, tier):
    return jsonify({
        "endpoint": endpoint,
        "tier": tier,
        "status": "ok",
    }), 200


for tier, config in ENDPOINTS.items():
    for endpoint, method in config["routes"]:
        def make_handler(ep, m, t):
            def handler():
                return handle_request(m, ep, t)
            return handler
        app.add_url_rule(endpoint, endpoint.replace("/", "_"), make_handler(endpoint, method, tier), methods=[method])


@app.route("/health")
def health():
    return jsonify({"status": "healthy"}), 200


@app.route("/latency/tier1", methods=["GET"])
def latency_tier1():
    time.sleep(0.8)
    return jsonify({"endpoint": "/latency/tier1", "tier": "tier1", "status": "ok", "latency_ms": 800}), 200


@app.route("/error/tier1", methods=["GET"])
def error_tier1():
    return jsonify({"endpoint": "/error/tier1", "tier": "tier1", "status": "error", "error": "internal server error"}), 500


@app.route("/error/tier2", methods=["GET"])
def error_tier2():
    return jsonify({"endpoint": "/error/tier2", "tier": "tier2", "status": "error", "error": "bad gateway"}), 502


@app.route("/error/tier3", methods=["GET"])
def error_tier3():
    return jsonify({"endpoint": "/error/tier3", "tier": "tier3", "status": "error", "error": "service unavailable"}), 503


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    app.run(host="0.0.0.0", port=5000)
