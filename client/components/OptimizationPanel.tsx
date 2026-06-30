import React, { useState, useEffect } from 'react';
import { RefreshCcw, Settings, Zap, Check, AlertCircle, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '../store';

interface Props {
  apiUrl: string;
  baseParams: string; // symbol=BTC_USDT&interval=15m&start=...
  onApplyParams: (params: any) => void;
}

const OptimizationPanel: React.FC<Props> = ({ apiUrl, baseParams, onApplyParams }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'fast' | 'full'>('fast');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedRank, setAppliedRank] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { optimizeTopN, optimizeMinTrades, updateParams } = useStore();
  const [progress, setProgress] = useState<{ current: number, total: number, valid: number } | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Timer for elapsed time
  useEffect(() => {
    if (!loading || !startTime) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [loading, startTime]);

  useEffect(() => {
    const wsUrl = apiUrl.replace('http', 'ws') + '/ws/signals';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'optimize_progress') {
          setProgress({
            current: msg.current,
            total: msg.total,
            valid: msg.valid
          });
        }
      } catch (e) {}
    };

    return () => {
      ws.close();
    };
  }, [apiUrl]);

  const runOptimization = async () => {
    setLoading(true);
    setError(null);
    setAppliedRank(null);
    setProgress(null);
    setStartTime(Date.now());
    setElapsedTime(0);
    try {
      // The API endpoint handles creating the params and running the worker
      // We pass the base parameters so it knows which timeframe/asset to use
      const endpoint = `${apiUrl}/api/optimize?${baseParams}&mode=${mode}&topN=${optimizeTopN}&minTrades=${optimizeMinTrades}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (params: any, rank: number) => {
    onApplyParams(params);
    setAppliedRank(rank);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter italic">Optimizer</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1">Grid Search & Parameter Discovery</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            disabled={loading}
            className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Config
          </button>
          <select 
            value={mode} 
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as 'fast' | 'full')}
            className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none"
            disabled={loading}
          >
            <option value="fast">Fast Search (~300 combos)</option>
            <option value="full">Full Search (~5,000 combos)</option>
          </select>
          <button 
            onClick={runOptimization} 
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Optimizing...' : 'Run Optimizer'}
          </button>
        </div>
      </div>

      <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8">
        {!results && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center opacity-40">
            <Settings className="w-16 h-16 text-emerald-500" />
            <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Select Mode and Run Optimizer</p>
            <p className="text-[10px] text-slate-500 max-w-sm">
              The optimizer runs a grid search across thousands of parameter combinations directly in the backend memory engine, scoring them using the customized fitness function.
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-black text-rose-400 uppercase tracking-widest">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-6 w-full max-w-2xl mx-auto">
            <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Searching parameter space...</p>
            
            {progress && progress.total > 0 && (
              <div className="w-full space-y-6">
                {/* Main Progress Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline gap-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-black text-white">{Math.round((progress.current / progress.total) * 100)}%</span>
                      <span className="text-[10px] text-slate-500">{progress.current.toLocaleString()} / {progress.total.toLocaleString()} combos</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 px-3 py-1 bg-emerald-500/10 rounded-full">
                      Valid: {progress.valid}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden border border-slate-700/50">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-300 rounded-full shadow-lg shadow-emerald-500/20"
                      style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Time Elapsed */}
                  <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">Elapsed</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  {/* Speed */}
                  <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">Speed</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {elapsedTime > 0 ? (progress.current / elapsedTime).toFixed(0) : '0'} /sec
                    </span>
                  </div>

                  {/* ETA */}
                  <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">ETA</span>
                    <span className="text-sm font-bold text-sky-400 font-mono">
                      {elapsedTime > 0 && progress.current > 0
                        ? `${Math.ceil((progress.total - progress.current) / (progress.current / elapsedTime))}s`
                        : '—'
                      }
                    </span>
                  </div>
                </div>

                {/* Progress Stages */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className={`flex items-center gap-2 ${progress.current > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${progress.current > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    Started
                  </div>
                  <div className={`flex items-center gap-2 ${progress.current >= progress.total * 0.25 ? 'text-emerald-400' : 'text-slate-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${progress.current >= progress.total * 0.25 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    25%
                  </div>
                  <div className={`flex items-center gap-2 ${progress.current >= progress.total * 0.5 ? 'text-emerald-400' : 'text-slate-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${progress.current >= progress.total * 0.5 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    50%
                  </div>
                  <div className={`flex items-center gap-2 ${progress.current >= progress.total * 0.75 ? 'text-emerald-400' : 'text-slate-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${progress.current >= progress.total * 0.75 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    75%
                  </div>
                  <div className={`flex items-center gap-2 ${progress.current === progress.total ? 'text-emerald-400' : 'text-slate-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${progress.current === progress.total ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    Complete
                  </div>
                </div>

                {mode === 'full' && !progress && <p className="text-[9px] text-slate-600">This may take a minute.</p>}
              </div>
            )}
          </div>
        )}

        {results && !loading && (
          <div className="space-y-6">
            <div className="flex gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Total Runs</span>
                <span className="text-xl font-black text-white">{results.totalRuns}</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-3">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block">Valid Combos</span>
                <span className="text-xl font-black text-emerald-400">{results.validRuns}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[9px] text-slate-600 uppercase tracking-widest border-b border-white/5">
                    <th className="pb-3 text-left">Rank</th>
                    <th className="pb-3 text-right">Score</th>
                    <th className="pb-3 text-right">Win Rate</th>
                    <th className="pb-3 text-right">Sharpe</th>
                    <th className="pb-3 text-right">Return</th>
                    <th className="pb-3 text-right">Max DD</th>
                    <th className="pb-3 text-right">Params Snippet</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r: any) => {
                    const p = r.params;
                    const snippet = `Sens:${p.sensitivity} TP1:${p.tp1Pct}% SL:${p.slPercent}%`;
                    return (
                      <tr key={r.rank} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="py-3">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${r.rank === 1 ? 'bg-amber-500 text-amber-950' : r.rank <= 3 ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-400'}`}>
                            {r.rank}
                          </span>
                        </td>
                        <td className="py-3 text-right font-black text-emerald-400">{r.score.toFixed(3)}</td>
                        <td className="py-3 text-right text-slate-300">{r.performance.winRate}%</td>
                        <td className="py-3 text-right text-slate-300">{r.performance.sharpeRatio}</td>
                        <td className="py-3 text-right font-bold text-emerald-400">{r.performance.totalReturn}%</td>
                        <td className="py-3 text-right font-bold text-rose-400">{r.performance.maxDrawdownPercent}%</td>
                        <td className="py-3 text-right text-[10px] text-slate-500 font-mono tracking-tighter">{snippet}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleApply(p, r.rank)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              appliedRank === r.rank 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-white/10 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400'
                            }`}
                          >
                            {appliedRank === r.rank ? <Check className="w-3 h-3 inline mr-1"/> : null}
                            {appliedRank === r.rank ? 'Applied' : 'Apply'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0f1d] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Optimizer Config
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Top N Results</label>
                  <input type="number" value={optimizeTopN} onChange={(e) => updateParams({ optimizeTopN: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Min Trades</label>
                  <input type="number" value={optimizeMinTrades} onChange={(e) => updateParams({ optimizeMinTrades: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-slate-300 hover:bg-white/10 transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  runOptimization();
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                Save & Rerun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizationPanel;
