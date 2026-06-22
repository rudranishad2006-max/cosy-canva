import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Sparkles, 
  Undo2, 
  Trash2, 
  Copy, 
  Plus, 
  ChevronRight, 
  Palette, 
  Brush, 
  Users, 
  Check, 
  Settings, 
  Heart, 
  Share2, 
  LogOut,
  MessageSquare,
  Send,
  X 
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';

// Cozy Room Code Wordlists
const ADJECTIVES = ['warm', 'cozy', 'gentle', 'soft', 'golden', 'misty', 'starry', 'dusky', 'amber', 'rosy', 'dreamy', 'silent', 'peaceful', 'sweet', 'blushing', 'velvet', 'tender', 'floral'];
const NOUNS = ['meadow', 'forest', 'river', 'glade', 'haven', 'cove', 'peak', 'garden', 'cottage', 'path', 'hearth', 'cloud', 'breeze', 'willow', 'nest', 'bower', 'valley', 'grove'];

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
  { name: 'Warm Charcoal', hex: '#3C3C3C' }
];

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
  latestCallback.current = callback;
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
      callback(...args);
      lastCalled.current = now;
    } else if (!timeout.current) {
      timeout.current = setTimeout(() => {
        callback(...args);
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
  } catch (e) {}

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

export default function App() {
  // 1. Firebase Config Management
  // Tip: If you want to bake your database configuration directly into the app so users don't have to enter it:
  // Set your config object here instead of null:
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAq7tZt6kn5bJXNguxIuX3__0AopTh1nyk",
    authDomain: "test-e33f5.firebaseapp.com",
    projectId: "test-e33f5",
    storageBucket: "test-e33f5.firebasestorage.app",
    messagingSenderId: "506111090456",
    appId: "1:506111090456:web:61ad48eefdc439e63c086d"
  };

  const [firebaseConfig, setFirebaseConfig] = useState(() => {
    const saved = localStorage.getItem('cozy_canvas_db_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
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

  // Initialize DB
  const db = useMemo(() => {
    if (!firebaseConfig) return null;
    try {
      const apps = getApps();
      const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
      return getFirestore(app);
    } catch (e) {
      console.error('Firebase DB Init Error:', e);
      return null;
    }
  }, [firebaseConfig]);

  // 2. Room & Onboarding State
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  });
  const [roomInput, setRoomInput] = useState('');
  const [nickname, setNickname] = useState(() => localStorage.getItem('cozy_canvas_nickname') || '');
  const [nicknameInput, setNicknameInput] = useState('');
  const [userId] = useState(() => {
    let id = localStorage.getItem('cozy_canvas_user_id');
    if (!id) {
      id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cozy_canvas_user_id', id);
    }
    return id;
  });

  // 3. Canvas State
  const canvasRef = useRef(null);
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [activeSize, setActiveSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokePoints = useRef([]);

  // 4. Collaborative Sync States
  const [strokes, setStrokes] = useState([]);
  const [clearedAtTime, setClearedAtTime] = useState(0);
  const [presenceList, setPresenceList] = useState([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 4.1 Chat States
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

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
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [roomCode]);

  // DB Sync 1: Listen to Room clearedAt
  useEffect(() => {
    if (!db || !roomCode) return;
    const roomRef = doc(db, 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.clearedAt) {
          setClearedAtTime(data.clearedAt.toDate().getTime());
        } else {
          setClearedAtTime(0);
        }
      } else {
        // Init room doc
        setDoc(roomRef, { createdAt: serverTimestamp() }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [db, roomCode]);

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
        if (!showChatRef.current && prevMessages.length > 0) {
          const prevIds = new Set(prevMessages.map(m => m.id));
          const newPartnerMsgs = list.filter(m => !prevIds.has(m.id) && m.sender !== nickname);
          if (newPartnerMsgs.length > 0) {
            setUnreadCount((c) => c + newPartnerMsgs.length);
          }
        }
        return list;
      });
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

  // DB Sync 4: Presence & Heartbeat Listeners
  useEffect(() => {
    if (!db || !roomCode || !nickname || !userId) return;

    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    
    // Create base presence doc
    const writePresence = async (x = null, y = null, drawing = false, points = []) => {
      try {
        await setDoc(presenceRef, {
          userId,
          name: nickname,
          x,
          y,
          isDrawing: drawing,
          activeColor,
          activeSize,
          currentPoints: points,
          lastActive: Date.now()
        });
      } catch (e) {}
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
  }, [db, roomCode, nickname, userId, activeColor, activeSize]);

  // DB Sync 5: Listen to Partner Presence
  useEffect(() => {
    if (!db || !roomCode || !userId) return;
    const presenceColl = collection(db, 'rooms', roomCode, 'presence');
    const unsubscribe = onSnapshot(presenceColl, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.userId !== userId) {
          list.push(data);
        }
      });
      setPresenceList(list);
    });
    return () => unsubscribe();
  }, [db, roomCode, userId]);

  const partner = presenceList[0]; // Designed for couples (only 1 partner active)
  const isPartnerOnline = partner && (Date.now() - partner.lastActive < 15000);

  // Throttled Presence Writer for drawing / pointermove updates
  const updatePresenceCursor = useThrottle((x, y, drawing, points) => {
    if (!db || !roomCode || !userId) return;
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    updateDoc(presenceRef, {
      x,
      y,
      isDrawing: drawing,
      currentPoints: points,
      lastActive: Date.now()
    }).catch(() => {});
  }, 80);

  // Immediate presence update (no throttle, for pointerup/pointerleave)
  const updatePresenceCursorImmediate = (x, y, drawing, points) => {
    if (!db || !roomCode || !userId) return;
    const presenceRef = doc(db, 'rooms', roomCode, 'presence', userId);
    updateDoc(presenceRef, {
      x,
      y,
      isDrawing: drawing,
      currentPoints: points,
      lastActive: Date.now()
    }).catch(() => {});
  };

  // 5. Canvas Drawing Engine
  const drawStroke = (ctx, stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
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

    // Draw partner active stroke (in progress)
    if (isPartnerOnline && partner.isDrawing && partner.currentPoints && partner.currentPoints.length > 1) {
      drawStroke(ctx, {
        color: partner.activeColor || '#3C3C3C',
        size: partner.activeSize || 5,
        points: partner.currentPoints
      });
    }

    // Draw local active stroke (in progress)
    if (currentStrokePoints.current.length > 1) {
      drawStroke(ctx, {
        color: activeColor,
        size: activeSize,
        points: currentStrokePoints.current
      });
    }
  }, [visibleStrokes, isPartnerOnline, partner, activeColor, activeSize]);

  // Redraw when strokes, partner status, or settings change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

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

    // Trigger instant canvas refresh for starting dot
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.fillStyle = activeColor;
    ctx.arc(x, y, activeSize / 2, 0, Math.PI * 2);
    ctx.fill();

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

    if (isDrawing) {
      const lastPoint = currentStrokePoints.current[currentStrokePoints.current.length - 1];
      const newPoint = { x, y };
      currentStrokePoints.current.push(newPoint);

      // Instantly draw line segment locally
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(newPoint.x, newPoint.y);
      ctx.stroke();

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

    if (points.length > 1) {
      const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const strokeRef = doc(db, 'rooms', roomCode, 'strokes', strokeId);
      
      // Save complete stroke
      setDoc(strokeRef, {
        id: strokeId,
        author: nickname,
        color: activeColor,
        size: activeSize,
        points: points,
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
    endDrawing();
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!db || !roomCode || !nickname || !messageInput.trim()) return;

    const messageText = messageInput.trim();
    setMessageInput('');

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const msgRef = doc(db, 'rooms', roomCode, 'messages', msgId);

    try {
      await setDoc(msgRef, {
        id: msgId,
        text: messageText,
        sender: nickname,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
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
      } catch (e) {
        console.error("Undo failed:", e);
      }
    }
  };

  const handleClear = async () => {
    if (!db || !roomCode) return;
    try {
      const roomRef = doc(db, 'rooms', roomCode);
      await setDoc(roomRef, {
        clearedAt: serverTimestamp()
      }, { merge: true });
      setShowClearConfirm(false);
      triggerHeartConfetti();
    } catch (e) {
      console.error("Clear failed:", e);
    }
  };

  const handleShareLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      triggerJoinConfetti();
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  // Reset database setup
  const handleResetConfig = () => {
    localStorage.removeItem('cozy_canvas_db_config');
    localStorage.removeItem('cozy_canvas_nickname');
    window.location.href = window.location.origin;
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
    triggerJoinConfetti();
  };

  // Nickname onboard submit
  const handleNicknameSubmit = (e) => {
    e.preventDefault();
    if (!nicknameInput.trim()) return;
    const name = nicknameInput.trim();
    localStorage.setItem('cozy_canvas_nickname', name);
    setNickname(name);
    triggerHeartConfetti();
  };

  // Bypassing view: 
  // Screen A: Setup Firebase if no config exists
  if (!firebaseConfig) {
    return (
      <div className="min-h-screen bg-cream-grid flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white/70 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-stone-200/50 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-rose-400 fill-rose-100" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 text-center mb-2">Welcome to CozyCanvas</h1>
          <p className="text-stone-500 text-center text-sm mb-6">
            A real-time drawing board for you and your partner. To begin, connect a Firebase Firestore database. It takes just 2 minutes!
          </p>

          <form onSubmit={handleSaveConfig} className="w-full space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">Firebase Config SDK Object</label>
              <textarea 
                rows={7}
                value={configInput}
                onChange={(e) => setConfigInput(e.target.value)}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "...",\n  projectId: "...",\n  ...\n};`}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-400/40 text-stone-700"
              />
            </div>
            
            {configError && (
              <p className="text-xs text-rose-500 bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-100">
                {configError}
              </p>
            )}

            <button 
              type="submit"
              className="w-full bg-stone-800 hover:bg-stone-700 transition duration-200 text-white font-semibold py-3 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Connect Database</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-100 w-full text-xs text-stone-400 space-y-2">
            <p className="font-semibold text-stone-500">Steps to configure:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open the <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-rose-400 underline hover:text-rose-500">Firebase Console</a>.</li>
              <li>Create a new project.</li>
              <li>Add a Web App under Project Settings to generate the Config code snippet.</li>
              <li>Enable <strong>Cloud Firestore</strong> and ensure database rules allow public access in testing mode (e.g. <code>allow read, write: if true;</code>).</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Screen B: If DB configured but no room joined yet
  if (!roomCode) {
    return (
      <div className="min-h-screen bg-cream-grid flex flex-col items-center justify-center p-6 relative">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-6 right-6 p-3 bg-white/60 hover:bg-white/80 transition rounded-full border border-stone-200/40 shadow-sm cursor-pointer"
          title="Database Settings"
        >
          <Settings className="w-5 h-5 text-stone-600" />
        </button>

        {showSettings && (
          <div className="absolute top-20 right-6 z-50 w-64 bg-white/90 backdrop-blur rounded-2xl p-4 shadow-xl border border-stone-200/50">
            <h3 className="text-sm font-bold text-stone-700 mb-2">Database Connected</h3>
            <p className="text-xs text-stone-400 mb-4 font-mono truncate">{firebaseConfig.projectId}</p>
            <button 
              onClick={handleResetConfig}
              className="w-full py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect Database
            </button>
          </div>
        )}

        <div className="w-full max-w-md bg-white/60 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-stone-200/40 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mb-6">
            <Heart className="w-7 h-7 text-rose-400 fill-rose-100 animate-pulse" />
          </div>

          <h1 className="text-3xl font-extrabold text-stone-800 text-center tracking-tight mb-2">CozyCanvas</h1>
          <p className="text-stone-500 text-center text-sm mb-8">
            Create a shared canvas to doodle, express love, and share moments together in real-time.
          </p>

          <div className="w-full space-y-6">
            <button 
              onClick={handleCreateRoom}
              className="w-full bg-rose-400 hover:bg-rose-500 transition duration-200 text-white font-semibold py-3.5 px-6 rounded-2xl shadow-md shadow-rose-100 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-white/20" />
              Start a new canvas
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-stone-200/70"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-stone-400 tracking-widest uppercase">Or Join Existing</span>
              <div className="flex-grow border-t border-stone-200/70"></div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-3">
              <input 
                type="text" 
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Enter room code (e.g. warm-meadow-42)"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200/70 rounded-2xl text-center text-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/40 transition"
              />
              <button 
                type="submit"
                className="w-full bg-stone-800 hover:bg-stone-700 transition duration-200 text-white font-semibold py-3 px-6 rounded-2xl shadow"
              >
                Join room
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Screen C: Room joined but Nickname Onboarding is required
  if (!nickname) {
    return (
      <div className="min-h-screen bg-cream-grid flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white/70 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-stone-200/50 flex flex-col items-center">
          <h2 className="text-xl font-bold text-stone-800 text-center mb-2">Joining Room</h2>
          <span className="px-3 py-1 bg-amber-50 border border-amber-100 text-amber-700 rounded-full text-xs font-semibold font-mono tracking-tight mb-6">
            {roomCode}
          </span>

          <form onSubmit={handleNicknameSubmit} className="w-full space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 text-center">What should your partner call you?</label>
              <input 
                type="text" 
                maxLength={16}
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Your cute nickname..."
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-center text-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/40 transition"
                required
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-rose-400 hover:bg-rose-500 transition duration-200 text-white font-semibold py-3 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2"
            >
              <span>Enter Canvas</span>
              <Heart className="w-4 h-4 fill-white/20" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Screen D: Cozy Collaborative Drawing Canvas Screen
  return (
    <div className="min-h-screen bg-cream-grid flex flex-col relative">
      
      {/* 1. Header Area */}
      <header className="flex justify-between items-center px-6 py-4 bg-white/30 backdrop-blur-sm border-b border-stone-200/30 z-20">
        {/* Left Side: Logo & Room details */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
            <Heart className="w-4.5 h-4.5 text-rose-400 fill-rose-100" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-md font-bold text-stone-800 tracking-tight">CozyCanvas</h2>
              <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-100/70 text-amber-700 rounded-full text-[10px] font-semibold font-mono tracking-tighter">
                {roomCode}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 leading-none mt-0.5">Logged in as {nickname}</p>
          </div>
        </div>

        {/* Right Side: Partner Presence indicator & Action */}
        <div className="flex items-center gap-3">
          {/* Presence Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 rounded-full border border-stone-200/40 shadow-sm text-xs">
            <span className="text-stone-500 font-medium">Partner:</span>
            {partner ? (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-stone-700">{partner.name}</span>
                <span 
                  className={`w-2 h-2 rounded-full ${
                    isPartnerOnline ? 'bg-emerald-400 animate-soft-pulse' : 'bg-stone-300'
                  }`} 
                />
                <span className="text-[10px] text-stone-400 font-medium">
                  ({isPartnerOnline ? 'online' : 'away'})
                </span>
              </div>
            ) : (
              <span className="text-stone-400 font-medium italic">Waiting for partner...</span>
            )}
          </div>

          {/* Chat Panel Toggle */}
          <button 
            onClick={() => setShowChat(!showChat)}
            className={`p-2 relative transition rounded-full border cursor-pointer ${
              showChat 
                ? 'bg-rose-50 border-rose-100 text-rose-500' 
                : 'bg-white/60 hover:bg-white/85 border-stone-200/40 text-stone-600 shadow-sm'
            }`}
            title="Chat with partner"
          >
            <MessageSquare className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Quick Exit Room */}
          <button 
            onClick={() => setRoomCode('')}
            className="p-2 text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition rounded-full border border-transparent cursor-pointer"
            title="Leave room"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Wrapper (Left: Canvas/Toolbar, Right: Chat Sidebar) */}
      <div className="flex-grow flex flex-row overflow-hidden relative w-full min-h-0">
        
        {/* Left Section: Canvas and Bottom Toolbar */}
        <div className="flex-grow flex flex-col justify-between items-center relative overflow-hidden h-full w-full min-h-0">
          
          {/* 2. Main Work Area (Canvas Polaroid Frame) */}
          <main className="flex-grow flex items-center justify-center p-4 relative z-10 w-full">
            
            {/* Polaroid Center Frame */}
            <div className="w-full max-w-[min(90vw,58vh)] bg-white rounded-3xl pt-4 px-4 pb-10 md:pt-6 md:px-6 md:pb-14 shadow-2xl border border-stone-200/40 flex flex-col gap-2.5 relative select-none">
              
              <div className="w-full aspect-square rounded-2xl overflow-hidden relative border-4 border-rose-300/90 bg-cream-grid shadow-[0_0_18px_rgba(244,63,94,0.18),inset_0_2px_8px_rgba(0,0,0,0.06)]">
                {/* Canvas */}
                <canvas
                  ref={canvasRef}
                  width={1500}
                  height={1500}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className={`w-full h-full bg-transparent touch-none ${isDrawing ? 'canvas-drawing' : ''}`}
                />

                {/* Partner's Cursor Position Overlay */}
                {isPartnerOnline && partner.x !== null && partner.y !== null && (
                  <div 
                    className="absolute pointer-events-none transition-all duration-75 ease-out select-none z-10"
                    style={{
                      left: `${(partner.x / 1500) * 100}%`,
                      top: `${(partner.y / 1500) * 100}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {/* Pointer brush size dot */}
                    <div 
                      className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md animate-soft-pulse"
                      style={{ backgroundColor: partner.activeColor || '#C85C50' }}
                    />
                    {/* Text Indicator */}
                    <div className="ml-4 mt-2 px-2.5 py-0.5 bg-white/95 text-stone-700 text-[10px] rounded-full shadow-lg border border-stone-200/50 font-bold whitespace-nowrap flex items-center gap-1">
                      <span>{partner.name}</span>
                      {partner.isDrawing && <Brush className="w-2.5 h-2.5 text-stone-500 fill-stone-50" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Polaroid Caption - Cute Emojis instead of names */}
              <div className="flex items-center justify-center text-xl md:text-2xl select-none tracking-widest pt-1 gap-1.5">
                <span>🧸</span>
                <span>🌸</span>
                <span>✨</span>
                <Heart className="w-5 h-5 text-rose-400 fill-rose-300 animate-pulse" />
                <span>✨</span>
                <span>🌸</span>
                <span>🧸</span>
              </div>
            </div>
          </main>

          {/* 3. Cozy Bottom Toolbar */}
          <footer className="w-full p-4 flex flex-col items-center z-20 bg-gradient-to-t from-[#edd8cb] via-[#edd8cb]/95 to-transparent pb-6">
            
            {/* Core Control Panel (Nude Color Box) */}
            <div className="w-full max-w-lg bg-[#EADCD3]/95 backdrop-blur rounded-3xl px-6 py-4 shadow-xl border border-[#d0c0b6] flex flex-col gap-4">
              
              <div className="flex flex-wrap items-center justify-between gap-4">
                
                {/* Color Palette Presets */}
                <div className="flex items-center gap-2.5">
                  <Palette className="w-4 h-4 text-stone-400" />
                  <div className="flex items-center gap-2">
                    {COLORS.map((col) => (
                      <button
                        key={col.hex}
                        onClick={() => setActiveColor(col.hex)}
                        className="w-6 h-6 rounded-full cursor-pointer border border-white hover:scale-110 active:scale-95 transition shadow-sm relative flex items-center justify-center"
                        style={{ backgroundColor: col.hex }}
                        title={col.name}
                      >
                        {activeColor === col.hex && (
                          <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brush Size Controls */}
                <div className="flex items-center gap-3 flex-grow max-w-[160px] md:max-w-xs">
                  <Brush className="w-4 h-4 text-stone-400" />
                  <input 
                    type="range"
                    min="2"
                    max="30"
                    value={activeSize}
                    onChange={(e) => setActiveSize(parseInt(e.target.value))}
                    className="w-full accent-rose-400 cursor-pointer h-1.5 bg-transparent appearance-none"
                  />
                  <span className="text-[11px] font-bold text-stone-500 w-5 text-right">{activeSize}px</span>
                </div>

              </div>

              <div className="h-px bg-[#d0c0b6]/60" />

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                
                {/* Undo Last Stroke */}
                <button
                  onClick={handleUndo}
                  className="px-4 py-2 hover:bg-stone-50 text-stone-600 rounded-2xl border border-stone-200/50 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                  title="Undo last stroke"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Undo</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* Copy Share Link */}
                  <button
                    onClick={handleShareLink}
                    className={`px-4 py-2 rounded-2xl flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                      copiedLink 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' 
                        : 'bg-white hover:bg-stone-50 text-stone-600 border border-stone-200/50'
                    }`}
                    title="Copy room link"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied!' : 'Share Link'}</span>
                  </button>

                  {/* Clear Canvas */}
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="px-4 py-2 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-2xl border border-rose-200/30 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                    title="Clear canvas"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear</span>
                  </button>
                </div>

              </div>

            </div>
          </footer>
        </div>

        {/* Right Section: Collapsible Chat Sidebar */}
        {showChat && (
          <div className="w-full sm:w-80 h-full bg-[#F5EBE6]/95 backdrop-blur border-l border-[#d0c0b6] flex flex-col z-30 transition-all duration-300 relative shadow-2xl shrink-0 absolute right-0 sm:relative min-h-0">
            
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-[#d8c7bd] flex justify-between items-center bg-[#EADCD3]/40">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-stone-500" />
                <span className="font-bold text-sm text-stone-700">Cozy Chat</span>
              </div>
              <button 
                onClick={() => { setShowChat(false); window.scrollTo(0, 0); }}
                className="p-1 hover:bg-[#EADCD3]/70 rounded-full text-stone-500 hover:text-stone-700 transition cursor-pointer"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message History */}
            <div className="flex-grow h-0 min-h-0 overflow-y-auto p-4 space-y-3 flex flex-col" id="cozy-chat-messages">
              {messages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-stone-400">
                  <div className="w-10 h-10 rounded-full bg-stone-50/55 flex items-center justify-center mb-2">
                    <Heart className="w-5 h-5 text-rose-300/60" />
                  </div>
                  <p className="text-xs font-semibold">No messages yet...</p>
                  <p className="text-[10px] text-stone-400/80 mt-0.5">Send a sweet note to your partner!</p>
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
                      <div 
                        className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMe 
                            ? 'bg-[#C85C50] text-white rounded-br-none' 
                            : 'bg-white text-stone-700 rounded-bl-none border border-stone-200/50'
                        }`}
                      >
                        {msg.text}
                      </div>
                      
                      {/* Timestamp */}
                      <span className="text-[9px] text-stone-400 mt-1 px-1">
                        {isMe ? 'You' : msg.sender} • {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-[#d8c7bd] bg-[#EADCD3]/30 flex gap-2">
              <input 
                type="text" 
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onBlur={handleInputBlur}
                placeholder="Write a sweet message..."
                maxLength={200}
                className="flex-grow px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-rose-300 transition"
              />
              <button 
                type="submit"
                disabled={!messageInput.trim()}
                className="p-2 bg-[#C85C50] hover:bg-[#b04d42] disabled:bg-stone-300 text-white rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 4. Clear Canvas Confirmation Overlay */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-100 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-stone-800 text-center mb-2">Wipe canvas?</h3>
            <p className="text-stone-500 text-sm text-center mb-6 leading-relaxed">
              This will erase all drawings for both you and your partner. Are you sure you want to start fresh?
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 bg-stone-50 hover:bg-stone-100 transition rounded-xl text-stone-600 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleClear}
                className="flex-1 py-3 bg-rose-400 hover:bg-rose-500 transition text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Yes, clear all
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
