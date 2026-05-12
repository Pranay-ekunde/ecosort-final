# EcoSort — AI-Powered Waste Classification

An advanced web platform that uses AI to classify household waste into recyclable, non-recyclable, and hazardous categories — with a gamified points and rewards system to incentivize responsible disposal habits.

---

## Features

- **AI Classification** — MobileNetV2-based waste classification via upload or webcam
- **Duplicate Detection** — Multi-layer anti-abuse system (pHash + CNN similarity)
- **Points & Tiers** — Earn points per classification, climb bronze → platinum
- **Coupon Marketplace** — Redeem points for discounts from real brands
- **Leaderboard** — Weekly and all-time rankings
- **Rate Limiting** — Per-user scan limits prevent gaming the system

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite, React Router, Chart.js, react-hot-toast |
| Backend | Node.js + Express, JWT auth, bcrypt, Multer |
| Database | MongoDB (Mongoose ODM) |
| AI Service | Python + Flask, TensorFlow/Keras (MobileNetV2) |
| Image Hashing | pHash (perceptual hash) + CNN feature vectors |

---

## Project Structure

```
ecosort/
├── backend/              # Express API (port 5000)
│   └── src/
│       ├── controllers/   # auth, scans, analytics, rewards, coupons, leaderboard, admin
│       ├── models/       # User, Scan, Reward, Coupon (index.js exports all)
│       ├── routes/       # Express route definitions
│       ├── middleware/    # JWT auth, file upload
│       ├── utils/        # pHash hashing
│       └── tests/        # Jest test suites
├── ai-service/            # Flask ML service (port 8000)
│   └── models/           # best_model.keras
└── frontend/              # React SPA (port 5173)
    └── src/
        ├── api/client.js # Axios + all API endpoints
        ├── context/      # AuthContext
        └── pages/        # All page components
```

---

## Quick Start

### 1. Backend (Terminal 1)

```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### 2. AI Service (Terminal 2)

```bash
cd ai-service
pip install -r requirements.txt
python app.py
# Runs on http://localhost:8000
```

### 3. Frontend (Terminal 3)

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```


## API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account (+50 welcome points) |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/change-password` | Change password |

### Scans

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scans/classify` | Upload image, get AI classification |
| GET | `/api/scans` | Paginated scan history |
| GET | `/api/scans/recent` | Last 10 scans |
| GET | `/api/scans/limits` | Current rate limit status |
| DELETE | `/api/scans/:id` | Delete a scan |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | User's total scans, points, breakdown |
| GET | `/api/analytics/monthly` | Monthly scan counts by category |
| GET | `/api/analytics/global` | Platform-wide stats |

### Rewards & Coupons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rewards/balance` | Points balance + tier progress |
| GET | `/api/rewards` | Transaction history |
| GET | `/api/coupons/catalogue` | Available coupons |
| POST | `/api/coupons/redeem` | Redeem points for a coupon |
| GET | `/api/coupons/my` | User's redeemed coupons |
| POST | `/api/coupons/use/:code` | Mark coupon as used |

### Leaderboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard` | All-time top users + your rank |
| GET | `/api/leaderboard/weekly` | This week's top users |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform stats |
| GET | `/api/admin/users` | User list (paginated) |
| PUT | `/api/admin/users/:id/ban` | Ban a user |
| PUT | `/api/admin/users/:id/unban` | Unban a user |
| POST | `/api/admin/users/:id/award-points` | Manual points award |
| GET | `/api/admin/scans` | All scans |
| DELETE | `/api/admin/scans/:id` | Delete a scan |

### AI Service (internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health + model status |
| POST | `/predict` | Single image classification |
| POST | `/features/extract` | Extract CNN feature vector |
| POST | `/features/similarity` | Compare two images |

---

## Points System

| Action | Points |
|--------|--------|
| Register (welcome bonus) | +50 |
| Scan Recyclable | +10 |
| Scan Non-Recyclable | +5 |
| Scan Hazardous | +15 |
| 10-scan milestone | +50 |
| 50-scan milestone | +100 |
| 100-scan milestone | +200 |
| Duplicate image | 0 |

## Tier Thresholds

| Tier | Points Required |
|------|----------------|
| Bronze | 0–499 |
| Silver | 500–1,999 |
| Gold | 2,000–4,999 |
| Platinum | 5,000+ |

---

## Anti-Abuse System

- **Rate limits**: 30 scans/hour, 100 scans/day per user
- **Cooldown**: 10 seconds between scans
- **Duplicate detection**:
  - pHash: Hamming distance ≤ 10
  - CNN features: cosine similarity > 0.85
  - Scope: per-user (last 50) + global (last 24h)
- **Fallback**: If AI service is unreachable, returns a mock prediction so the experience never breaks

---

## Running Tests

```bash
cd backend
npm test
```

---

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | `npm run build`, upload `dist/` |
| Backend | Railway / Render | Set env vars in dashboard |
| AI Service | Render / Azure | Needs more RAM for TensorFlow |
| Database | MongoDB Atlas | Already hosted, whitelist deploy IPs |
