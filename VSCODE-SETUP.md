# VS Code Terminal Setup Guide

## 🖥️ Run EarnHub in VS Code Split Terminals

Follow these steps to run everything in VS Code:

---

## **Step 1: Open VS Code Integrated Terminal**

1. Open VS Code in the earnhub folder
2. Press **`` Ctrl + ` ``** (backtick) to open terminal
3. Or go to: **Terminal → New Terminal**

---

## **Step 2: Split Terminal (3 Panes)**

1. Click the **Split Terminal** button (icon with two rectangles)
2. Or press **Ctrl + Shift + 5**
3. Split again to have 3 terminal panes

You should now have 3 terminal panes side by side.

---

## **Step 3: Run Commands in Each Pane**

### **Terminal 1 (Left) - Seed Database:**

```bash
cd backend
node scripts/seed.js
```

Wait for:
- ✅ Admin user created
- ✅ Test user created
- ✅ Daily challenges seeded

---

### **Terminal 2 (Middle) - Backend Server:**

```bash
cd backend
npm run dev
```

Wait for:
- ✅ EarnHub server running on port 5000
- ✅ MongoDB connected

Leave this running ⚠️

---

### **Terminal 3 (Right) - Frontend Server:**

```bash
cd frontend
npm run dev
```

Wait for:
- ✅ Ready on http://localhost:3000

Leave this running ⚠️

---

## **Step 4: Open Browser**

Go to: **http://localhost:3000**

---

## **👤 Login:**

**Phone:** `+254711111111`  
**Password:** `Test@1234`

---

## **🎨 Alternative: Use VS Code Tasks**

Instead of manual commands, you can press:
- **Ctrl + Shift + P**
- Type: "Tasks: Run Task"
- Select the task you want to run

---

## **⚡ Quick Copy Commands:**

**Seed:**
```
cd backend && node scripts/seed.js
```

**Backend:**
```
cd backend && npm run dev
```

**Frontend:**
```
cd frontend && npm run dev
```

---

## **🛑 To Stop Servers:**

In each terminal, press: **Ctrl + C**

---

## **🔄 To Restart:**

1. Press **Ctrl + C** in backend terminal
2. Press **Ctrl + C** in frontend terminal
3. Run the commands again (use Up Arrow to recall)
