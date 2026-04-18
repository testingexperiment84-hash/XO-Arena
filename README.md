# ✕ XO Arena

> A polished, feature-rich Tic Tac Toe experience built with React, TypeScript, and Firebase.

XO Arena takes the classic game to the next level — variable grid sizes, strategic power-ups, an AI opponent, a global leaderboard, full player customization, and four distinct visual themes. Whether you're playing solo or challenging a friend, every match feels fresh.

---

## ✨ Features

### 🎮 Gameplay
- **Three grid sizes** — 3×3, 4×4, or 5×5 boards with win-length scaling automatically
- **Two game modes** — Play against the AI or go head-to-head with a local friend (2-Player)
- **AI difficulty levels** — Easy, Medium, and Hard (center/corner strategy + win/block logic)
- **Timer mode** — Optional 10-second per-turn countdown to keep things tense
- **Undo** — Step back your last move (or last two in AI mode)
- **Move history** — Full game state tracked across every turn

### ⚡ Power-Ups
Each player starts with one of each power-up per game:

| Power-Up | Effect |
|---|---|
| 🧹 **Remove** | Erase one of your opponent's placed marks |
| 🛡️ **Block** | Place an impassable shield tile on any empty cell |
| ⚡ **Double Move** | Place two marks in a single turn |

### 🎨 Customization
- **Player names** — Rename both players freely
- **Player colors** — Full color picker for each player's mark color
- **Icons** — Choose from 10 built-in Lucide icons (X, Circle, Star, Ghost, Crown, and more)
- **Custom avatars** — Upload any image file to use as your player icon
- **4 visual themes** — `modern`, `neon`, `brutalist`, `minimalist`

### 🏆 Leaderboard
- Google Sign-In via Firebase Auth
- Win scores are saved to Firestore automatically after each victory
- Filterable by game mode (vs AI / 2 Player) and grid size (3×3, 4×4, 5×5)
- Top 10 global rankings displayed in-app

### 🔊 Polish
- Synthesized sound effects via the Web Audio API (place, power-up, win)
- Confetti burst on victory (`canvas-confetti`)
- Smooth animations throughout powered by `motion/react`
- Winning cells highlighted with a glowing ring

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS v4 |
| Animations | Motion (Framer Motion) |
| Icons | Lucide React |
| Auth & Database | Firebase v12 (Auth + Firestore) |
| Deployment | Vercel / Netlify |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Firebase](https://console.firebase.google.com/) project with **Authentication** (Google provider) and **Firestore** enabled

### 1. Clone the repo

```bash
git clone https://github.com/your-username/xo-arena.git
cd xo-arena
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

Copy the example env file and fill in your Firebase project credentials:

```bash
cp .env.example .env
```

Then update `firebase-applet-config.json` with your Firebase project's config object (available in your Firebase Console under **Project Settings → Your apps**):

```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_PROJECT.firebaseapp.com",
  "projectId": "YOUR_PROJECT_ID",
  "storageBucket": "YOUR_PROJECT.appspot.com",
  "messagingSenderId": "YOUR_SENDER_ID",
  "appId": "YOUR_APP_ID",
  "firestoreDatabaseId": "(default)"
}
```

### 4. Set up Firestore Rules

Deploy the included security rules to your Firebase project:

```bash
firebase deploy --only firestore:rules
```

Or paste the contents of `firestore.rules` directly in the Firebase Console under **Firestore → Rules**.

### 5. Run locally

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 📦 Build & Deploy

### Build for production

```bash
npm run build
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

The `vercel.json` config is already included — just connect your repo and deploy.

### Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

The `netlify.toml` config is already included. Connect your repo and Netlify handles the rest.

---

## 📁 Project Structure

```
xo-arena/
├── src/
│   ├── App.tsx          # Main game component (all game logic, UI, modals)
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles & theme definitions
├── firebase-applet-config.json   # Firebase project configuration
├── firebase-blueprint.json       # Firestore data schema reference
├── firestore.rules               # Firestore security rules
├── index.html
├── vite.config.ts
├── tsconfig.json
├── vercel.json
└── netlify.toml
```

---

## 🗺️ Roadmap

- [ ] Online multiplayer (real-time with Firestore)
- [ ] More grid sizes (6×6, 7×7)
- [ ] Animated theme transitions
- [ ] Match replay viewer
- [ ] Mobile PWA support

---

## 📄 License

MIT — feel free to fork, modify, and ship your own version.

---

<div align="center">
  Made with React, Firebase, and a healthy competitive spirit.
</div>
