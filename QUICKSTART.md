# EarnHub - Quick Start Guide

## 🚀 Automatic Setup (Easiest)

**Double-click this file:**
```
setup-and-run.bat
```

This will:
1. ✅ Seed the database with test users
2. ✅ Start the backend server
3. ✅ Start the frontend server

Then go to: **http://localhost:3000**

---

## 👤 Test Login Credentials

**Phone:** `+254711111111`  
**Password:** `Test@1234`

Or admin account:  
**Phone:** `+254700000000`  
**Password:** `Admin@1234`

Or ledger account:  
**Phone:** `+254700000002`  
**Password:** `Ledger@1234`

---

## 📝 Registration (New Users)

OTP is **bypassed** in development mode!

1. Click "Register"
2. Enter any phone number
3. Fill in details
4. **OTP:** Enter ANY 6 digits (e.g., 123456)
5. Done! ✅

---

## 🔄 Useful Scripts

| File | Purpose |
|------|---------|
| `setup-and-run.bat` | Complete setup (seed + start servers) |
| `restart-all.bat` | Restart both servers |
| `stop-all.bat` | Stop all Node processes |
| `start-all.bat` | Start servers only (no seeding) |
| `backend/run-seed.bat` | Seed database only |

---

## 🛠️ Manual Commands

### Seed Database
```cmd
cd backend
node scripts\seed.js
```

### Start Backend
```cmd
cd backend
npm run dev
```

### Start Frontend
```cmd
cd frontend
npm run dev
```

---

## 🌐 URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health

---

## ⚙️ Configuration

### Backend (.env)
- `NODE_ENV=development` (OTP bypass enabled)
- `MONGODB_URI=mongodb://127.0.0.1:27017/earnhub`
- `JWT_SECRET=local-dev-secret-change-me`

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL=http://localhost:5000`

---

## 🐛 Troubleshooting

### "Port already in use"
Run `stop-all.bat` to kill all Node processes

### "Cannot connect to MongoDB"
Make sure MongoDB is running on port 27017

### "Login fails"
1. Run `backend/run-seed.bat` to create test users
2. Use the correct credentials above

### "OTP not working"
OTP is bypassed in development - just enter any 6 digits

---

## 📦 Optional: Redis Setup

Redis is **not required** for development (OTP is bypassed).

If you want full OTP functionality:
- Double-click `install-redis.bat`
- Or use Docker: `docker run -d -p 6379:6379 redis:7-alpine`

---

## ✅ Next Steps

1. Run `setup-and-run.bat`
2. Open http://localhost:3000
3. Login with test account
4. Start earning! 💰
