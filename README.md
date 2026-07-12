# 🧸 CozyCanvas — Shared Drawing for Couples

CozyCanvas is an intimate, real-time collaborative scrapbook drawing canvas web application designed specifically for couples. Featuring a premium dark-mode glassmorphic interface with floating ambient background elements, the application allows couples to doodle, chat, and share creative moments synchronously from anywhere in the world.

---

## ✨ Features

-  **Real-Time Drawing**: Smooth, lag-free local drawing lines utilizing a dynamic 2D canvas, synchronized instantly to Firestore.
-  **Live Partner Cursors**: Track your partner's cursor position in real-time with names, color highlights, and brush drawing states.
-  **Cozy Chat Sidebar**: A collapsible chat drawer built right into the viewport to send sweet notes with unread message notifications.
-  **Intimate Couples Presence**: Heartbeat-based presence system that automatically limits room capacity to **exactly 2 active users** at a time.
-  **Eraser & Undo**: Pen and Eraser tool switcher featuring instant local erasing feedback (`destination-out`) and stroke undoing/clearing with custom confetti.
-  **Web Configurator**: Connect your own Firebase Firestore database instantly using the on-screen configuration form (saved securely in localStorage).
-  **Admin Dashboard**: Inspect active collaborative rooms, view creation timestamps, and perform cleanups of inactive sessions.

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

```
