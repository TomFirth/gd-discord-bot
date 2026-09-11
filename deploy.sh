#!/bin/bash

# Deployment script for gd-discord-bot
# This script will:
# 1. Check for uncommitted changes
# 2. SSH into the server
# 3. Pull latest code
# 4. Restart PM2 processes
# 5. Run Discord bot

set -e # Exit on any error

echo "Starting deployment..."

# Step 1: Check for uncommitted changes
echo "Checking for uncommitted changes..."
if ! git diff-index --quiet HEAD --; then
  echo "ERROR: There are uncommitted changes. Please commit or stash them before deploying."
  exit 1
fi

if ! git diff-files --quiet; then
  echo "ERROR: There are uncommitted changes. Please commit or stash them before deploying."
  exit 1
fi

echo "No uncommitted changes found."

# Step 2: Deploy to server
echo "Deploying to server..."

ssh barber@192.168.1.81 << 'EOF'
  echo "Connected to server"
  
  # Navigate to the project directory
  cd /home/barber/gd-discord-bot
  
  # Pull latest code
  echo "Pulling latest code..."
  git pull origin main
  
  # Restart PM2 processes
  echo "Restarting PM2 processes..."
  pm2 restart all
  
  # Run Discord bot
  echo "Starting Discord bot..."
  npm run dc
EOF

echo "Deployment completed successfully!"