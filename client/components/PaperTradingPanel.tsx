import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, DollarSign, Crosshair, Zap, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Trade } from '../types';

interface Props {
  apiUrl: string;
  config: any; // Contains symbol, interval, strategy, params, balance
}

const PaperTradingPanel: React.FC<Props> = ({ apiUrl, config }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/paper/status`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatus(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [apiUrl]);

  const deployEngine = async () => {
    setDeploying(true);
    setError(null);
    try {
      const payload = {
        symbol: config.symbol,
        interval: config.interval,
        strategy: config.strategy,
        params: config.params,
        balance: config.balance || 10000,
        leverage: config.leverage || 100,
        fee: config.fee || 0.05,
        risk: config.risk || 1
      };
      
      const res = await fetch(`${apiUrl}/api/paper/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeploying(false);
    }
  };

  const stopEngine = async () => {
    setDeploying(true);
    try {
      await fetch(`${apiUrl}/api/paper/stop`, { method: 'POST' });
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeploying(false);
    }
  };

  const active = status?.active;
  const deployment = status?.deployment;
  const balance = status?.balance || config.balance || 10000;
  const openPosition = status?.openPosition;
  const trades = status?.trades || [];

  const profit = balance - (deployment?.balance || config.balance || 10000);
  const profitPct = (profit / (deployment?.balance || config.balance || 10000)) * 100;

  const chartData = trades.map((t: Trade, i: number) => {
      const currentEq = (deployment?.balance || config.balance || 10000) + trades.slice(0, i + 1).reduce((sum: number, tr: Trade) => sum + parseFloat(tr.profit), 0);
      return {
          time: new Date(t.exit_time).toLocaleTimeString(),
          equity: currentEq
      }
  });
  if (chartData.length === 0 && active) {
      chartData.push({ time: new Date(deployment.deployed_at * 1000).toLocaleTimeString(), equity: deployment.balance });
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter italic">Paper Engine</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1">Live Forward Testing & Execution</p>
        </div>
        
        <div className="flex gap-2">
          {!active ? (
            <button 
              onClick={deployEngine}
              disabled={deploying}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
            >
              <Play className="w-4 h-4" />
              {deploying ? 'Deploying...' : 'Deploy Strategy'}
            </button>
          ) : (
            <button 
              onClick={stopEngine}
              disabled={deploying}
              className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
            >
              <Square className="w-4 h-4" />
              Stop Engine
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`border rounded-[2rem] p-6 relative overflow-hidden ${active ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-[#0a0f1d] border-white/5'}`}>
          {active && <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[50px] -mr-10 -mt-10 rounded-full animate-pulse" />}
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-xl ${active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-500'}`}>
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
          </div>
          <p className={`text-2xl font-black uppercase tracking-tighter ${active ? 'text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'text-slate-500'}`}>
            {active ? 'Engine Active' : 'Offline'}
          </p>
          {active && deployment && (
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              Running {deployment.strategy} on {deployment.symbol} {deployment.interval}
            </p>
          )}
        </div>

        <div className="bg-[#0a0f1d] border border-white/5 rounded-[2rem] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paper Balance</span>
          </div>
          <p className="text-3xl font-black text-white">${balance.toFixed(2)}</p>
          {active && (
            <p className={`text-[11px] font-black uppercase mt-1 ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(2)} ({profitPct.toFixed(2)}%)
            </p>
          )}
        </div>

        <div className="bg-[#0a0f1d] border border-white/5 rounded-[2rem] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Crosshair className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Open Position</span>
          </div>
          {openPosition ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${openPosition.isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {openPosition.isLong ? 'LONG' : 'SHORT'}
                  </span>
                  <span className="text-sm font-black text-white">{openPosition.size.toFixed(4)}</span>
                </div>
                <span className={`text-xs font-black ${openPosition.unrealizedPnLPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {openPosition.unrealizedPnLPct >= 0 ? '+' : ''}{openPosition.unrealizedPnLPct.toFixed(2)}%
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500">Entry:</span>
                  <span className="text-white">{openPosition.entryPrice?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500">Current:</span>
                  <span className="text-white">{openPosition.currentPrice?.toFixed(2)}</span>
                </div>
                {openPosition.stoploss && (
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Stop Loss:</span>
                    <span className="text-rose-400 font-bold">{openPosition.stoploss.toFixed(2)}</span>
                  </div>
                )}
                {openPosition.takeProfits && openPosition.takeProfits.length > 0 && (
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Next TP:</span>
                    <span className="text-emerald-400 font-bold">
                      {openPosition.takeProfits.find((tp: any) => !tp.hit)?.targetPrice?.toFixed(2) || 'All Hit'}
                    </span>
                  </div>
                )}
                {openPosition.trailing && openPosition.highestProfitPrice && (
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Highwater:</span>
                    <span className="text-indigo-400">{openPosition.highestProfitPrice.toFixed(2)} (Trailing)</span>
                  </div>
                )}
                {openPosition.quantityPct !== undefined && openPosition.quantityPct < 100 && (
                  <div className="flex justify-between text-[10px] font-mono mt-1 pt-1 border-t border-white/10">
                    <span className="text-slate-500">Remaining Qty:</span>
                    <span className="text-white">{openPosition.quantityPct.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-lg font-bold text-slate-600 italic">No Open Positions</p>
          )}
        </div>

        <div className="bg-[#0a0f1d] border border-white/5 rounded-[2rem] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Trades</span>
          </div>
          <p className="text-3xl font-black text-white">{trades.length}</p>
        </div>
      </div>

      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 min-h-[300px]">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Equity Curve (Live)</h3>
            {chartData.length > 1 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="eqColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#eqColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center opacity-30">
                <p className="text-xs font-black uppercase tracking-widest">Waiting for trades...</p>
              </div>
            )}
          </div>
          
          <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 overflow-y-auto max-h-[400px]">
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Recent Executions</h3>
             <div className="space-y-3">
               {trades.slice().reverse().map((t: Trade, i: number) => (
                 <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                   <div>
                     <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${t.isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {t.isLong ? 'LONG' : 'SHORT'}
                     </span>
                     <p className="text-[10px] text-slate-400 mt-1">{new Date(t.exit_time).toLocaleTimeString()}</p>
                   </div>
                   <div className="text-right">
                     <p className={`text-sm font-black ${parseFloat(t.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {parseFloat(t.profit) >= 0 ? '+' : ''}{t.profit}
                     </p>
                   </div>
                 </div>
               ))}
               {trades.length === 0 && (
                 <p className="text-xs text-center text-slate-600 italic py-4">No closed trades yet.</p>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperTradingPanel;
