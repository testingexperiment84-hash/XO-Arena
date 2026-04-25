import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Settings, Trophy, RotateCcw, LogIn, LogOut, X, Circle,
  Triangle, Square, Star, Heart, Ghost, Skull, Crown, Rocket,
  Eraser, Shield, Zap, Undo, Moon, Sun, Monitor, User as UserIcon, Check, History, Flame, MessageCircle, Send
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, where, doc, setDoc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json'

// --- Firebase Setup ---
// In AI Studio, firebase-applet-config.json provides the credentials.
// For GitHub or Vercel builds, you can provide these as VITE_ environment variables.
const firebaseConfig = {
  apiKey: firebaseConfigJson?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: firebaseConfigJson?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseConfigJson?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: firebaseConfigJson?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseConfigJson?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseConfigJson?.appId || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: firebaseConfigJson?.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId: firebaseConfigJson?.firestoreDatabaseId || import.meta.env.VITE_FIRESTORE_DATABASE_ID
};

const isFirebaseConfigured = !!firebaseConfig.projectId;

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const analytics = isFirebaseConfigured ? getAnalytics(app!) : null;
const db = isFirebaseConfigured ? getFirestore(app!, firebaseConfig.firestoreDatabaseId) : null;
const auth = isFirebaseConfigured ? getAuth(app!) : null;

// --- Types ---
type Player = { name: string; icon: string; iconType?: 'lucide' | 'custom'; iconUrl?: string; color: string; mark: string };
type BoardState = (string | null)[];
type PowerUps = { remove: number; block: number; double: number };
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type Theme = 'modern' | 'neon' | 'brutalist' | 'minimalist';

// --- Constants ---
const ICONS: Record<string, React.ElementType> = {
  X, Circle, Triangle, Square, Star, Heart, Ghost, Skull, Crown, Rocket
};
const COLORS = [
  { name: 'Sky', value: '#38bdf8', class: 'text-sky-400' },
  { name: 'Rose', value: '#fb7185', class: 'text-rose-400' },
  { name: 'Emerald', value: '#34d399', class: 'text-emerald-400' },
  { name: 'Amber', value: '#fbbf24', class: 'text-amber-400' },
  { name: 'Violet', value: '#a78bfa', class: 'text-violet-400' },
  { name: 'Slate', value: '#f8fafc', class: 'text-slate-50' },
];

// --- Helpers ---
function getWinningLines(size: number, winLength: number) {
  const lines: number[][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - winLength; c++) {
      const line = [];
      for (let i = 0; i < winLength; i++) line.push(r * size + c + i);
      lines.push(line);
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - winLength; r++) {
      const line = [];
      for (let i = 0; i < winLength; i++) line.push((r + i) * size + c);
      lines.push(line);
    }
  }
  for (let r = 0; r <= size - winLength; r++) {
    for (let c = 0; c <= size - winLength; c++) {
      const line = [];
      for (let i = 0; i < winLength; i++) line.push((r + i) * size + (c + i));
      lines.push(line);
    }
  }
  for (let r = 0; r <= size - winLength; r++) {
    for (let c = winLength - 1; c < size; c++) {
      const line = [];
      for (let i = 0; i < winLength; i++) line.push((r + i) * size + (c - i));
      lines.push(line);
    }
  }
  return lines;
}

function checkWinner(board: BoardState, size: number, winLength: number) {
  const lines = getWinningLines(size, winLength);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const first = board[line[0]];
    if (first && first !== 'BLOCK') {
      let isWin = true;
      for (let j = 1; j < winLength; j++) {
        if (board[line[j]] !== first) {
          isWin = false;
          break;
        }
      }
      if (isWin) return { winner: first, line };
    }
  }
  return null;
}

