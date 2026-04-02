# Login Failed - Troubleshooting Guide

## 🔴 Issue: Login Failed

You're seeing "Login failed" because the **database hasn't been seeded** yet. The test users don't exist.

---

## ✅ Solution: Run These Commands in VS Code Terminal

### **Step 1: Check if users exist**

In VS Code terminal:
```bash
cd backend
node check-users.js
```

If you see "No users found", continue to Step 2.

---

### **Step 2: Seed the database** 

In VS Code terminal:
```bash
cd backend
node scripts/seed.js
```

You should see:
- ✅ Admin user created — phone: +254700000000 / password: Admin@1234
- ✅ Test user created — phone: +254711111111 / password: Test@1234

---

### **Step 3: Restart the backend**

1. In the backend terminal, press **Ctrl + C**
2. Run:
```bash
npm run dev
```

---

### **Step 4: Try logging in again**

Go to: http://localhost:3000

**Use these exact credentials:**

**Option 1 - Test User (Recommended):**
- Phone: `+254711111111`
- Password: `Test@1234`

**Option 2 - Admin:**
- Phone: `+254700000000`
- Password: `Admin@1234`

---

## 🚨 Common Issues:

### Issue: "MongoDB connection failed"
**Solution:** Make sure MongoDB is running on port 27017

Check if MongoDB is running:
```bash
tasklist | findstr mongo
```

If not running, start it or use MongoDB Atlas (cloud).

---

### Issue: "Still shows login failed"
**Possible causes:**

1. **Wrong phone format**
   - Must include country code: `+254711111111`
   - NOT: `0711111111` or `254711111111`

2. **Password is case-sensitive**
   - Use exact password: `Test@1234` or `Admin@1234`

3. **Account locked after 5 failed attempts**
   - Wait 30 minutes or re-run seed script

4. **Backend not restarted after seeding**
   - Restart backend with Ctrl+C then `npm run dev`

---

## 📋 Quick Fix Commands (Copy & Paste):

**Check database:**
```bash
cd backend && node check-users.js
```

**Seed database:**
```bash
cd backend && node scripts/seed.js
```

**Restart backend:**
```bash
cd backend && npm run dev
```

---

## 🔍 Debug Mode

Want to see what's happening? Add this to backend terminal:

```bash
cd backend
set DEBUG=* && npm run dev
```

Then check `logs/backend.out.log` for detailed errors.

---

## ✅ After Fix:

You should be able to login with:
- Phone: `+254711111111`
- Password: `Test@1234`

The test user has:
- ✅ Pre-activated account
- ✅ $12.40 balance
- ✅ Level 2 with XP
- ✅ 5-day streak

---

Need more help? Check the backend terminal for error messages!
