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
  HeartOff, 
  Share2, 
  LogOut,
  MessageSquare,
  Send,
  X,
  Eraser 
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
  { name: 'Warm Charcoal', hex: '#3C3C3C' },
  { name: 'Lavender', hex: '#9B8EC4' },
  { name: 'Snow White', hex: '#FFFFFF' }
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

// Floating ambient particles component
const FloatingParticles = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="particle w-2 h-2 bg-rose-400/20" style={{ top: '15%', left: '10%', animationDelay: '0s' }} />
    <div className="particle w-3 h-3 bg-amber-400/15" style={{ top: '70%', left: '80%', animationDelay: '2s' }} />
    <div className="particle-slow w-4 h-4 bg-rose-300/10" style={{ top: '40%', left: '60%', animationDelay: '4s' }} />
    <div className="particle w-1.5 h-1.5 bg-amber-300/20" style={{ top: '85%', left: '25%', animationDelay: '1s' }} />
    <div className="particle-slow w-5 h-5 bg-rose-400/[0.08]" style={{ top: '20%', left: '75%', animationDelay: '3s' }} />
    <div className="particle w-2.5 h-2.5 bg-amber-400/[0.12]" style={{ top: '55%', left: '15%', animationDelay: '5s' }} />
    <div className="particle-slow w-3 h-3 bg-rose-300/15" style={{ top: '90%', left: '50%', animationDelay: '6s' }} />
    <div className="particle w-2 h-2 bg-amber-300/[0.18]" style={{ top: '10%', left: '45%', animationDelay: '7s' }} />
  </div>
);

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
  const [presenceLoaded, setPresenceLoaded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTool, setActiveTool] = useState('pen'); // 'pen' | 'eraser'

  // 4.1 Chat States
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesLoadedRef = useRef(false);

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
  useEffect(() => {
    if (!roomCode) {
      setPresenceLoaded(false);
      setPresenceList([]);
      messagesLoadedRef.current = false;
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

  const activePresences = useMemo(() => {
    return presenceList.filter(p => Date.now() - p.lastActive < 15000);
  }, [presenceList]);

  const partner = activePresences[0]; // Designed for couples (only 1 active partner)
  const isPartnerOnline = !!partner;

  const activeOthersCount = activePresences.length;
  const isRoomFull = activeOthersCount >= 2;

  // DB Sync 4: Presence & Heartbeat Listeners
  useEffect(() => {
    if (!db || !roomCode || !nickname || !userId || !presenceLoaded || isRoomFull) return;

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
          activeTool,
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
  }, [db, roomCode, nickname, userId, activeColor, activeSize, presenceLoaded, isRoomFull, activeTool]);

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
      setPresenceLoaded(true);
    }, (error) => {
      console.error("Presence listen error:", error);
      setPresenceLoaded(true); // fallback to unblock
    });
    return () => unsubscribe();
  }, [db, roomCode, userId]);


  // Throttled Presence Writer for drawing / pointermove updates
  const updatePresenceCursor = useThrottle((x, y, drawing, points) => {
    if (!db || !roomCode || !userId) return;
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
    if (!db || !roomCode || !userId) return;
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

  // 5. Canvas Drawing Engine
  const drawStroke = (ctx, stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;
    ctx.beginPath();
    
    // Support transparent erasing
    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
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

    // Draw partner active stroke (in progress)
    if (isPartnerOnline && partner.isDrawing && partner.currentPoints && partner.currentPoints.length > 1) {
      drawStroke(ctx, {
        color: partner.activeColor || '#3C3C3C',
        size: partner.activeSize || 5,
        points: partner.currentPoints,
        isEraser: partner.activeTool === 'eraser'
      });
    }

    // Draw local active stroke (in progress)
    if (currentStrokePoints.current.length > 1) {
      drawStroke(ctx, {
        color: activeColor,
        size: activeSize,
        points: currentStrokePoints.current,
        isEraser: activeTool === 'eraser'
      });
    }
  }, [visibleStrokes, isPartnerOnline, partner, activeColor, activeSize, activeTool]);

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
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = activeColor;
    }
    ctx.arc(x, y, activeSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; // Reset

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
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(newPoint.x, newPoint.y);
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

  // Admin authentication submit
  const handleAdminAuth = (e) => {
    e.preventDefault();
    const correctPasscode = import.meta.env.VITE_ADMIN_PASSCODE || 'cozyadmin123';
    if (adminPasscodeInput === correctPasscode) {
      setAdminAuthenticated(true);
      setAdminError('');
      loadRoomsDirectly();
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

  const loadAdminRooms = () => {
    loadRoomsDirectly();
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
        <FloatingParticles />
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
          <FloatingParticles />
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
        <FloatingParticles />
        <div className="w-full max-w-4xl glass-card-strong rounded-3xl p-6 md:p-10 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-6 mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold gradient-text tracking-tight font-display">Admin Dashboard</h1>
              <p className="text-white/35 text-sm mt-1">Manage, inspect, and clean up active collaborative rooms.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadAdminRooms}
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

  // Screen B: If DB configured but no room joined yet — Lobby
  if (!roomCode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <FloatingParticles />

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 transition rounded-full border border-white/5 cursor-pointer z-20"
          title="Database Settings"
        >
          <Settings className="w-5 h-5 text-white/40" />
        </button>

        {showSettings && (
          <div className="absolute top-20 right-6 z-50 w-64 glass-card-strong rounded-2xl p-4 animate-fade-in">
            <h3 className="text-sm font-bold text-white/70 mb-2">Database Connected</h3>
            <p className="text-xs text-white/30 mb-4 font-mono truncate">{firebaseConfig.projectId}</p>
            <button
              onClick={handleResetConfig}
              className="w-full py-2 px-4 bg-rose-400/10 hover:bg-rose-400/20 text-rose-400 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-rose-400/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect Database
            </button>
          </div>
        )}

        <div className="w-full max-w-md glass-card-strong rounded-3xl p-10 flex flex-col items-center relative z-10 animate-fade-in">
          {/* Glowing Heart Logo */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-400/20 to-amber-400/20 flex items-center justify-center mb-6 relative">
            <Heart className="w-10 h-10 text-rose-400 fill-rose-400/30 animate-heart-glow" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-400/10 to-transparent blur-xl" />
          </div>

          <h1 className="text-4xl font-extrabold gradient-text text-center tracking-tight mb-2 font-display">CozyCanvas</h1>
          <p className="text-white/35 text-center text-sm mb-10">
            Draw together, stay together. Create a shared canvas to express your love in real-time.
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
        <FloatingParticles />
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
        <FloatingParticles />
        <div className="w-full max-w-md glass-card-strong rounded-3xl p-8 flex flex-col items-center text-center relative z-10 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-rose-400/10 flex items-center justify-center mb-6">
            <HeartOff className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-white/90 tracking-tight mb-2 font-display">Room is Full</h2>
          <p className="text-white/35 text-sm mb-6">
            Only 2 people can draw together in a room at the same time. This room already has its couple!
          </p>
          <button
            onClick={() => setRoomCode('')}
            className="w-full btn-gradient py-3 px-6 rounded-2xl cursor-pointer text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Screen C: Room joined but Nickname Onboarding is required
  if (!nickname) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <FloatingParticles />
        <div className="w-full max-w-sm glass-card-strong rounded-3xl p-8 flex flex-col items-center relative z-10 animate-fade-in">
          <h2 className="text-xl font-bold text-white/90 text-center mb-2 font-display">Joining Room</h2>
          <span className="px-3 py-1 bg-amber-400/10 border border-amber-400/20 text-amber-400/80 rounded-full text-xs font-semibold font-mono tracking-tight mb-6">
            {roomCode}
          </span>

          <form onSubmit={handleNicknameSubmit} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/25 text-center">What should your partner call you?</label>
              <input
                type="text"
                maxLength={16}
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Your cute nickname..."
                className="w-full px-4 py-3 glass-input rounded-2xl text-center text-sm transition"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full btn-gradient py-3 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <span>Enter Canvas</span>
              <Heart className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Screen D: Cozy Collaborative Drawing Canvas Screen
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)' }}>

      {/* Ambient Background Particles */}
      <FloatingParticles />

      {/* 1. Header Area */}
      <header className="flex justify-between items-center px-5 py-3 glass-card border-0 border-b border-white/5 z-20 relative">
        {/* Left Side: Logo & Room details */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400/25 to-amber-400/25 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400/40" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold gradient-text tracking-tight font-display">CozyCanvas</h2>
              <span className="px-2 py-0.5 bg-amber-400/10 border border-amber-400/15 text-amber-400/70 rounded-full text-[9px] font-semibold font-mono tracking-tighter">
                {roomCode}
              </span>
            </div>
            <p className="text-[10px] text-white/25 leading-none mt-0.5">Drawing as <span className="text-white/40 font-medium">{nickname}</span></p>
          </div>
        </div>

        {/* Right Side: Partner Presence indicator & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Presence Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-full border border-white/[0.06] text-xs">
            <span className="text-white/30 font-medium text-[11px]">Partner:</span>
            {partner ? (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white/70 text-[11px]">{partner.name}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPartnerOnline ? 'bg-emerald-400 animate-soft-pulse' : 'bg-white/20'
                  }`}
                  style={isPartnerOnline ? { boxShadow: '0 0 8px rgba(52,211,153,0.5)' } : {}}
                />
              </div>
            ) : (
              <span className="text-white/20 font-medium italic text-[11px]">Waiting...</span>
            )}
          </div>

          {/* Chat Panel Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
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
            onClick={() => setRoomCode('')}
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

          {/* 2. Main Canvas Area */}
          <main className="flex-grow flex items-center justify-center p-3 md:p-5 relative z-10 w-full">
            {/* Canvas Container — Full Bleed, No Polaroid */}
            <div className="w-full max-w-[min(92vw,62vh)] relative">
              <div className="w-full aspect-square rounded-2xl overflow-hidden relative bg-white border border-white/10" style={{ boxShadow: '0 0 60px rgba(232,168,124,0.08), 0 8px 32px rgba(0,0,0,0.4)' }}>
                {/* Canvas */}
                <canvas
                  ref={canvasRef}
                  width={1500}
                  height={1500}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className={`w-full h-full bg-white touch-none ${isDrawing ? 'canvas-drawing' : ''}`}
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
                    {/* Pointer brush circle with glow */}
                    <div
                      className="w-4 h-4 rounded-full border-2 border-white animate-soft-pulse"
                      style={{ backgroundColor: partner.activeColor || '#C85C50', boxShadow: `0 0 12px ${partner.activeColor || '#C85C50'}60` }}
                    />
                    {/* Name label */}
                    <div className="ml-4 mt-1.5 px-2 py-0.5 bg-gray-900/80 text-white text-[9px] rounded-full backdrop-blur-sm font-semibold whitespace-nowrap flex items-center gap-1 border border-white/10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                      <span>{partner.name}</span>
                      {partner.isDrawing && <Brush className="w-2.5 h-2.5 text-rose-300" />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* 3. Floating Bottom Toolbar */}
          <footer className="w-full p-4 flex flex-col items-center z-20 pb-5">
            <div className="w-full max-w-xl glass-card rounded-[20px] px-5 py-3.5 flex flex-col gap-3">

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
                        className={`w-6 h-6 rounded-full transition-all duration-200 relative flex items-center justify-center ${
                          activeTool === 'eraser' ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:scale-125 active:scale-95'
                        }`}
                        style={{
                          backgroundColor: col.hex,
                          boxShadow: activeColor === col.hex && activeTool !== 'eraser'
                            ? `0 0 0 2px #0f0f1a, 0 0 0 4px ${col.hex}, 0 0 14px ${col.hex}50`
                            : 'none'
                        }}
                        title={col.name}
                      >
                        {activeColor === col.hex && activeTool !== 'eraser' && (
                          <Check className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tool Selector (Pen / Eraser) */}
                <div className="flex items-center bg-white/5 border border-white/[0.08] p-0.5 rounded-xl gap-0.5">
                  <button
                    onClick={() => setActiveTool('pen')}
                    className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                      activeTool === 'pen'
                        ? 'bg-gradient-to-r from-rose-400 to-amber-400 text-white shadow-lg'
                        : 'text-white/30 hover:text-white/50 hover:bg-white/5'
                    }`}
                    style={activeTool === 'pen' ? { boxShadow: '0 4px 12px rgba(232,168,124,0.3)' } : {}}
                    title="Pen tool"
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
                    title="Eraser tool"
                  >
                    <Eraser className="w-4 h-4" />
                  </button>
                </div>

                {/* Brush Size Controls */}
                <div className="flex items-center gap-2.5 flex-grow max-w-[140px] md:max-w-[180px]">
                  <Brush className="w-3.5 h-3.5 text-white/20" />
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={activeSize}
                    onChange={(e) => setActiveSize(parseInt(e.target.value))}
                    className="w-full cursor-pointer h-1"
                  />
                  <span className="text-[10px] font-bold text-white/30 w-6 text-right">{activeSize}px</span>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleUndo}
                  className="px-3.5 py-1.5 hover:bg-white/5 text-white/35 hover:text-white/60 rounded-xl border border-white/5 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                  title="Undo last stroke"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShareLink}
                    className={`px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                        : 'bg-white/5 hover:bg-white/[0.08] text-white/35 hover:text-white/60 border border-white/5'
                    }`}
                    title="Copy room link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied!' : 'Share'}</span>
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
        {showChat && (
          <div className="fixed z-30 flex flex-col shadow-2xl glass-card-strong min-h-0 w-full h-full inset-0 sm:w-80 sm:h-auto sm:inset-auto sm:top-[68px] sm:bottom-5 sm:right-5 rounded-none sm:rounded-2xl animate-slide-in-right overflow-hidden">

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
                      <div
                        className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? 'bg-gradient-to-r from-rose-500/90 to-amber-500/90 text-white rounded-br-sm'
                            : 'bg-white/[0.08] text-white/70 rounded-bl-sm border border-white/5'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Timestamp */}
                      <span className="text-[9px] text-white/20 mt-1 px-1">
                        {isMe ? 'You' : msg.sender} • {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-white/[0.03] flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onBlur={handleInputBlur}
                placeholder="Write a sweet message..."
                maxLength={200}
                className="flex-grow px-3 py-2 glass-input rounded-xl text-xs transition"
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
              This will erase all drawings for both you and your partner. Are you sure you want to start fresh?
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

    </div>
  );
}
