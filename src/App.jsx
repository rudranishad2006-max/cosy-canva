import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  ChevronRight,
  Palette,
  Brush,
  Users,
  Check,
  Settings,
  Heart,
  HeartOff,
  LogOut,
  MessageSquare,
  Send,
  X,
  Eraser,
  Download,
  Smile,
  Sun,
  Moon,
  Square,
  Circle,
  UserPlus,
  UserX,
  Crown,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import EmojiPicker from 'emoji-picker-react';

// Firebase imports
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDoc,
  getDocs,
  serverTimestamp,
  where,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'firebase/firestore';

// Firebase Auth — username+password accounts (see src/auth.jsx)
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import LoginScreen from './auth.jsx';
import FriendsPanel from './friends.jsx';
import { emailToUsername } from './account.js';

// Cozy Room Code Wordlists
const ADJECTIVES = ['warm', 'cozy', 'gentle', 'soft', 'golden', 'misty', 'starry', 'dusky', 'amber', 'rosy', 'dreamy', 'silent', 'peaceful', 'sweet', 'blushing', 'velvet', 'tender', 'floral'];
const NOUNS = ['meadow', 'forest', 'river', 'glade', 'haven', 'cove', 'peak', 'garden', 'cottage', 'path', 'hearth', 'cloud', 'breeze', 'willow', 'nest', 'bower', 'valley', 'grove'];

const QUICK_REACTIONS = ['❤️', '😂', '👍', '✨'];

const DAILY_PROMPTS = [
  "Draw something that made you smile today",
  "Sketch your favorite childhood toy",
  "Draw a cozy little cabin in the woods",
  "Illustrate your dream breakfast",
  "Draw a tiny creature with a big personality",
  "Sketch a houseplant you wish you had",
  "Draw something that smells like autumn",
  "Illustrate a magical potion bottle",
  "Draw your perfect reading nook",
  "Sketch a friendly ghost doing chores",
  "Draw an animal wearing a tiny hat"
];

// Gentle "leave room for your person" nudges, shown on the paper while it's still sparse.
const COLLAB_HINTS = [
  "psst… leave a little corner for them",
  "psst… start it, they'll finish it",
  "psst… draw the sky, let them do the ground",
  "psst… add one thing and pass it back",
  "psst… your turn — they're watching"
];

