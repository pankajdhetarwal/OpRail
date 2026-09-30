# 🚂 OpRail — Railway.app Deployment Guide

> **Time Estimate:** ~20-30 minutes | **Cost:** Free ($5 trial credit, no card needed)

---

## Step 1: Sign Up on Railway (~2 min)

1. Go to **[railway.app](https://railway.app)**
2. Click **"Login"** → **"Login with GitHub"**
3. Authorize Railway to access your GitHub account
4. You'll get **$5 free trial credit** — enough for weeks of usage

> [!NOTE]
> No credit card required! The $5 trial credit is given automatically on GitHub signup.

---

## Step 2: Push Your Code to GitHub (~5 min)

Your project needs to be on GitHub for Railway to deploy it.

```powershell
cd "C:\Users\panka\OneDrive\Desktop\SIH PROJECT\railway-block-planner"

# Make sure .env is NOT committed (it's in .gitignore ✓)
git add .
git commit -m "Add deployment config (Dockerfile + Railway)"
git remote add origin https://github.com/YOUR_USERNAME/oprail.git
git push -u origin main
```

> [!CAUTION]
> Before pushing, make sure your `.env` file with the Gemini API key is NOT being tracked:
> ```powershell
> git status
> ```
> If `.env` shows up, run: `git rm --cached .env` then commit again.

---

## Step 3: Create a New Project on Railway (~2 min)

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **"+ New Project"**
3. Select **"Deploy from GitHub Repo"**
4. Find and select your **oprail** repository
5. Railway will detect the `Dockerfile` automatically ✓

---

## Step 4: Add PostgreSQL Database (~1 min)

1. In your Railway project dashboard, click **"+ New"** (top right)
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will create a PostgreSQL instance and automatically set the `DATABASE_URL` environment variable

> [!IMPORTANT]
> Railway auto-injects `DATABASE_URL` into your app's environment. The format uses `postgresql://` which our code handles correctly ✓

---

## Step 5: Set Environment Variables (~2 min)

1. Click on your **app service** (not the database) in the Railway dashboard
2. Go to the **"Variables"** tab
3. Click **"+ New Variable"** and add these one by one:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key |
| `SECRET_KEY` | Any random string (e.g., `oprail-prod-2026-sih`) |
| `ENVIRONMENT` | `production` |
| `SEVERITY_WEIGHT` | `0.40` |
| `OVERDUE_WEIGHT` | `0.30` |
| `TRAIN_DENSITY_WEIGHT` | `0.15` |
| `ASSET_CRITICALITY_WEIGHT` | `0.15` |
| `PORT` | `8080` |

> [!TIP]
> You can also click **"RAW Editor"** and paste all variables at once:
> ```
> GEMINI_API_KEY=your_key_here
> SECRET_KEY=oprail-prod-2026-sih
> ENVIRONMENT=production
> SEVERITY_WEIGHT=0.40
> OVERDUE_WEIGHT=0.30
> TRAIN_DENSITY_WEIGHT=0.15
> ASSET_CRITICALITY_WEIGHT=0.15
> PORT=8080
> ```

---

## Step 6: Configure the Service (~1 min)

1. Click on your **app service**
2. Go to **"Settings"** tab
3. Under **"Networking"** → Click **"Generate Domain"**
   - This gives you a public URL like `oprail-production.up.railway.app`

---

## Step 7: Deploy! (~5-10 min)

Railway auto-deploys when you push to GitHub. If it hasn't started:

1. Go to the **"Deployments"** tab
2. Click **"Deploy"** or **"Redeploy"**

Watch the build logs — you should see:
```
Step 1/15 : FROM node:20-slim AS frontend-builder
...
Step 10/15 : FROM python:3.11-slim AS production
...
╔══════════════════════════════════════════════╗
║   OpRail — AI-Powered Block Planning System  ║
║   Starting production server...              ║
╚══════════════════════════════════════════════╝

→ Running database migrations...
✓ Database ready.
→ Starting Uvicorn on port 8080...
```

---

## Step 8: Verify Your Deployment (~1 min)

Open your Railway-generated URL in the browser:
```
https://oprail-production.up.railway.app
```

Check health:
```
https://oprail-production.up.railway.app/health
```

Check API docs:
```
https://oprail-production.up.railway.app/docs
```

🎉 **Your OpRail app is now live!**

---

## 🔧 Day-to-Day Workflow

### Redeploy after code changes:
```powershell
cd "C:\Users\panka\OneDrive\Desktop\SIH PROJECT\railway-block-planner"
git add .
git commit -m "Your change description"
git push
```
Railway auto-deploys on every push! ✨

### View logs:
- Railway Dashboard → Your Service → **"Deployments"** tab → Click latest deployment → View logs

### Connect to PostgreSQL directly:
- Railway Dashboard → PostgreSQL service → **"Connect"** tab → Copy connection string

---

## 🛠️ Troubleshooting

### Build fails on OR-Tools / XGBoost
These are large packages. Railway's build timeout is generous (20 min), but if it fails:
- Go to Settings → increase build timeout
- Or add `PIP_NO_CACHE_DIR=1` as an environment variable

### App crashes on startup
- Check **Deployment Logs** in the Railway dashboard
- Most common issue: missing environment variables

### Database connection refused
- Make sure the PostgreSQL service is running (green dot in dashboard)
- Check that `DATABASE_URL` appears in your app's Variables tab (Railway should auto-inject it)
- Verify the URL starts with `postgresql://` (our code auto-fixes `postgres://`)

### Need to reset the database
- Railway Dashboard → PostgreSQL service → **"Data"** tab → You can run SQL queries directly
- Or delete the PostgreSQL service and create a new one

---

## 💰 Cost Summary

| Resource | Cost |
|---|---|
| **Trial credit** | $5 free (no card needed) |
| **App runtime** | ~$0.01/hr when active |
| **PostgreSQL** | Included in trial |
| **Estimated monthly** | ~$3-5/month (or free within trial) |

> [!TIP]
> The $5 trial credit typically lasts **2-4 weeks** for a project like this, which is plenty for a hackathon demo!

---

*Built for Smart India Hackathon 2026 | PS-26027*
