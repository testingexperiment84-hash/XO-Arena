import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Settings, Trophy, RotateCcw, LogIn, LogOut, X, Circle,
  Triangle, Square, Star, Heart, Ghost, Skull, Crown, Rocket,
  Eraser, Shield, Zap, Undo, Moon, Sun, Monitor, User as UserIcon, Check, History, Flame
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

  const [player1, setPlayer1] = useState<Player>({ name: 'Player 1', icon: 'X', iconType: 'lucide', color: '#38bdf8', mark: 'P1' });
  const [player2, setPlayer2] = useState<Player>({ name: 'Player 2', icon: 'Circle', iconType: 'lucide', color: '#fb7185', mark: 'P2' });
  
  const [scores, setScores] = useState({ p1: 0, p2: 0, currentStreakHolder: null as 'P1' | 'P2' | null, streakCount: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({ wins: 0, draws: 0, total: 0 });
  const [lbFilterMode, setLbFilterMode] = useState<'ALL' | 'AI' | '2P'>('ALL');
  const [lbFilterGrid, setLbFilterGrid] = useState<'ALL' | 3 | 4 | 5>('ALL');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

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
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
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
      const q = query(collection(db, 'leaderboard')); // we will just fetch all and filter client side for simplicity given small size, or orderBy.
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data());
      const userGames = data.filter(d => d.userId === uid);
      setUserStats({
        wins: userGames.length,
        draws: 0,
        total: userGames.length
      });
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

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
    return () => unsub();
  }, [mode, roomId, onlineStatus]);

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

    // 1. Immediate Win
    for (let move of available) if (wins(move, aiMark)) return move;

    // 2. Immediate Block
    if (difficulty !== 'EASY') {
      for (let move of available) if (wins(move, pMark)) return move;
    }

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

  const saveWinToLeaderboard = async () => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, 'leaderboard'), {
        userId: user.uid,
        name: user.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        gridSize,
        difficulty: mode === 'AI' ? difficulty : 'PvP'
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
      const q = query(collection(db, 'leaderboard'), orderBy('timestamp', 'desc'), limit(200));
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => doc.data());
      
      if (lbFilterMode !== 'ALL') {
        data = data.filter(d => lbFilterMode === 'AI' ? d.difficulty !== 'PvP' : d.difficulty === 'PvP');
      }
      if (lbFilterGrid !== 'ALL') {
        data = data.filter(d => d.gridSize === lbFilterGrid);
      }

      // Group by user and count wins
      const counts: Record<string, any> = {};
      data.forEach(d => {
        if (!counts[d.userId]) counts[d.userId] = { name: d.name, wins: 0 };
        counts[d.userId].wins++;
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
    <div className="min-h-screen flex flex-col items-center py-12 px-4 relative overflow-hidden">
      
      {/* Floating Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 modern-card px-8 py-3 flex items-center gap-8 z-50 rounded-full">
        <h1 className="text-xl font-bold tracking-tight">
          XO <span className="text-sky-400">Arena</span>
        </h1>
        {mode === 'ONLINE' && roomId && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10 hidden sm:flex">
            <div className={`w-2 h-2 rounded-full ${onlineStatus === 'playing' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></div>
            <span className="text-xs font-mono font-bold tracking-widest text-white/50 w-24">ROOM {roomId}</span>
          </div>
        )}
        <div className="w-px h-6 bg-white/10"></div>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={resetGame} title="Restart Game" className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <RotateCcw className="w-5 h-5" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => { setShowLeaderboard(true); fetchLeaderboard(); }} title="Leaderboard" className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <Trophy className="w-5 h-5" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => { setShowHistory(true); fetchGameHistory(); }} title="History" className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <History className="w-5 h-5" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowProfile(true)} title="Profile" className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <UserIcon className="w-5 h-5" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowSettings(true)} title="Settings" className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </motion.button>
        </div>
      </header>

      {/* Multiplayer Lobby Overlay */}
      <AnimatePresence>
        {mode === 'ONLINE' && onlineStatus !== 'playing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-40 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="modern-card bg-[#0a0a0a]/90 p-8 rounded-[2rem] w-full max-w-md border border-white/10 text-center shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 flex justify-center items-center gap-2"><Crown className="w-6 h-6 text-amber-400" /> Multiplayer Lobby</h2>
              {onlineStatus === 'waiting' && roomId ? (
                <div>
                  <p className="text-gray-400 mb-2">Waiting for opponent to join...</p>
                  <p className="text-sm font-medium">Share this code with your friend:</p>
                  <div className="text-5xl font-mono text-sky-400 font-bold my-8 tracking-[0.2em]">{roomId}</div>
                  <button onClick={() => { setMode('AI'); setOnlineStatus(null); setRoomId(null); }} className="text-sm text-gray-400 hover:text-rose-400 transition">Cancel and Go Back</button>
                </div>
              ) : (
                <div className="space-y-4">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={createMultiplayerGame} className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white rounded-xl py-3.5 font-bold transition">
                      Create New Room
                    </motion.button>
                    <div className="relative py-4 flex items-center">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="shrink-0 px-4 text-xs text-gray-500 font-bold tracking-widest">OR</span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>
                    <div className="flex gap-2">
                      <input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center font-mono font-bold focus:outline-none focus:border-sky-400 tracking-widest" maxLength={6} />
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => joinMultiplayerGame(joinCodeInput)} disabled={joinCodeInput.length < 5} className="bg-white/10 hover:bg-white/20 text-white px-6 rounded-xl font-bold transition disabled:opacity-30 disabled:cursor-not-allowed">Join</motion.button>
                    </div>
                    <button onClick={() => setMode('AI')} className="w-full text-sm text-gray-400 mt-4 hover:text-white transition">Back to Single Player</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <div className="mt-20 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-5xl z-10">
        
        {/* Left Panel: Status & PowerUps */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Current Turn */}
          <div className="modern-card p-8 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
            <div className={`absolute top-0 left-0 h-1 bg-gradient-to-r from-sky-400 to-rose-400 transition-all duration-150 ${isAiThinking ? 'opacity-100' : 'opacity-0 w-0'}`} style={{ width: `${aiProgress}%` }}></div>
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent ${isAiThinking ? 'opacity-0' : 'opacity-100'}`}></div>
            
            <h2 className="text-sm font-medium mb-4 tracking-widest text-gray-400 uppercase">
              {isAiThinking ? 'AI is Thinking...' : 'Current Turn'}
            </h2>
            <div className={`flex items-center justify-center gap-4 text-3xl font-bold tracking-tight transition-opacity ${isAiThinking ? 'animate-pulse opacity-50' : ''}`}>
              {renderIcon(currentPlayer.mark, 'w-10 h-10')}
              <span style={{ color: currentPlayer.color }}>
                {currentPlayer.name}
              </span>
            </div>
            {isTimerMode && !isAiThinking && (
              <div className="mt-6 text-4xl font-mono font-light tracking-tighter">
                00:{timeLeft.toString().padStart(2, '0')}
              </div>
            )}
          </div>

          {/* Scores */}
          <div className="modern-card p-6 rounded-3xl grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">P1 Score</p>
              <p className="text-3xl font-semibold">{scores.p1}</p>
            </div>
            <div className="text-center flex flex-col justify-center items-center border-x border-white/10">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                {scores.currentStreakHolder ? `${scores.currentStreakHolder} Streak` : 'Streak'}
              </p>
              <div className="flex items-center justify-center gap-1">
                {scores.currentStreakHolder === 'P1' && <Flame className="w-5 h-5 text-sky-400 animate-pulse" />}
                <p className={`text-3xl font-semibold ${scores.currentStreakHolder === 'P1' ? 'text-sky-400' : scores.currentStreakHolder === 'P2' ? 'text-rose-400' : 'text-gray-500/50'}`}>
                  {scores.streakCount}
                </p>
                {scores.currentStreakHolder === 'P2' && <Flame className="w-5 h-5 text-rose-400 animate-pulse" />}
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">P2 Score</p>
              <p className="text-3xl font-semibold">{scores.p2}</p>
            </div>
          </div>

          {/* Power-Ups */}
          <div className="modern-card p-6 rounded-3xl">
            <h2 className="text-sm font-medium mb-4 tracking-widest text-gray-400 uppercase text-center">Power-Ups</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'remove', icon: Eraser, label: 'Remove', count: currentPowerUps.remove, cd: currentCooldowns.remove },
                { id: 'block', icon: Shield, label: 'Block', count: currentPowerUps.block, cd: currentCooldowns.block },
                { id: 'double', icon: Zap, label: '2x Move', count: currentPowerUps.double, cd: currentCooldowns.double },
              ].map(p => {
                const isCooldown = p.cd > 0;
                const isDisabled = p.count === 0 || isCooldown || winner !== undefined || isDraw || (mode === 'AI' && !xIsNext);
                return (
                  <motion.button
                    whileHover={isDisabled ? {} : { scale: 1.05 }}
                    whileTap={isDisabled ? {} : { scale: 0.95 }}
                    key={p.id}
                    disabled={isDisabled}
                    onClick={() => setActivePowerUp(activePowerUp === p.id ? null : p.id as keyof PowerUps)}
                    className={`relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 overflow-hidden ${
                      activePowerUp === p.id ? 'bg-white/10 ring-1 ring-white/30 shadow-lg' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/5'
                    } ${isDisabled && !isCooldown ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    <p.icon className={`w-6 h-6 mb-2 ${isCooldown ? 'text-gray-500' : 'text-gray-300'}`} />
                    <span className="text-xs font-medium text-gray-400">{p.label}</span>
                    <div className="mt-2 text-xs font-bold leading-none bg-white/10 px-2 py-1 rounded-full">{p.count} left</div>

                    <AnimatePresence>
                      {isCooldown && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 border border-amber-500/30">
                          <span className="text-3xl font-black text-amber-400 mb-0.5">{p.cd}</span>
                          <span className="text-[9px] uppercase tracking-widest font-bold text-amber-400/80">Turns</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
            <div className="h-8 mt-4 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {activePowerUp && (
                  <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-sm font-medium text-amber-400">
                    {activePowerUp === 'remove' && 'Select an opponent\'s mark to remove.'}
                    {activePowerUp === 'block' && 'Select an empty cell to block.'}
                    {activePowerUp === 'double' && 'Place your first mark.'}
                  </motion.p>
                )}
                {isDoubleMove && (
                  <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-sm font-medium text-amber-400">
                    Place your second mark!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Right Panel: Board */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          <div className="modern-card p-6 md:p-8 rounded-[2.5rem] w-full max-w-[500px] shadow-2xl relative">
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gap: '0.75rem',
                width: '100%',
                aspectRatio: '1/1'
              }}
            >
              {board.map((cell, i) => {
                const isWinningCell = winningLine.includes(i);
                return (
                  <motion.button
                    key={i}
                    whileHover={{ scale: cell || winner ? 1 : 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCellClick(i)}
                    className={`modern-cell relative flex items-center justify-center rounded-2xl overflow-hidden ${
                      isWinningCell ? 'bg-white/10 ring-1 ring-white/50' : ''
                    } ${activePowerUp === 'remove' && cell && cell !== 'BLOCK' && cell !== currentPlayer.mark ? 'ring-1 ring-rose-500 cursor-crosshair' : ''}`}
                  >
                    <AnimatePresence>
                      {cell && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="w-full h-full absolute inset-0 flex items-center justify-center"
                        >
                          {renderIcon(cell, 'w-3/4 h-3/4')}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4 mt-8 w-full max-w-[500px]">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => jumpTo(Math.max(0, stepNumber - (mode === 'AI' ? 2 : 1)))} disabled={stepNumber === 0 || !!winner || isDraw} className="flex-1 modern-card py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-white/[0.06] transition disabled:opacity-30">
              <Undo className="w-5 h-5" /> Undo
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={resetGame} className="flex-1 modern-card py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-white/[0.06] transition">
              <RotateCcw className="w-5 h-5" /> Play Again
            </motion.button>
          </div>

          {/* Time Travel History Visualizer */}
          <div className="w-full max-w-[500px] mt-6 modern-card p-5 rounded-[2rem] shadow-xl">
            <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-sky-400" /> Time Travel
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
              {history.map((_, step) => (
                <button 
                  key={step}
                  onClick={() => jumpTo(step)}
                  className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-medium transition-all snap-center ${
                    stepNumber === step 
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 scale-105'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400'
                  }`}
                >
                  {step === 0 ? 'Start' : `Move ${step}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="modern-card bg-[#0a0a0a]/90 p-8 rounded-[2rem] w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Grid Size</label>
                  <div className="flex gap-2">
                    {[3, 4, 5].map(s => (
                      <button key={s} onClick={() => changeGridSize(s)} className={`flex-1 py-3 rounded-xl font-medium transition ${gridSize === s ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>
                        {s}x{s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Win Condition (in a row)</label>
                  <div className="flex gap-2">
                    {[3, 4, 5].map(w => (
                      <button 
                        key={w} 
                        disabled={w > gridSize} 
                        onClick={() => changeWinLength(w)} 
                        className={`flex-1 py-3 rounded-xl font-medium transition ${w > gridSize ? 'opacity-30 cursor-not-allowed' : winLength === w ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Game Mode</label>
                  <div className="flex gap-2">
                    <button onClick={() => setMode('AI')} className={`flex-1 py-3 rounded-xl font-medium transition ${mode === 'AI' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>vs AI</button>
                    <button onClick={() => setMode('2P')} className={`flex-1 py-3 rounded-xl font-medium transition ${mode === '2P' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>2 Player</button>
                    <button onClick={() => setMode('ONLINE')} className={`flex-1 py-3 rounded-xl font-medium transition ${mode === 'ONLINE' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>Online</button>
                  </div>
                </div>

                {mode === 'AI' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 mt-8">AI Difficulty</label>
                    <div className="flex gap-2">
                      {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                        <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-3 rounded-xl font-medium transition ${difficulty === d ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="pt-4 border-t border-white/10">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['modern', 'neon', 'brutalist', 'minimalist'] as Theme[]).map(t => {
                      const isActive = theme === t;
                      return (
                        <button 
                          key={t} 
                          onClick={() => setTheme(t)} 
                          className={`relative py-3 px-4 rounded-xl font-bold transition-all duration-200 capitalize flex items-center justify-between ${
                            isActive 
                              ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.4)] ring-2 ring-sky-400 scale-[1.02]' 
                              : 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/5'
                          }`}
                        >
                          {t}
                          {isActive && (
                            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Player 1 Customization</label>
                  <div className="space-y-3">
                    <input type="text" value={player1.name} onChange={e => setPlayer1({...player1, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white/30" placeholder="Player 1 Name" />
                    <div className="flex gap-2 items-center">
                      <input type="color" value={player1.color} onChange={e => setPlayer1({...player1, color: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
                      <div className="flex-1 flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                        {Object.keys(ICONS).slice(0, 5).map(icon => (
                          <button key={icon} onClick={() => updatePlayerIcon(1, icon)} className={`p-2 rounded-lg shrink-0 ${player1.icon === icon && player1.iconType === 'lucide' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}>
                            {React.createElement(ICONS[icon], { className: "w-5 h-5" })}
                          </button>
                        ))}
                        <label className="p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold px-1">Upload</span>
                          <input type="file" accept="image/*" onChange={handleFileUpload(1)} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Player 2 Customization</label>
                  <div className="space-y-3">
                    <input type="text" value={player2.name} onChange={e => setPlayer2({...player2, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white/30" placeholder="Player 2 Name" />
                    <div className="flex gap-2 items-center">
                      <input type="color" value={player2.color} onChange={e => setPlayer2({...player2, color: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
                      <div className="flex-1 flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                        {Object.keys(ICONS).slice(0, 5).map(icon => (
                          <button key={icon} onClick={() => updatePlayerIcon(2, icon)} className={`p-2 rounded-lg shrink-0 ${player2.icon === icon && player2.iconType === 'lucide' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}>
                            {React.createElement(ICONS[icon], { className: "w-5 h-5" })}
                          </button>
                        ))}
                        <label className="p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold px-1">Upload</span>
                          <input type="file" accept="image/*" onChange={handleFileUpload(2)} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="font-medium text-gray-300 group-hover:text-white transition">Enable 10s Timer</span>
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${isTimerMode ? 'bg-sky-500' : 'bg-white/10'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isTimerMode ? 'left-7' : 'left-1'}`}></div>
                    </div>
                    <input type="checkbox" checked={isTimerMode} onChange={(e) => setIsTimerMode(e.target.checked)} className="hidden" />
                  </label>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="modern-card bg-[#0a0a0a]/90 w-full max-w-md p-8 rounded-3xl shadow-2xl border border-white/10 relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
                <UserIcon className="text-sky-400 w-5 h-5" /> User Profile
              </h2>

              {!user ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                    <UserIcon className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Not Logged In</h3>
                  <p className="text-gray-400 text-sm mb-8 px-4">Sign in to track your global stats, customize your avatar, and appear on the leaderboard!</p>
                  <button 
                    onClick={async () => {
                      if (!auth) return alert("Firebase environment variables are missing! Check your AI Studio settings.");
                      try {
                        await signInWithPopup(auth, new GoogleAuthProvider());
                      } catch(e) { console.error(e); }
                    }} 
                    className="flex items-center gap-3 bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  >
                    <LogIn className="w-5 h-5" /> Sign in with Google
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {/* Avatar & Info */}
                  <div className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <img 
                      src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`} 
                      alt="Avatar" 
                      className="w-20 h-20 rounded-full border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] bg-black/50"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h3 className="text-xl font-bold text-white">{user.displayName || 'Player'}</h3>
                      <p className="text-sm text-gray-400 truncate max-w-[200px]">{user.email}</p>
                      <button onClick={() => { if(auth) signOut(auth) }} className="mt-2 text-xs flex items-center gap-1 text-rose-400 hover:text-rose-300 transition">
                        <LogOut className="w-3 h-3" /> Sign Out
                      </button>
                    </div>
                  </div>

                  {/* Avatar Customization */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Customize Avatar</h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {['bottts', 'adventurer', 'avataaars', 'fun-emoji', 'micah'].map(style => {
                        const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${user.uid}`;
                        const isCurrent = user.photoURL === url || (!user.photoURL && style === 'bottts');
                        return (
                          <button 
                            key={style}
                            onClick={async () => {
                              try {
                                await updateProfile(user, { photoURL: url });
                                setUser({ ...user, photoURL: url } as User); 
                              } catch(e) { console.error(e) }
                            }}
                            className={`relative min-w-16 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${isCurrent ? 'border-sky-400 scale-105 shadow-[0_0_10px_rgba(56,189,248,0.3)]' : 'border-transparent hover:border-white/20 hover:scale-105 bg-white/5'}`}
                          >
                            <img src={url} alt={style} className="w-full h-full object-cover" />
                            {isCurrent && <div className="absolute inset-0 bg-sky-500/20 flex items-center justify-center"><Check className="w-5 h-5 text-white" /></div>}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">Provided by DiceBear</p>
                  </div>

                  {/* Stats */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Global Stats</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-xs text-gray-400 mb-1">Total Wins</p>
                        <p className="text-3xl font-bold text-sky-400">{userStats.wins}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                        <p className="text-xs text-gray-400 mb-1">Games Recorded</p>
                        <p className="text-3xl font-bold text-white">{userStats.total}</p>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {showLeaderboard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="modern-card bg-[#0a0a0a]/90 p-8 rounded-[2rem] w-full max-w-md border border-white/10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" /> Leaderboard
                </h2>
                <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
              </div>
              
              {!user ? (
                <div className="text-center py-12">
                  <p className="mb-6 text-gray-400">Sign in to save your scores and compete globally.</p>
                  <button onClick={() => {
                    if (!auth) {
                      alert("Firebase environment variables are missing! Please check your AI Studio settings.");
                      return;
                    }
                    signInWithPopup(auth, new GoogleAuthProvider())
                  }} className="bg-white text-black px-6 py-3 rounded-xl font-medium flex items-center gap-2 mx-auto hover:bg-gray-200 transition">
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
                        <span className="font-semibold text-amber-400">{entry.wins} Wins</span>
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
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="modern-card bg-[#0a0a0a]/90 p-8 rounded-[2rem] w-full max-w-lg border border-white/10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" /> Match History
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
              </div>
              
              {!user ? (
                <div className="text-center py-12">
                   <p className="text-gray-400 mb-6">Sign in to view your match history.</p>
                   <button onClick={() => {
                    if (!auth) {
                      alert("Firebase environment variables are missing! Please check your AI Studio settings.");
                      return;
                    }
                    signInWithPopup(auth, new GoogleAuthProvider())
                  }} className="bg-white text-black px-6 py-3 rounded-xl font-medium flex items-center gap-2 mx-auto hover:bg-gray-200 transition">
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
      </AnimatePresence>
    </div>
  );
}
