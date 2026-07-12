# 🧸 CozyCanvas — Shared Drawing for Couples

CozyCanvas is an intimate, real-time collaborative scrapbook drawing canvas web application designed specifically for couples. Featuring a premium dark-mode glassmorphic interface with floating ambient background elements, the application allows couples to doodle, chat, and share creative moments synchronously from anywhere in the world.

---

## ✨ Features

- 🎨 **Real-Time Drawing**: Smooth, lag-free local drawing lines utilizing a dynamic 2D canvas, synchronized instantly to Firestore.
- 📍 **Live Partner Cursors**: Track your partner's cursor position in real-time with names, color highlights, and brush drawing states.
- 🧸 **Cozy Chat Sidebar**: A collapsible chat drawer built right into the viewport to send sweet notes with unread message notifications.
- 🔒 **Intimate Couples Presence**: Heartbeat-based presence system that automatically limits room capacity to **exactly 2 active users** at a time.
- 🧹 **Eraser & Undo**: Pen and Eraser tool switcher featuring instant local erasing feedback (`destination-out`) and stroke undoing/clearing with custom confetti.
- ⚙️ **Web Configurator**: Connect your own Firebase Firestore database instantly using the on-screen configuration form (saved securely in localStorage).
- 🛡️ **Admin Dashboard**: Inspect active collaborative rooms, view creation timestamps, and perform cleanups of inactive sessions.

---

## 🛠️ Tech Stack

- **Frontend Core**: React 19, Vite 8
- **Styling**: Tailwind CSS 4, Vanilla CSS (Custom Glassmorphism & Keyframes)
- **Database & Sync**: Firebase Firestore (Web SDK v12)
- **Icons**: Lucide React
- **Effects**: Canvas Confetti

---

## 📂 Project Structure

```text
cozy-canva/
├── .env.example         # Reference environment variables template
├── firestore.rules      # Firestore Security Rules (deploy these — see below)
├── index.html           # Entry HTML page (loads Inter & Quicksand fonts)
├── package.json         # Project scripts & dependencies configuration
├── vite.config.js       # Vite compilation configuration
├── public/              # Static public assets
└── src/
    ├── main.jsx         # App mounting point (wraps App in ErrorBoundary)
    ├── App.jsx          # Core app logic (routes, Firestore sync, canvas logic, UI)
    ├── ErrorBoundary.jsx # Catches runtime errors and shows a recovery screen
    └── index.css        # Core stylesheet (glassmorphism variables, animations, styles)
```

---

## 🚀 Getting Started (Developers)

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/rudranishad2006-max/cosy-canva.git
cd cosy-canva

# Install dependencies
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
```
The compiled, production-ready static assets will be located in the `dist/` directory.

---

## 🔥 Firebase Database Configuration

CozyCanvas operates completely on **Cloud Firestore**. To hook up your own backend:

### 1. Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and follow the steps.
3. In your project dashboard, click the **Web icon (`</>`)** to register a new Web App.
4. Copy the `firebaseConfig` credentials object.

### 2. Configure Environment Variables
Create a `.env` file in the root of the project:
```bash
cp .env.example .env
```
Fill in the credentials copied from the console:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
# Set your own admin secret; leave blank to disable the admin panel.
VITE_ADMIN_PASSCODE=
```

> **Security note:** `VITE_ADMIN_PASSCODE` is a convenience gate that runs in the browser — it is **not** real access control. Anyone can read client-side env values in a built app. The real protection for your data is the Firestore Security Rules below.

### 3. Create Firestore Database
1. In the Firebase console left menu, go to **Build** > **Firestore Database**.
2. Click **Create Database** and select your location.

### 4. Enable Anonymous Auth & Deploy Security Rules
The app signs in anonymously on load so that Firestore rules can require an authenticated session
instead of being open to the entire internet.

1. Go to **Build** > **Authentication** > **Sign-in method**, and **enable Anonymous**.
2. Deploy the rules shipped in [`firestore.rules`](./firestore.rules):
   ```bash
   firebase deploy --only firestore:rules
   ```
   (or paste the file's contents into the **Firestore > Rules** tab and **Publish**).

> ⚠️ **Do not run in "test mode" (`allow read, write: if true`) in production** — that lets anyone
> on the internet read, overwrite, or delete every room. The provided rules require
> `request.auth != null` and add basic shape/size validation. If Anonymous Auth is not enabled, the
> app logs a warning and continues to work under whatever rules you currently have (so nothing breaks
> during setup).

---

## 🏛️ Firestore Database Model

The database stores data using the following structure:

```text
rooms/ (Collection)
  ├── {roomCode}/ (Document)
  │     ├── clearedAt: timestamp
  │     ├── createdAt: timestamp
  │     │
  │     ├── presence/ (Subcollection)
  │     │     └── {userId}: { name, x, y, isDrawing, lastActive, activeColor, activeSize, activeTool, currentPoints }
  │     │
  │     ├── strokes/ (Subcollection)
  │     │     └── {strokeId}: { id, author, color, size, points, isEraser, timestamp }
  │     │
  │     └── messages/ (Subcollection)
  │           └── {msgId}: { id, sender, text, timestamp }
```