const generateRoomCode = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}-${noun}-${num}`;
};

// Cozy Color Presets
const COLORS = [
  { name: 'Terracotta', hex: '#C85C50' },
  { name: 'Dusty Rose', hex: '#D4A59A' },
  { name: 'Sage Green', hex: '#8FA89B' },
  { name: 'Deep Navy', hex: '#2B3E50' },
  { name: 'Ochre Gold', hex: '#E09F67' },
  { name: 'Warm Charcoal', hex: '#3C3C3C' },
  { name: 'Lavender', hex: '#9B8EC4' },
  { name: 'Snow White', hex: '#FFFFFF' }
];

// Chat Label Colors
const CHAT_COLORS = ['#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#FBBF24', '#F87171'];
const getUserColor = (name) => {
  if (!name) return CHAT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length];
};

// Confetti triggers
const triggerJoinConfetti = () => {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.8 },
    colors: ['#D4A59A', '#8FA89B', '#E09F67', '#C85C50']
  });
};

const triggerHeartConfetti = () => {
  const duration = 1.5 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#C85C50', '#D4A59A']
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#C85C50', '#D4A59A']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
};

// Custom Hook: useThrottle
const useThrottle = (callback, delay) => {
  const latestCallback = useRef(callback);
  useEffect(() => {
    latestCallback.current = callback;
  }, [callback]);
  const lastCalled = useRef(0);
  const timeout = useRef(null);

  return useCallback((...args) => {
    const now = Date.now();
    const remaining = delay - (now - lastCalled.current);

    if (remaining <= 0) {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
      latestCallback.current(...args);
      lastCalled.current = now;
    } else if (!timeout.current) {
      timeout.current = setTimeout(() => {
        latestCallback.current(...args);
        lastCalled.current = Date.now();
        timeout.current = null;
      }, remaining);
    }
  }, [delay]);
};

// Parse raw Firebase config text/JSON
const parseFirebaseConfig = (text) => {
  try {
    const parsed = JSON.parse(text);
    if (parsed.apiKey && parsed.projectId) return parsed;
  } catch { /* not JSON — fall through to regex parsing */ }

  const apiKey = text.match(/apiKey:\s*["']([^"']+)["']/)?.[1];
  const authDomain = text.match(/authDomain:\s*["']([^"']+)["']/)?.[1];
  const projectId = text.match(/projectId:\s*["']([^"']+)["']/)?.[1];
  const storageBucket = text.match(/storageBucket:\s*["']([^"']+)["']/)?.[1];
  const messagingSenderId = text.match(/messagingSenderId:\s*["']([^"']+)["']/)?.[1];
  const appId = text.match(/appId:\s*["']([^"']+)["']/)?.[1];

  if (apiKey && projectId) {
    return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
  }
  return null;
};

// Cute ambient scene: paper grain + vignette (in CSS) plus a slow, quiet cast of
// drifting hearts, twinkling stars (evening) and soft clouds (day). Theme visibility
// and motion are handled in index.css; this just lays out the players.
const SCENE_HEARTS = [
  { left: '7%',  size: 22, dur: 23, delay: 0,   color: '#C85C50' },
  { left: '82%', size: 15, dur: 27, delay: 5,   color: '#D4A59A' },
  { left: '58%', size: 28, dur: 31, delay: 9,   color: '#E5A469' },
  { left: '30%', size: 14, dur: 25, delay: 2.5, color: '#D4A59A' },
  { left: '93%', size: 18, dur: 29, delay: 7,   color: '#C85C50' },
  { left: '44%', size: 12, dur: 21, delay: 13,  color: '#E5A469' }
];
const SCENE_STARS = [
  { left: '12%', top: '22%', size: 10, delay: 0 },
  { left: '24%', top: '12%', size: 7,  delay: 1.4 },
  { left: '68%', top: '18%', size: 8,  delay: 0.8 },
  { left: '80%', top: '34%', size: 6,  delay: 2.1 },
  { left: '48%', top: '9%',  size: 9,  delay: 1.1 },
  { left: '88%', top: '52%', size: 7,  delay: 3.0 },
  { left: '16%', top: '46%', size: 6,  delay: 2.6 },
  { left: '36%', top: '28%', size: 5,  delay: 1.8 }
];
const SCENE_CLOUDS = [
  { top: '16%', width: 150, dur: 46, delay: 0 },
  { top: '32%', width: 110, dur: 58, delay: 10 },
  { top: '11%', width: 90,  dur: 52, delay: 26 }
];

const HeartMark = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M12 21s-7.6-4.9-7.6-10.4A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.6 3.3C19.6 16.1 12 21 12 21z" />
  </svg>
);

const Atmosphere = () => (
  <div className="atmosphere" aria-hidden="true">
    <div className="celestial celestial-moon evening-only" />
    <div className="celestial celestial-sun day-only" />
    <div className="cozy-scene">
      {SCENE_STARS.map((s, i) => (
        <span key={`st${i}`} className="star evening-only"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
      {SCENE_CLOUDS.map((c, i) => (
        <span key={`cl${i}`} className="cloud day-only"
          style={{ top: c.top, width: c.width, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />
      ))}
      {SCENE_HEARTS.map((h, i) => (
        <span key={`ht${i}`} className="drift-heart"
          style={{ left: h.left, bottom: '4%', animationDuration: `${h.dur}s`, animationDelay: `${h.delay}s` }}>
          <HeartMark color={h.color} size={h.size} />
        </span>
      ))}
    </div>
  </div>
);

// Day / Evening theme toggle. Shows the mode you'll switch *to*.
const ThemeToggle = ({ theme, onToggle, className = '' }) => (
  <button
    onClick={onToggle}
    className={`p-2.5 bg-white/5 hover:bg-white/10 transition rounded-full border border-white/10 text-white/60 hover:text-white/80 cursor-pointer ${className}`}
    title={theme === 'day' ? 'Switch to evening' : 'Switch to day'}
    aria-label={theme === 'day' ? 'Switch to evening mode' : 'Switch to day mode'}
  >
    {theme === 'day' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
  </button>
);

export default function App() {
  // 1. Firebase Config Management
  // A Firebase WEB config is safe to ship publicly — it only identifies the project, not grants
  // access. Security is enforced by the deployed Firestore rules (require auth, see firestore.rules)
  // + Anonymous Auth. This default lets production builds (which have no .env) connect out of the box.
  // Local dev can override it via a .env file (VITE_FIREBASE_*) or the on-screen setup form.
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyD3nNWvrPdvqlZYmW30Q87qxKRdmjM7so8",
    authDomain: "cosy-canva.firebaseapp.com",
    projectId: "cosy-canva",
    storageBucket: "cosy-canva.firebasestorage.app",
    messagingSenderId: "164120165333",
    appId: "1:164120165333:web:990737ee463de97637db5c",
    measurementId: "G-W3DFQSD1GR"
  };

  const [firebaseConfig, setFirebaseConfig] = useState(() => {
    const saved = localStorage.getItem('cozy_canvas_db_config');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* invalid stored config — fall back to env/default */ }
    }
    if (import.meta.env.VITE_FIREBASE_API_KEY) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };
    }
    return DEFAULT_FIREBASE_CONFIG;
  });

  const [configInput, setConfigInput] = useState('');
  const [configError, setConfigError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Theme: 'evening' (warm dark, default) | 'day' (warm light). Persisted + reflected
  // onto <html data-theme> so all the theme CSS can key off it.
  const [theme, setTheme] = useState(() => localStorage.getItem('cozy_canvas_theme') || 'evening');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cozy_canvas_theme', theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'day' ? 'evening' : 'day')), []);

  // Initialize DB + Auth
  const { db, auth } = useMemo(() => {
    if (!firebaseConfig) return { db: null, auth: null };
    try {
      const apps = getApps();
      const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
      return { db: getFirestore(app), auth: getAuth(app) };
    } catch (e) {
      console.error('Firebase DB Init Error:', e);
      return { db: null, auth: null };
    }
  }, [firebaseConfig]);

  // Account session (username+password via src/auth.jsx). The username lives in the
  // synthetic email, so a session alone is enough to know who's drawing — no extra
  // profile read required before the app is usable.
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      // Ignore stray anonymous sessions from the pre-account era.
      setAuthUser(u && !u.isAnonymous ? u : null);
      setAuthReady(true);
    });
    return () => unsub();
  }, [auth]);
  const handleSignOut = () => {
    setRoomCode('');
    setSelectedMode(null);
    if (auth) signOut(auth).catch(() => {});
  };

  // 2. Room & Onboarding State
  const [selectedMode, setSelectedMode] = useState(null); // 'couple' | 'group'
  const [roomMaxParticipants, setRoomMaxParticipants] = useState(2);
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  });
  const [roomInput, setRoomInput] = useState('');
  // Identity comes from the account: the auth UID is the userId everywhere
  // (presence docs, friendships, room ownership), and the username doubles as
  // the display name — the old per-room nickname prompt is gone.
  const userId = authUser?.uid || '';
  const nickname = authUser ? emailToUsername(authUser.email) : '';

  // 3. Canvas State
  const canvasRef = useRef(null);
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [activeSize, setActiveSize] = useState(5);
  const [activeEraserSize, setActiveEraserSize] = useState(15);
  const [isDrawing, setIsDrawing] = useState(false);
  const cursorRef = useRef(null);
  const currentStrokePoints = useRef([]);

  // Ratio between the canvas's on-screen (CSS) size and its internal 1500px drawing
  // space. Brush/eraser sizes are in the 1500 space, so the cursor preview must be
  // scaled by this to match the thickness that actually gets drawn.
  const [canvasScale, setCanvasScale] = useState(1);
  const resizeObsRef = useRef(null);
  const attachCanvas = useCallback((node) => {
    canvasRef.current = node;
    if (resizeObsRef.current) {
      resizeObsRef.current.disconnect();
      resizeObsRef.current = null;
    }
    if (node) {
      const measure = () => {
        const w = node.getBoundingClientRect().width;
        if (w) setCanvasScale(w / 1500);
      };
      measure();
      resizeObsRef.current = new ResizeObserver(measure);
      resizeObsRef.current.observe(node);
    }
  }, []);

  // 4. Collaborative Sync States
  const [strokes, setStrokes] = useState([]);
  const [clearedAtTime, setClearedAtTime] = useState(0);
  const [presenceList, setPresenceList] = useState([]);
  const [presenceLoaded, setPresenceLoaded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTool, setActiveTool] = useState('pen'); // 'pen' | 'eraser' | 'shape'
  const [activeShape, setActiveShape] = useState('rect'); // 'rect' | 'ellipse'
  const [nudge, setNudge] = useState(null); // { from, at } — a partner's incoming "thinking of you"
  const [redoStack, setRedoStack] = useState([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // 4.05 Room ownership: whoever created the room hosts it — they can kick
  // (with a ban list), un-ban, and hand the keys to someone else.
  const [roomOwnerId, setRoomOwnerId] = useState(null);
  const [roomBanned, setRoomBanned] = useState([]);
  const [roomBannedNames, setRoomBannedNames] = useState({});
  const [showParticipants, setShowParticipants] = useState(false);
  const isRoomOwner = !!userId && roomOwnerId === userId;
  const isBannedHere = !!userId && roomBanned.includes(userId);

  // 4.06 Friends drawer + request badge
  const [showFriends, setShowFriends] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  // 4.07 Time-lapse replay
  const [isReplaying, setIsReplaying] = useState(false);
  const replayRafRef = useRef(null);

  // 4.1 Chat States
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [hidePrompt, setHidePrompt] = useState(() => {
    const hiddenDate = localStorage.getItem('cozy_canvas_prompt_hidden_date');
    const today = new Date().toISOString().split('T')[0];
    return hiddenDate === today;
  });
  const messagesEndRef = useRef(null);
  const messagesLoadedRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);

  // Grow the chat input with its content (up to a cap) so a long message stays fully
  // visible while typing instead of scrolling within one line.
  useEffect(() => {
    const el = messageInputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    }
  }, [messageInput, showChat]);

  // Handle escape key to close emoji picker
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && showEmojiPicker) {
        setShowEmojiPicker(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showEmojiPicker]);

  // 4.2 Admin Panel States
  const [isAdminMode, setIsAdminMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'true';
  });
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminPasscodeInput, setAdminPasscodeInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminRoomsList, setAdminRoomsList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // Synchronize URL query parameter with Room State
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (roomCode) {
      params.set('room', roomCode);
      window.history.replaceState(null, '', `?${params.toString()}`);
    } else {
      params.delete('room');
      const newQuery = params.toString();
      window.history.replaceState(null, '', newQuery ? `?${newQuery}` : window.location.pathname);
    }
  }, [roomCode]);

  // Reset presenceLoaded, presenceList, and messagesLoaded states when leaving the room
  const assignedColorRef = useRef(false);
  useEffect(() => {
    if (!roomCode) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setPresenceLoaded(false);
      setPresenceList([]);
      /* eslint-enable react-hooks/set-state-in-effect */
      messagesLoadedRef.current = false;
      assignedColorRef.current = false;
    }
  }, [roomCode]);

  // Auto-Color Assignment
  useEffect(() => {
    if (presenceLoaded && !assignedColorRef.current) {
      const usedColors = presenceList.map(p => p.activeColor);
      const availableColors = COLORS.filter(c => !usedColors.includes(c.hex));
      /* eslint-disable react-hooks/set-state-in-effect */
      if (availableColors.length > 0) {
        setActiveColor(availableColors[0].hex);
      } else {
        setActiveColor(COLORS[Math.floor(Math.random() * COLORS.length)].hex);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
      assignedColorRef.current = true;
    }
  }, [presenceLoaded, presenceList]);

  // DB Sync 1: Listen to Room clearedAt
  useEffect(() => {
    if (!db || !roomCode) return;
    const roomRef = doc(db, 'rooms', roomCode);

    const checkStreak = async () => {
      try {
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
          const data = snap.data();
          const today = new Date().toISOString().split('T')[0];
          const lastActiveDate = data.lastActiveDate || '';
          let currentStreak = data.streakCount || 0;
          
          if (lastActiveDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (lastActiveDate === yesterdayStr) {
              currentStreak += 1;
            } else {
              currentStreak = 1;
            }
            
            await updateDoc(roomRef, {
              lastActiveDate: today,
              streakCount: currentStreak
            });
          }
        }
      } catch { /* streak update is best-effort */ }
    };
    checkStreak();

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.clearedAt) {
          setClearedAtTime(data.clearedAt.toDate().getTime());
        } else {
          setClearedAtTime(0);
        }
        if (data.maxParticipants) {
          setRoomMaxParticipants(data.maxParticipants);
        } else {
          setRoomMaxParticipants(2);
        }
        if (data.streakCount) {
          setStreakCount(data.streakCount);
        }
        setRoomOwnerId(data.ownerId || null);
        setRoomBanned(data.banned || []);
        setRoomBannedNames(data.bannedNames || {});
      } else {
        // Init room doc — first person in (e.g. via an invite link to a room
        // that doesn't exist yet) becomes its owner.
        setDoc(roomRef, {
          createdAt: serverTimestamp(),
          maxParticipants: 2,
          lastActiveDate: new Date().toISOString().split('T')[0],
          streakCount: 1,
          ownerId: userId || null,
          ownerName: nickname || null,
          banned: []
        }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [db, roomCode, userId, nickname]);

  // DB Sync 2: Listen to Strokes
  useEffect(() => {
    if (!db || !roomCode) return;
    const strokesRef = collection(db, 'rooms', roomCode, 'strokes');
    const q = query(strokesRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setStrokes(list);
    });
    return () => unsubscribe();
  }, [db, roomCode]);

  // Sync ref for showChat and clear unreadCount when chat opens
  const showChatRef = useRef(showChat);
  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
    }
  }, [showChat]);

  // DB Sync 2.5: Listen to Chat Messages
  useEffect(() => {
    if (!db || !roomCode) return;
    const messagesRef = collection(db, 'rooms', roomCode, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMessages((prevMessages) => {
        if (!showChatRef.current && messagesLoadedRef.current) {
          const prevIds = new Set(prevMessages.map(m => m.id));
          const newPartnerMsgs = list.filter(m => !prevIds.has(m.id) && m.sender !== nickname);
          if (newPartnerMsgs.length > 0) {
            setUnreadCount((c) => c + newPartnerMsgs.length);
          }
        }
        return list;
      });
      messagesLoadedRef.current = true;
    });
    return () => unsubscribe();
  }, [db, roomCode, nickname]);

  // DB Sync 3: Filter visible strokes based on clearedAt
  const visibleStrokes = useMemo(() => {
    return strokes.filter(stroke => {
      if (!stroke.timestamp) return true; // optimistic updates (pending writes)
      return stroke.timestamp.toDate().getTime() > clearedAtTime;
    });
  }, [strokes, clearedAtTime]);

  useEffect(() => {
    if (visibleStrokes.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSavedIndicator(true);
      const timer = setTimeout(() => setShowSavedIndicator(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [visibleStrokes]);

  const activePresences = useMemo(() => {
    // Clock-based filter to drop stale presences; presenceList updates via heartbeats often
    // enough to keep this current.
    // eslint-disable-next-line react-hooks/purity
    return presenceList.filter(p => Date.now() - p.lastActive < 15000);
  }, [presenceList]);

  const activeOthersCount = activePresences.length;
  const isRoomFull = activeOthersCount >= roomMaxParticipants;

  // DB Sync 4: Presence & Heartbeat Listeners
  useEffect(() => {
    if (!db || !roomCode || !nickname || !userId || !presenceLoaded || isRoomFull || isBannedHere) return;

    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);

    // Create base presence doc (identity + liveness only). Tool settings are kept current by a
    // separate effect below so that changing color/size/tool does NOT tear down presence.
    const writePresence = async () => {
      try {
        await setDoc(presenceRef, {
          userId,
          name: nickname,
          x: null,
          y: null,
          isDrawing: false,
          currentPoints: [],
          lastActive: Date.now()
        }, { merge: true });
      } catch { /* best-effort presence write */ }
    };

    writePresence();

    // Heartbeat every 8s to keep presence alive
    const interval = setInterval(() => {
      updateDoc(presenceRef, { lastActive: Date.now() }).catch(() => {
        // Fallback if doc got deleted
        writePresence();
      });
    }, 8000);

    // Clean up presence on exit
    return () => {
      clearInterval(interval);
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [db, roomCode, nickname, userId, presenceLoaded, isRoomFull, isBannedHere]);

  // Sync active tool settings into presence WITHOUT re-running the heartbeat effect (which would
  // delete + recreate the doc and make the partner's cursor flicker). merge:true creates the doc
  // if the heartbeat hasn't written it yet.
  useEffect(() => {
    if (!db || !roomCode || !userId || !presenceLoaded || isRoomFull || isBannedHere) return;
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    setDoc(presenceRef, {
      userId,
      activeColor,
      activeSize,
      activeEraserSize,
      activeTool,
      activeShape,
      lastActive: Date.now()
    }, { merge: true }).catch(() => { /* heartbeat will (re)create the doc */ });
  }, [db, roomCode, userId, presenceLoaded, isRoomFull, isBannedHere, activeColor, activeSize, activeEraserSize, activeTool, activeShape]);

  // Global presence: a quiet heartbeat on users/{uid} so friends can see
  // whether you're offline, online, or in a room (and which one).
  useEffect(() => {
    if (!db || !userId || !nickname) return;
    const meRef = doc(db, 'users', userId);
    const write = () => {
      setDoc(meRef, {
        username: nickname,
        online: true,
        lastSeen: Date.now(),
        currentRoom: roomCode || null
      }, { merge: true }).catch(() => { /* enabled once firestore.rules is deployed */ });
    };
    write();
    const interval = setInterval(write, 25000);
    return () => {
      clearInterval(interval);
      // Best-effort "gone" marker on room change / logout / unmount.
      setDoc(meRef, { online: false, currentRoom: null, lastSeen: Date.now() }, { merge: true }).catch(() => {});
    };
  }, [db, userId, nickname, roomCode]);

  // Friend request badge — incoming pendings, visible even with the drawer closed.
  useEffect(() => {
    if (!db || !userId) return;
    const q = query(collection(db, 'friendships'), where('users', 'array-contains', userId));
    const unsub = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach(d => {
        const f = d.data();
        if (f.status === 'pending' && f.requestedBy !== userId) count++;
      });
      setFriendRequestCount(count);
    }, () => setFriendRequestCount(0));
    return () => unsub();
  }, [db, userId]);

  // DB Sync 5: Listen to Partner Presence
  useEffect(() => {
    if (!db || !roomCode || !userId) return;
    const presenceColl = collection(db, 'rooms', roomCode, 'presence');
    const unsubscribe = onSnapshot(presenceColl, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        // Identify our own doc by its ID (always the userId). The `userId` field can be
        // momentarily absent while writes race, and keying off it would make us count our
        // own doc as a partner — causing phantom cursors and false "room full".
        if (docSnap.id !== userId) {
          list.push({ ...docSnap.data(), userId: docSnap.id });
        }
      });
      setPresenceList(list);
      setPresenceLoaded(true);
    }, (error) => {
      console.error("Presence listen error:", error);
      setPresenceLoaded(true); // fallback to unblock
    });
    return () => unsubscribe();
  }, [db, roomCode, userId]);


  // Throttled Presence Writer for drawing / pointermove updates
  const updatePresenceCursor = useThrottle((x, y, drawing, points) => {
    if (!db || !roomCode || !userId || isBannedHere) return;
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    updateDoc(presenceRef, {
      x,
      y,
      isDrawing: drawing,
      currentPoints: points,
      activeTool,
      lastActive: Date.now()
    }).catch(() => {});
  }, 80);

  // Immediate presence update (no throttle, for pointerup/pointerleave)
  const updatePresenceCursorImmediate = (x, y, drawing, points) => {
    if (!db || !roomCode || !userId || isBannedHere) return;
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    updateDoc(presenceRef, {
      x,
      y,
      isDrawing: drawing,
      currentPoints: points,
      activeTool,
      lastActive: Date.now()
    }).catch(() => {});
  };

  // Send a nudge: bump a timestamp on our own presence doc. Partners watch this
  // field and greet a new value with a heart burst + a little "thinking of you" toast.
  const seenNudgesRef = useRef({});
  const sendNudge = useCallback(() => {
    if (!db || !roomCode || !userId || isBannedHere) return;
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    updateDoc(presenceRef, { nudge: Date.now(), lastActive: Date.now() }).catch(() => {});
    triggerHeartConfetti(); // instant local feedback for the sender
  }, [db, roomCode, userId, isBannedHere]);

  useEffect(() => {
    activePresences.forEach(p => {
      if (!p.nudge) return;
      const seen = seenNudgesRef.current[p.userId];
      if (seen === undefined) {
        seenNudgesRef.current[p.userId] = p.nudge; // baseline; don't fire on first sight
      } else if (p.nudge > seen) {
        seenNudgesRef.current[p.userId] = p.nudge;
        setNudge({ from: p.name, at: Date.now() });
        triggerHeartConfetti();
      }
    });
  }, [activePresences]);

  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(null), 3200);
    return () => clearTimeout(t);
  }, [nudge]);

  // 4.9 Room host controls — only meaningful when isRoomOwner.
  const kickUser = (targetUid, targetName) => {
    if (!db || !roomCode || !isRoomOwner || targetUid === userId) return;
    const roomRef = doc(db, 'rooms', roomCode);
    updateDoc(roomRef, {
      banned: arrayUnion(targetUid),
      [`bannedNames.${targetUid}`]: targetName || 'someone'
    }).catch(() => {});
    deleteDoc(doc(db, 'rooms', roomCode, 'presence', targetUid)).catch(() => {});
  };

  const unbanUser = (targetUid) => {
    if (!db || !roomCode || !isRoomOwner) return;
    updateDoc(doc(db, 'rooms', roomCode), {
      banned: arrayRemove(targetUid),
      [`bannedNames.${targetUid}`]: deleteField()
    }).catch(() => {});
  };

  const promoteUser = (targetUid, targetName) => {
    if (!db || !roomCode || !isRoomOwner || targetUid === userId) return;
    if (!window.confirm(`Hand the room keys to ${targetName}? You'll stay in the room, they'll be its host.`)) return;
    updateDoc(doc(db, 'rooms', roomCode), {
      ownerId: targetUid,
      ownerName: targetName || 'someone'
    }).catch(() => {});
  };

  // 5. Canvas Drawing Engine
  const drawStroke = (ctx, stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;

    // Shapes (rectangle / ellipse): two anchor points, an outlined figure between them.
    if (stroke.type === 'shape') {
      const a = stroke.points[0];
      const b = stroke.points[stroke.points.length - 1];
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (stroke.shapeType === 'ellipse') {
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        ctx.ellipse(cx, cy, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      } else {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        const r = Math.min(24, w / 2, h / 2);
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
      ctx.stroke();
      return;
    }

    ctx.beginPath();

    // Support transparent erasing
    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.points.length < 3) {
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
    } else {
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }
      ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
    }
    ctx.stroke();

    // Reset composite operation to default
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all visible saved strokes
    visibleStrokes.forEach(stroke => {
      drawStroke(ctx, stroke);
    });

    // Draw all active strokes (in progress)
    activePresences.forEach(p => {
      if (p.isDrawing && p.currentPoints && p.currentPoints.length > 1) {
        if (p.activeTool === 'shape') {
          drawStroke(ctx, {
            type: 'shape',
            shapeType: p.activeShape || 'rect',
            color: p.activeColor || '#C85C50',
            size: p.activeSize || 5,
            points: p.currentPoints
          });
        } else {
          drawStroke(ctx, {
            color: p.activeColor || '#C85C50',
            size: p.activeTool === 'eraser' ? (p.activeEraserSize || 15) : (p.activeSize || 5),
            points: p.currentPoints,
            isEraser: p.activeTool === 'eraser'
          });
        }
      }
    });

    // Draw local active stroke (in progress)
    if (currentStrokePoints.current.length > 1) {
      if (activeTool === 'shape') {
        drawStroke(ctx, {
          type: 'shape',
          shapeType: activeShape,
          color: activeColor,
          size: activeSize,
          points: currentStrokePoints.current
        });
      } else {
        drawStroke(ctx, {
          color: activeColor,
          size: activeTool === 'eraser' ? activeEraserSize : activeSize,
          points: currentStrokePoints.current,
          isEraser: activeTool === 'eraser'
        });
      }
    }
  }, [visibleStrokes, activePresences, activeColor, activeSize, activeEraserSize, activeTool, activeShape]);

  // Redraw when strokes, partner status, or settings change — paused while a
  // time-lapse replay owns the canvas; when the replay ends this repaints.
  useEffect(() => {
    if (isReplaying) return;
    drawCanvas();
  }, [drawCanvas, isReplaying]);

  // 5.5 Time-lapse replay: redraw the room's story stroke-by-stroke, in the
  // order everyone drew it. Pen strokes grow point-by-point, shapes grow from
  // their anchor, erases replay too — so the finale matches the live canvas.
  const stopReplay = useCallback(() => {
    if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
    replayRafRef.current = null;
    setIsReplaying(false);
  }, []);

  const startReplay = () => {
    const canvas = canvasRef.current;
    if (!canvas || isReplaying || visibleStrokes.length === 0) return;
    const ctx = canvas.getContext('2d');
    const strokesToPlay = visibleStrokes;

    // Per-stroke time weighted by how much drawing it holds, capped so the
    // whole story lands in ~9 seconds.
    const durations = strokesToPlay.map(s =>
      s.type === 'shape' ? 320 : Math.max(140, Math.min(900, (s.points?.length || 1) * 14))
    );
    let total = durations.reduce((a, b) => a + b, 0);
    const squeeze = total > 9000 ? 9000 / total : 1;
    const starts = [];
    let acc = 0;
    for (const d of durations) {
      starts.push(acc);
      acc += d * squeeze;
    }
    total = acc;

    setIsReplaying(true);
    const t0 = performance.now();

    const tick = (now) => {
      const t = now - t0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < strokesToPlay.length; i++) {
        const dur = durations[i] * squeeze;
        if (t >= starts[i] + dur) {
          drawStroke(ctx, strokesToPlay[i]);
          continue;
        }
        if (t < starts[i]) break;
        const f = (t - starts[i]) / dur;
        const s = strokesToPlay[i];
        if (s.type === 'shape') {
          const a = s.points[0];
          const b = s.points[s.points.length - 1];
          drawStroke(ctx, { ...s, points: [a, { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }] });
        } else {
          drawStroke(ctx, { ...s, points: s.points.slice(0, Math.max(2, Math.ceil(s.points.length * f))) });
        }
        break;
      }
      if (t < total) {
        replayRafRef.current = requestAnimationFrame(tick);
      } else {
        replayRafRef.current = null;
        setIsReplaying(false);
      }
    };
    replayRafRef.current = requestAnimationFrame(tick);
  };

  // Never leave a dangling animation frame behind.
  useEffect(() => () => {
    if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
  }, []);

  // Listen to window resizing to keep the viewport bounds correct
  useEffect(() => {
    const handleResize = () => {
      drawCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // 6. Pointer Event Handlers
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const scaleX = 1500 / rect.width;
    const scaleY = 1500 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    currentStrokePoints.current = [{ x, y }];
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '1';
      cursorRef.current.style.left = `${(x / 1500) * 100}%`;
      cursorRef.current.style.top = `${(y / 1500) * 100}%`;
    }

    // Freehand/eraser lay down a starting dot; shapes rubber-band from the anchor instead.
    if (activeTool !== 'shape') {
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = activeColor;
      }
      ctx.arc(x, y, (activeTool === 'eraser' ? activeEraserSize : activeSize) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; // Reset
    }

    updatePresenceCursorImmediate(x, y, true, [{ x, y }]);
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = 1500 / rect.width;
    const scaleY = 1500 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '1';
      cursorRef.current.style.left = `${(x / 1500) * 100}%`;
      cursorRef.current.style.top = `${(y / 1500) * 100}%`;
    }

    if (isDrawing && activeTool === 'shape') {
      // Shape preview: keep only the anchor + current point, and redraw the whole
      // canvas so the rubber-banded figure follows the cursor.
      const start = currentStrokePoints.current[0] || { x, y };
      currentStrokePoints.current = [start, { x, y }];
      drawCanvas();
      updatePresenceCursor(x, y, true, currentStrokePoints.current);
    } else if (isDrawing) {
      const newPoint = { x, y };
      currentStrokePoints.current.push(newPoint);

      // Instantly draw line segment locally
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = activeColor;
      }
      ctx.lineWidth = activeTool === 'eraser' ? activeEraserSize : activeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const pts = currentStrokePoints.current;
      if (pts.length >= 3) {
        const p0 = pts[pts.length - 3];
        const p1 = pts[pts.length - 2];
        const p2 = pts[pts.length - 1];
        const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        ctx.moveTo(mid1.x, mid1.y);
        ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      } else if (pts.length === 2) {
        ctx.moveTo(pts[0].x, pts[0].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        ctx.lineTo(mid.x, mid.y);
      }
      
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; // Reset

      updatePresenceCursor(x, y, true, currentStrokePoints.current);
    } else {
      // Just moving cursor - update position
      updatePresenceCursor(x, y, false, []);
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const points = currentStrokePoints.current;
    currentStrokePoints.current = [];

    if (activeTool === 'shape' && points.length >= 2) {
      const a = points[0];
      const b = points[points.length - 1];
      // Ignore a tiny drag that was really just a tap.
      if (Math.hypot(b.x - a.x, b.y - a.y) > 6) {
        setRedoStack([]);
        const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const strokeRef = doc(db, 'rooms', roomCode, 'strokes', strokeId);
        setDoc(strokeRef, {
          id: strokeId,
          author: nickname,
          type: 'shape',
          shapeType: activeShape,
          color: activeColor,
          size: activeSize,
          points: [a, b],
          isEraser: false,
          timestamp: serverTimestamp()
        }).catch(err => console.error("Error saving stroke:", err));
      }
    } else if (activeTool !== 'shape' && points.length > 1) {
      // Clear redoStack on new stroke
      setRedoStack([]);

      const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const strokeRef = doc(db, 'rooms', roomCode, 'strokes', strokeId);

      // Save complete stroke
      setDoc(strokeRef, {
        id: strokeId,
        author: nickname,
        color: activeColor,
        size: activeTool === 'eraser' ? activeEraserSize : activeSize,
        points: points,
        isEraser: activeTool === 'eraser',
        timestamp: serverTimestamp()
      }).catch(err => console.error("Error saving stroke:", err));
    }

    // Clear cursor points on db immediately
    updatePresenceCursorImmediate(null, null, false, []);
    drawCanvas();
  };

  const handlePointerUp = (e) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    if (e.pointerType === 'touch' && cursorRef.current) {
      cursorRef.current.style.opacity = '0';
    }
    endDrawing();
  };

  const handlePointerLeave = (e) => {
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '0';
    }
    handlePointerUp(e);
  };

  const handleMessageInputChange = (e) => {
    setMessageInput(e.target.value);
    
    if (!db || !roomCode || !userId || isBannedHere) return;
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    
    updateDoc(presenceRef, { isChatTyping: true, lastActive: Date.now() }).catch(() => {});
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(presenceRef, { isChatTyping: false }).catch(() => {});
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!db || !roomCode || !nickname || !messageInput.trim()) return;

    const messageText = messageInput.trim();
    setMessageInput('');
    setShowEmojiPicker(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    updateDoc(presenceRef, { isChatTyping: false }).catch(() => {});

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const msgRef = doc(db, 'rooms', roomCode, 'messages', msgId);

    try {
      await setDoc(msgRef, {
        id: msgId,
        text: messageText,
        sender: nickname,
        timestamp: serverTimestamp(),
        reactions: {}
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleReaction = async (msgId, emoji) => {
    if (!db || !roomCode || !nickname) return;
    const msgRef = doc(db, 'rooms', roomCode, 'messages', msgId);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    
    const currentReactions = msg.reactions || {};
    const usersForEmoji = currentReactions[emoji] || [];
    
    let newUsers;
    if (usersForEmoji.includes(nickname)) {
      newUsers = usersForEmoji.filter(u => u !== nickname);
    } else {
      newUsers = [...usersForEmoji, nickname];
    }
    
    try {
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: newUsers
      });
    } catch (err) {
      console.error("Reaction failed", err);
    }
    setActiveReactionMsgId(null);
  };

  const handleInputBlur = () => {
    // Reset window scroll to 0,0 on mobile after keyboard collapses
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
  };

  // 7. Toolbar Operations
  const handleUndo = async () => {
    if (!db || !roomCode || !nickname) return;
    
    // Filter our own strokes in memory
    const myStrokes = visibleStrokes.filter(s => s.author === nickname);
    if (myStrokes.length > 0) {
      const lastStroke = myStrokes[myStrokes.length - 1];
      try {
        await deleteDoc(doc(db, 'rooms', roomCode, 'strokes', lastStroke.id));
        setRedoStack(prev => [...prev, lastStroke]);
      } catch (e) {
        console.error("Undo failed:", e);
      }
    }
  };

  const handleRedo = async () => {
    if (!db || !roomCode || redoStack.length === 0) return;
    
    const strokeToRestore = redoStack[redoStack.length - 1];
    try {
      const strokeRef = doc(db, 'rooms', roomCode, 'strokes', strokeToRestore.id);
      await setDoc(strokeRef, strokeToRestore);
      setRedoStack(prev => prev.slice(0, -1));
    } catch (e) {
      console.error("Redo failed:", e);
    }
  };

  const handleClear = async () => {
    if (!db || !roomCode) return;
    try {
      await updateDoc(doc(db, 'rooms', roomCode), {
        clearedAt: serverTimestamp()
      });
      setShowClearConfirm(false);
      setRedoStack([]);
      triggerHeartConfetti();
    } catch (e) {
      console.error("Clear failed:", e);
    }
  };

  // Keep latest undo/redo handlers in a ref so the global key listener attaches once, instead of
  // re-attaching on every render (this component re-renders on every stroke and cursor move).
  const keyHandlersRef = useRef({ handleUndo, handleRedo });
  useEffect(() => {
    keyHandlersRef.current = { handleUndo, handleRedo };
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          keyHandlersRef.current.handleRedo();
        } else {
          keyHandlersRef.current.handleUndo();
        }
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        keyHandlersRef.current.handleRedo();
        e.preventDefault();
      }

      if (!e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === 'b') setActiveTool('pen');
        if (e.key.toLowerCase() === 'e') setActiveTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleShareLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      triggerJoinConfetti();
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  const handleDownloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    
    // Fill warm background for the PNG
    ctx.fillStyle = '#FBF6EE';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the actual canvas on top
    ctx.drawImage(canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `CozyCanvas-${roomCode}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save config from input form
  const handleSaveConfig = (e) => {
    e.preventDefault();
    const config = parseFirebaseConfig(configInput);
    if (config) {
      localStorage.setItem('cozy_canvas_db_config', JSON.stringify(config));
      setFirebaseConfig(config);
      setConfigError('');
      setConfigInput('');
      window.location.reload();
    } else {
      setConfigError('Could not detect a valid Firebase Configuration. Please check the snippet.');
    }
  };

  // Join room submit
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    const cleanRoom = roomInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setRoomCode(cleanRoom);
    triggerJoinConfetti();
  };

  // Generate a room
  const handleCreateRoom = () => {
    const code = generateRoomCode();
    setRoomCode(code);
    
    // Explicitly init room doc immediately on creation so maxParticipants is
    // correct and the creator is recorded as the room's owner.
    if (db) {
      const roomRef = doc(db, 'rooms', code);
      setDoc(roomRef, {
        createdAt: serverTimestamp(),
        maxParticipants: selectedMode === 'group' ? 5 : 2,
        ownerId: userId,
        ownerName: nickname,
        banned: []
      }).catch(() => {});
    }

    triggerJoinConfetti();
  };

  // Admin authentication submit
  const handleAdminAuth = (e) => {
    e.preventDefault();
    const correctPasscode = import.meta.env.VITE_ADMIN_PASSCODE;
    if (correctPasscode && adminPasscodeInput === correctPasscode) {
      setAdminAuthenticated(true);
      setAdminError('');
      loadRoomsDirectly();
    } else if (!correctPasscode) {
      setAdminError('Admin access is not configured. Set VITE_ADMIN_PASSCODE in your environment.');
    } else {
      setAdminError('Invalid passcode. Access denied.');
    }
  };

  // Helper to load rooms
  const loadRoomsDirectly = async () => {
    if (!db) return;
    setAdminLoading(true);
    try {
      const roomsColl = collection(db, 'rooms');
      const snapshot = await getDocs(roomsColl);
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort by createdAt desc
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      setAdminRoomsList(list);
    } catch (err) {
      console.error("Failed to load rooms:", err);
      setAdminError('Failed to fetch rooms. Check Firestore security rules.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Deep deletion of a room and all its subcollections
  const handleAdminDeleteRoom = async (roomCode) => {
    if (!db || !window.confirm(`Are you sure you want to delete room "${roomCode}" and all its history?`)) return;
    setAdminLoading(true);
    try {
      // 1. Delete strokes subcollection
      const strokesColl = collection(db, 'rooms', roomCode, 'strokes');
      const strokesSnapshot = await getDocs(strokesColl);
      const strokeDeletes = strokesSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(strokeDeletes);

      // 2. Delete messages subcollection
      const messagesColl = collection(db, 'rooms', roomCode, 'messages');
      const messagesSnapshot = await getDocs(messagesColl);
      const messageDeletes = messagesSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(messageDeletes);

      // 3. Delete presence subcollection
      const presenceColl = collection(db, 'rooms', roomCode, 'presence');
      const presenceSnapshot = await getDocs(presenceColl);
      const presenceDeletes = presenceSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(presenceDeletes);

      // 4. Delete root room document
      const roomRef = doc(db, 'rooms', roomCode);
      await deleteDoc(roomRef);

      alert(`Room "${roomCode}" successfully deleted.`);
      loadRoomsDirectly();
    } catch (err) {
      console.error("Failed to delete room:", err);
      alert("Error deleting room: " + err.message);
      setAdminLoading(false);
    }
  };

  // Bypassing view: 
  // Screen A: Setup Firebase if no config exists
  if (!firebaseConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <Atmosphere />
        <div className="w-full max-w-lg glass-card-strong rounded-3xl p-8 flex flex-col items-center relative z-10 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400/20 to-amber-400/20 flex items-center justify-center mb-5">
            <Heart className="w-8 h-8 text-rose-400 fill-rose-400/30 animate-heart-glow" />
          </div>
          <h1 className="text-3xl font-bold gradient-text text-center mb-2 font-display">Welcome to CozyCanvas</h1>
          <p className="text-white/40 text-center text-sm mb-6">
            A real-time drawing board for you and your partner. Connect a Firebase Firestore database to begin.
          </p>
          <form onSubmit={handleSaveConfig} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/30">Firebase Config SDK Object</label>
              <textarea
                rows={7}
                value={configInput}
                onChange={(e) => setConfigInput(e.target.value)}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "...",\n  projectId: "...",\n  ...\n};`}
                className="w-full px-4 py-3 glass-input rounded-2xl text-xs font-mono transition"
              />
            </div>
            {configError && (
              <p className="text-xs text-rose-400 bg-rose-400/10 px-4 py-2.5 rounded-xl border border-rose-400/20">
                {configError}
              </p>
            )}
            <button
              type="submit"
              className="w-full btn-gradient py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 group cursor-pointer text-sm"
            >
              <span>Connect Database</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-white/5 w-full text-xs text-white/25 space-y-2">
            <p className="font-semibold text-white/35">Steps to configure:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open the <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-rose-400/80 underline hover:text-rose-400">Firebase Console</a>.</li>
              <li>Create a new project.</li>
              <li>Add a Web App under Project Settings to generate the Config code snippet.</li>
              <li>Enable <strong className="text-white/40">Cloud Firestore</strong> and set rules to allow read/write in testing mode.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Screen: Admin Panel Login/Dashboard
  if (isAdminMode) {
    if (!adminAuthenticated) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <Atmosphere />
          <div className="w-full max-w-sm glass-card-strong rounded-3xl p-8 flex flex-col items-center relative z-10 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <Settings className="w-7 h-7 text-white/40 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold text-white/90 tracking-tight mb-2 text-center font-display">Admin Panel</h2>
            <p className="text-white/35 text-sm mb-6 text-center">Enter admin passcode to manage CozyCanvas rooms.</p>
            <form onSubmit={handleAdminAuth} className="w-full space-y-4">
              <input
                type="password"
                value={adminPasscodeInput}
                onChange={(e) => setAdminPasscodeInput(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full px-4 py-3 glass-input rounded-2xl text-center text-sm transition"
              />
              {adminError && <p className="text-xs text-rose-400 text-center font-semibold">{adminError}</p>}
              <button
                type="submit"
                className="w-full btn-gradient py-3 px-6 rounded-2xl cursor-pointer text-sm"
              >
                Authenticate
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen p-6 md:p-12 flex flex-col items-center relative overflow-hidden">
        <Atmosphere />
        <div className="w-full max-w-4xl glass-card-strong rounded-3xl p-6 md:p-10 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-6 mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold gradient-text tracking-tight font-display">Admin Dashboard</h1>
              <p className="text-white/35 text-sm mt-1">Manage, inspect, and clean up active collaborative rooms.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadRoomsDirectly}
                className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/60 font-semibold text-xs rounded-xl transition cursor-pointer border border-white/5"
              >
                Refresh List
              </button>
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setAdminAuthenticated(false);
                  setAdminPasscodeInput('');
                  const params = new URLSearchParams(window.location.search);
                  params.delete('admin');
                  window.history.replaceState(null, '', params.toString() ? `?${params.toString()}` : window.location.pathname);
                }}
                className="py-2.5 px-4 bg-rose-400/10 hover:bg-rose-400/20 text-rose-400 font-semibold text-xs rounded-xl transition cursor-pointer border border-rose-400/10"
              >
                Exit Dashboard
              </button>
            </div>
          </div>

          {adminLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-rose-400/30 border-t-rose-400 rounded-full animate-spin mb-4"></div>
              <p className="text-white/35 text-sm">Loading rooms...</p>
            </div>
          ) : adminRoomsList.length === 0 ? (
            <div className="text-center py-12 text-white/25 text-sm">
              No active rooms found in database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs font-semibold text-white/25 uppercase tracking-wider">
                    <th className="py-3 px-4">Room Code</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminRoomsList.map((room) => (
                    <tr key={room.id} className="hover:bg-white/5 transition">
                      <td className="py-4 px-4 font-mono text-sm text-white/80 font-bold">{room.id}</td>
                      <td className="py-4 px-4 text-xs text-white/30 font-medium">
                        {room.createdAt?.toDate ? room.createdAt.toDate().toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-right flex justify-end gap-2">
                        <a
                          href={`/?room=${room.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-white/60 font-semibold text-xs rounded-lg transition"
                        >
                          View Room
                        </a>
                        <button
                          onClick={() => handleAdminDeleteRoom(room.id)}
                          className="py-1.5 px-3 bg-rose-400/10 hover:bg-rose-400/20 text-rose-400 font-semibold text-xs rounded-lg transition cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Screen A2: Account gate — a username (and password) instead of nicknames.
  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <Atmosphere />
        <div className="w-10 h-10 border-4 border-rose-400/30 border-t-rose-400 rounded-full animate-spin relative z-10" />
      </div>
    );
  }
  if (!authUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <Atmosphere />
        <ThemeToggle theme={theme} onToggle={toggleTheme} className="absolute top-6 right-6 z-20" />
        <div className="relative z-10 flex flex-col items-center mb-6">
          <h1 className="text-4xl font-extrabold gradient-text text-center tracking-tight font-display">CozyCanvas</h1>
          <p className="text-rose-300/80 text-center text-sm italic font-display mt-1">draw together, stay close</p>
        </div>
        <LoginScreen auth={auth} db={db} />
      </div>
    );
  }

  // Screen B: If DB configured but no room joined yet — Lobby
  if (!roomCode) {
    if (!selectedMode) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <Atmosphere />
          <button
            onClick={() => setShowFriends(v => !v)}
            className="absolute top-6 left-6 px-4 py-2.5 bg-white/5 hover:bg-white/10 transition rounded-full border border-white/5 cursor-pointer z-20 flex items-center gap-2 text-white/50 hover:text-white/80 text-xs font-semibold"
            title="Friends"
          >
            <UserPlus className="w-4 h-4" />
            Friends
            {friendRequestCount > 0 && (
              <span className="bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center" style={{ boxShadow: '0 0 8px rgba(244,63,94,0.5)' }}>
                {friendRequestCount}
              </span>
            )}
          </button>
          <ThemeToggle theme={theme} onToggle={toggleTheme} className="absolute top-6 right-20 z-20" />
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 transition rounded-full border border-white/5 cursor-pointer z-20"
            title="Account"
          >
            <Settings className="w-5 h-5 text-white/40" />
          </button>

          {showFriends && (
            <FriendsPanel
              db={db}
              uid={userId}
              username={nickname}
              onJoinRoom={(code) => { setShowFriends(false); setRoomCode(code); }}
              onClose={() => setShowFriends(false)}
            />
          )}

          {showSettings && (
            <div className="absolute top-20 right-6 z-50 w-64 glass-card-strong rounded-2xl p-4 animate-fade-in">
              <h3 className="text-sm font-bold text-white/70 mb-3">Signed in as <span className="text-rose-300/90">@{nickname}</span></h3>
              <button
                onClick={handleSignOut}
                className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-white/60 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-white/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}

          <div className="w-full max-w-2xl relative z-10 animate-fade-in flex flex-col items-center">
            {/* Glowing jar-of-hearts logo */}
            <div className="relative mb-6 flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full bg-rose-400/20 blur-2xl" />
              <svg width="72" height="92" viewBox="0 0 64 84" fill="none" className="relative animate-soft-pulse">
                <rect x="17" y="3" width="30" height="8" rx="3" fill="#E6D5B8" />
                <rect x="20" y="10" width="24" height="5" rx="2" fill="#D8C6A6" />
                <rect x="15" y="15" width="34" height="62" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <rect x="20" y="21" width="3.5" height="38" rx="1.75" fill="rgba(255,255,255,0.12)" />
                <path d="M32 56 C32 56 19 47 19 38 C19 32.5 23.5 30 27 32.5 C29 34 31 37 32 39.5 C33 37 35 34 37 32.5 C40.5 30 45 32.5 45 38 C45 47 32 56 32 56 Z" fill="#F43F5E" className="animate-heart-glow" />
              </svg>
            </div>

            <h1 className="text-5xl font-extrabold gradient-text text-center tracking-tight mb-3 font-display">CozyCanvas</h1>
            <p className="text-rose-300/80 text-center text-lg italic font-display mb-2">draw together, stay close</p>
            <p className="text-white/35 text-center text-sm mb-10 max-w-md mx-auto">
              Pick a room and pull up a chair — the paper's already taped down.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full items-stretch">
              {/* Couple Room Card */}
              <button
                onClick={() => setSelectedMode('couple')}
                className="glass-card-strong p-7 rounded-3xl flex flex-col items-start text-left border border-white/5 hover:border-rose-400/30 hover:-translate-y-1 hover:bg-white/[0.04] transition duration-300 group cursor-pointer relative"
              >
                <span className="absolute top-6 right-6 text-[9px] font-bold tracking-[0.14em] text-rose-300/70 border border-dashed border-rose-300/30 rounded-full px-2.5 py-1">JUST YOU TWO</span>
                <div className="w-12 h-12 rounded-2xl bg-rose-400/10 border border-rose-400/15 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                  <Heart className="w-6 h-6 text-rose-400 fill-rose-400/30" />
                </div>
                <h3 className="text-2xl font-bold text-white/90 mb-2 font-display tracking-tight">Couple Room</h3>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                  The classic CozyCanvas — one sheet of paper, two brushes, and a nightly prompt to keep your streak warm.
                </p>
                <span className="mt-auto btn-gradient text-white font-semibold text-sm rounded-xl px-5 py-2.5 flex items-center gap-1.5">
                  Open our room →
                </span>
              </button>

              {/* Group Room Card */}
              <button
                onClick={() => setSelectedMode('group')}
                className="glass-card-strong p-7 rounded-3xl flex flex-col items-start text-left border border-white/5 hover:border-amber-400/30 hover:-translate-y-1 hover:bg-white/[0.04] transition duration-300 group cursor-pointer relative"
              >
                <span className="absolute top-6 right-6 text-[9px] font-bold tracking-[0.14em] text-amber-300/70 border border-dashed border-amber-300/30 rounded-full px-2.5 py-1">UP TO 6 FRIENDS</span>
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/15 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                  <Users className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-white/90 mb-2 font-display tracking-tight">Invite the Group</h3>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                  Doodle and chat with up to five of your favorite people. Everyone gets a color, nobody gets the eraser.
                </p>
                <span className="mt-auto text-amber-300/90 font-semibold text-sm rounded-xl px-5 py-2.5 flex items-center gap-1.5 border border-amber-400/25 group-hover:bg-amber-400/10 transition">
                  Start a group canvas →
                </span>
              </button>
            </div>

            <p className="text-white/25 text-xs mt-8 text-center">
              made for late-night doodles <span className="text-rose-400/70">♥</span> drawing as <span className="text-white/40 font-semibold">@{nickname}</span>
            </p>
          </div>
        </div>
      );
    }

  return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <Atmosphere />

        <button
          onClick={() => setSelectedMode(null)}
          className="absolute top-6 left-6 px-4 py-2 bg-white/5 hover:bg-white/10 transition rounded-xl border border-white/5 cursor-pointer z-20 text-white/40 font-semibold text-xs flex items-center gap-2"
        >
          <X className="w-3.5 h-3.5" />
          Change Mode
        </button>

        <ThemeToggle theme={theme} onToggle={toggleTheme} className="absolute top-6 right-20 z-20" />
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 transition rounded-full border border-white/5 cursor-pointer z-20"
          title="Account"
        >
          <Settings className="w-5 h-5 text-white/40" />
        </button>

        {showSettings && (
          <div className="absolute top-20 right-6 z-50 w-64 glass-card-strong rounded-2xl p-4 animate-fade-in">
            <h3 className="text-sm font-bold text-white/70 mb-3">Signed in as <span className="text-rose-300/90">@{nickname}</span></h3>
            <button
              onClick={handleSignOut}
              className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-white/60 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-white/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}

        <div className="w-full max-w-md glass-card-strong rounded-3xl p-10 flex flex-col items-center relative z-10 animate-fade-in">
          {/* Glowing Mode Logo */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-400/20 to-amber-400/20 flex items-center justify-center mb-6 relative">
            {selectedMode === 'group' ? (
              <Users className="w-10 h-10 text-amber-400 animate-heart-glow" />
            ) : (
              <Heart className="w-10 h-10 text-rose-400 fill-rose-400/30 animate-heart-glow" />
            )}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-400/10 to-transparent blur-xl" />
          </div>

          <h1 className="text-4xl font-extrabold gradient-text text-center tracking-tight mb-2 font-display">CozyCanvas</h1>
          <p className="text-white/35 text-center text-sm mb-10">
            {selectedMode === 'group' ? 'Create a room to draw with friends.' : 'Create a shared canvas for you and your partner.'}
          </p>

          <div className="w-full space-y-6">
            <button
              onClick={handleCreateRoom}
              className="w-full btn-gradient py-4 px-6 rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer text-[15px]"
            >
              <Sparkles className="w-5 h-5" />
              Create New Canvas
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-[10px] font-semibold text-white/20 tracking-widest uppercase">Or Join Existing</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-3">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Enter room code (e.g. warm-meadow-42)"
                className="w-full px-4 py-3.5 glass-input rounded-2xl text-center text-sm transition"
              />
              <button
                type="submit"
                className="w-full bg-white/5 hover:bg-white/10 transition py-3 px-6 rounded-2xl text-white/70 font-semibold border border-white/10 text-sm cursor-pointer"
              >
                Join Room
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Screen: Wait for presence to load to check room capacity
  if (roomCode && !presenceLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <Atmosphere />
        <div className="w-full max-w-sm glass-card-strong rounded-3xl p-8 flex flex-col items-center relative z-10 animate-fade-in">
          <div className="w-10 h-10 border-4 border-rose-400/30 border-t-rose-400 rounded-full animate-spin mb-4"></div>
          <p className="text-white/40 text-sm font-semibold animate-pulse">Connecting to room...</p>
        </div>
      </div>
    );
  }

  // Screen: Room is Full
  if (roomCode && isRoomFull) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <Atmosphere />
        <div className="w-full max-w-md glass-card-strong rounded-3xl p-8 flex flex-col items-center text-center relative z-10 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-rose-400/10 flex items-center justify-center mb-6">
            <HeartOff className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-white/90 tracking-tight mb-2 font-display">Room is Full</h2>
          <p className="text-white/35 text-sm mb-6">
            This canvas is limited to {roomMaxParticipants} people. Ask them to start a new one!
          </p>
          <button
            onClick={() => { setRoomCode(''); setSelectedMode(null); }}
            className="w-full btn-gradient py-3 px-6 rounded-2xl cursor-pointer text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Screen C: Room joined but Nickname Onboarding is required
  // Screen C: You were removed from this room by its host.
  if (isBannedHere) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <Atmosphere />
        <div className="w-full max-w-md glass-card-strong rounded-3xl p-8 flex flex-col items-center text-center relative z-10 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-rose-400/10 flex items-center justify-center mb-6">
            <HeartOff className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-white/90 tracking-tight mb-2 font-display">Removed from room</h2>
          <p className="text-white/35 text-sm mb-6">
            The host of <span className="font-mono text-amber-300/80">{roomCode}</span> removed you. They can let you back in from their participants list.
          </p>
          <button
            onClick={() => { setRoomCode(''); setSelectedMode(null); }}
            className="w-full btn-gradient py-3 px-6 rounded-2xl cursor-pointer text-sm"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Screen D: Cozy Collaborative Drawing Canvas Screen
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">

      {/* Ambient Background Particles */}
      <Atmosphere />

      {/* Incoming nudge toast */}
      {nudge && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
          <div className="glass-card-strong rounded-full px-4 py-2 flex items-center gap-2 shadow-xl">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400/50 animate-heart-glow" />
            <span className="text-sm text-white/80">
              <span className="font-semibold text-white/90">{nudge.from || 'someone'}</span> is thinking of you
            </span>
          </div>
        </div>
      )}

      {/* 1. Header Area */}
      <header className="flex justify-between items-center px-5 py-3 glass-card border-0 border-b border-white/5 z-20 relative">
        {/* Left Side: Logo & Room details */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400/25 to-amber-400/25 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400/40" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-bold gradient-text tracking-tight font-display">CozyCanvas</h2>
              <span className="px-2 py-0.5 bg-amber-400/10 border border-amber-400/15 text-amber-400/70 rounded-full text-[9px] font-semibold font-mono tracking-tighter">
                {roomCode}
              </span>
              <span className="px-2 py-0.5 bg-white/10 text-white/60 rounded-full text-[9px] font-semibold uppercase tracking-wider">
                {roomMaxParticipants === 2 ? 'Couple' : 'Group'}
              </span>
              {streakCount > 0 && (
                <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-orange-400/20 text-orange-400 font-bold flex items-center gap-1" title="Current Streak">
                  🔥 {streakCount} {streakCount === 1 ? 'day' : 'days'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-white/25 leading-none">drawing as <span className="text-white/40 font-medium">{nickname}</span></p>
              <div className={`text-[9px] text-emerald-400/60 font-medium transition-opacity duration-500 ${showSavedIndicator ? 'opacity-100' : 'opacity-0'}`}>
                ✓ Saved
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Partner Presence indicator & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Presence: overlapping avatar stack — click for the participants list */}
          <div className="hidden sm:flex items-center gap-2.5 relative">
            <button
              onClick={() => setShowParticipants(v => !v)}
              className="flex items-center -space-x-2 cursor-pointer rounded-full px-0.5 py-0.5 hover:bg-white/5 transition"
              title="Who's here"
            >
              {/* You */}
              <span
                className="relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--avatar-ring)] bg-gradient-to-br from-rose-400 to-amber-400 lowercase"
              >
                {nickname.slice(0, 1) || '·'}
                {isRoomOwner && (
                  <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 text-amber-300 fill-amber-300/40" />
                )}
              </span>
              {/* Partners */}
              {activePresences.map(p => (
                <span
                  key={p.userId}
                  className="relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--avatar-ring)] lowercase"
                  style={{ backgroundColor: p.activeColor || '#C85C50' }}
                  title={p.name}
                >
                  {(p.name || '?').slice(0, 1)}
                  {p.userId === roomOwnerId && (
                    <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 text-amber-300 fill-amber-300/40" />
                  )}
                  {p.isDrawing && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[var(--avatar-ring)]" />
                  )}
                </span>
              ))}
              {/* Empty seat while waiting */}
              {activePresences.length === 0 && (
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white/35 ring-2 ring-[var(--avatar-ring)] border border-dashed border-white/25 bg-white/[0.03]">
                  +1
                </span>
              )}
            </button>
            {activePresences.length === 0 && (
              <span className="text-[11px] text-white/35 italic font-medium">
                {roomMaxParticipants === 2 ? 'waiting for your person…' : 'waiting for the group…'}
              </span>
            )}

            {/* Participants popover — the host sees kick / promote controls */}
            {showParticipants && (
              <div className="absolute top-10 right-0 z-50 w-64 glass-card-strong rounded-2xl p-3 animate-fade-in space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-1.5 pb-1">In this room</p>
                {[{ userId, name: nickname, activeColor: null, self: true }, ...activePresences].map(p => (
                  <div key={p.userId} className="flex items-center gap-2 px-1.5 py-1.5 rounded-xl hover:bg-white/[0.04]">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white lowercase shrink-0 ${p.self ? 'bg-gradient-to-br from-rose-400 to-amber-400' : ''}`}
                      style={p.self ? undefined : { backgroundColor: p.activeColor || '#C85C50' }}
                    >
                      {(p.name || '?').slice(0, 1)}
                    </span>
                    <span className="text-xs text-white/75 font-semibold truncate flex-grow">
                      {p.self ? `${p.name} (you)` : p.name}
                    </span>
                    {p.userId === roomOwnerId && (
                      <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" title="Room host" />
                    )}
                    {isRoomOwner && !p.self && (
                      <>
                        <button
                          onClick={() => promoteUser(p.userId, p.name)}
                          className="p-1.5 rounded-lg text-white/25 hover:bg-amber-400/15 hover:text-amber-300 transition cursor-pointer shrink-0"
                          title={`Make ${p.name} the host`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => kickUser(p.userId, p.name)}
                          className="p-1.5 rounded-lg text-white/25 hover:bg-rose-400/15 hover:text-rose-300 transition cursor-pointer shrink-0"
                          title={`Remove ${p.name} from the room`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {isRoomOwner && roomBanned.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-1.5 pt-2 pb-1">Removed</p>
                    {roomBanned.map(buid => (
                      <div key={buid} className="flex items-center gap-2 px-1.5 py-1.5 rounded-xl">
                        <span className="text-xs text-white/40 truncate flex-grow">{roomBannedNames[buid] || 'someone'}</span>
                        <button
                          onClick={() => unbanUser(buid)}
                          className="text-[10px] font-semibold text-emerald-300/80 hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-400/10 transition cursor-pointer"
                        >
                          let back in
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Friends drawer toggle */}
          <button
            onClick={() => { setShowFriends(v => !v); if (showChat) setShowChat(false); }}
            className={`p-2 relative transition rounded-full border cursor-pointer ${
              showFriends
                ? 'bg-rose-400/15 border-rose-400/20 text-rose-400'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-white/40'
            }`}
            title="Friends"
          >
            <UserPlus className="w-4 h-4" />
            {friendRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center" style={{ boxShadow: '0 0 8px rgba(244,63,94,0.5)' }}>
                {friendRequestCount}
              </span>
            )}
          </button>

          {/* Send a nudge */}
          <button
            onClick={sendNudge}
            disabled={activePresences.length === 0}
            className="p-2 rounded-full border cursor-pointer transition bg-white/[0.04] hover:bg-amber-400/10 border-white/[0.06] text-amber-300/70 hover:text-amber-300 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white/[0.04]"
            title={activePresences.length === 0 ? 'Nobody to nudge yet' : 'Send a nudge'}
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Day / Evening Toggle */}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />

          {/* Chat Panel Toggle */}
          <button
            onClick={() => { setShowChat(!showChat); if (showFriends) setShowFriends(false); }}
            className={`p-2 relative transition rounded-full border cursor-pointer ${
              showChat
                ? 'bg-rose-400/15 border-rose-400/20 text-rose-400'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-white/40'
            }`}
            title="Chat with partner"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center" style={{ boxShadow: '0 0 8px rgba(244,63,94,0.5)' }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Quick Exit Room */}
          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-2 text-white/25 hover:text-rose-400 hover:bg-rose-400/10 transition rounded-full border border-transparent cursor-pointer"
            title="Leave room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Wrapper */}
      <div className="flex-grow flex flex-row overflow-hidden relative w-full min-h-0">

        {/* Left Section: Canvas and Bottom Toolbar */}
        <div className="flex-grow flex flex-col justify-between items-center relative overflow-hidden h-full w-full min-h-0">

          {/* Tonight's Prompt Banner — perched over the top of the paper */}
          {!hidePrompt && (
            <div className="absolute top-14 z-20 w-full flex justify-center px-4 animate-fade-in pointer-events-none">
              <div className="glass-card-strong rounded-full pl-4 pr-2.5 py-2 flex items-center gap-2.5 pointer-events-auto max-w-[92vw]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: '#E5A469' }} />
                <span className="text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[68vw] sm:max-w-none">
                  <span className="font-semibold text-amber-300/90">Tonight's prompt</span>
                  <span className="text-white/25"> · </span>
                  <span className="italic font-display text-white/80">
                    {/* eslint-disable-next-line react-hooks/purity -- intentional daily (clock-based) prompt */}
                    {DAILY_PROMPTS[Math.floor(Date.now() / 86400000) % DAILY_PROMPTS.length].toLowerCase()}
                  </span>
                </span>
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    localStorage.setItem('cozy_canvas_prompt_hidden_date', today);
                    setHidePrompt(true);
                  }}
                  className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center transition shrink-0"
                >
                  <X className="w-3 h-3 text-white/50" />
                </button>
              </div>
            </div>
          )}

          {/* 2. Main Canvas Area */}
          <main className="flex-grow flex items-center justify-center p-3 md:p-5 relative z-10 w-full">
            {/* Canvas Container — Full Bleed, No Polaroid */}
            <div className="paper-frame w-full max-w-[min(92vw,62vh)]">
              {/* Washi tape holding the sheet to the desk */}
              <span className="tape tape-tl" aria-hidden="true" />
              <span className="tape tape-tr" aria-hidden="true" />
              <div className="paper-canvas w-full aspect-square rounded-2xl overflow-hidden relative">
                {/* Canvas */}
                <canvas
                  ref={attachCanvas}
                  width={1500}
                  height={1500}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  className={`w-full h-full touch-none cursor-none ${isDrawing ? 'canvas-drawing' : ''}`}
                  style={{ backgroundColor: '#FBF6EE' }}
                />

                {/* Replay ribbon */}
                {isReplaying && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-fade-in">
                    <span className="bg-gray-900/80 text-amber-200/90 text-[10px] font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5 border border-white/10">
                      <Play className="w-3 h-3" /> replaying your story…
                    </span>
                  </div>
                )}

                {/* Local Custom Cursor Overlay */}
                <div
                  ref={cursorRef}
                  className="absolute pointer-events-none z-20 flex items-center justify-center transition-none"
                  style={{
                    opacity: 0,
                    transform: 'translate(-50%, -50%)',
                    width: Math.max((activeTool === 'eraser' ? activeEraserSize : activeSize) * canvasScale, activeTool === 'eraser' ? 4 : 2),
                    height: Math.max((activeTool === 'eraser' ? activeEraserSize : activeSize) * canvasScale, activeTool === 'eraser' ? 4 : 2)
                  }}
                >
                  <div
                    className="rounded-full w-full h-full"
                    style={
                      activeTool === 'eraser'
                        ? { boxSizing: 'border-box', border: '1.5px dashed #888', backgroundColor: 'transparent' }
                        : { boxSizing: 'border-box', backgroundColor: activeColor, border: '1px solid rgba(255, 255, 255, 0.8)', boxShadow: `0 0 3px ${activeColor}66` }
                    }
                  />
                </div>

                {/* Partners' Cursor Position Overlays */}
                {activePresences.map(p => {
                  if (p.x === null || p.y === null) return null;
                  const cursorSize = p.activeTool === 'eraser' ? (p.activeEraserSize || 15) : (p.activeSize || 5);
                  return (
                    <div
                      key={p.userId}
                      className="absolute pointer-events-none transition-all duration-75 ease-out select-none z-10 flex items-center justify-center"
                      style={{
                        left: `${(p.x / 1500) * 100}%`,
                        top: `${(p.y / 1500) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        // A partner's cursor is a "where are they" indicator, so keep a clearly
                        // visible floor (it scales up for large brushes but never vanishes).
                        width: Math.max(cursorSize * canvasScale, 12),
                        height: Math.max(cursorSize * canvasScale, 12)
                      }}
                    >
                      {/* Pointer brush circle */}
                      <div
                        className="rounded-full animate-soft-pulse w-full h-full"
                        style={
                          p.activeTool === 'eraser'
                            ? { boxSizing: 'border-box', border: '1.5px dashed white', backdropFilter: 'invert(0.2)' }
                            : { boxSizing: 'border-box', backgroundColor: p.activeColor || '#C85C50', border: '1px solid white', boxShadow: `0 0 12px ${p.activeColor || '#C85C50'}60` }
                        }
                      />
                      {/* Name label */}
                      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2 py-0.5 bg-gray-900/80 text-white text-[9px] rounded-full backdrop-blur-sm font-semibold whitespace-nowrap flex items-center gap-1 border border-white/10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                        <span>{p.name}</span>
                        {p.isDrawing && <Brush className="w-2.5 h-2.5 text-rose-300" />}
                      </div>
                    </div>
                  );
                })}

                {/* Cozy collaboration hint, only while the paper is still sparse */}
                {visibleStrokes.length < 4 && (
                  <div className="absolute bottom-[6%] left-0 right-0 text-center px-6 pointer-events-none select-none animate-fade-in">
                    <span className="italic font-display text-base sm:text-lg" style={{ color: 'rgba(176, 120, 110, 0.55)' }}>
                      {/* eslint-disable-next-line react-hooks/purity -- stable daily pick */}
                      {COLLAB_HINTS[Math.floor(Date.now() / 86400000) % COLLAB_HINTS.length]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* 3. Floating Bottom Toolbar */}
          <footer className="w-full p-4 flex flex-col items-center z-20 pb-5">
            <div className="w-full max-w-xl glass-card palette-tray rounded-[20px] px-5 py-3.5 flex flex-col gap-3">

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Color Palette */}
                <div className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-white/20" />
                  <div className="flex items-center gap-1.5">
                    {COLORS.map((col) => (
                      <button
                        key={col.hex}
                        disabled={activeTool === 'eraser'}
                        onClick={() => setActiveColor(col.hex)}
                        className={`w-6 h-6 rounded-full transition-all duration-200 relative flex items-center justify-center group ${
                          activeTool === 'eraser' ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:scale-125 active:scale-95'
                        }`}
                        style={{
                          backgroundColor: col.hex,
                          boxShadow: activeColor === col.hex && activeTool !== 'eraser'
                            ? `0 0 0 2px var(--ring-gap), 0 0 0 4px ${col.hex}, 0 0 14px ${col.hex}50`
                            : 'none'
                        }}
                      >
                        {activeColor === col.hex && activeTool !== 'eraser' && (
                          <Check className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                        )}
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition duration-200 bg-gray-900/90 text-white text-[10px] py-1 px-2 rounded font-semibold whitespace-nowrap pointer-events-none z-50">
                          {col.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tool Selector (Pen / Eraser / Shapes) */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white/5 border border-white/[0.08] p-0.5 rounded-xl gap-0.5">
                    <button
                      onClick={() => setActiveTool('pen')}
                      className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                        activeTool === 'pen'
                          ? 'bg-gradient-to-r from-rose-400 to-amber-400 text-white shadow-lg'
                          : 'text-white/30 hover:text-white/50 hover:bg-white/5'
                      }`}
                      style={activeTool === 'pen' ? { boxShadow: '0 4px 12px rgba(232,168,124,0.3)' } : {}}
                      title="Pen"
                    >
                      <Brush className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveTool('eraser')}
                      className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                        activeTool === 'eraser'
                          ? 'bg-gradient-to-r from-rose-400 to-amber-400 text-white shadow-lg'
                          : 'text-white/30 hover:text-white/50 hover:bg-white/5'
                      }`}
                      style={activeTool === 'eraser' ? { boxShadow: '0 4px 12px rgba(232,168,124,0.3)' } : {}}
                      title="Eraser"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveTool('shape')}
                      className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                        activeTool === 'shape'
                          ? 'bg-gradient-to-r from-rose-400 to-amber-400 text-white shadow-lg'
                          : 'text-white/30 hover:text-white/50 hover:bg-white/5'
                      }`}
                      style={activeTool === 'shape' ? { boxShadow: '0 4px 12px rgba(232,168,124,0.3)' } : {}}
                      title="Shapes"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Shape kind (only while the shapes tool is active) */}
                  {activeTool === 'shape' && (
                    <div className="flex items-center bg-white/5 border border-white/[0.08] p-0.5 rounded-xl gap-0.5 animate-fade-in">
                      <button
                        onClick={() => setActiveShape('rect')}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${activeShape === 'rect' ? 'bg-white/15 text-white/90' : 'text-white/30 hover:text-white/50'}`}
                        title="Rectangle"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveShape('ellipse')}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${activeShape === 'ellipse' ? 'bg-white/15 text-white/90' : 'text-white/30 hover:text-white/50'}`}
                        title="Ellipse"
                      >
                        <Circle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Brush Size Controls */}
                <div className="flex items-center gap-2.5 flex-grow max-w-[140px] md:max-w-[180px]">
                  {activeTool === 'eraser' ? <Eraser className="w-3.5 h-3.5 text-white/20" /> : <Brush className="w-3.5 h-3.5 text-white/20" />}
                  <input
                    type="range"
                    min="2"
                    max="50"
                    value={activeTool === 'eraser' ? activeEraserSize : activeSize}
                    onChange={(e) => activeTool === 'eraser' ? setActiveEraserSize(parseInt(e.target.value)) : setActiveSize(parseInt(e.target.value))}
                    className="w-full cursor-pointer h-1"
                  />
                  <span className="text-[10px] font-bold text-white/30 w-9 text-right">{activeTool === 'eraser' ? activeEraserSize : activeSize} px</span>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUndo}
                    className="px-3.5 py-1.5 hover:bg-white/5 text-white/35 hover:text-white/60 rounded-xl border border-white/5 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                    title="Undo last stroke"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Undo</span>
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="px-3.5 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 text-white/35 hover:text-white/60 rounded-xl border border-white/5 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                    title="Redo last undone stroke"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Redo</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShareLink}
                    className={`px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                        : 'bg-white/5 hover:bg-white/[0.08] text-white/35 hover:text-white/60 border border-white/5'
                    }`}
                    title="Copy invite link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied link!' : 'Copy invite link'}</span>
                  </button>

                  <button
                    onClick={isReplaying ? stopReplay : startReplay}
                    disabled={!isReplaying && visibleStrokes.length === 0}
                    className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed ${
                      isReplaying
                        ? 'bg-amber-400/15 text-amber-300 border-amber-400/25'
                        : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 border-white/5'
                    }`}
                    title={isReplaying ? 'Stop the replay' : 'Watch this drawing come together'}
                  >
                    {isReplaying ? <X className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isReplaying ? 'Stop' : 'Replay'}</span>
                  </button>

                  <button
                    onClick={handleDownloadCanvas}
                    className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 rounded-xl border border-white/5 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                    title="Download drawing"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </button>

                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="px-3.5 py-1.5 hover:bg-rose-400/10 text-rose-400/40 hover:text-rose-400 rounded-xl border border-rose-400/10 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                    title="Clear canvas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

            </div>
          </footer>
        </div>

        {/* Right Section: Collapsible Chat Sidebar */}
        {showFriends && (
          <FriendsPanel
            db={db}
            uid={userId}
            username={nickname}
            onJoinRoom={(code) => { setShowFriends(false); setRoomCode(code); }}
            onClose={() => setShowFriends(false)}
          />
        )}

        {showChat && (
          <div className="chat-surface fixed z-30 flex flex-col shadow-2xl glass-card-strong min-h-0 w-full h-full inset-0 sm:w-80 sm:h-auto sm:inset-auto sm:top-[68px] sm:bottom-5 sm:right-5 rounded-none sm:rounded-2xl animate-slide-in-right overflow-hidden">

            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/[0.03]">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-white/30" />
                <span className="font-bold text-sm text-white/70 font-display">Cozy Chat</span>
              </div>
              <button
                onClick={() => { setShowChat(false); window.scrollTo(0, 0); }}
                className="p-1 hover:bg-white/[0.08] rounded-full text-white/30 hover:text-white/60 transition cursor-pointer"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message History */}
            <div className="flex-grow h-0 min-h-0 overflow-y-auto p-4 space-y-3 flex flex-col" id="cozy-chat-messages">
              {messages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-white/25">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
                    <Heart className="w-5 h-5 text-rose-400/40" />
                  </div>
                  <p className="text-xs font-semibold">No messages yet...</p>
                  <p className="text-[10px] text-white/15 mt-0.5">Send a sweet note to your partner!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender === nickname;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[75%] ${
                        isMe ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      {/* Message Bubble */}
                      {!isMe && (
                        <div className="text-[10px] font-bold mb-0.5 px-1" style={{ color: getUserColor(msg.sender) }}>
                          {msg.sender}
                        </div>
                      )}
                      <div
                        onClick={() => setActiveReactionMsgId(prev => prev === msg.id ? null : msg.id)}
                        onContextMenu={(e) => { e.preventDefault(); setActiveReactionMsgId(prev => prev === msg.id ? null : msg.id); }}
                        className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed relative cursor-pointer whitespace-pre-wrap break-words ${
                          isMe
                            ? 'bg-gradient-to-r from-rose-500/90 to-amber-500/90 text-white rounded-br-sm'
                            : 'bg-white/[0.08] text-white/70 rounded-bl-sm border border-white/5'
                        }`}
                      >
                        {msg.text}
                        
                        {/* Reaction Picker Popover */}
                        {activeReactionMsgId === msg.id && (
                          <div className={`absolute ${isMe ? 'right-0' : 'left-0'} -top-8 bg-black/80 backdrop-blur-md rounded-full shadow-xl border border-white/10 px-2 py-1 flex gap-1 z-40`}>
                            {QUICK_REACTIONS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }}
                                className="w-6 h-6 hover:bg-white/20 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Display Reactions */}
                      {msg.reactions && Object.values(msg.reactions).some(arr => arr.length > 0) && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {Object.entries(msg.reactions).map(([emoji, users]) => users.length > 0 && (
                            <div
                              key={emoji}
                              onClick={() => handleReaction(msg.id, emoji)}
                              className="bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] flex items-center gap-1 cursor-pointer transition"
                            >
                              <span>{emoji}</span>
                              <span className="text-white/60 font-semibold">{users.length}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Timestamp */}
                      <span className="text-[9px] text-white/20 mt-1 px-1">
                        {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {activePresences.filter(p => p.isChatTyping && p.userId !== userId).length > 0 && (
              <div className="px-4 py-1.5 text-[10px] text-white/40 italic flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                {activePresences.filter(p => p.isChatTyping && p.userId !== userId).map(u => u.name).join(', ')} {activePresences.filter(p => p.isChatTyping && p.userId !== userId).length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Message Input Form */}
            <div className="relative p-3 border-t border-white/5 bg-white/[0.03]">
              {showEmojiPicker && (
                <>
                  {/* Invisible Backdrop to close on click outside */}
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowEmojiPicker(false)}
                  />
                  <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl bg-[#222222] rounded-xl overflow-hidden border border-white/10">
                    <div className="flex justify-end p-2 border-b border-white/5 bg-black/20">
                      <button
                        onClick={() => setShowEmojiPicker(false)}
                        className="p-1 hover:bg-white/10 rounded-full transition cursor-pointer"
                        style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        title="Close Emojis"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <EmojiPicker 
                      theme="dark" 
                      onEmojiClick={(emojiData) => setMessageInput(prev => prev + emojiData.emoji)}
                    />
                  </div>
                </>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2 items-end relative z-50">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-white/30 hover:text-white/60 transition cursor-pointer shrink-0"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <textarea
                  ref={messageInputRef}
                  value={messageInput}
                  onChange={handleMessageInputChange}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter inserts a new line.
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  onBlur={handleInputBlur}
                  placeholder="Write a sweet message..."
                  maxLength={500}
                  rows={1}
                  className="flex-grow px-3 py-2 glass-input rounded-xl text-xs leading-relaxed transition resize-none max-h-32 overflow-y-auto"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="p-2 btn-gradient disabled:opacity-20 disabled:shadow-none rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* 4. Clear Canvas Confirmation Overlay */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-sm glass-card-strong rounded-3xl p-6 flex flex-col items-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-rose-400/10 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-white/90 text-center mb-2 font-display">Wipe canvas?</h3>
            <p className="text-white/35 text-sm text-center mb-6 leading-relaxed">
              This will erase all drawings for everyone in the room. Are you sure you want to start fresh?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 transition rounded-xl text-white/50 text-sm font-semibold cursor-pointer border border-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3 btn-gradient rounded-xl text-sm cursor-pointer"
              >
                Yes, clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Exit Room Confirmation Overlay */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-sm glass-card-strong rounded-3xl p-6 flex flex-col items-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-rose-400/10 flex items-center justify-center mb-4">
              <LogOut className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-white/90 text-center mb-2 font-display">Leave Room?</h3>
            <p className="text-white/35 text-sm text-center mb-6 leading-relaxed">
              Are you sure you want to exit? Your drawings will remain in the room.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 transition rounded-xl text-white/50 text-sm font-semibold cursor-pointer border border-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowExitConfirm(false); setRoomCode(''); }}
                className="flex-1 py-3 btn-gradient rounded-xl text-sm cursor-pointer"
              >
                Yes, leave
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