export default function App() {
  // --- State ---
  const [theme, setTheme] = useState<Theme>('modern');
  const [gridSize, setGridSize] = useState<number>(3);
  const [winLength, setWinLength] = useState<number>(3);
  const [mode, setMode] = useState<'2P' | 'AI' | 'ONLINE'>('AI');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<'waiting' | 'playing' | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  
  const [history, setHistory] = useState<BoardState[]>([Array(9).fill(null)]);
  const [stepNumber, setStepNumber] = useState(0);
  const [xIsNext, setXIsNext] = useState(true);
  
  const [isTimerMode, setIsTimerMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  
  const [p1PowerUps, setP1PowerUps] = useState<PowerUps>({ remove: 3, block: 3, double: 2 });
  const [p2PowerUps, setP2PowerUps] = useState<PowerUps>({ remove: 3, block: 3, double: 2 });
  const [p1Cooldowns, setP1Cooldowns] = useState<PowerUps>({ remove: 0, block: 0, double: 0 });
  const [p2Cooldowns, setP2Cooldowns] = useState<PowerUps>({ remove: 0, block: 0, double: 0 });
  const [activePowerUp, setActivePowerUp] = useState<keyof PowerUps | null>(null);
  const [isDoubleMove, setIsDoubleMove] = useState(false);

  const [player1, setPlayer1] = useState<Player>({ name: 'Player 1', icon: 'X', iconType: 'lucide', color: '#b1a1ff', mark: 'P1' });
  const [player2, setPlayer2] = useState<Player>({ name: 'Player 2', icon: 'Circle', iconType: 'lucide', color: '#00eefc', mark: 'P2' });
  
  const [scores, setScores] = useState({ p1: 0, p2: 0, currentStreakHolder: null as 'P1' | 'P2' | null, streakCount: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({ wins: 0, draws: 0, total: 0 });
  const [lbFilterMode, setLbFilterMode] = useState<'ALL' | 'AI' | '2P' | 'ONLINE'>('ALL');
  const [lbFilterGrid, setLbFilterGrid] = useState<'ALL' | 3 | 4 | 5>('ALL');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const updatePlayerIcon = (playerNum: 1 | 2, icon: string) => {
    if (playerNum === 1) {
      if (player2.icon === icon && player2.iconType === 'lucide') {
        setPlayer2({ ...player2, icon: player1.icon });
      }
      setPlayer1({ ...player1, iconType: 'lucide', icon });
    } else {
      if (player1.icon === icon && player1.iconType === 'lucide') {
        setPlayer1({ ...player1, icon: player2.icon });
      }
      setPlayer2({ ...player2, iconType: 'lucide', icon });
    }
  };

  const board = history[stepNumber];
  const winInfo = checkWinner(board, gridSize, winLength);
  const winner = winInfo?.winner;
  const winningLine = winInfo?.line || [];
  const isDraw = !winner && board.every(cell => cell !== null);
  const currentPlayer = xIsNext ? player1 : player2;
  const currentPowerUps = xIsNext ? p1PowerUps : p2PowerUps;
  const currentCooldowns = xIsNext ? p1Cooldowns : p2Cooldowns;

  // --- Audio ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = (type: 'place' | 'win' | 'draw' | 'powerup') => {
    if (isSoundMuted) return;
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'place') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(xIsNext ? 440 : 554.37, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'powerup') {
      // Arpeggiator effect for power-up
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.05);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.setTargetAtTime(0.01, ctx.currentTime + 0.1, 0.05);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'win') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'draw') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  };

  // --- Effects ---
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    if (!localStorage.getItem('xo_tutorial_seen')) {
      setShowTutorial(true);
      localStorage.setItem('xo_tutorial_seen', 'true');
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setPlayer1(p => ({ ...p, name: currentUser.displayName || 'Player 1' }));
        fetchUserStats(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserStats = async (uid: string) => {
    if (!db) return;
    try {
      const q = query(collection(db, 'gameHistory'), where('userId', '==', uid));
      const snapshot = await getDocs(q);
      let wins = 0;
      let total = snapshot.docs.length;
      snapshot.docs.forEach(doc => {
        if (doc.data().outcome === 'Win') wins++;
      });
      setUserStats({ wins, draws: 0, total });
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  const showChatRef = useRef(false);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);

  useEffect(() => {
    if (mode !== 'ONLINE' || !roomId || !db) return;
    const unsub = onSnapshot(doc(db, 'games', roomId), (docSnap) => {
      if (docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
        const data = docSnap.data();
        if (data.status === 'playing' && onlineStatus === 'waiting') {
           setOnlineStatus('playing');
        }
        if (data.stateStr) {
           const remoteState = JSON.parse(data.stateStr);
           setHistory(remoteState.history);
           setStepNumber(remoteState.stepNumber);
           setXIsNext(remoteState.xIsNext);
        }
      }
    });
    
    let isInitialLoad = true;
    const messagesQuery = query(collection(db, 'games', roomId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChatMessages(newMessages);
        
        if (isInitialLoad) {
            isInitialLoad = false;
        } else {
            let newDocs = 0;
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') newDocs++;
            });
            
            if (newDocs > 0 && !showChatRef.current) {
                setUnreadCount(prev => prev + newDocs);
            }
        }
    });

    return () => {
        unsub();
        unsubMessages();
    };
  }, [mode, roomId, onlineStatus]);

  useEffect(() => {
    if (showChat) {
        setUnreadCount(0);
    }
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  useEffect(() => {
    if (winner && winner !== 'BLOCK') {
      playSound('win');
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: [player1.color, player2.color] });
      setScores(s => {
        const isP1 = winner === player1.mark;
        const streakHolder = isP1 ? 'P1' as const : 'P2' as const;
        const sameHolder = s.currentStreakHolder === streakHolder;
        return {
          p1: isP1 ? s.p1 + 1 : s.p1,
          p2: !isP1 ? s.p2 + 1 : s.p2,
          currentStreakHolder: streakHolder,
          streakCount: sameHolder ? s.streakCount + 1 : 1
        };
      });
      if (user && winner === player1.mark) saveWinToLeaderboard();
      if (user) saveToHistory(winner === player1.mark ? 'Win' : 'Loss');
    } else if (isDraw) {
      playSound('draw');
      setScores(s => ({ ...s, currentStreakHolder: null, streakCount: 0 }));
      if (user) saveToHistory('Draw');
    }
  }, [winner, isDraw]);

  useEffect(() => {
    if (!isTimerMode || winner || isDraw) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setXIsNext(!xIsNext);
          setActivePowerUp(null);
          setIsDoubleMove(false);
          return 10;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [xIsNext, winner, isDraw, isTimerMode]);

  useEffect(() => {
    if (mode === 'AI' && !xIsNext && !winner && !isDraw) {
      setIsAiThinking(true);
      setAiProgress(0);
      
      const interval = setInterval(() => {
        setAiProgress(p => Math.min(p + 10, 100));
      }, 150); // Progress bar updates over 1.5s

      const timer = setTimeout(() => {
        const move = getAiMove(board, player2.mark, player1.mark);
        if (move !== -1) handleCellClick(move, true);
        setIsAiThinking(false);
      }, 1500);
      return () => {
        clearInterval(interval);
        clearTimeout(timer);
        setIsAiThinking(false);
      }
    }
  }, [xIsNext, board, winner, isDraw, mode]);

  // --- Logic ---
  const getAiMove = (currentBoard: BoardState, aiMark: string, pMark: string) => {
    const available = currentBoard.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
    if (available.length === 0) return -1;

    const wins = (move: number, mark: string) => {
      const b = [...currentBoard];
      b[move] = mark;
      return checkWinner(b, gridSize, winLength) !== null;
    };

    if (difficulty === 'EASY') {
       return available[Math.floor(Math.random() * available.length)];
    }

    // 1. Immediate Win
    for (let move of available) if (wins(move, aiMark)) return move;

    // 2. Immediate Block
    for (let move of available) if (wins(move, pMark)) return move;

    // 3. Minimax for HARD
    if (difficulty === 'HARD') {
      const maxDepth = gridSize === 3 ? 9 : 3;

      const minimax = (b: BoardState, depth: number, isMaximizing: boolean, alpha: number, beta: number): number => {
        const winCheck = checkWinner(b, gridSize, winLength);
        if (winCheck?.winner === aiMark) return 100 - depth;
        if (winCheck?.winner === pMark) return -100 + depth;

        const empties = b.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
        if (empties.length === 0 || depth >= maxDepth) return 0;

        if (isMaximizing) {
          let maxEval = -Infinity;
          for (let move of empties) {
            b[move] = aiMark;
            const ev = minimax(b, depth + 1, false, alpha, beta);
            b[move] = null;
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
          }
          return maxEval;
        } else {
          let minEval = Infinity;
          for (let move of empties) {
            b[move] = pMark;
            const ev = minimax(b, depth + 1, true, alpha, beta);
            b[move] = null;
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
          }
          return minEval;
        }
      };

      let bestScore = -Infinity;
      let bestMove = available[0];

      if (available.length === gridSize * gridSize) return Math.floor((gridSize * gridSize) / 2);

      const bCopy = [...currentBoard];
      for (let move of available) {
        bCopy[move] = aiMark;
        const score = minimax(bCopy, 0, false, -Infinity, Infinity);
        bCopy[move] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      return bestMove;
    }

    if (difficulty === 'MEDIUM') {
      const center = Math.floor((gridSize * gridSize) / 2);
      if (available.includes(center)) return center;
    }

    // 4. Random fallback for EASY / early moves
    return available[Math.floor(Math.random() * available.length)];
  };

  const handleCellClick = (index: number, isAi = false) => {
    if (winner || isDraw || (mode === 'AI' && !xIsNext && !isAi)) return;
    if (mode === 'ONLINE') {
      if (onlineStatus !== 'playing') return;
      if (isHost && !xIsNext) return;
      if (!isHost && xIsNext) return;
    }

    const newBoard = [...board];

    if (activePowerUp === 'remove') {
      if (newBoard[index] === (xIsNext ? player2.mark : player1.mark)) {
        newBoard[index] = null;
        consumePowerUp('remove');
        finalizeMove(newBoard);
      }
      return;
    }

    if (activePowerUp === 'block') {
      if (!newBoard[index]) {
        newBoard[index] = 'BLOCK';
        consumePowerUp('block');
        finalizeMove(newBoard);
      }
      return;
    }

    if (newBoard[index]) return;

    newBoard[index] = xIsNext ? player1.mark : player2.mark;
    playSound('place');

    if (activePowerUp === 'double') {
      consumePowerUp('double');
      setIsDoubleMove(true);
      setActivePowerUp(null);
      const newHistory = history.slice(0, stepNumber + 1);
      const appended = [...newHistory, newBoard];
      setHistory(appended);
      setStepNumber(newHistory.length);
      syncGameState({ stateStr: JSON.stringify({ history: appended, stepNumber: newHistory.length, xIsNext }) });
      return; // Don't switch turns
    }

    if (isDoubleMove) {
      setIsDoubleMove(false);
    }

    finalizeMove(newBoard, !isDoubleMove);
  };

  const finalizeMove = (newBoard: BoardState, switchTurn = true) => {
    const newHistory = history.slice(0, stepNumber + 1);
    const appendedHistory = [...newHistory, newBoard];
    setHistory(appendedHistory);
    setStepNumber(newHistory.length);
    
    let nextTurn = xIsNext;
    if (switchTurn) {
      nextTurn = !xIsNext;
      if (xIsNext) {
        setP1Cooldowns(c => ({ remove: Math.max(0, c.remove - 1), block: Math.max(0, c.block - 1), double: Math.max(0, c.double - 1) }));
      } else {
        setP2Cooldowns(c => ({ remove: Math.max(0, c.remove - 1), block: Math.max(0, c.block - 1), double: Math.max(0, c.double - 1) }));
      }
      setXIsNext(nextTurn);
      setTimeLeft(10);
    }
    setActivePowerUp(null);

    syncGameState({
      stateStr: JSON.stringify({ history: appendedHistory, stepNumber: newHistory.length, xIsNext: nextTurn })
    });
  };

  const consumePowerUp = (type: keyof PowerUps) => {
    playSound('powerup');
    const COOLDOWNS = { remove: 3, block: 3, double: 4 };
    if (xIsNext) {
      setP1PowerUps(p => ({ ...p, [type]: p[type] - 1 }));
      setP1Cooldowns(c => ({ ...c, [type]: COOLDOWNS[type] }));
    } else {
      setP2PowerUps(p => ({ ...p, [type]: p[type] - 1 }));
      setP2Cooldowns(c => ({ ...c, [type]: COOLDOWNS[type] }));
    }
  };

  const jumpTo = (step: number) => {
    setStepNumber(step);
    setXIsNext(step % 2 === 0);
    setTimeLeft(10);
    setActivePowerUp(null);
    setIsDoubleMove(false);
  };

  const resetGame = () => {
    setHistory([Array(gridSize * gridSize).fill(null)]);
    setStepNumber(0);
    setXIsNext(true);
    setTimeLeft(10);
    setActivePowerUp(null);
    setIsDoubleMove(false);
    setP1PowerUps({ remove: 3, block: 3, double: 2 });
    setP2PowerUps({ remove: 3, block: 3, double: 2 });
    setP1Cooldowns({ remove: 0, block: 0, double: 0 });
    setP2Cooldowns({ remove: 0, block: 0, double: 0 });
    syncGameState({ stateStr: JSON.stringify({ history: [Array(gridSize * gridSize).fill(null)], stepNumber: 0, xIsNext: true }) });
  };

  const changeGridSize = (size: number) => {
    setGridSize(size);
    const newWinLength = Math.min(winLength, size);
    if (newWinLength !== winLength) setWinLength(newWinLength);
    setHistory([Array(size * size).fill(null)]);
    setStepNumber(0);
    setXIsNext(true);
  };

  const changeWinLength = (len: number) => {
    if (len <= gridSize) {
      setWinLength(len);
      setHistory([Array(gridSize * gridSize).fill(null)]);
      setStepNumber(0);
      setXIsNext(true);
    }
  };

  const syncGameState = async (changes: any) => {
    if (mode !== 'ONLINE' || !roomId || !db) return;
    try { await updateDoc(doc(db, 'games', roomId), changes); } catch (e) { console.error(e) }
  };

  const createMultiplayerGame = async () => {
    if (!user || !db) return alert("Sign in to play online!");
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await setDoc(doc(db, 'games', newRoomId), {
        host: { uid: user.uid, displayName: user.displayName || 'P1', mark: 'P1' },
        guest: null,
        gridSize,
        winLength,
        stateStr: JSON.stringify({ history: [Array(gridSize * gridSize).fill(null)], stepNumber: 0, xIsNext: true }),
        status: 'waiting',
      });
      setRoomId(newRoomId);
      setIsHost(true);
      setMode('ONLINE');
      setOnlineStatus('waiting');
      changeGridSize(gridSize);
    } catch (e) { console.error(e) }
  };

  const joinMultiplayerGame = async (code: string) => {
    if (!user || !db) return alert("Sign in to play online!");
    const roomRef = doc(db, 'games', code.toUpperCase());
    try {
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'waiting' && data.host.uid !== user.uid) {
          await updateDoc(roomRef, {
            guest: { uid: user.uid, displayName: user.displayName || 'P2', mark: 'P2' },
            status: 'playing'
          });
          setRoomId(code.toUpperCase());
          setIsHost(false);
          setMode('ONLINE');
          setOnlineStatus('playing');
          setGridSize(data.gridSize);
          setWinLength(data.winLength);
          const st = JSON.parse(data.stateStr);
          setHistory(st.history);
          setStepNumber(st.stepNumber);
          setXIsNext(st.xIsNext);
        } else { alert('Room is full or you are the host.'); }
      } else { alert('Room not found'); }
    } catch (e) { console.error(e) }
  };

  const handleGoogleLogin = async () => {
    if (!auth) {
      alert("Firebase environment variables are missing! Please check your AI Studio settings.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/popup-closed-by-user') {
        // Ignore if user intentionally closed the popup, or it was blocked contextually
        console.log('Login popup was closed before completion.');
      } else {
        alert(`Login failed: ${e.message}\n\nIf you are viewing this inside the AI Studio preview, you may need to click 'Open App' in the top right to open the app in a new tab for Google Login to work.`);
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user || !roomId || !db || mode !== 'ONLINE') return;
    
    const msgText = chatInput.trim();
    setChatInput("");
    try {
        await addDoc(collection(db, 'games', roomId, 'messages'), {
            text: msgText,
            senderId: user.uid,
            senderName: user.displayName || 'Anonymous',
            timestamp: serverTimestamp()
        });
    } catch(err) {
        console.error("Error sending message", err);
    }
  };

  const saveWinToLeaderboard = async () => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, 'leaderboard'), {
        userId: user.uid,
        name: user.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        gridSize,
        difficulty: mode === 'AI' ? difficulty : 'PvP',
        gameMode: mode
      });
    } catch (e) {
      console.error("Error saving score:", e);
    }
  };

  const saveToHistory = async (outcome: 'Win' | 'Loss' | 'Draw') => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, 'gameHistory'), {
        userId: user.uid,
        opponent: mode === 'AI' ? `AI (${difficulty})` : player2.name,
        outcome,
        gridSize,
        timestamp: serverTimestamp(),
        gameMode: mode
      });
    } catch (e) {
      console.error("Error saving history:", e);
    }
  };

  const fetchGameHistory = async () => {
    if (!user || !db) return;
    try {
      const q = query(collection(db, 'gameHistory'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data());
      data.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setGameHistory(data.slice(0, 50));
    } catch (e) {
      console.error("Error fetching history:", e);
    }
  };

  const fetchLeaderboard = async () => {
    if (!db) return;
    try {
      const qWins = query(collection(db, 'leaderboard'), orderBy('timestamp', 'desc'), limit(200));
      const qHist = query(collection(db, 'gameHistory'), orderBy('timestamp', 'desc'), limit(500));
      
      const [winsSnap, histSnap] = await Promise.all([getDocs(qWins), getDocs(qHist)]);
      
      let data = winsSnap.docs.map(doc => doc.data());
      const histData = histSnap.docs.map(doc => doc.data());
      
      if (lbFilterMode !== 'ALL') {
        data = data.filter(d => {
           if (lbFilterMode === 'AI') return d.difficulty !== 'PvP' || d.gameMode === 'AI';
           if (lbFilterMode === '2P') return d.gameMode === '2P' || (d.difficulty === 'PvP' && !d.gameMode);
           if (lbFilterMode === 'ONLINE') return d.gameMode === 'ONLINE';
           return true;
        });
      }
      if (lbFilterGrid !== 'ALL') {
        data = data.filter(d => d.gridSize === lbFilterGrid);
      }

      const userTotals: Record<string, number> = {};
      histData.forEach(hd => {
         if (!userTotals[hd.userId]) userTotals[hd.userId] = 0;
         userTotals[hd.userId]++;
      });

      // Group by user and count wins
      const counts: Record<string, any> = {};
      data.forEach(d => {
        if (!counts[d.userId]) counts[d.userId] = { name: d.name, wins: 0, total: 0 };
        counts[d.userId].wins++;
        counts[d.userId].total = Math.max(counts[d.userId].wins, userTotals[d.userId] || counts[d.userId].wins);
      });
      setLeaderboardData(Object.values(counts).sort((a, b) => b.wins - a.wins).slice(0, 10));
    } catch (e) {
      console.error("Error fetching leaderboard:", e);
    }
  };

  useEffect(() => {
    if (showLeaderboard) fetchLeaderboard();
  }, [lbFilterMode, lbFilterGrid]);

  const handleFileUpload = (playerNum: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        if (playerNum === 1) setPlayer1(p => ({ ...p, iconType: 'custom', iconUrl: url }));
        else setPlayer2(p => ({ ...p, iconType: 'custom', iconUrl: url }));
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Render Helpers ---
  const renderIcon = (mark: string | null, className = '') => {
    if (!mark) return null;
    if (mark === 'BLOCK') return <Shield className={`w-full h-full p-2 text-gray-500 ${className}`} />;
    const p = mark === player1.mark ? player1 : player2;
    if (p.iconType === 'custom' && p.iconUrl) {
      return <img src={p.iconUrl} alt={p.name} className={`w-full h-full object-contain p-2 ${className}`} style={{ filter: `drop-shadow(0 0 4px ${p.color})` }} />;
    }
    const Icon = ICONS[p.icon] || X;
    return <Icon className={`w-full h-full p-2 ${className}`} style={{ color: p.color }} />;
  };

  return (
    <div className="text-on-surface font-body min-h-screen selection:bg-primary-container/30 overflow-x-hidden relative pb-28">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden transition-all duration-1000">
        {theme === 'modern' && (
          <>
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-900/10 blur-[150px] rounded-full"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/10 blur-[150px] rounded-full"></div>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }}></div>
          </>
        )}
        {theme === 'neon' && (
          <>
            <div className="absolute top-[0%] right-[0%] w-[60%] h-[60%] bg-fuchsia-600/20 blur-[120px] rounded-full mix-blend-screen"></div>
            <div className="absolute bottom-[0%] left-[0%] w-[60%] h-[60%] bg-cyan-500/20 blur-[120px] rounded-full mix-blend-screen"></div>
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
          </>
        )}
        {theme === 'brutalist' && (
          <>
            <div className="absolute inset-0 bg-[#0e0e0e]" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/concrete-wall.png')", opacity: 0.1 }}></div>
            <div className="absolute top-[10%] left-[10%] w-[80%] h-[1px] bg-white/20"></div>
            <div className="absolute top-[30%] left-[10%] w-[80%] h-[1px] bg-white/10"></div>
            <div className="absolute top-[10%] left-[10%] w-[1px] h-[80%] bg-white/20"></div>
            <div className="absolute top-[10%] right-[10%] w-[1px] h-[80%] bg-white/20"></div>
          </>
        )}
        {theme === 'minimalist' && (
          <>
            <div className="absolute inset-0 bg-[#0a0a0a]"></div>
            <div className="absolute inset-0 opacity-[0.01]" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/stardust.png')" }}></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] border-[1px] border-white/5 rounded-full"></div>
          </>
        )}
      </div>

      {/* TopNavBar (Shared Component) */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center gap-6 rounded-full mt-4 mx-auto w-fit max-w-[calc(100vw-32px)] px-6 py-2 bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(88,17,255,0.1)]">

        <div className="hidden sm:block text-2xl font-bold bg-gradient-to-br from-violet-500 to-violet-700 bg-clip-text text-transparent font-headline tracking-tight">XO Arena</div>
        <div className="hidden sm:block h-6 w-[1px] bg-outline-variant/30"></div>
        <div className="flex items-center gap-2">
          {mode === 'ONLINE' && roomId ? (
            <>
              <div className={`w-2 h-2 rounded-full ${onlineStatus === 'playing' ? 'bg-secondary-fixed' : 'bg-primary animate-pulse'}`}></div>
              <span className="text-slate-500 font-mono text-xs tracking-wider">ROOM</span>
              <span className="text-violet-400 font-bold font-mono px-2">{roomId}</span>
            </>
          ) : (
            <span className="text-slate-500 font-mono text-xs tracking-wider px-2">{mode}</span>
          )}
        </div>
        <nav className="flex items-center gap-4 sm:ml-4">
          <button onClick={() => setIsSoundMuted(!isSoundMuted)} className="text-slate-400 hover:text-cyan-400 transition-colors scale-90 relative">
            <span className="material-symbols-outlined">{isSoundMuted ? 'volume_off' : 'volume_up'}</span>
          </button>
          <button onClick={() => setShowTutorial(true)} className="text-slate-400 hover:text-cyan-400 transition-colors scale-90 relative">
            <span className="material-symbols-outlined">help</span>
          </button>
          {mode === 'ONLINE' && roomId && (
            <button onClick={() => setShowChat(true)} className="text-slate-400 hover:text-cyan-400 transition-colors scale-95 active:scale-90 relative">
              <span className="material-symbols-outlined">chat</span>
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold text-white">{unreadCount}</span>}
            </button>
          )}
          <button onClick={resetGame} className="text-slate-400 hover:text-cyan-400 transition-colors scale-95 active:scale-90">
            <span className="material-symbols-outlined">restart_alt</span>
          </button>
          <button onClick={() => { setShowLeaderboard(true); fetchLeaderboard(); }} className="text-slate-400 hover:text-cyan-400 transition-colors scale-95 active:scale-90">
            <span className="material-symbols-outlined">leaderboard</span>
          </button>
          <button onClick={() => setShowSettings(true)} className="text-violet-400 hover:text-cyan-400 transition-colors scale-95 active:scale-90 transition-transform">
            <span className="material-symbols-outlined shrink-0" data-icon="settings">settings</span>
          </button>
        </nav>
      </header>

      {/* Multiplayer Lobby Overlay */}
      <AnimatePresence>
        {mode === 'ONLINE' && onlineStatus !== 'playing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-12 overflow-hidden bg-surface-dim/80 backdrop-blur-[40px]">
            {/* Background ambient lighting */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[120px]"></div>
              <img className="w-full h-full object-cover opacity-20 grayscale brightness-50" referrerPolicy="no-referrer" alt="background texture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBDdEwZeWlWAGgSs-CshUYj5o8SryJ3LfwOj6sQ1_yc0Y-gAqXItk3tlmPtJC14d-XoREvgJTffWzq-9OfwO5ubjLP2iMY8Kfdyd1ymZq0L2YQjdxKv0Qthg_8kp_uKkpkVu37LMmCAmMC29Z32UepOdOGy93xMiMEsQay0sdt2IWp-CUjRlq0l7rBjT6nxyIYk5f4_dd8tgsPrxIIsRCvoIaOPaOxVyzNxw6p35kJgZxYDWchlQ_BkBbWI_5OupPXjEtHZGOCZUjE"/>
            </div>

            <motion.section initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative z-10 w-full max-w-5xl bg-surface-container-high/40 backdrop-blur-[40px] rounded-lg border-t border-white/5 shadow-2xl overflow-x-hidden flex flex-col md:grid md:grid-cols-12 gap-0 max-h-[90vh] overflow-y-auto custom-scrollbar">
              
              {/* Left Side: Status & Global Waiting State */}
              <div className="col-span-12 md:col-span-5 p-8 md:p-12 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 bg-surface-container-lowest/30 shrink-0">
                  <div className="relative mb-10">
                      {/* Animated Pulse Loader */}
                      <div className="w-32 h-32 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                          <div className={`absolute inset-0 rounded-full border-t-4 border-secondary ${roomId && onlineStatus === 'waiting' ? 'pulse-glow' : ''}`}></div>
                          <span className="material-symbols-outlined text-5xl text-primary" data-icon="group" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                      </div>
                      {/* Secondary Orbital Glow */}
                      <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-secondary-dim/20 blur-xl"></div>
                  </div>
                  <h1 className="font-headline text-3xl font-bold tracking-tight text-center mb-2">Lobby {roomId ? 'Active' : 'Core'}</h1>
                  <p className="font-label text-on-surface-variant uppercase tracking-widest text-xs text-center mb-8">{roomId ? 'Waiting for Challenger...' : 'Ready to Connect'}</p>
                  
                  <div className="w-full space-y-4">
                      <div className="flex items-center justify-between p-4 bg-surface-container rounded-lg">
                          <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-secondary" data-icon="online_prediction">online_prediction</span>
                              <span className="text-sm font-medium">Server Latency</span>
                          </div>
                          <span className="font-mono text-secondary-fixed text-sm">24ms</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-surface-container rounded-lg">
                          <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-primary" data-icon="public">public</span>
                              <span className="text-sm font-medium">Region</span>
                          </div>
                          <span className="font-mono text-primary-fixed text-sm">EU-WEST</span>
                      </div>
                  </div>
              </div>

              {/* Right Side: Create/Join Actions */}
              <div className="col-span-12 md:col-span-7 p-8 md:p-12 space-y-8 md:space-y-12">
                  {/* Create Room Section */}
                  <div>
                      <label className="font-label text-on-surface-variant uppercase tracking-[0.2em] text-[10px] font-bold mb-4 block">Host a Match</label>
                      <div className="flex flex-col gap-4">
                          {roomId && onlineStatus === 'waiting' ? (
                            <>
                              <div className="bg-surface-container-low p-6 rounded-lg border border-white/5 flex flex-col md:flex-row items-center justify-between group hover:bg-surface-container transition-all gap-4">
                                  <div className="space-y-1 text-center md:text-left">
                                      <p className="text-xs text-on-surface-variant font-medium">Room ID</p>
                                      <p className="font-mono text-3xl font-bold tracking-wider text-primary">{roomId}</p>
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(roomId); alert('Room code copied!'); }} className="flex items-center justify-center p-4 bg-primary-container/10 hover:bg-primary-container/20 text-primary rounded-full transition-all active:scale-95 group-hover:shadow-[0_0_20px_rgba(177,161,255,0.2)]">
                                      <span className="material-symbols-outlined" data-icon="content_copy">content_copy</span>
                                  </button>
                              </div>
                              <p className="text-[11px] text-on-surface-variant italic text-center md:text-left">Share this code with your opponent to start a private duel.</p>
                            </>
                          ) : (
                            <button onClick={createMultiplayerGame} className="w-full bg-gradient-to-r from-primary to-primary-dim hover:brightness-110 text-on-primary rounded-lg py-4 font-bold transition flex justify-center items-center gap-3 uppercase tracking-wider text-sm shadow-[0_10px_30px_rgba(88,17,255,0.3)]">
                                <span className="material-symbols-outlined">add_circle</span>
                                Create New Room
                            </button>
                          )}
                      </div>
                  </div>

                  {/* Divider with Label */}
                  <div className="relative flex items-center">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink mx-4 text-[10px] font-mono text-outline uppercase tracking-widest">OR</span>
                      <div className="flex-grow border-t border-white/5"></div>
                  </div>

                  {/* Join Room Section */}
                  <div>
                      <label className="font-label text-on-surface-variant uppercase tracking-[0.2em] text-[10px] font-bold mb-4 block">Join Arena</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                          <div className="relative flex-grow">
                              <input 
                                value={joinCodeInput} 
                                onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                                maxLength={6}
                                className="w-full bg-surface-container-highest/50 border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none rounded-lg px-5 py-4 font-mono text-lg placeholder:text-outline tracking-widest transition-all text-center sm:text-left" 
                                placeholder="Enter Room Code..." 
                                type="text"
                              />
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant hidden sm:block">
                                  <span className="material-symbols-outlined" data-icon="search">search</span>
                              </div>
                          </div>
                          <button onClick={() => joinMultiplayerGame(joinCodeInput)} disabled={joinCodeInput.length < 5} className="bg-gradient-to-br from-secondary to-secondary-container text-on-secondary px-8 py-4 rounded-lg font-bold uppercase tracking-widest text-xs hover:shadow-[0_0_25px_rgba(0,238,252,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shrink-0">
                              Join
                              <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
                          </button>
                      </div>
                  </div>

                  {/* Quick Actions / Navigation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                      <button onClick={() => { setMode('AI'); setOnlineStatus(null); setRoomId(null); }} className="p-4 rounded-lg border border-outline-variant/30 hover:bg-surface-container transition-colors flex justify-center items-center gap-3">
                          <span className="material-symbols-outlined text-on-surface-variant" data-icon="sports_esports">sports_esports</span>
                          <span className="text-sm font-medium shrink-0">Practice AI</span>
                      </button>
                      <button onClick={() => { setMode('2P'); setOnlineStatus(null); setRoomId(null); }} className="p-4 rounded-lg border border-outline-variant/30 hover:bg-surface-container transition-colors flex justify-center items-center gap-3">
                          <span className="material-symbols-outlined text-on-surface-variant" data-icon="stadium">stadium</span>
                          <span className="text-sm font-medium shrink-0">Local 2P</span>
                      </button>
                  </div>
              </div>
            </motion.section>

            {/* Decorative Elements */}
            <div className="absolute bottom-12 left-12 hidden md:flex gap-4 items-center z-20 pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></div>
                <span className="font-mono text-[10px] text-on-surface-variant tracking-tighter uppercase">XOA // NODE_STABLE // 0.9.4.2</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <main className="pt-24 pb-28 px-4 md:px-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative z-10 w-full">
        
        {/* Left Panel: Status & PowerUps */}
        <section className="md:col-span-4 flex flex-col gap-6">
          
          {/* Turn Card */}
          <div className="glass-panel p-6 rounded-lg border-t border-white/5 relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all"></div>
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Current Turn</p>
                <h2 className={`text-2xl font-headline font-bold transition-opacity ${isAiThinking ? 'opacity-50' : ''}`} style={{ color: currentPlayer.color, textShadow: `0 0 15px ${currentPlayer.color}80` }}>{currentPlayer.name}</h2>
              </div>
              <div className="bg-surface-container-high px-3 py-1 rounded-full flex items-center gap-2">
                {isAiThinking ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
                    <span className="text-[10px] font-mono text-secondary">AI Thinking...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse"></span>
                    <span className="text-[10px] font-mono text-primary">Your turn</span>
                  </>
                )}
              </div>
            </div>
            {isAiThinking && (
              <div className="mt-4">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-secondary text-[10px] uppercase tracking-widest font-bold">Processing Logic</span>
                  <span className="font-mono text-xs text-secondary">{aiProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full transition-all duration-150 ease-linear pulse-glow" style={{ width: `${aiProgress}%` }}></div>
                </div>
              </div>
            )}
            
            {isTimerMode && !isAiThinking && (
              <div className="mt-4">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-on-surface-variant text-xs">Remaining Time</span>
                  <span className="font-mono text-xl text-on-surface">00:{timeLeft.toString().padStart(2, '0')}</span>
                </div>
                <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / 15) * 100}%` }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Score Panel */}
          <div className="glass-panel p-6 rounded-lg border-t border-white/5 flex items-center justify-between">
            <div className="text-center w-24">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold truncate">{player1.name}</p>
              <p className="text-3xl font-headline font-bold text-white">{scores.p1}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className={`flex items-center gap-1 ${scores.streakCount > 1 ? 'text-error animate-pulse' : 'text-on-surface-variant opacity-50'}`}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                <span className="text-xs font-bold font-mono">{scores.streakCount} STREAK</span>
              </div>
              <div className="h-[1px] w-12 bg-outline-variant/30"></div>
              <span className="text-xs font-mono text-on-surface-variant">VS</span>
            </div>
            <div className="text-center w-24">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold truncate">{player2.name}</p>
              <p className="text-3xl font-headline font-bold text-white">{scores.p2}</p>
            </div>
          </div>

          {/* Power-Ups */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-on-surface-variant px-1">Power Arsenal</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'remove', icon: 'ink_eraser', colorClass: 'text-primary', hoverColor: 'hover:border-primary/40', label: 'Remove', count: currentPowerUps.remove, cd: currentCooldowns.remove },
                { id: 'block', icon: 'shield', colorClass: 'text-secondary-dim', hoverColor: 'hover:border-secondary-dim/40', label: 'Block', count: currentPowerUps.block, cd: currentCooldowns.block },
                { id: 'double', icon: 'dynamic_feed', colorClass: 'text-tertiary', hoverColor: 'hover:border-tertiary/40', label: 'Double', count: currentPowerUps.double, cd: currentCooldowns.double },
              ].map(p => {
                const isCooldown = p.cd > 0;
                const isDisabled = p.count === 0 || isCooldown || winner !== undefined || isDraw || (mode === 'AI' && !xIsNext);
                return (
                  <button
                    key={p.id}
                    disabled={isDisabled}
                    onClick={() => setActivePowerUp(activePowerUp === p.id ? null : p.id as keyof PowerUps)}
                    className={`group relative flex flex-col items-center justify-center aspect-square glass-panel rounded-lg border border-white/5 transition-all ${
                      activePowerUp === p.id ? 'bg-white/10 ring-1 ring-white/30 shell-active' : p.hoverColor
                    } ${isDisabled && !isCooldown ? 'opacity-30 cursor-not-allowed' : ''} ${isCooldown ? 'opacity-60 overflow-hidden' : ''}`}
                  >
                    <span className={`material-symbols-outlined mb-1 ${isCooldown ? 'text-gray-500' : p.colorClass}`}>{p.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-on-surface">{p.label}</span>
                    
                    {!isCooldown && !isDisabled && activePowerUp !== p.id && (
                      <div className="absolute inset-0 bg-surface-container-highest/80 flex flex-col items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        <span className={`font-mono text-sm font-bold ${p.colorClass}`}>READY</span>
                      </div>
                    )}

                    {!isCooldown && p.count > 0 && (
                      <div className={`absolute -top-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                        p.id === 'remove' ? 'bg-primary text-on-primary' : p.id === 'block' ? 'bg-secondary text-on-secondary' : 'bg-tertiary text-on-tertiary'
                      }`}>x{p.count}</div>
                    )}

                    <AnimatePresence>
                      {isCooldown && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center">
                          <div className="absolute inset-0 bg-surface-variant/40"></div>
                          <span className="relative font-mono text-sm font-bold text-white">{p.cd}t</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
            <div className="h-8 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {activePowerUp && (
                  <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-sm font-medium text-amber-400 font-headline">
                    {activePowerUp === 'remove' && 'Select an opponent\'s mark to remove.'}
                    {activePowerUp === 'block' && 'Select an empty cell to block.'}
                    {activePowerUp === 'double' && 'Place your first mark.'}
                  </motion.p>
                )}
                {isDoubleMove && (
                  <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-sm font-medium text-amber-400 font-headline">
                    Place your second mark!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

        </section>

        {/* Right Panel: Board & History */}
        <section className="md:col-span-8 flex flex-col gap-8">
          
          {/* Game Board Container */}
          <div className="relative flex items-center justify-center py-8">
            {/* Decorative Glows */}
            <div className="absolute w-96 h-96 bg-primary/5 blur-[100px] -z-10 rounded-full"></div>
            
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gap: '1rem',
                width: '100%',
                maxWidth: '500px',
                aspectRatio: '1/1'
              }}
            >
              {board.map((cell, i) => {
                const isWinningCell = winningLine.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => handleCellClick(i)}
                    className={`glass-panel aspect-square rounded-xl border border-white/5 hover:bg-white/5 transition-all flex items-center justify-center group overflow-hidden ${
                      isWinningCell ? 'ring-1 ring-white/50 bg-white/10' : ''
                    } ${activePowerUp === 'remove' && cell && cell !== 'BLOCK' && cell !== currentPlayer.mark ? 'ring-1 ring-error cursor-crosshair' : ''}`}
                  >
                    <AnimatePresence>
                      {cell && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="w-full h-full absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform"
                        >
                          {renderIcon(cell, 'w-3/4 h-3/4')}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {!cell && activePowerUp === 'block' && (
                        <span className="material-symbols-outlined text-primary-dim text-4xl group-hover:rotate-180 transition-transform opacity-30 group-hover:opacity-100">add</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Winner Banner */}
          <AnimatePresence>
            {(winner || isDraw) && (
              <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }} className="w-full max-w-[500px]">
                <div className={`glass-panel text-center py-4 rounded-2xl border flex items-center justify-center gap-3 ${winner ? 'border-primary shadow-[0_0_20px_rgba(var(--color-primary),0.2)]' : 'border-outline-variant'}`}>
                  {winner && <Trophy className="w-6 h-6 text-primary" />}
                  <span className="text-2xl font-headline font-bold text-white">
                    {winner ? (winner === player1.mark ? `${player1.name} WINS!` : `${player2.name} WINS!`) : 'DRAW!'}
                  </span>
                  {winner && <Trophy className="w-6 h-6 text-primary" />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Cluster */}
          <div className="flex items-center justify-center gap-6">
            <button 
              onClick={() => jumpTo(Math.max(0, stepNumber - (mode === 'AI' ? 2 : 1)))} 
              disabled={stepNumber === 0 || !!winner || isDraw} 
              className="px-8 py-3 rounded-full border border-outline-variant hover:bg-white/5 text-sm font-bold tracking-widest uppercase transition-all active:scale-95 disabled:opacity-30"
            >
              Undo
            </button>
            <button 
              onClick={resetGame} 
              className="px-10 py-3 rounded-full bg-gradient-to-br from-primary to-primary-dim text-on-primary-fixed text-sm font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(177,161,255,0.3)] hover:shadow-[0_0_40px_rgba(177,161,255,0.5)] transition-all active:scale-95"
            >
              Play Again
            </button>
          </div>

          {/* Time Travel Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Time Travel (Move History)</span>
              <span className="text-[10px] font-mono text-primary">{stepNumber}/{history.length - 1} Moves</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x scroll-smooth">
              {history.map((_, step) => {
                const isActive = stepNumber === step;
                // Try to derive who moved and what their mark was for visual flavor
                // (Since we don't store exactly what changed in history, we'll just show the move number)
                return (
                  <button 
                    key={step}
                    onClick={() => jumpTo(step)}
                    className={`flex-none snap-center glass-panel w-24 py-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                      isActive 
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-white/5 hover:border-secondary/40'
                    }`}
                  >
                    <span className={`text-[10px] font-mono ${isActive ? 'text-primary' : 'text-secondary-dim'}`}>MOVE {step}</span>
                    <span className="text-lg font-headline font-bold text-white">{step === 0 ? 'START' : `M${step}`}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/95 backdrop-blur-3xl overflow-y-auto">
            {/* Abstract Atmospheric Lighting */}
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none"></div>
            
            <motion.section initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="max-w-5xl w-full glass-panel border border-primary/10 rounded-[2rem] overflow-hidden glow-violet z-10 relative my-8 shadow-2xl">
              <div className="p-6 md:p-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <span className="text-primary font-mono text-[10px] tracking-[0.2em] uppercase mb-1 block">System Configuration</span>
                    <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter bg-gradient-to-r from-on-surface to-on-surface-variant bg-clip-text text-transparent">Arena Settings</h1>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => {
                        setTheme('modern'); setGridSize(3); setWinLength(3); setMode('AI'); setDifficulty('MEDIUM'); setIsTimerMode(false);
                      }} className="bg-surface-container-high text-on-surface-variant px-6 py-3 rounded-full text-sm font-bold hover:bg-surface-bright transition-colors duration-300 tracking-widest uppercase">
                      Reset
                    </button>
                    <button onClick={() => setShowSettings(false)} className="bg-gradient-to-br from-primary to-primary-dim text-on-primary px-8 py-3 rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all tracking-widest uppercase">
                      Save & Close
                    </button>
                  </div>
                </div>

                {/* Settings Grid (Bento Style) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Player Customization (Large Card) */}
                  <div className="md:col-span-7 bg-surface-container-low rounded-3xl p-6 md:p-8 border border-white/5 space-y-8 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 flex gap-2 z-10">
                       <button onClick={() => setPlayer1({...player1})} className="text-xs font-mono px-3 py-1 bg-primary/20 text-primary rounded-full border border-primary/30">P1</button>
                       {mode === '2P' && <button onClick={() => setPlayer2({...player2})} className="text-xs font-mono px-3 py-1 bg-white/5 text-gray-400 hover:bg-white/10 rounded-full border border-white/10 transition-colors">P2 Config Below</button>}
                    </div>

                    <div>
                      <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">person_edit</span>
                        Player 1 Identity
                      </h3>
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="relative group shrink-0">
                          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary-dim/30 glow-violet bg-surface-container flex items-center justify-center">
                            {player1.iconType === 'lucide' ? React.createElement(ICONS[player1.icon as keyof typeof ICONS], { className: "w-12 h-12 text-primary" }) : <img src={player1.icon} alt="Avatar" className="w-full h-full object-cover" />}
                          </div>
                          <label className="absolute bottom-0 right-0 bg-primary hover:bg-primary-dim text-on-primary p-2 rounded-full shadow-lg cursor-pointer transition-colors">
                            <span className="material-symbols-outlined text-[16px]">upload</span>
                            <input type="file" accept="image/*" onChange={handleFileUpload(1)} className="hidden" />
                          </label>
                        </div>
                        <div className="flex-1 w-full">
                          <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest mb-2 block">Player Handle</label>
                          <input className="w-full bg-surface-container border-none rounded-xl p-3 font-mono text-primary-fixed focus:ring-2 focus:ring-primary/50 transition-all focus:outline-none" type="text" value={player1.name} onChange={e => setPlayer1({...player1, name: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                        <div>
                          <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest mb-3 block">Signature Color</label>
                          <div className="flex gap-3">
                            {['#b1a1ff', '#00eefc', '#ff9ac3', '#ff6e84', '#34d399'].map(c => (
                              <button key={c} onClick={() => setPlayer1({...player1, color: c})} className={`w-8 h-8 rounded-full transition-transform ${player1.color === c ? 'ring-2 ring-offset-4 ring-offset-surface-container-low ring-primary scale-110' : 'ring-0 ring-offset-4 ring-offset-surface-container-low hover:scale-110'}`} style={{ backgroundColor: c }}></button>
                            ))}
                            <div className="relative flex items-center justify-center w-8 h-8 rounded-full overflow-hidden ring-0 ring-offset-4 ring-offset-surface-container-low bg-gradient-to-br from-indigo-500 to-purple-500">
                               <input type="color" value={player1.color} onChange={e => setPlayer1({...player1, color: e.target.value})} className="absolute inset-0 w-20 h-20 -left-6 -top-6 cursor-pointer opacity-0" />
                               <span className="material-symbols-outlined text-white text-[16px] pointer-events-none">colorize</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest mb-3 block">Combat Icon</label>
                          <div className="flex gap-4">
                            {Object.keys(ICONS).slice(0, 5).map(icon => {
                              const LucideIcon = ICONS[icon as keyof typeof ICONS];
                              return (
                                <button key={icon} onClick={() => updatePlayerIcon(1, icon)} className={`transition-transform hover:scale-110 ${player1.icon === icon && player1.iconType === 'lucide' ? 'text-primary' : 'text-on-surface-variant'}`}>
                                  <LucideIcon className="w-6 h-6" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {mode === '2P' && (
                      <div className="pt-6 border-t border-white/5">
                        <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
                          <span className="material-symbols-outlined text-secondary">person_edit</span>
                          Player 2 Identity
                        </h3>
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                          <div className="relative group shrink-0">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-secondary-dim/30 glow-cyan bg-surface-container flex items-center justify-center">
                              {player2.iconType === 'lucide' ? React.createElement(ICONS[player2.icon as keyof typeof ICONS], { className: "w-12 h-12 text-secondary" }) : <img src={player2.icon} alt="Avatar" className="w-full h-full object-cover" />}
                            </div>
                            <label className="absolute bottom-0 right-0 bg-secondary hover:bg-[#00d7e6] text-on-secondary p-2 rounded-full shadow-lg cursor-pointer transition-colors">
                              <span className="material-symbols-outlined text-[16px]">upload</span>
                              <input type="file" accept="image/*" onChange={handleFileUpload(2)} className="hidden" />
                            </label>
                          </div>
                          <div className="flex-1 w-full">
                            <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest mb-2 block">Player Handle</label>
                            <input className="w-full bg-surface-container border-none rounded-xl p-3 font-mono text-secondary focus:ring-2 focus:ring-secondary/50 transition-all focus:outline-none" type="text" value={player2.name} onChange={e => setPlayer2({...player2, name: e.target.value})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                          <div>
                            <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest mb-3 block">Signature Color</label>
                            <div className="flex gap-3">
                              {['#00eefc', '#ff6e84', '#b1a1ff', '#fbbf24', '#f87171'].map(c => (
                                <button key={c} onClick={() => setPlayer2({...player2, color: c})} className={`w-8 h-8 rounded-full transition-transform ${player2.color === c ? 'ring-2 ring-offset-4 ring-offset-surface-container-low ring-secondary scale-110' : 'ring-0 ring-offset-4 ring-offset-surface-container-low hover:scale-110'}`} style={{ backgroundColor: c }}></button>
                              ))}
                              <div className="relative flex items-center justify-center w-8 h-8 rounded-full overflow-hidden ring-0 ring-offset-4 ring-offset-surface-container-low bg-gradient-to-br from-indigo-500 to-purple-500">
                                 <input type="color" value={player2.color} onChange={e => setPlayer2({...player2, color: e.target.value})} className="absolute inset-0 w-20 h-20 -left-6 -top-6 cursor-pointer opacity-0" />
                                 <span className="material-symbols-outlined text-white text-[16px] pointer-events-none">colorize</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest mb-3 block">Combat Icon</label>
                            <div className="flex gap-4">
                              {Object.keys(ICONS).slice(0, 5).map(icon => {
                                const LucideIcon = ICONS[icon as keyof typeof ICONS];
                                return (
                                  <button key={icon} onClick={() => updatePlayerIcon(2, icon)} className={`transition-transform hover:scale-110 ${player2.icon === icon && player2.iconType === 'lucide' ? 'text-secondary' : 'text-on-surface-variant'}`}>
                                    <LucideIcon className="w-6 h-6" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column Stack */}
                  <div className="md:col-span-5 flex flex-col gap-6">
                    {/* Grid Architecture */}
                    <div className="bg-surface-container-low rounded-3xl p-6 border border-white/5">
                      <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary">grid_view</span>
                        Grid Architecture
                      </h3>
                      <div className="flex flex-col gap-3">
                        <button onClick={() => { changeGridSize(3); changeWinLength(3); }} className={`flex items-center justify-between p-3 rounded-xl transition-all group ${gridSize === 3 ? 'bg-surface-container border border-primary/30 text-on-surface shadow-[0_0_15px_rgba(177,161,255,0.1)]' : 'bg-surface-container/30 border border-transparent hover:border-white/10 text-on-surface-variant'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold ${gridSize === 3 ? 'bg-primary/20 text-primary' : 'bg-white/5 text-on-surface-variant'}`}>3x3</div>
                            <span className="font-bold text-sm tracking-wide">Classic Arena (Win: 3)</span>
                          </div>
                          {gridSize === 3 && <span className="material-symbols-outlined text-primary">check_circle</span>}
                        </button>
                        <button onClick={() => { changeGridSize(4); changeWinLength(4); }} className={`flex items-center justify-between p-3 rounded-xl transition-all group ${gridSize === 4 ? 'bg-surface-container border border-secondary/30 text-on-surface shadow-[0_0_15px_rgba(0,238,252,0.1)]' : 'bg-surface-container/30 border border-transparent hover:border-white/10 text-on-surface-variant'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold ${gridSize === 4 ? 'bg-secondary/20 text-secondary' : 'bg-white/5 text-on-surface-variant'}`}>4x4</div>
                            <span className="font-bold text-sm tracking-wide">Extended Field (Win: 4)</span>
                          </div>
                          {gridSize === 4 && <span className="material-symbols-outlined text-secondary">check_circle</span>}
                        </button>
                        <button onClick={() => { changeGridSize(5); changeWinLength(4); }} className={`flex items-center justify-between p-3 rounded-xl transition-all group ${gridSize === 5 ? 'bg-surface-container border border-tertiary/30 text-on-surface shadow-[0_0_15px_rgba(255,154,195,0.1)]' : 'bg-surface-container/30 border border-transparent hover:border-white/10 text-on-surface-variant'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold ${gridSize === 5 ? 'bg-tertiary/20 text-tertiary' : 'bg-white/5 text-on-surface-variant'}`}>5x5</div>
                            <div className="flex flex-col items-start"><span className="font-bold text-sm tracking-wide">Grand Master (Win: 4)</span></div>
                          </div>
                          {gridSize === 5 && <span className="material-symbols-outlined text-tertiary">check_circle</span>}
                        </button>
                      </div>
                    </div>

                    {/* AI Difficulty */}
                    <AnimatePresence>
                      {mode === 'AI' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface-container-low rounded-3xl p-6 border border-white/5">
                          <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary-fixed">psychology</span>
                            AI Core Logic
                          </h3>
                          <div className="space-y-6">
                            <div className="flex justify-between font-mono text-[10px] uppercase text-on-surface-variant tracking-wider">
                              <span className={difficulty === 'EASY' ? 'text-white font-bold' : ''}>Easy</span>
                              <span className={difficulty === 'MEDIUM' ? 'text-white font-bold' : ''}>Medium</span>
                              <span className={difficulty === 'HARD' ? 'text-white font-bold' : ''}>Hard</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {['EASY', 'MEDIUM', 'HARD'].map((d) => (
                                <button key={d} onClick={() => setDifficulty(d as Difficulty)} className={`h-2 rounded-full transition-all ${difficulty === d ? 'bg-gradient-to-r from-primary to-secondary scale-y-150' : 'bg-surface-container hover:bg-surface-container-high'}`}></button>
                              ))}
                            </div>
                            <div className="text-center pt-2">
                              <span className="text-xl font-mono text-primary font-bold">Lvl. {difficulty === 'EASY' ? '01' : difficulty === 'MEDIUM' ? '05' : '10'}</span>
                              <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest">{difficulty === 'HARD' ? 'Adaptive Strategy Active' : 'Standard Routine'}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Timer Toggle */}
                    <div className="bg-surface-container-low rounded-3xl p-6 border border-white/5">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined ${isTimerMode ? 'text-tertiary' : 'text-on-surface-variant'}`}>timer</span>
                          <span className="font-bold tracking-wide">Match Timer (10s)</span>
                        </div>
                        <div className={`w-12 h-6 rounded-full relative p-1 transition-colors ${isTimerMode ? 'bg-tertiary shadow-[0_0_15px_rgba(255,154,195,0.4)]' : 'bg-surface-container'}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isTimerMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                        <input type="checkbox" checked={isTimerMode} onChange={(e) => setIsTimerMode(e.target.checked)} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Atmospheric Styles (Theme Switcher) */}
                  <div className="md:col-span-12 bg-surface-container-low rounded-3xl p-6 md:p-8 border border-white/5">
                    <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
                      <span className="material-symbols-outlined text-tertiary">palette</span>
                      Atmospheric Styles
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { id: 'modern', name: 'Modern', img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop' },
                        { id: 'neon', name: 'Neon', img: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop' },
                        { id: 'brutalist', name: 'Brutalist', img: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2600&auto=format&fit=crop' },
                        { id: 'minimalist', name: 'Minimalist', img: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?q=80&w=2547&auto=format&fit=crop' }
                      ].map(t => (
                        <button key={t.id} onClick={() => setTheme(t.id as Theme)} className={`relative group aspect-square rounded-2xl overflow-hidden transition-all ${theme === t.id ? 'ring-2 ring-primary ring-offset-4 ring-offset-surface scale-[1.02]' : 'grayscale hover:grayscale-0'}`}>
                          <img src={t.img} alt={t.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className={`absolute inset-0 flex items-end p-4 transition-colors ${theme === t.id ? 'bg-gradient-to-t from-black/90 via-black/40 to-transparent' : 'bg-gradient-to-t from-black/80 to-transparent'}`}>
                            <span className={`font-mono text-xs uppercase tracking-widest font-bold ${theme === t.id ? 'text-primary' : 'text-white'}`}>{t.name}</span>
                          </div>
                          {theme === t.id && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(177,161,255,1)]"></div>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Game Mode Selection (Wide Bottom) */}
                  <div className="md:col-span-12 bg-surface-container-low rounded-3xl p-6 md:p-8 border border-white/5">
                    <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
                       <span className="material-symbols-outlined text-secondary">power</span>
                       Execution Mode
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button onClick={() => setMode('AI')} className={`p-6 rounded-2xl text-left transition-all flex items-start gap-4 ${mode === 'AI' ? 'bg-primary/10 border border-primary/50 shadow-[0_0_20px_rgba(177,161,255,0.15)] ring-1 ring-primary/30' : 'bg-surface-container border border-white/5 hover:border-primary/40'}`}>
                        <span className={`material-symbols-outlined text-3xl ${mode === 'AI' ? 'text-primary' : 'text-on-surface-variant'}`}>robot_2</span>
                        <div>
                          <div className={`font-bold tracking-wide ${mode === 'AI' ? 'text-primary' : 'text-white'}`}>Neural Link</div>
                          <div className={`text-xs mt-1 ${mode === 'AI' ? 'text-primary-container' : 'text-on-surface-variant'}`}>Challenge the Arena AI</div>
                        </div>
                      </button>
                      <button onClick={() => setMode('2P')} className={`p-6 rounded-2xl text-left transition-all flex items-start gap-4 ${mode === '2P' ? 'bg-secondary/10 border border-secondary/50 shadow-[0_0_20px_rgba(0,238,252,0.15)] ring-1 ring-secondary/30' : 'bg-surface-container border border-white/5 hover:border-secondary/40'}`}>
                        <span className={`material-symbols-outlined text-3xl ${mode === '2P' ? 'text-secondary' : 'text-on-surface-variant'}`}>group</span>
                        <div>
                          <div className={`font-bold tracking-wide ${mode === '2P' ? 'text-secondary' : 'text-white'}`}>Local Fusion</div>
                          <div className={`text-xs mt-1 ${mode === '2P' ? 'text-secondary-container' : 'text-on-surface-variant'}`}>Play with a friend locally</div>
                        </div>
                      </button>
                      <button onClick={() => setMode('ONLINE')} className={`p-6 rounded-2xl text-left transition-all flex items-start gap-4 ${mode === 'ONLINE' ? 'bg-tertiary/10 border border-tertiary/50 shadow-[0_0_20px_rgba(255,154,195,0.15)] ring-1 ring-tertiary/30' : 'bg-surface-container border border-white/5 hover:border-tertiary/40'}`}>
                        <span className={`material-symbols-outlined text-3xl ${mode === 'ONLINE' ? 'text-tertiary' : 'text-on-surface-variant'}`}>language</span>
                        <div>
                          <div className={`font-bold tracking-wide ${mode === 'ONLINE' ? 'text-tertiary' : 'text-white'}`}>Global Net</div>
                          <div className={`text-xs mt-1 ${mode === 'ONLINE' ? 'text-tertiary-container' : 'text-on-surface-variant'}`}>Connect & battle online</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Section */}
                <div className="mt-12 flex items-center justify-center gap-8 text-[10px] uppercase font-mono tracking-[0.3em] text-on-surface-variant">
                  <span className="cursor-pointer hover:text-primary transition-colors">v4.2.0-STABLE</span>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {showProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-surface-dim/80 backdrop-blur-[40px] overflow-y-auto">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="glass-panel w-full max-w-2xl rounded-xl p-8 border border-outline-variant/15 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden my-8">
              
              {/* Ambient Glow Effects */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/10 blur-[100px] rounded-full"></div>

              <div className="relative flex flex-col gap-10">

              {!user ? (
                <div className="flex flex-col items-center justify-center py-8 text-center relative z-10">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 bg-surface-container-lowest flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-6xl text-on-surface-variant/50">account_circle</span>
                  </div>
                  <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface mb-2">Guest Profile</h1>
                  <p className="font-body text-on-surface-variant tracking-wide mb-8 max-w-sm">Sign in to track your global stats, customize your avatar, and dominate the leaderboard!</p>
                  
                  <button onClick={handleGoogleLogin} className="w-full py-4 bg-gradient-to-r from-primary to-primary-dim text-on-primary font-headline font-bold rounded-lg shadow-[0_10px_30px_rgba(88,17,255,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                    <LogIn className="w-5 h-5" /> Sign in with Google
                  </button>
                  <button onClick={() => setShowProfile(false)} className="mt-6 text-on-surface-variant hover:text-white transition-colors text-sm font-semibold tracking-wide uppercase">
                    Return to Arena
                  </button>
                </div>
              ) : (
                <>
                  {/* Profile Header Section */}
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-br from-primary to-secondary rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                      <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-primary/20 bg-surface-container-lowest">
                        <img 
                          src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`} 
                          alt="Avatar" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface mb-1">{user.displayName || 'NeoPlayer'}</h1>
                      <p className="font-body text-on-surface-variant tracking-wide mb-4">{user.email || 'neo@arena.com'}</p>
                      <button onClick={() => { if(auth) signOut(auth) }} className="px-6 py-2 bg-error-container/20 text-error font-headline font-semibold text-sm rounded-full border border-error-container/30 hover:bg-error-container/40 transition-all active:scale-95 flex items-center gap-2 mx-auto md:mx-0">
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        Sign Out
                      </button>
                    </div>
                  </div>

                  {/* Avatar Selector */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant font-semibold">Avatar Selector</h2>
                      <span className="text-[10px] text-secondary font-mono">6 AVAILABLE</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar mask-fade-right">
                      {['bottts', 'adventurer', 'avataaars', 'fun-emoji', 'micah', 'lorelei'].map(style => {
                        const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${user.uid}`;
                        const isCurrent = user.photoURL === url || (!user.photoURL && style === 'bottts');
                        return (
                          <div 
                            key={style}
                            onClick={async () => {
                              try {
                                await updateProfile(user, { photoURL: url });
                                setUser({ ...user, photoURL: url } as User); 
                              } catch(e) { console.error(e) }
                            }}
                            className={`flex-shrink-0 w-16 h-16 rounded-lg bg-surface-container-high border ${isCurrent ? 'border-primary/50 shadow-[0_0_10px_rgba(177,161,255,0.3)]' : 'border-outline-variant/10 hover:border-primary/50'} flex items-center justify-center group cursor-pointer transition-all`}
                          >
                            <img src={url} alt={style} className={`w-10 h-10 object-cover ${isCurrent ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Stats Dashboard Bento Grid */}
                  <section>
                    <h2 className="font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant font-semibold mb-4">Performance Stats</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Stat Card 1 */}
                      <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5 flex flex-col justify-between h-32 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                          <span className="material-symbols-outlined text-6xl">emoji_events</span>
                        </div>
                        <span className="font-headline text-[10px] text-on-surface-variant uppercase tracking-widest">Total Wins</span>
                        <span className="font-mono text-4xl text-primary font-bold">{userStats.wins}</span>
                      </div>
                      {/* Stat Card 2 */}
                      <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5 flex flex-col justify-between h-32 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                          <span className="material-symbols-outlined text-6xl">sports_esports</span>
                        </div>
                        <span className="font-headline text-[10px] text-on-surface-variant uppercase tracking-widest">Total Games</span>
                        <span className="font-mono text-4xl text-on-surface font-bold">{userStats.total}</span>
                      </div>
                      {/* Stat Card 3 (Featured) */}
                      <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-secondary-container/20 to-surface-container-low p-6 rounded-lg border border-secondary-container/10 flex flex-col justify-between h-32 relative overflow-hidden group">
                        <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-secondary/10 blur-2xl rounded-full"></div>
                        <span className="font-headline text-[10px] text-secondary uppercase tracking-widest font-bold">Win Rate</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-4xl text-secondary font-bold">{userStats.total > 0 ? Math.round((userStats.wins / userStats.total) * 100) : 0}</span>
                          <span className="font-mono text-xl text-secondary/60">%</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Close / Action Button */}
                  <button onClick={() => setShowProfile(false)} className="mt-4 w-full py-4 bg-gradient-to-r from-primary to-primary-dim text-on-primary font-headline font-bold rounded-lg shadow-[0_10px_30px_rgba(88,17,255,0.3)] hover:brightness-110 active:scale-[0.98] transition-all">
                    Return to Arena
                  </button>
                </>
              )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showLeaderboard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="glass-panel p-8 rounded-[2rem] w-full max-w-md relative">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" /> Leaderboard
                </h2>
                <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
              </div>
              
              {!user ? (
                <div className="text-center py-12">
                  <p className="mb-6 text-gray-400">Sign in to save your scores and compete globally.</p>
                  <button onClick={handleGoogleLogin} className="bg-white text-black px-6 py-3 rounded-xl font-medium flex items-center gap-2 mx-auto hover:bg-gray-200 transition">
                    <LogIn className="w-5 h-5" /> Sign In with Google
                  </button>
                </div>
              ) : (
                <div className="flex flex-col h-full max-h-[60vh]">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10 shrink-0">
                    <span className="font-medium">{user.displayName}</span>
                    <button onClick={() => { if(auth) signOut(auth) }} className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1"><LogOut className="w-4 h-4" /> Sign Out</button>
                  </div>
                  
                  <div className="flex gap-2 mb-4 shrink-0">
                    <select value={lbFilterMode} onChange={e => setLbFilterMode(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                      <option value="ALL">All Modes</option>
                      <option value="AI">vs AI</option>
                      <option value="2P">2 Player</option>
                      <option value="ONLINE">Online</option>
                    </select>
                    <select value={lbFilterGrid} onChange={e => setLbFilterGrid(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value) as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                      <option value="ALL">All Grids</option>
                      <option value="3">3x3</option>
                      <option value="4">4x4</option>
                      <option value="5">5x5</option>
                    </select>
                  </div>

                  <div className="space-y-2 overflow-y-auto pr-2">
                    {leaderboardData.length === 0 ? <p className="text-center text-gray-500 py-4">No scores found for these filters.</p> : leaderboardData.map((entry, i) => (
                      <div key={i} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                        <span className="font-medium flex items-center gap-3">
                          <span className="text-gray-500 w-4">{i + 1}.</span> {entry.name}
                        </span>
                        <div className="text-right">
                          <span className="font-semibold text-amber-400 block">{entry.wins} Wins</span>
                          <span className="text-xs text-on-surface-variant block">{entry.total ? Math.round((entry.wins / entry.total) * 100) : 0}% Win Rate</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="glass-panel p-8 rounded-[2rem] w-full max-w-lg relative">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" /> Match History
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
              </div>
              
              {!user ? (
                <div className="text-center py-12">
                   <p className="text-gray-400 mb-6">Sign in to view your match history.</p>
                  <button onClick={handleGoogleLogin} className="bg-white text-black px-6 py-3 rounded-xl font-medium flex items-center gap-2 mx-auto hover:bg-gray-200 transition">
                    <LogIn className="w-5 h-5" /> Sign In with Google
                  </button>
                </div>
              ) : (
                <div className="flex flex-col max-h-[60vh]">
                  <div className="space-y-3 overflow-y-auto pr-2">
                    {gameHistory.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No match history found. Play a game!</p>
                    ) : (
                      gameHistory.map((game, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-4 rounded-xl flex-wrap gap-2">
                          <div>
                            <p className="font-medium flex items-center gap-2 text-sm">
                              {game.outcome === 'Win' ? <Trophy className="w-4 h-4 text-emerald-400" /> : game.outcome === 'Loss' ? <Skull className="w-4 h-4 text-rose-400" /> : <div className="w-4 h-4 bg-gray-500 rounded-full"></div>}
                              <span className={game.outcome === 'Win' ? 'text-emerald-400' : game.outcome === 'Loss' ? 'text-rose-400' : 'text-gray-400'}>{game.outcome}</span>
                              <span className="text-gray-500 mx-1">vs</span> 
                              <span>{game.opponent}</span>
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{game.gridSize}x{game.gridSize} Grid</p>
                          </div>
                          {game.timestamp && (
                            <span className="text-xs text-gray-500 font-medium">
                              {new Date(game.timestamp?.toMillis ? game.timestamp.toMillis() : Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
        {showChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center sm:justify-end sm:items-end z-50 p-4 pb-4 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) setShowChat(false); }}>
            <motion.div initial={{ y: 50, scale: 0.95, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 50, scale: 0.95, opacity: 0 }} className="glass-panel flex flex-col w-full sm:w-[400px] h-[500px] max-h-[80vh] rounded-[2rem] shadow-2xl p-6">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10 shrink-0">
                <h2 className="text-lg font-bold flex items-center gap-2"><MessageCircle className="w-5 h-5 text-sky-400" /> Room Chat</h2>
                <button onClick={() => setShowChat(false)} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-gray-500 mt-10 text-sm">No messages yet. Say hello!</p>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = user && msg.senderId === user.uid;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-gray-500 font-medium mb-1 px-1">{msg.senderName}</span>
                        <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] ${isMe ? 'bg-primary/20 text-primary border border-primary/30 rounded-br-sm' : 'bg-white/10 text-white rounded-bl-sm border border-white/5'}`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendMessage} className="flex gap-2 isolate pt-2 shrink-0">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  placeholder="Type a message..." 
                  className="flex-1 bg-white/5 border border-white/10 px-4 py-3 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-primary" 
                />
                <button type="submit" disabled={!chatInput.trim()} className="bg-primary text-on-primary-fixed p-3 rounded-full hover:bg-primary-dim transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BottomNavBar (Shared Component) */}
      <footer className="fixed bottom-0 w-full z-50 flex justify-around items-center px-6 pb-8 pt-4 bg-slate-950/80 backdrop-blur-2xl rounded-t-[32px] border-t border-white/5 shadow-[0_-10px_50px_rgba(0,0,0,0.5)]">
        <div onClick={() => jumpTo(Math.max(0, stepNumber - (mode === 'AI' ? 2 : 1)))} className="flex flex-col items-center justify-center text-slate-500 p-3 hover:bg-white/5 active:scale-95 duration-200 cursor-pointer">
          <span className="material-symbols-outlined text-2xl">undo</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">Undo</span>
        </div>
        <div onClick={resetGame} className="flex flex-col items-center justify-center bg-violet-600/20 text-violet-400 rounded-full p-3 active:scale-95 duration-200 cursor-pointer">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">Play</span>
        </div>
        <div onClick={() => { setShowHistory(true); fetchGameHistory(); }} className="flex flex-col items-center justify-center text-slate-500 p-3 hover:bg-white/5 active:scale-95 duration-200 cursor-pointer">
          <span className="material-symbols-outlined text-2xl">history</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">History</span>
        </div>
        <div onClick={() => setShowProfile(true)} className="flex flex-col items-center justify-center text-slate-500 p-3 hover:bg-white/5 active:scale-95 duration-200 cursor-pointer">
          <span className="material-symbols-outlined text-2xl">account_circle</span>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest mt-1">Profile</span>
        </div>
      </footer>

      {/* Tutorial / Onboarding Modal */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-surface-container-high w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative mt-16 sm:mt-0">
              <button onClick={() => setShowTutorial(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10">
                <X className="w-5 h-5" />
              </button>
              
              <div className="p-8">
                {tutorialStep === 0 && (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/30 text-white">
                      <span className="material-symbols-outlined text-4xl">sports_esports</span>
                    </div>
                    <h2 className="text-3xl font-headline font-bold mb-4">Welcome to XO Arena</h2>
                    <p className="text-on-surface-variant mb-6 text-sm leading-relaxed">
                      Experience Tic-Tac-Toe evolved. With dynamic grid sizes, powerful abilities, and competitive matchmaking, strategy is redefined.
                    </p>
                  </div>
                )}
                
                {tutorialStep === 1 && (
                  <div>
                    <h2 className="text-2xl font-headline font-bold mb-6 text-center">Power-Ups Arsenal</h2>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 bg-surface-container p-4 rounded-2xl border border-white/5">
                        <span className="material-symbols-outlined text-primary text-3xl">ink_eraser</span>
                        <div>
                          <h4 className="font-bold text-sm text-primary">Remove (Cooldown: 3)</h4>
                          <p className="text-xs text-on-surface-variant">Erase any opponent's mark from the board.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-surface-container p-4 rounded-2xl border border-white/5">
                        <span className="material-symbols-outlined text-secondary-dim text-3xl">shield</span>
                        <div>
                          <h4 className="font-bold text-sm text-secondary-dim">Block (Cooldown: 4)</h4>
                          <p className="text-xs text-on-surface-variant">Place an immovable block that nobody can claim.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-surface-container p-4 rounded-2xl border border-white/5">
                        <span className="material-symbols-outlined text-tertiary text-3xl">dynamic_feed</span>
                        <div>
                          <h4 className="font-bold text-sm text-tertiary">Double (Cooldown: 4)</h4>
                          <p className="text-xs text-on-surface-variant">Take two consecutive turns to outmaneuver.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tutorialStep === 2 && (
                  <div className="text-center">
                    <h2 className="text-2xl font-headline font-bold mb-6">Game Modes</h2>
                    <p className="text-on-surface-variant text-sm mb-6">
                      Customize your match in the Settings panel:
                    </p>
                    <ul className="text-left space-y-3 mb-6 bg-surface-container rounded-2xl p-4 border border-white/5 text-sm w-full max-w-sm mx-auto">
                      <li className="flex items-start gap-3">
                        <span className="text-primary font-bold mt-1">•</span>
                        <span><b>Grid Size:</b> Play classic 3x3, or expand to 4x4 and 5x5 for massive battles.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-secondary font-bold mt-1">•</span>
                        <span><b>Timer Mode:</b> Limit turns to 10 seconds. Play fast or lose!</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-tertiary font-bold mt-1">•</span>
                        <span><b>Multiplayer:</b> Battle our adaptive AI, invite a friend locally, or host an online room.</span>
                      </li>
                    </ul>
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between">
                  <div className="flex gap-2">
                    {[0, 1, 2].map(step => (
                      <div key={step} className={`w-2 h-2 rounded-full transition-all ${tutorialStep === step ? 'bg-primary w-4' : 'bg-surface-container-highest'}`} />
                    ))}
                  </div>
                  <div className="flex gap-3">
                    {tutorialStep > 0 && (
                      <button onClick={() => setTutorialStep(s => s - 1)} className="px-4 py-2 rounded-full text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
                        Back
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        if (tutorialStep < 2) setTutorialStep(s => s + 1);
                        else { setShowTutorial(false); setTutorialStep(0); }
                      }} 
                      className="px-6 py-2 rounded-full bg-gradient-to-r from-primary to-primary-dim text-white text-sm font-bold shadow-[0_0_15px_rgba(88,17,255,0.4)] hover:brightness-110 transition-all"
                    >
                      {tutorialStep < 2 ? 'Next' : 'Play Now'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
