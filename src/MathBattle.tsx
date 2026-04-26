import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Trophy, BrainCircuit, RefreshCw, X, History as HistoryIcon } from 'lucide-react';

interface MathBattleProps {
  onClose: () => void;
}

interface BattleHistoryEntry {
  id: string;
  winner: string;
  xyloScore: number;
  noriScore: number;
  rounds: number;
  date: string;
}

export const MathBattle: React.FC<MathBattleProps> = ({ onClose }) => {
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'ENDED'>('IDLE');
  const [scores, setScores] = useState({ Xylo: 0, Nori: 0 });
  const [currentRound, setCurrentRound] = useState(0);
  const [problem, setProblem] = useState('');
  const [xyloAnswer, setXyloAnswer] = useState<number | null | 'Thinking...'>('Thinking...');
  const [noriAnswer, setNoriAnswer] = useState<number | null | 'Thinking...'>('Thinking...');
  const [roundWinner, setRoundWinner] = useState<string | null>(null);
  const [xyloTime, setXyloTime] = useState(0);
  const [noriTime, setNoriTime] = useState(0);
  
  const [xyloDiff, setXyloDiff] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [noriDiff, setNoriDiff] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [battleHistory, setBattleHistory] = useState<BattleHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const maxRounds = 5;

  const generateProblem = () => {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const a = Math.floor(Math.random() * 50) + 10;
    const b = Math.floor(Math.random() * 50) + 10;
    return `${a} ${op} ${b}`;
  };

  const evalProblem = (p: string) => {
    try {
      // eslint-disable-next-line no-new-func
      return new Function(`return ${p}`)();
    } catch {
      return 0;
    }
  };

  const startGame = () => {
    setScores({ Xylo: 0, Nori: 0 });
    setCurrentRound(1);
    setGameState('PLAYING');
    startRound(1, generateProblem());
  };

  const startRound = async (roundNum: number, newProblem: string) => {
    setXyloAnswer('Thinking...');
    setNoriAnswer('Thinking...');
    setRoundWinner(null);
    setXyloTime(0);
    setNoriTime(0);

    setProblem(newProblem);
    const correctAnswer = evalProblem(newProblem);

    const startTime = Date.now();

    const fetchAnswer = async (model: string, difficulty: string) => {
      try {
        const res = await fetch('/api/math-solve', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ model, problem: newProblem, difficulty })
        });
        const data = await res.json();
        return { model, answer: data.answer, time: Date.now() - startTime };
      } catch (e) {
        return { model, answer: null, time: Date.now() - startTime };
      }
    };

    const p1 = fetchAnswer('Xylo', xyloDiff).then((res) => {
       setXyloAnswer(res.answer);
       setXyloTime(res.time);
       return res;
    });
    
    const p2 = fetchAnswer('Nori', noriDiff).then((res) => {
       setNoriAnswer(res.answer);
       setNoriTime(res.time);
       return res;
    });

    const results = await Promise.all([p1, p2]);

    const xyloRes = results.find(r => r.model === 'Xylo');
    const noriRes = results.find(r => r.model === 'Nori');

    let winner = null;
    
    const xyloCorrect = xyloRes?.answer === correctAnswer;
    const noriCorrect = noriRes?.answer === correctAnswer;

    if (xyloCorrect && noriCorrect) {
       winner = (xyloRes!.time <= noriRes!.time) ? 'Xylo' : 'Nori';
    } else if (xyloCorrect) {
       winner = 'Xylo';
    } else if (noriCorrect) {
       winner = 'Nori';
    } else {
       winner = 'Draw (Neither got it right)';
    }

    setRoundWinner(winner);

    let nextScores = { ...scores };
    if (winner === 'Xylo') nextScores.Xylo += 1;
    if (winner === 'Nori') nextScores.Nori += 1;
    
    setScores(nextScores);

    setTimeout(() => {
       if (roundNum < maxRounds) {
          setCurrentRound(roundNum + 1);
          startRound(roundNum + 1, generateProblem());
       } else {
          setGameState('ENDED');
          const finalWinner = nextScores.Xylo > nextScores.Nori ? 'Xylo' : nextScores.Nori > nextScores.Xylo ? 'Nori' : 'Draw';
          setBattleHistory(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            winner: finalWinner,
            xyloScore: nextScores.Xylo,
            noriScore: nextScores.Nori,
            rounds: maxRounds,
            date: new Date().toLocaleString()
          }, ...prev]);
       }
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4">
      <motion.div 
         initial={{ scale: 0.95, opacity: 0 }} 
         animate={{ scale: 1, opacity: 1 }} 
         className="w-full max-w-5xl bg-[#0a0a0a] border-4 border-white/20 p-10 flex flex-col items-center relative overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.05)]"
      >
         {/* Brutalist Grid Background overlay */}
         <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
         
         <button onClick={onClose} className="absolute top-6 right-6 z-10 text-on-surface-variant hover:text-red-500 transition-colors">
            <X className="w-10 h-10" strokeWidth={1.5} />
         </button>

         <div className="z-10 flex flex-col items-center w-full">
            <BrainCircuit className="w-20 h-20 text-white mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" strokeWidth={1} />
            <h1 className="text-5xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 uppercase tracking-tighter mb-4">
               Auto-Battle Protocol
            </h1>
            <p className="text-gray-400 font-mono text-center max-w-2xl mb-12 uppercase text-sm tracking-widest border-b border-white/10 pb-6 w-full">
               System Initialized. Entrants: <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] font-bold">Xylo</span> vs <span className="text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.5)] font-bold">Nori</span>. First to compute correct result wins round.
            </p>

            {gameState === 'IDLE' && (
               <div className="flex flex-col items-center justify-center w-full gap-8">
                   <div className="grid grid-cols-2 gap-12 w-full max-w-2xl px-4">
                      {/* Xylo Difficulty */}
                      <div className="flex flex-col items-center gap-4">
                         <h3 className="text-xl font-mono text-cyan-400 uppercase tracking-widest text-center">Xylo Diff</h3>
                         <div className="flex gap-2">
                           {['EASY', 'MEDIUM', 'HARD'].map(d => (
                              <button 
                                key={d} 
                                onClick={() => setXyloDiff(d as any)}
                                className={`px-4 py-2 text-xs font-mono font-bold uppercase transition-all border ${xyloDiff === d ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-[#111] text-gray-500 border-white/10 hover:border-white/30'}`}
                              >
                                 {d}
                              </button>
                           ))}
                         </div>
                      </div>

                      {/* Nori Difficulty */}
                      <div className="flex flex-col items-center gap-4">
                         <h3 className="text-xl font-mono text-fuchsia-400 uppercase tracking-widest text-center">Nori Diff</h3>
                         <div className="flex gap-2">
                           {['EASY', 'MEDIUM', 'HARD'].map(d => (
                              <button 
                                key={d} 
                                onClick={() => setNoriDiff(d as any)}
                                className={`px-4 py-2 text-xs font-mono font-bold uppercase transition-all border ${noriDiff === d ? 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.2)]' : 'bg-[#111] text-gray-500 border-white/10 hover:border-white/30'}`}
                              >
                                 {d}
                              </button>
                           ))}
                         </div>
                      </div>
                   </div>

                   <button onClick={startGame} className="px-12 py-5 bg-white text-black hover:bg-gray-200 hover:scale-[1.02] font-mono font-black uppercase tracking-widest border-4 border-white transition-all active:scale-95 flex items-center gap-4 group">
                      <Play className="fill-current w-6 h-6 group-hover:animate-pulse" /> Initialize Match
                   </button>

                   <button onClick={() => setShowHistory(true)} className="text-gray-400 hover:text-white font-mono uppercase tracking-widest text-sm flex items-center gap-2 mt-4 transition-colors">
                      <HistoryIcon className="w-4 h-4" /> View Battle History
                   </button>
               </div>
            )}

            {gameState !== 'IDLE' && (
               <div className="w-full flex flex-col gap-10">
                  {/* Scoreboard */}
                  <div className="flex justify-between items-center w-full bg-[#111] px-10 py-6 border-y-2 border-white/10 relative">
                     <div className="text-center w-1/3">
                        <h2 className="text-3xl font-mono font-bold tracking-widest text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] uppercase">Xylo</h2>
                        <p className="text-6xl font-black font-mono text-white mt-2 leading-none">{scores.Xylo}</p>
                     </div>
                     
                     <div className="text-center flex flex-col items-center justify-center w-1/3 border-x-2 border-white/10 px-4">
                        <span className="text-xs font-mono text-gray-500 uppercase tracking-widest bg-black px-4 py-2 border border-white/10 mb-4 animate-pulse">
                           Cycle {currentRound} / {maxRounds}
                        </span>
                        {gameState === 'ENDED' ? (
                           <h3 className="text-3xl font-black font-mono text-white uppercase tracking-tighter">Terminated</h3>
                        ) : (
                           <h3 className="text-5xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{problem || '---'}</h3>
                        )}
                     </div>
                     
                     <div className="text-center w-1/3">
                        <h2 className="text-3xl font-mono font-bold tracking-widest text-fuchsia-400 drop-shadow-[0_0_10px_rgba(232,121,249,0.5)] uppercase">Nori</h2>
                        <p className="text-6xl font-black font-mono text-white mt-2 leading-none">{scores.Nori}</p>
                     </div>
                  </div>

                  {/* Battle Arena */}
                  {gameState === 'PLAYING' && (
                     <div className="grid grid-cols-2 gap-10 w-full px-4">
                        <div className={`p-8 border-2 flex flex-col items-center justify-center transition-all duration-300 min-h-[200px] relative overflow-hidden
                           ${roundWinner === 'Xylo' ? 'bg-cyan-950/30 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.3)]' : 'bg-[#1a1a1a] border-white/10'}`}>
                           {roundWinner === 'Xylo' && <div className="absolute inset-0 bg-cyan-400/5 animate-pulse rounded-lg pointer-events-none"></div>}
                           <span className="text-sm font-mono uppercase tracking-widest text-gray-500 mb-6">Xylo.Response</span>
                           <div className={`text-5xl font-mono font-black ${roundWinner === 'Xylo' ? 'text-cyan-400' : 'text-gray-300'}`}>{xyloAnswer}</div>
                           {xyloTime > 0 && <div className="absolute bottom-4 left-4 text-xs font-mono text-cyan-500/70">{xyloTime}ms</div>}
                        </div>
                        
                        <div className={`p-8 border-2 flex flex-col items-center justify-center transition-all duration-300 min-h-[200px] relative overflow-hidden
                           ${roundWinner === 'Nori' ? 'bg-fuchsia-950/30 border-fuchsia-400 shadow-[0_0_30px_rgba(232,121,249,0.3)]' : 'bg-[#1a1a1a] border-white/10'}`}>
                           {roundWinner === 'Nori' && <div className="absolute inset-0 bg-fuchsia-400/5 animate-pulse rounded-lg pointer-events-none"></div>}
                           <span className="text-sm font-mono uppercase tracking-widest text-gray-500 mb-6">Nori.Response</span>
                           <div className={`text-5xl font-mono font-black ${roundWinner === 'Nori' ? 'text-fuchsia-400' : 'text-gray-300'}`}>{noriAnswer}</div>
                           {noriTime > 0 && <div className="absolute bottom-4 right-4 text-xs font-mono text-fuchsia-500/70">{noriTime}ms</div>}
                        </div>
                     </div>
                  )}

                  {/* Inter-round messages */}
                  <div className="h-16 flex items-center justify-center overflow-hidden">
                     <AnimatePresence mode="wait">
                        {roundWinner && gameState === 'PLAYING' && (
                           <motion.div 
                              key={roundWinner}
                              initial={{ opacity: 0, scale: 0.8, y: 20 }} 
                              animate={{ opacity: 1, scale: 1, y: 0 }} 
                              exit={{ opacity: 0, y: -20 }}
                              className="text-2xl font-black font-mono text-white tracking-[0.2em] uppercase px-8 py-3 border border-white/20 bg-white/5"
                           >
                              {roundWinner === 'Xylo' ? <span className="text-cyan-400">Xylo Override</span> : 
                               roundWinner === 'Nori' ? <span className="text-fuchsia-400">Nori Override</span> : 
                               <span className="text-gray-400">Syntax Error - Draw</span>}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>

                  {/* End Screen */}
                  {gameState === 'ENDED' && (
                     <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center mt-4">
                        <Trophy className={`w-24 h-24 mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] ${scores.Xylo > scores.Nori ? 'text-cyan-400' : scores.Nori > scores.Xylo ? 'text-fuchsia-400' : 'text-white'}`} strokeWidth={1} />
                        <h2 className="text-7xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-4 uppercase tracking-tighter">
                           {scores.Xylo > scores.Nori ? 'Xylo Dominates' : scores.Nori > scores.Xylo ? 'Nori Dominates' : 'Mutual Destruction'}
                        </h2>
                        <button onClick={startGame} className="mt-10 px-10 py-5 bg-transparent border-2 border-white text-white hover:bg-white hover:text-black font-mono font-black uppercase tracking-widest flex items-center gap-3 transition-colors group">
                           <RefreshCw className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-500" /> Reboot Sequence
                        </button>
                     </motion.div>
                  )}
               </div>
            )}

            {/* History Modal */}
            <AnimatePresence>
               {showHistory && (
                  <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     className="absolute inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col p-8 border-4 border-white/20"
                  >
                     <button onClick={() => setShowHistory(false)} className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors">
                        <X className="w-8 h-8" />
                     </button>
                     
                     <h2 className="text-4xl font-mono font-black text-white uppercase tracking-widest mb-8 border-b border-white/20 pb-4 flex items-center gap-4">
                        <HistoryIcon className="w-10 h-10" /> Battle Log
                     </h2>

                     {battleHistory.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-mono tracking-widest uppercase">
                           No battles recorded yet
                        </div>
                     ) : (
                        <div className="flex-1 overflow-y-auto w-full flex flex-col gap-4 pr-4 custom-scrollbar">
                           {battleHistory.map(entry => (
                              <div key={entry.id} className="bg-[#111] border border-white/10 p-6 flex justify-between items-center w-full">
                                 <div>
                                    <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-widest">{entry.date} • {entry.rounds} ROUNDS</div>
                                    <div className="text-xl font-mono font-bold tracking-widest uppercase flex items-center gap-4">
                                       <span className={`${entry.winner === 'Xylo' ? 'text-cyan-400' : 'text-gray-500'}`}>Xylo : {entry.xyloScore}</span>
                                       <span className="text-white/20">vs</span>
                                       <span className={`${entry.winner === 'Nori' ? 'text-fuchsia-400' : 'text-gray-500'}`}>Nori : {entry.noriScore}</span>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Victor</div>
                                    <div className={`text-2xl font-mono font-black uppercase tracking-tighter ${entry.winner === 'Xylo' ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : entry.winner === 'Nori' ? 'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(232,121,249,0.5)]' : 'text-white'}`}>
                                       {entry.winner}
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </motion.div>
    </div>
  );
};
