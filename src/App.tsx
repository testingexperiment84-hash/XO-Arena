import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Settings, Trophy, RotateCcw, LogIn, LogOut, X, Circle,
  Triangle, Square, Star, Heart, Ghost, Skull, Crown, Rocket,
  Eraser, Shield, Zap, Undo, Moon, Sun, Monitor
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
// --- Firebase Setup ---
const firebaseConfig = {
  projectId: "ai-studio-applet-webapp-64f98",
  appId: "1:1003378525409:web:2b77945678002dedfc63a0",
  apiKey: "AIzaSyCUZGhcnWjhP3WNV9DVhj19rmiyY0gG_V4",
  authDomain: "ai-studio-applet-webapp-64f98.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-7bdd13ae-3860-4025-8d70-1043604614f9",
  storageBucket: "ai-studio-applet-webapp-64f98.firebasestorage.app",
  messagingSenderId: "1003378525409",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth();

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
  const [mode, setMode] = useState<'2P' | 'AI'>('AI');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  
  const [history, setHistory] = useState<BoardState[]>([Array(9).fill(null)]);
  const [stepNumber, setStepNumber] = useState(0);
  const [xIsNext, setXIsNext] = useState(true);
  
  const [isTimerMode, setIsTimerMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  
  const [p1PowerUps, setP1PowerUps] = useState<PowerUps>({ remove: 1, block: 1, double: 1 });
  const [p2PowerUps, setP2PowerUps] = useState<PowerUps>({ remove: 1, block: 1, double: 1 });
  const [activePowerUp, setActivePowerUp] = useState<keyof PowerUps | null>(null);
  const [isDoubleMove, setIsDoubleMove] = useState(false);

  const [player1, setPlayer1] = useState<Player>({ name: 'Player 1', icon: 'X', iconType: 'lucide', color: '#38bdf8', mark: 'P1' });
  const [player2, setPlayer2] = useState<Player>({ name: 'Player 2', icon: 'Circle', iconType: 'lucide', color: '#fb7185', mark: 'P2' });
  
  const [scores, setScores] = useState({ p1: 0, p2: 0, streak: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [lbFilterMode, setLbFilterMode] = useState<'ALL' | 'AI' | '2P'>('ALL');
  const [lbFilterGrid, setLbFilterGrid] = useState<'ALL' | 3 | 4 | 5>('ALL');

  const board = history[stepNumber];
  const winInfo = checkWinner(board, gridSize, winLength);
  const winner = winInfo?.winner;
  const winningLine = winInfo?.line || [];
  const isDraw = !winner && board.every(cell => cell !== null);
  const currentPlayer = xIsNext ? player1 : player2;
  const currentPowerUps = xIsNext ? p1PowerUps : p2PowerUps;

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
    }
  };

  // --- Effects ---
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setPlayer1(p => ({ ...p, name: currentUser.displayName || 'Player 1' }));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (winner && winner !== 'BLOCK') {
      playSound('win');
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: [player1.color, player2.color] });
      setScores(s => {
        const isP1 = winner === player1.mark;
        return {
          p1: isP1 ? s.p1 + 1 : s.p1,
          p2: !isP1 ? s.p2 + 1 : s.p2,
          streak: isP1 ? s.streak + 1 : 0
        };
      });
      if (user && winner === player1.mark) saveWinToLeaderboard();
    } else if (isDraw) {
      playSound('draw');
      setScores(s => ({ ...s, streak: 0 }));
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
      const timer = setTimeout(() => {
        const move = getAiMove(board, player2.mark, player1.mark);
        if (move !== -1) handleCellClick(move, true);
      }, 600);
      return () => clearTimeout(timer);
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

    for (let move of available) if (wins(move, aiMark)) return move;
    if (difficulty !== 'EASY') {
      for (let move of available) if (wins(move, pMark)) return move;
    }
    if (difficulty === 'HARD') {
      const center = Math.floor((gridSize * gridSize) / 2);
      if (available.includes(center)) return center;
      const corners = [0, gridSize - 1, gridSize * (gridSize - 1), gridSize * gridSize - 1];
      const availCorners = corners.filter(c => available.includes(c));
      if (availCorners.length > 0) return availCorners[Math.floor(Math.random() * availCorners.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  };

  const handleCellClick = (index: number, isAi = false) => {
    if (winner || isDraw || (mode === 'AI' && !xIsNext && !isAi)) return;

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
      setHistory([...newHistory, newBoard]);
      setStepNumber(newHistory.length);
      return; // Don't switch turns
    }

    if (isDoubleMove) {
      setIsDoubleMove(false);
    }

    finalizeMove(newBoard, !isDoubleMove);
  };

  const finalizeMove = (newBoard: BoardState, switchTurn = true) => {
    const newHistory = history.slice(0, stepNumber + 1);
    setHistory([...newHistory, newBoard]);
    setStepNumber(newHistory.length);
    if (switchTurn) {
      setXIsNext(!xIsNext);
      setTimeLeft(10);
    }
    setActivePowerUp(null);
  };

  const consumePowerUp = (type: keyof PowerUps) => {
    playSound('powerup');
    if (xIsNext) setP1PowerUps(p => ({ ...p, [type]: p[type] - 1 }));
    else setP2PowerUps(p => ({ ...p, [type]: p[type] - 1 }));
  };

  const undoMove = () => {
    if (stepNumber > 0) {
      const stepsToUndo = mode === 'AI' ? 2 : 1;
      const newStep = Math.max(0, stepNumber - stepsToUndo);
      setStepNumber(newStep);
      setXIsNext(newStep % 2 === 0);
      setTimeLeft(10);
      setActivePowerUp(null);
      setIsDoubleMove(false);
    }
  };

  const resetGame = () => {
    setHistory([Array(gridSize * gridSize).fill(null)]);
    setStepNumber(0);
    setXIsNext(true);
    setTimeLeft(10);
    setActivePowerUp(null);
    setIsDoubleMove(false);
    setP1PowerUps({ remove: 1, block: 1, double: 1 });
    setP2PowerUps({ remove: 1, block: 1, double: 1 });
  };

  const changeGridSize = (size: number) => {
    setGridSize(size);
    setWinLength(size === 3 ? 3 : 4);
    setHistory([Array(size * size).fill(null)]);
    setStepNumber(0);
    setXIsNext(true);
  };

  const saveWinToLeaderboard = async () => {
    if (!user) return;
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

  const fetchLeaderboard = async () => {
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
        <div className="w-px h-6 bg-white/10"></div>
        <div className="flex gap-2">
          <button onClick={() => { setShowLeaderboard(true); fetchLeaderboard(); }} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <Trophy className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="mt-20 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-5xl z-10">
        
        {/* Left Panel: Status & PowerUps */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Current Turn */}
          <div className="modern-card p-8 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <h2 className="text-sm font-medium mb-4 tracking-widest text-gray-400 uppercase">Current Turn</h2>
            <div className="flex items-center justify-center gap-4 text-3xl font-bold tracking-tight">
              {renderIcon(currentPlayer.mark, 'w-10 h-10')}
              <span style={{ color: currentPlayer.color }}>
                {currentPlayer.name}
              </span>
            </div>
            {isTimerMode && (
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
            <div className="text-center border-x border-white/10">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Streak</p>
              <p className="text-3xl font-semibold text-amber-400">{scores.streak}</p>
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
                { id: 'remove', icon: Eraser, label: 'Remove', count: currentPowerUps.remove },
                { id: 'block', icon: Shield, label: 'Block', count: currentPowerUps.block },
                { id: 'double', icon: Zap, label: '2x Move', count: currentPowerUps.double },
              ].map(p => (
                <button
                  key={p.id}
                  disabled={p.count === 0 || winner !== undefined || isDraw || (mode === 'AI' && !xIsNext)}
                  onClick={() => setActivePowerUp(activePowerUp === p.id ? null : p.id as keyof PowerUps)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 ${
                    activePowerUp === p.id ? 'bg-white/10 ring-1 ring-white/30 shadow-lg' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/5'
                  } ${p.count === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <p.icon className="w-6 h-6 mb-2 text-gray-300" />
                  <span className="text-xs font-medium text-gray-400">{p.label}</span>
                  <div className="mt-2 text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full">{p.count}</div>
                </button>
              ))}
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
            <button onClick={undoMove} disabled={stepNumber === 0 || !!winner || isDraw} className="flex-1 modern-card py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-white/[0.06] transition disabled:opacity-30">
              <Undo className="w-5 h-5" /> Undo
            </button>
            <button onClick={resetGame} className="flex-1 modern-card py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-white/[0.06] transition">
              <RotateCcw className="w-5 h-5" /> Play Again
            </button>
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
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Game Mode</label>
                  <div className="flex gap-2">
                    <button onClick={() => setMode('AI')} className={`flex-1 py-3 rounded-xl font-medium transition ${mode === 'AI' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>vs AI</button>
                    <button onClick={() => setMode('2P')} className={`flex-1 py-3 rounded-xl font-medium transition ${mode === '2P' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>2 Player</button>
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
                  <div className="grid grid-cols-2 gap-2">
                    {(['modern', 'neon', 'brutalist', 'minimalist'] as Theme[]).map(t => (
                      <button key={t} onClick={() => setTheme(t)} className={`py-2 rounded-xl font-medium transition capitalize ${theme === t ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}>
                        {t}
                      </button>
                    ))}
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
                          <button key={icon} onClick={() => setPlayer1({...player1, iconType: 'lucide', icon})} className={`p-2 rounded-lg shrink-0 ${player1.icon === icon && player1.iconType === 'lucide' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}>
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
                          <button key={icon} onClick={() => setPlayer2({...player2, iconType: 'lucide', icon})} className={`p-2 rounded-lg shrink-0 ${player2.icon === icon && player2.iconType === 'lucide' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}>
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
                  <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="bg-white text-black px-6 py-3 rounded-xl font-medium flex items-center gap-2 mx-auto hover:bg-gray-200 transition">
                    <LogIn className="w-5 h-5" /> Sign In with Google
                  </button>
                </div>
              ) : (
                <div className="flex flex-col h-full max-h-[60vh]">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10 shrink-0">
                    <span className="font-medium">{user.displayName}</span>
                    <button onClick={() => signOut(auth)} className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1"><LogOut className="w-4 h-4" /> Sign Out</button>
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
      </AnimatePresence>
    </div>
  );
}
