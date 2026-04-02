#!/bin/bash
# ============================================================
# EarnHub EC2 Server Setup Script
# Run once on a fresh Ubuntu 22.04 EC2 instance
# Usage: bash scripts/setup-ec2.sh
# ============================================================

set -e
echo "🚀 Setting up EarnHub server..."

# Update system
sudo apt-get update -y && sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install RabbitMQ
sudo apt-get install -y rabbitmq-server
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server
sudo rabbitmq-plugins enable rabbitmq_management

# Install Certbot for SSL
sudo apt-get install -y certbot python3-certbot-nginx

# Create app directory
sudo mkdir -p /var/www/earnhub
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/www/earnhub
sudo chown -R $USER:$USER /var/log/pm2

# Copy Nginx config
sudo cp /var/www/earnhub/nginx/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx

# Setup PM2 startup
pm2 startup systemd -u $USER --hp $HOME
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Clone your repo to /var/www/earnhub"
echo "  2. Copy backend/.env.example to backend/.env and fill in values"
echo "  3. cd backend && npm install"
echo "  4. pm2 start ecosystem.config.js --env production"
echo "  5. pm2 save"
echo "  6. sudo certbot --nginx -d api.yourdomain.com"
echo ""
