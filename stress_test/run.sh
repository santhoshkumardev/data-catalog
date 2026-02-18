#!/usr/bin/env bash
# Usage:
#   ./run.sh            → headless, 50 users, 3-minute run, produces report.html
#   ./run.sh --ui       → opens live web UI at http://localhost:8089

set -e
cd "$(dirname "$0")"

HOST="http://localhost:8001"
USERS=50
SPAWN_RATE=5
DURATION=3m

if [[ "$1" == "--ui" ]]; then
  echo "Starting Locust UI → open http://localhost:8089 and set host to $HOST"
  locust -f locustfile.py --host "$HOST"
else
  echo "Running headless stress test: $USERS users, spawning $SPAWN_RATE/s for $DURATION"
  locust -f locustfile.py \
    --headless \
    --host "$HOST" \
    -u "$USERS" \
    -r "$SPAWN_RATE" \
    -t "$DURATION" \
    --html report.html \
    --csv results \
    --csv-full-history \
    --print-stats \
    --only-summary
  echo ""
  echo "Done! Report saved to: $(pwd)/report.html"
  echo "CSV files: results_stats.csv  results_failures.csv"
fi
