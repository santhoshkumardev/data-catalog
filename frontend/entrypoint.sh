#!/bin/sh
echo "Waiting for backend to be ready..."
until wget -q -T 2 --spider http://backend:8000/health 2>/dev/null; do
  sleep 2
done
echo "Backend is ready. Starting nginx."
exec nginx -g 'daemon off;'
