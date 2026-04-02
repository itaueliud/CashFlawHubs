# OTP BYPASS - Development Mode

## ✅ Changes Made

Modified `backend/src/controllers/authController.js` to bypass OTP verification when `NODE_ENV=development`

### What Changed:

1. **sendOTP endpoint**: In development mode, it returns success without requiring Redis or sending SMS
2. **register endpoint**: In development mode, it skips OTP verification completely

### How to Use:

#### For Registration (NEW USERS):
1. Go to registration page
2. Fill in:
   - Name: anything
   - Phone: any valid format (e.g., +254722000000)
   - Country: select any
   - Password: create a password
   - OTP: **type ANY 6 digits** (e.g., 123456)
3. Click Register ✅

#### For Login (EXISTING USERS):
Use the seeded test accounts:
- **Admin:** `+254700000000` / `Admin@1234`
- **Test User:** `+254711111111` / `Test@1234`

## 🚀 Next Steps

1. **Run the seed script** (if not done yet):
   ```cmd
   cd c:\Users\SecurityManager\Desktop\earnhub\backend
   node scripts\seed.js
   ```

2. **Restart the backend** to apply changes:
   - Close the backend terminal
   - Run: `npm run dev` in backend folder

3. **Access the app**:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## ⚠️ Important Notes

- This bypass ONLY works in development mode (NODE_ENV=development)
- In production, OTP verification will still be required
- To enable full OTP functionality later, install Redis

## 🔄 To Revert This Change

If you want to restore OTP requirement, change `NODE_ENV` to `production` in `.env` file.
Or install Redis and the OTP system will work normally.
