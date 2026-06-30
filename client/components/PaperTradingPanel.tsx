import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, DollarSign, Crosshair, Zap, AlertTriangle, Settings, X, Plus, List } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Trade } from '../types';
import { useStore } from '../store';
import { ASSET_OPTIONS, INTERVAL_OPTIONS } from '../constants';

interface Props {
  apiUrl: string;
  config: any; // Base config from currently viewed backtest
}

const PaperTradingPanel: React.FC<Props> = ({ apiUrl, config }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTradesDeployment, setSelectedTradesDeployment] = useState<any>(null);

  const { updateParams, symbol, interval, balance: storeBalance, leverage, risk, fee, strategy } = useStore();

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
    const intervalId = setInterval(fetchStatus, 5000); // Poll every 5s
    return () => clearInterval(intervalId);
  }, [apiUrl]);

  const deployEngine = async () => {
    setDeploying(true);
    setError(null);
    try {
      const payload = {
        symbol: symbol,
        interval: interval,
        strategy: strategy,
        params: config.params, // use currently generated params from backtest
        balance: storeBalance || 10000,
        leverage: leverage || 100,
        fee: fee || 0.05,
        risk: risk || 1
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

  const stopEngine = async (id?: string) => {
    setDeploying(true);
    try {
      await fetch(`${apiUrl}/api/paper/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {})
      });
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeploying(false);
    }
  };

  const activeDeployments = status?.deployments || [];
  
  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter italic">Paper Engine</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1">Multi-Strategy Forward Testing</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            disabled={deploying}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Deploy New
          </button>
          
          {activeDeployments.length > 0 && (
            <button
              onClick={() => stopEngine()}
              disabled={deploying}
              className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
            >
              <Square className="w-4 h-4" />
              Stop All
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

      {activeDeployments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center opacity-40">
          <Activity className="w-16 h-16 text-indigo-500" />
          <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">No active paper trading deployments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {activeDeployments.map((dep: any, idx: number) => {
            const deployment = dep.deployment;
            const balance = dep.balance;
            const openPosition = dep.openPosition;
            const trades = dep.trades || [];
            
            const startBalance = deployment.balance;
            const profit = balance - startBalance;
            const profitPct = (profit / startBalance) * 100;

            const bestTrade = trades.length > 0 ? trades.reduce((best: any, t: any) => parseFloat(t.profit) > parseFloat(best.profit) ? t : best) : null;
            const worstTrade = trades.length > 0 ? trades.reduce((worst: any, t: any) => parseFloat(t.profit) < parseFloat(worst.profit) ? t : worst) : null;

            const chartData = trades.map((t: Trade, i: number) => {
              const currentEq = startBalance + trades.slice(0, i + 1).reduce((sum: number, tr: Trade) => sum + parseFloat(tr.profit), 0);
              return {
                time: new Date(t.exit_time).toLocaleTimeString(),
                equity: currentEq
              }
            });
            if (chartData.length === 0) {
              chartData.push({ time: new Date(deployment.deployed_at * 1000).toLocaleTimeString(), equity: startBalance });
            }

            return (
              <div key={deployment.id} className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-6 space-y-6 flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-indigo-400">
                      {deployment.strategy} <span className="text-white">| {deployment.symbol} {deployment.interval}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">Deployed ID: {deployment.id} • {new Date(deployment.deployed_at * 1000).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTradesDeployment(dep)}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all"
                    >
                      <List className="w-3 h-3" /> All Trades
                    </button>
                    <button
                      onClick={() => stopEngine(deployment.id)}
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all"
                    >
                      <Square className="w-3 h-3" /> Stop
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-grow">
                  {/* PnL Card */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Balance</span>
                    </div>
                    <p className="text-2xl font-black text-white">${balance.toFixed(2)}</p>
                    <p className={`text-[11px] font-black uppercase mt-1 ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {profit >= 0 ? '+' : ''}{profit.toFixed(2)} ({profitPct.toFixed(2)}%)
                    </p>
                  </div>

                  {/* Open Position */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5 md:col-span-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                        <Crosshair className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Open Position</span>
                    </div>
                    {openPosition ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${openPosition.isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              {openPosition.isLong ? 'LONG' : 'SHORT'}
                            </span>
                            <span className="text-sm font-black text-white">{openPosition.size.toFixed(4)}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">Entry: {openPosition.entryPrice?.toFixed(2)} | Current: {openPosition.currentPrice?.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xl font-black ${openPosition.unrealizedPnLPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {openPosition.unrealizedPnLPct >= 0 ? '+' : ''}{openPosition.unrealizedPnLPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-slate-600 italic mt-2">No active trade.</p>
                    )}
                  </div>

                  {/* Trades Stats */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                        <Activity className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Stats</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-500 font-black uppercase">Trades:</span>
                      <span className="text-[11px] text-white font-bold">{trades.length}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-slate-500 font-black uppercase">Best:</span>
                      <span className="text-[11px] text-emerald-400 font-bold">{bestTrade ? `+$${parseFloat(bestTrade.profit).toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-500 font-black uppercase">Worst:</span>
                      <span className="text-[11px] text-rose-400 font-bold">{worstTrade ? `-$${Math.abs(parseFloat(worstTrade.profit)).toFixed(2)}` : '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Equity Curve */}
                <div className="bg-[#020617] rounded-2xl p-4 border border-white/5 h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id={`eqColor-${deployment.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill={`url(#eqColor-${deployment.id})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trades Details Modal */}
      {selectedTradesDeployment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0f1d] border border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <List className="w-4 h-4" /> Trade History - {selectedTradesDeployment.deployment.strategy} ({selectedTradesDeployment.deployment.symbol})
              </h3>
              <button onClick={() => setSelectedTradesDeployment(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow" style={{ maxHeight: '60vh' }}>
              <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase tracking-widest text-slate-500 sticky top-0 bg-[#0a0f1d] z-10 shadow-md">
                  <tr>
                    <th className="pb-4 pt-2 px-2">Type</th>
                    <th className="pb-4 pt-2 px-2">Status</th>
                    <th className="pb-4 pt-2 px-2">Entry Time</th>
                    <th className="pb-4 pt-2 px-2">Entry Price</th>
                    <th className="pb-4 pt-2 px-2">Close Time / Price</th>
                    <th className="pb-4 pt-2 px-2">SL / TP</th>
                    <th className="pb-4 pt-2 px-2">Drawdown (MAE)</th>
                    <th className="pb-4 pt-2 px-2 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {selectedTradesDeployment.openPosition && (
                    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors bg-indigo-500/5">
                      <td className="py-4 px-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${selectedTradesDeployment.openPosition.isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {selectedTradesDeployment.openPosition.isLong ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="py-4 px-2"><span className="text-amber-400 font-bold uppercase text-[9px] tracking-widest">Open</span></td>
                      <td className="py-4 px-2 text-slate-300">Active Now</td>
                      <td className="py-4 px-2 text-slate-300">{selectedTradesDeployment.openPosition.entryPrice?.toFixed(2)}</td>
                      <td className="py-4 px-2 text-slate-300">
                        Current: {selectedTradesDeployment.openPosition.currentPrice?.toFixed(2)}
                      </td>
                      <td className="py-4 px-2 text-slate-500 text-[10px]">
                        SL: {selectedTradesDeployment.openPosition.stoploss ? selectedTradesDeployment.openPosition.stoploss.toFixed(2) : '-'} <br/>
                        Next TP: {selectedTradesDeployment.openPosition.takeProfits?.find((tp: any) => !tp.hit)?.targetPrice?.toFixed(2) || '-'}
                      </td>
                      <td className="py-4 px-2 text-slate-500">-</td>
                      <td className={`py-4 px-2 text-right font-black ${selectedTradesDeployment.openPosition.unrealizedPnLPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedTradesDeployment.openPosition.unrealizedPnLPct >= 0 ? '+' : ''}{selectedTradesDeployment.openPosition.unrealizedPnLPct.toFixed(2)}%
                      </td>
                    </tr>
                  )}
                  
                  {selectedTradesDeployment.trades.slice().reverse().map((t: any, i: number) => {
                    const pnlVal = parseFloat(t.profit);
                    return (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {t.isLong ? 'LONG' : 'SHORT'}
                          </span>
                        </td>
                        <td className="py-4 px-2"><span className="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Closed</span></td>
                        <td className="py-4 px-2 text-slate-300">{new Date(t.entry_time).toLocaleString()}</td>
                        <td className="py-4 px-2 text-slate-300">
                          {t.entry_price?.toFixed(2)}
                          <br />
                          <span className="text-[10px] text-slate-500">Qty: {t.qnt ? t.qnt.toFixed(4) : '-'}</span>
                        </td>
                        <td className="py-4 px-2 text-slate-300">
                          {new Date(t.exit_time).toLocaleString()} <br/>
                          <span className="text-slate-500">@ {t.exit_price?.toFixed(2)}</span>
                        </td>
                        <td className="py-4 px-2 text-slate-500 text-[10px]">
                          SL: {t.stoploss ? t.stoploss.toFixed(2) : '-'} <br/>
                          <span className="text-[9px]">Partials: {t.partial_exit_time ? 'Yes' : 'No'}</span>
                        </td>
                        <td className="py-4 px-2 text-slate-500">
                          {t.maePct ? `${t.maePct.toFixed(2)}%` : '-'}
                        </td>
                        <td className={`py-4 px-2 text-right font-black ${pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnlVal >= 0 ? '+$' : '-$'}{Math.abs(pnlVal).toFixed(2)}
                          <br />
                          <span className="text-[10px] opacity-70 tracking-widest">{t.profitPct}%</span>
                        </td>
                      </tr>
                    );
                  })}
                  {selectedTradesDeployment.trades.length === 0 && !selectedTradesDeployment.openPosition && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-600 italic">No trades executed yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end flex-shrink-0">
              <button
                onClick={() => setSelectedTradesDeployment(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-slate-300 hover:bg-white/10 transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0f1d] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Deploy New Strategy
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-400">
                This will deploy the strategy currently configured in the <strong>Backtest</strong> tab using its latest tuned parameters.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Asset Pair</label>
                  <select value={symbol} onChange={(e) => updateParams({ symbol: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all cursor-pointer">
                    {ASSET_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Resolution</label>
                  <select value={interval} onChange={(e) => updateParams({ interval: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all cursor-pointer">
                    {INTERVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Initial Balance ($)</label>
                  <input type="number" value={storeBalance} onChange={(e) => updateParams({ balance: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Leverage (x)</label>
                  <input type="number" value={leverage} onChange={(e) => updateParams({ leverage: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Risk/Trade (%)</label>
                  <input type="number" step="0.1" value={risk} onChange={(e) => updateParams({ risk: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Fee (%)</label>
                  <input type="number" step="0.01" value={fee} onChange={(e) => updateParams({ fee: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-indigo-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-slate-300 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  deployEngine();
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
              >
                Deploy Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperTradingPanel;
