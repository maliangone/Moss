#!/bin/bash
# =============================================================================
# Moss AI Agent Platform — Generate Self-Signed TLS Certificates
#
# Usage: ./scripts/generate-certs.sh
#
# Generates a self-signed certificate for the nginx reverse proxy.
# Replace with real certificates (Let's Encrypt, etc.) for production.
# =============================================================================

set -euo pipefail

CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
    echo "Certificates already exist in ${CERT_DIR}/"
    echo "Delete them first if you want to regenerate."
    exit 0
fi

echo "Generating self-signed TLS certificate..."

openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/C=SG/ST=Singapore/L=Singapore/O=Moss AI/OU=IT/CN=moss.local" \
    2>/dev/null

echo "Self-signed certificate generated:"
echo "  Certificate: ${CERT_DIR}/server.crt"
echo "  Private key: ${CERT_DIR}/server.key"
echo "  Valid for:   365 days"
echo ""
echo "NOTE: Browsers will show a security warning for self-signed certs."
echo "      Replace with real certificates for production deployment."
