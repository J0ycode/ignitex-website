# igniteX — Hackathon Registration Website

> "Ideas are the pulses of progress" · 28th & 29th

A cinematic, production-grade hackathon registration site built with **React + Vite + Tailwind CSS + Framer Motion** on the frontend and **Firebase** (Auth + Firestore + Analytics) on the backend.

---

## 🔥 Features

- **Animated hero** with particle canvas, heartbeat SVG line, and ember glow effects
- **Smart countdown** — switches automatically between registration opening, closing, and event start countdowns
- **Multi-step registration** (Auth → Team Details → Review & Submit)
- **Atomic 20-team cap** enforced via Firestore Transaction (race-condition safe)
- **Server-side time gate** enforced by Firestore Security Rules
- **Real-time slot counter** via Firestore `onSnapshot`
- **Gate screens** for: before open, registration full, closed
- **Firebase Auth** — email/password + magic link
- **Dark ember/fire aesthetic** with glassmorphism and micro-animations

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd ignitex
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# The .env already has the Firebase config — no changes needed for development
```

### 3. Run development server

```bash
npm run dev
```

---

## 🔧 Firebase Setup

### Enable Authentication
1. Go to [Firebase Console](https://console.firebase.google.com) → **ignitex-ideathon**
2. **Authentication → Sign-in Methods**:
   - Enable **Email/Password**
   - Enable **Email link (passwordless sign-in)**
3. Add your domain to **Authorized Domains** (e.g. `localhost`, your Vercel URL)

### Set up Firestore
1. **Firestore Database → Create database** → Start in **production mode**
2. **Firestore → Rules** → Paste contents of [`firestore.rules`](./firestore.rules)
3. Click **Publish**

### Initialize the counter document
In Firebase Console → **Firestore → meta → stats**, create a document with:
```json
{ "teamCount": 0 }
```
Or run this once in your browser console after the app loads:
```javascript
import { doc, setDoc } from 'firebase/firestore'
import { db } from './src/lib/firebaseClient'
await setDoc(doc(db, 'meta', 'stats'), { teamCount: 0 })
```

### (Optional) Server Time Sync
For accurate server-side clock drift correction, create a Cloud Function that writes:
```javascript
// functions/index.js
exports.updateServerTime = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  await admin.firestore().doc('meta/serverTime').set({
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  })
})
```
Without this, the app uses client time with a fallback (acceptable for most hackathons).

---

## 📁 Project Structure

```
ignitex/
├── src/
│   ├── components/
│   │   ├── steps/
│   │   │   ├── StepAuth.tsx         # Firebase Auth (signup/login/magic link)
│   │   │   ├── StepTeamDetails.tsx  # Team + members form (Zod validation)
│   │   │   └── StepReview.tsx       # Review + Firestore Transaction submit
│   │   ├── ui/
│   │   │   └── ProgressBar.tsx
│   │   ├── Hero.tsx                 # Particle canvas + heartbeat SVG
│   │   ├── Countdown.tsx            # Animated flip countdown
│   │   ├── About.tsx                # Stats + timeline
│   │   ├── Tracks.tsx               # Configurable domain tracks
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── RegisterPage.tsx         # Gate screens + multi-step flow
│   │   └── ConfirmationPage.tsx     # Post-registration success
│   ├── hooks/
│   │   ├── useRegistrationStatus.ts # Firestore onSnapshot + server time
│   │   └── useCountdown.ts
│   ├── lib/
│   │   ├── firebaseClient.ts        # Firebase singleton + types
│   │   └── registrationStatus.ts   # Status logic + Firestore helpers
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── firestore.rules                  # Security Rules
├── .env.example
└── tailwind.config.js
```

---

## 🌐 Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard (copy from `.env.example`).

---

## ⚙️ Customizing Tracks

Edit the `TRACKS` array in [`src/components/Tracks.tsx`](./src/components/Tracks.tsx) to change domains, descriptions, and tags.

## ⚙️ Adjusting Registration Dates

Edit `getRegistrationDates()` in [`src/lib/registrationStatus.ts`](./src/lib/registrationStatus.ts) to change the registration window or event dates.

Update the timestamps in [`firestore.rules`](./firestore.rules) to match.

---

## 🔒 Security Architecture

| Layer | Mechanism |
|-------|-----------|
| **Capacity (20 teams)** | Firestore Transaction reads counter doc and writes atomically — race-condition safe |
| **Time window** | Firestore Security Rules enforce `request.time` server-side |
| **Auth** | Firebase Auth — only signed-in users can create teams |
| **Leader ownership** | Rules check `request.auth.uid == request.resource.data.leaderId` |
| **Client validation** | Zod schema on all form fields |
