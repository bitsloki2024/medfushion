# CosmoSentinel — Deployment Guide

Deploy in ~1.5 hours. Backend → Railway. Frontend → Vercel.

---

## Step 1 — Push to GitHub (5 min)

```bash
cd /Users/shrutianubolu/Desktop/medfushion
git init        # skip if already a git repo
git add .
git commit -m "prepare for deployment"
```

Create a new repo at https://github.com/new (name it `cosmosentinel` or similar),
then push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/cosmosentinel.git
git push -u origin main
```

---

## Step 2 — Deploy Backend to Railway (15 min)

1. Go to https://railway.app → sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your repo → select the **`backend/`** folder as the root directory
   - In Railway settings: **Root Directory** = `backend`
4. Railway auto-detects Python via `requirements.txt`
5. The `Procfile` tells Railway how to start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Add environment variables in Railway dashboard (Variables tab):**
```
GROQ_API_KEY=gsk_your_key_here        ← optional, for richer Cosmo responses
```

6. Click **Deploy** — Railway builds and starts the backend
7. After deploy: copy your backend URL, e.g. `https://cosmosentinel-backend.up.railway.app`
8. Test it: visit `https://your-backend.up.railway.app/health` — should return JSON

---

## Step 3 — Deploy Frontend to Vercel (10 min)

1. Go to https://vercel.com → sign up with GitHub
2. Click **Add New → Project** → Import your GitHub repo
3. Set **Root Directory** = `frontend`
4. In **Environment Variables**, add:
   ```
   NEXT_PUBLIC_API_URL = https://your-backend.up.railway.app
   ```
   (use the Railway URL from Step 2)
5. Click **Deploy**
6. Vercel builds Next.js and gives you a URL like `https://cosmosentinel.vercel.app`

---

## Step 4 — Verify (10 min)

1. Open your Vercel URL
2. Globe loads with heatmap data ✓
3. Click a country → panel opens ✓
4. Click **AI Chatbot** tab → Cosmo responds ✓
5. Type "show me Japan" → globe flies to Japan ✓
6. Type "switch to dengue" → disease switches ✓

---

## Troubleshooting

**Globe shows but no data (all zeros):**
- The backend URL is wrong in Vercel env vars
- Check `NEXT_PUBLIC_API_URL` is set correctly (no trailing slash)

**Backend crashes on Railway:**
- Check Railway logs → likely a missing package
- Run `pip install -r requirements.txt` locally to verify

**"cors" errors in browser:**
- Backend CORS is already set to `allow_origins=["*"]` so this shouldn't happen
- If it does: check the backend URL is HTTPS, not HTTP

**Cosmo gives generic responses (no data):**
- This is fine — it means backend data sources are unreachable
- Add `GROQ_API_KEY` to Railway env vars for better fallback responses

---

## Local Development (unchanged)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Frontend at http://localhost:3000, backend at http://localhost:8000.
The `.env.local` file already points the frontend to localhost:8000.
