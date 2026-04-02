#!/bin/bash

# Get local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

echo "================================================"
echo "Starting Party Game for Network Access"
echo "================================================"
echo ""
echo "Your local IP: $LOCAL_IP"
echo ""
echo "To join from your phone, open:"
echo "  http://$LOCAL_IP:3000"
echo ""
echo "================================================"
echo ""

# Export environment variables
# SERVER_URL: used by Next.js server-side proxy (next.config.js rewrites)
# CLIENT_URL: used by the backend server for CORS
export SERVER_URL=http://$LOCAL_IP:3001
export CLIENT_URL=http://$LOCAL_IP:3000

# Start both server and client
cd "$(dirname "$0")"
npm run dev
