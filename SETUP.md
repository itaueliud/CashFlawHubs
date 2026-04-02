# CashflowConnect — Developer Setup Guide

## Prerequisites

- Node.js 20+
- MongoDB Atlas account (free tier works)
- Redis (local or Upstash free tier)
- Git

---

## 1. Clone & Install

```bash
git clone <your-repo-url> earnhub
cd earnhub

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

---

## 2. Backend Environment

```bash
cp backend/.env.example backend/.env
```

Fill in **at minimum** these values to run locally:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/earnhub
JWT_SECRET=any-random-string-32-chars
NODE_ENV=development

# Leave other API keys blank for now
# The app will still run — API-dependent features just won't work
```

---

## 3. Frontend Environment

```bash
cp frontend/.env.example frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 4. Seed the Database

```bash
cd backend
npm run seed
```

This creates:
- **Admin:** `+254700000000` / `Admin@1234`
- **Test User:** `+254711111111` / `Test@1234` (pre-activated, $12.40 balance)

---

## 5. Run in Development

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

---

## 6. Production Deployment

### Backend (AWS EC2)

```bash
# On your EC2 instance
bash scripts/setup-ec2.sh

# Clone repo
cd /var/www && git clone <repo> earnhub

# Setup env
cp /var/www/earnhub/backend/.env.example /var/www/earnhub/backend/.env
# Fill in production values

# Install & start
cd /var/www/earnhub/backend
npm install --only=production
pm2 start ecosystem.config.js --env production
pm2 save

# Setup Nginx
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx

# SSL (replace with your domain)
sudo certbot --nginx -d api.yourdomain.com
```

### Frontend (Vercel)

```bash
cd frontend
npx vercel --prod
```

Set environment variable in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 7. Load Balancer Architecture

The Nginx config (`nginx/nginx.conf`) load balances across **4 backend instances**:

```
Internet → Nginx (port 443)
            ├── Port 5001 (earnhub-api-1)
            ├── Port 5002 (earnhub-api-2)
            ├── Port 5003 (earnhub-api-3)
            └── Port 5004 (earnhub-api-4)
```

All 4 instances share:
- MongoDB Atlas cluster
- Redis cache
- RabbitMQ queue

Start all 4 with PM2:
```bash
pm2 start ecosystem.config.js
```

---

## 8. API Keys You Need (Per Module)

### Payments (Required for activation to work)
| Country | Provider | Signup |
|---------|----------|--------|
| Kenya | Safaricom Daraja | https://developer.safaricom.co.ke |
| All others | Flutterwave | https://dashboard.flutterwave.com |

### Surveys (Revenue source)
| Provider | Signup |
|----------|--------|
| CPX Research | https://publishers.cpx-research.com |
| BitLabs | https://bitlabs.ai/publisher |

### Offerwalls (Revenue source)
| Provider | Signup |
|----------|--------|
| Ayет Studios | https://www.ayetstudios.com/publisher |
| AdGate | https://adgaterewards.com/publisher |

### SMS OTP
| Provider | Signup |
|----------|--------|
| Twilio | https://twilio.com |

### Exchange Rates
| Provider | Signup |
|----------|--------|
| ExchangeRate-API | https://exchangerate-api.com (free tier: 1500 req/month) |

---

## 9. Docker (Full Stack)

```bash
# Copy and fill env
cp backend/.env.example backend/.env

# Run everything
docker-compose up -d

# View logs
docker-compose logs -f api1
```

Services started:
- Nginx load balancer → port 80/443
- 4x Node.js API instances
- MongoDB
- Redis
- RabbitMQ (management UI at :15672)
- Next.js frontend → port 3000

---

## 10. Key URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api |
| Health check | http://localhost:5000/health |
| RabbitMQ UI | http://localhost:15672 |
| API Docs | See route files in `backend/src/routes/` |

---

## 11. Project Structure

```
earnhub/
├── backend/
│   ├── src/
│   │   ├── config/         # DB, Redis, countries
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # Auth, anti-fraud
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # Express routes
│   │   ├── services/       # Queue, scheduler, SMS, exchange rates
│   │   └── utils/          # Logger
│   ├── scripts/            # Seed script
│   ├── ecosystem.config.js # PM2 — 4 instances
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # Shared components
│   │   ├── lib/            # API client, helpers
│   │   └── store/          # Zustand state
│   └── Dockerfile
├── nginx/
│   └── nginx.conf          # Load balancer config
├── scripts/
│   └── setup-ec2.sh        # Server setup
├── docker-compose.yml
└── README.md
```
