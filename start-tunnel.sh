#!/bin/bash
echo "Starting Expo Metro bundler..."
npx expo start --port 8081 &
EXPO_PID=$!
echo "Waiting for Metro to start..."
sleep 12
echo "Starting Cloudflare tunnel..."
echo "Look for a URL like: https://something.trycloudflare.com"
echo "Open that URL in Expo Go on your phone"
cloudflared tunnel --url http://localhost:8081
