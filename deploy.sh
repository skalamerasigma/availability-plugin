#!/bin/bash
# Deploy support-queue-live to Google Cloud Run (via Cloud Build)

set -euo pipefail

# Mirror queue-health-monitor's local gcloud setup (safe if unset).
if [ -x "/opt/homebrew/bin/python3.13" ]; then
  export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.13
fi
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:$PATH

PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
REGION="us-central1"

if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: gcloud project is not set. Run: gcloud config set project <PROJECT_ID>" >&2
  exit 1
fi

echo "=== Deploying support-queue-live to Cloud Run ==="
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

gcloud builds submit --config=cloudbuild.yaml

echo ""
echo "✓ Deployment finished"

SERVICE_URL="$(gcloud run services describe support-queue-live --region="$REGION" --format='value(status.url)' 2>/dev/null || true)"
QHM_URL="$(gcloud run services describe queue-health-monitor --region="$REGION" --format='value(status.url)' 2>/dev/null || true)"

if [ -n "$SERVICE_URL" ]; then
  echo ""
  echo "support-queue-live URL:"
  echo "  $SERVICE_URL"
fi

if [ -n "$QHM_URL" ]; then
  echo ""
  echo "queue-health-monitor URL (API target):"
  echo "  $QHM_URL"
fi

echo ""
echo "Next steps:"
echo "1) Update Sigma plugin URL to:"
echo "   $SERVICE_URL"

