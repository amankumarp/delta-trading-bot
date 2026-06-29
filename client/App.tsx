
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import {
  TrendingUp, Activity, Clock, Target, ArrowUpRight, ArrowDownRight, RefreshCcw,
  BrainCircuit, LayoutDashboard, BarChart, List, Zap, ShieldCheck,
  Settings, Eye, DollarSign, Scale, TrendingDown, Layers, Briefcase, Gem,
  Award, AlertTriangle, Calendar, ChevronRight, PlayCircle, Info, Trash2, PlusCircle, X, Crosshair
} from 'lucide-react';
import { BacktestResponse, IndicatorSettings, Trade, IndicatorConfig } from './types';
import { ASSET_OPTIONS, INTERVAL_OPTIONS, STRATEGY_OPTIONS } from './constants';
import StatCard from './components/StatCard';
import TradingChart from './components/TradingChart';
import {
  HourlyTradingStats,
  DailyProfitHeatmap,
  PositionDistribution,
  EquityCurveChart,
  DayOfWeekAnalysis,
  ProfitBucketsChart,
  MonthlyYieldChart,
  PerformanceBarChart,
  MarketTrendEquityChart
} from './components/DashboardCharts';
import { getStrategyAnalysis } from './services/geminiService';
import RobustnessPanel from './components/RobustnessPanel';
import OptimizationPanel from './components/OptimizationPanel';
import PaperTradingPanel from './components/PaperTradingPanel';

type TabType = 'backtest' | 'trades' | 'chart' | 'robustness' | 'optimization' | 'papertrading';
type AppView = 'config' | 'dashboard';
const JOURNAL_PAGE_SIZE = 50;

const App: React.FC = () => {
  const {
    view, activeTab, focusedTradeIndex,
    strategy, symbol, interval, startDateTime, endDateTime, balance, leverage, risk, fee, apiUrl,
    imbaSensitivity, imbaRiskPercent, imbaTP1Pct, imbaTP1Size, imbaTP2Pct, imbaTP2Size, 
    imbaTP3Pct, imbaTP3Size, imbaTP4Pct, imbaTP4Size, imbaBreakEven, imbaFixedStop, imbaSLPct,
    imbaUseRsi, imbaRsiLen, imbaRsiOB, imbaRsiOS,
    indicatorSettings,
    loading, data, error, aiInsight, aiLoading, isBackfilling, backfillProgress,
    setView, setActiveTab, setFocusedTradeIndex, updateParams, removeIndicator, addIndicator, updateIndicator, updateParam,
    runBacktest, setAiInsight, setAiLoading, setBackfillProgress
  } = useStore();
  const [journalPage, setJournalPage] = useState(1);

  useEffect(() => {
    // Only connect if we need to track backfilling or live signals globally
    const wsUrl = apiUrl.replace('http', 'ws') + '/ws/signals';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'data_backfilled') {
          setBackfillProgress(`Backfilling: ${msg.chunkStart} to ${msg.chunkEnd} (${msg.chunksRemaining} chunks left)`, false);
        } else if (msg.type === 'data_backfilled_complete') {
          setBackfillProgress(null, true);
        }
      } catch (e) {}
    };

    return () => ws.close();
  }, [apiUrl, setBackfillProgress]);

  const journalTotalPages = Math.max(1, Math.ceil((data?.trades.length || 0) / JOURNAL_PAGE_SIZE));
  const journalSafePage = Math.min(journalPage, journalTotalPages);
  const journalStart = (journalSafePage - 1) * JOURNAL_PAGE_SIZE;
  const journalDisplayStart = data?.trades.length ? journalStart + 1 : 0;
  const journalDisplayEnd = Math.min(journalStart + JOURNAL_PAGE_SIZE, data?.trades.length || 0);
  const journalRows = useMemo(() => {
    return (data?.trades || []).slice(journalStart, journalStart + JOURNAL_PAGE_SIZE);
  }, [data?.trades, journalStart]);

  useEffect(() => {
    setJournalPage(1);
  }, [data]);

  useEffect(() => {
    if (journalPage !== journalSafePage) setJournalPage(journalSafePage);
  }, [journalPage, journalSafePage]);

  const handleRunBacktest = async () => {
    await runBacktest();
  };

  const jumpToTrade = (index: number) => {
    setFocusedTradeIndex(index);
    setActiveTab('chart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stats = useMemo(() => {
    if (!data?.analysis) return null;

    const raw = data.analysis;

    // Transform sessions array: [{ "Session Name": { profit, count, winRate } }] -> { "Session Name": profit }
    const sessionProfit: Record<string, number> = {};
    const sessionWinRates: Record<string, number> = {};
    raw.sessions?.forEach((s: any) => {
      const [key, value] = Object.entries(s)[0] as [string, any];
      sessionProfit[key] = value.profit;
      sessionWinRates[key] = parseFloat(value.winRate);
    });

    // Transform volatility array: [{ "Volatility Name": { profit, count, winRate } }] -> { "Volatility Name": profit }
    const volProfit: Record<string, number> = {};
    const volWinRates: Record<string, number> = {};
    raw.volatility?.forEach((v: any) => {
      const [key, value] = Object.entries(v)[0] as [string, any];
      volProfit[key] = value.profit;
      volWinRates[key] = parseFloat(value.winRate);
    });

    // Transform positions array: [{ "buy/sell": { profit, count, winRate } }] -> { "buy/sell": profit }
    const posProfit: Record<string, number> = {};
    raw.positions?.forEach((p: any) => {
      const [key, value] = Object.entries(p)[0] as [string, any];
      posProfit[key] = value.profit;
    });

    // Transform daily object: { "DD-MM-YYYY": { profit, count } } -> { "YYYY-MM-DD": profit }
    // As the heatmap expects "YYYY-MM-DD" for standard Date parsing if used, but "DD-MM-YYYY" is received, we'll format it.
    // Heatmap code actually just looks by string match but Recharts tooltip likes good formats. Let's just output YYYY-MM-DD.
    const dailyProfits: Record<string, number> = {};
    const monthlyProfits: Record<string, number> = {};
    const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (raw.daily) {
      Object.entries(raw.daily).forEach(([dateStr, metrics]: [string, any]) => {
        // Assume dateStr is "DD-MM-YYYY"
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
          dailyProfits[isoDate] = metrics.profit;

          const monthName = `${monthsNames[parseInt(parts[1], 10) - 1]} ${parts[2]}`;
          monthlyProfits[monthName] = (monthlyProfits[monthName] || 0) + metrics.profit;
        }
      });
    }

    return {
      ...raw,
      sessionProfit,
      sessionWinRates,
      volProfit,
      volWinRates,
      posProfit,
      dailyProfits,
      monthlyProfits,
    };
  }, [data]);



  const generateAiReport = async () => {
    if (!data?.analysis) return;
    setAiLoading(true);
    try {
      const insight = await getStrategyAnalysis(data.analysis, data.trades);
      setAiInsight(insight || "No insights generated.");
    } catch (e) {
      setAiInsight("AI Analysis failed. Check console.");
    } finally {
      setAiLoading(false);
    }
  };

  if (view === 'config') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 font-sans p-6 md:p-12 flex flex-col items-center justify-center">
        <div className="max-w-4xl w-full space-y-10">
          <div className="text-center space-y-4">
            <div className="inline-block bg-emerald-500/10 p-5 rounded-3xl border border-emerald-500/20 shadow-2xl mb-2">
              <TrendingUp className="text-emerald-500 w-12 h-12" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic">QUANTS<span className="text-emerald-500">BACK</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-sm">Synthetic Intelligence Trading Suite</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-8 flex flex-col">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-500 flex items-center gap-3">
                <PlayCircle className="w-5 h-5" /> Selection Engine
              </h2>
              <div className="space-y-4 flex-1">
                {STRATEGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateParams({ strategy: opt.id })}
                    className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 relative group ${strategy === opt.id
                      ? 'bg-emerald-500/10 border-emerald-500 shadow-2xl'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${strategy === opt.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-slate-500'}`}>
                      {opt.icon === 'Zap' ? <Zap className="w-6 h-6" /> : opt.icon === 'Crosshair' ? <Crosshair className="w-6 h-6" /> : opt.icon === 'TrendingUp' ? <TrendingUp className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-widest">{opt.name}</h3>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase leading-tight font-bold">{opt.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-6 flex flex-col">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-500 flex items-center gap-3">
                <Target className="w-5 h-5" /> Constraints Lab
              </h2>
              <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Asset Pair</label>
                    <select value={symbol} onChange={(e) => updateParams({ symbol: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all cursor-pointer">
                      {ASSET_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Resolution</label>
                    <select value={interval} onChange={(e) => updateParams({ interval: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all cursor-pointer">
                      {INTERVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Initial Balance ($)</label>
                    <input type="number" value={balance} onChange={(e) => updateParams({ balance: e.target.value })} placeholder="e.g. 10000" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Leverage (x)</label>
                    <input type="number" value={leverage} onChange={(e) => updateParams({ leverage: e.target.value })} placeholder="e.g. 200" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Risk/Trade (%)</label>
                    <input type="number" value={risk} onChange={(e) => updateParams({ risk: e.target.value })} placeholder="e.g. 1" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Fee (%)</label>
                    <input type="number" step="0.01" value={fee} onChange={(e) => updateParams({ fee: e.target.value })} placeholder="e.g. 0.01" className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Simulation Window</div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-600 uppercase flex items-center gap-2"><Calendar className="w-3 h-3" /> Start Boundary</label>
                      <input type="datetime-local" value={startDateTime} onChange={(e) => updateParams({ startDateTime: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-600 uppercase flex items-center gap-2"><Calendar className="w-3 h-3" /> End Boundary</label>
                      <input type="datetime-local" value={endDateTime} onChange={(e) => updateParams({ endDateTime: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* ── IMBA ALGO Settings Panel ─────────────────────────── */}
                {strategy === 'imba-algo' && (
                  <div className="space-y-5 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">IMBA ALGO Settings</span>
                    </div>

                    {/* Sensitivity + Risk */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Sensitivity</label>
                        <input type="number" step="0.1" value={imbaSensitivity} onChange={e => updateParams({ imbaSensitivity: e.target.value })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Risk %</label>
                        <input type="number" step="0.1" value={imbaRiskPercent} onChange={e => updateParams({ imbaRiskPercent: e.target.value })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                      </div>
                    </div>

                    {/* Take Profits */}
                    <div className="space-y-2">
                      <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Take Profits (% move / % position closed)</div>
                      {[
                        { label:'TP 1', pct: imbaTP1Pct, pctKey: 'imbaTP1Pct', size: imbaTP1Size, sizeKey: 'imbaTP1Size' },
                        { label:'TP 2', pct: imbaTP2Pct, pctKey: 'imbaTP2Pct', size: imbaTP2Size, sizeKey: 'imbaTP2Size' },
                        { label:'TP 3', pct: imbaTP3Pct, pctKey: 'imbaTP3Pct', size: imbaTP3Size, sizeKey: 'imbaTP3Size' },
                        { label:'TP 4', pct: imbaTP4Pct, pctKey: 'imbaTP4Pct', size: imbaTP4Size, sizeKey: 'imbaTP4Size' },
                      ].map(({ label, pct, pctKey, size, sizeKey }) => (
                        <div key={label} className="grid grid-cols-3 gap-2 items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                          <div className="space-y-0.5">
                            <label className="text-[7px] text-slate-600 uppercase font-black">Move %</label>
                            <input type="number" step="0.05" value={pct} onChange={e => updateParams({ [pctKey]: e.target.value })}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white focus:border-emerald-500 outline-none" />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[7px] text-slate-600 uppercase font-black">Size %</label>
                            <input type="number" step="5" value={size} onChange={e => updateParams({ [sizeKey]: e.target.value })}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white focus:border-emerald-500 outline-none" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Break-Even Target */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Break-Even After</label>
                        <select value={imbaBreakEven} onChange={e => updateParams({ imbaBreakEven: e.target.value })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none cursor-pointer">
                          <option value="1">TP 1</option>
                          <option value="2">TP 2</option>
                          <option value="3">TP 3</option>
                          <option value="WITHOUT">Without</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">SL % (if fixed)</label>
                        <input type="number" step="0.1" value={imbaSLPct} onChange={e => updateParams({ imbaSLPct: e.target.value })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => updateParams({ imbaFixedStop: !imbaFixedStop })}
                        className={`flex items-center justify-between p-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                          imbaFixedStop ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'
                        }`}
                      >
                        Fixed SL
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          imbaFixedStop ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                        }`}>
                          {imbaFixedStop && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </span>
                      </button>
                      <button
                        onClick={() => updateParams({ imbaUseRsi: !imbaUseRsi })}
                        className={`flex items-center justify-between p-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                          imbaUseRsi ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'
                        }`}
                      >
                        RSI Filter
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          imbaUseRsi ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                        }`}>
                          {imbaUseRsi && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </span>
                      </button>
                    </div>

                    {/* RSI params (only when filter is enabled) */}
                    {imbaUseRsi && (
                      <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">RSI Len</label>
                          <input type="number" value={imbaRsiLen} onChange={e => updateParams({ imbaRsiLen: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Overbought</label>
                          <input type="number" value={imbaRsiOB} onChange={e => updateParams({ imbaRsiOB: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Oversold</label>
                          <input type="number" value={imbaRsiOS} onChange={e => updateParams({ imbaRsiOS: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleRunBacktest}
                  disabled={loading || isBackfilling}
                  className={`w-full text-white py-4.5 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98] mt-4 ${
                    isBackfilling ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                  }`}
                >
                  {loading || isBackfilling ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                  {loading ? 'Synthesizing...' : isBackfilling ? 'Backfilling Data...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {isBackfilling && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
          <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
          {backfillProgress || 'Backfilling Historical Data in Background...'}
        </div>
      )}
      <header className="sticky top-0 z-50 bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-white/5 p-4 px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('config')}>
            <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <TrendingUp className="w-5 h-5 text-emerald-500 group-hover:text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">QUANTS<span className="text-emerald-500">BACK</span></h1>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
            <div className="px-4 py-2 border-r border-white/10">
              <span className="text-[8px] font-black text-slate-500 uppercase block tracking-widest">STRATEGY</span>
              <span className="text-[10px] font-black text-emerald-400 uppercase">{strategy}</span>
            </div>
            <div className="px-4 py-2 border-r border-white/10">
              <span className="text-[8px] font-black text-slate-500 uppercase block tracking-widest">ASSET</span>
              <span className="text-[10px] font-black text-white uppercase">{symbol}</span>
            </div>
            <div className="px-4 py-2 border-r border-white/10">
              <span className="text-[8px] font-black text-slate-500 uppercase block tracking-widest">TIMEFRAME</span>
              <span className="text-[10px] font-black text-white uppercase">{interval}</span>
            </div>
            <div className="px-4 py-2 flex items-center gap-4">
              <div>
                <span className="text-[8px] font-black text-slate-500 uppercase block tracking-widest">WINDOW</span>
                <span className="text-[10px] font-black text-slate-300 uppercase">{new Date(startDateTime).toLocaleDateString()} - {new Date(endDateTime).toLocaleDateString()}</span>
              </div>
              <button onClick={handleRunBacktest} className="p-2 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-all"><RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400 group-hover:rotate-90 transition-all duration-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:block">Indicator Lab</span>
              </div>
              <div className="absolute right-0 top-full mt-3 w-80 bg-[#0a0f1d] border border-white/10 p-6 rounded-[2rem] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] overflow-y-auto max-h-[70vh] custom-scrollbar border-t-emerald-500 border-t-4">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-[11px] font-black uppercase text-emerald-500 tracking-widest">Live Visual Signals</h3>
                    <Layers className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="space-y-4">
                    {indicatorSettings.indicators.map((ind) => (
                      <div key={ind.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4 group/item">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }}></div>
                            <span className="text-[10px] font-black text-white tracking-widest">{ind.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateIndicator(ind.id, { visible: !ind.visible })}
                              className={`p-1 rounded-md transition-all ${ind.visible ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-white/5'}`}
                            >
                              {ind.visible ? <Eye className="w-3 h-3" /> : <Eye className="w-3 h-3 opacity-20" />}
                            </button>
                            <input
                              type="color"
                              value={ind.color}
                              onChange={(e) => updateIndicator(ind.id, { color: e.target.value })}
                              className="w-5 h-5 bg-transparent border-none p-0 cursor-pointer rounded overflow-hidden"
                            />
                            <button onClick={() => removeIndicator(ind.id)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-md"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {Object.entries(ind.params).map(([pk, pv]) => (
                            <div key={pk} className="space-y-1">
                              <label className="text-[7px] text-slate-500 uppercase font-black">{pk}</label>
                              <input
                                type="number"
                                value={pv}
                                onChange={(e) => updateParam(ind.id, pk, parseFloat(e.target.value))}
                                className="bg-slate-900 border border-white/10 rounded-lg p-2 text-[10px] font-bold text-white w-full focus:border-emerald-500 outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {['EMA', 'BB', 'RSI', 'MACD'].map(t => (
                        <button key={t} onClick={() => addIndicator(t as any)} className="bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 text-[9px] font-black py-2 rounded-xl border border-white/10 hover:border-emerald-500/50 flex items-center justify-center gap-1.5 transition-all">
                          <PlusCircle className="w-3 h-3" /> {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => setView('config')} className="p-3 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-white/5 hover:border-rose-500/50 transition-all"><X className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <div className="border-b border-white/5 bg-[#0a0f1d]/40 backdrop-blur-md px-6">
        <div className="max-w-[1600px] mx-auto flex gap-10">
          <button onClick={() => setActiveTab('backtest')} className={`py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'backtest' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <LayoutDashboard className="w-4 h-4" /> PERFORMANCE
          </button>
          <button onClick={() => setActiveTab('trades')} className={`py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'trades' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <List className="w-4 h-4" /> JOURNAL
          </button>
          <button onClick={() => setActiveTab('chart')} className={`py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'chart' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <BarChart className="w-4 h-4" /> VISUALIZER
          </button>
          <button onClick={() => setActiveTab('robustness')} className={`py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'robustness' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <ShieldCheck className="w-4 h-4" /> ROBUSTNESS
          </button>
          <button onClick={() => setActiveTab('optimization')} className={`py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'optimization' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <Zap className="w-4 h-4" /> OPTIMIZER
          </button>
          <button onClick={() => setActiveTab('papertrading')} className={`py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 ${activeTab === 'papertrading' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <Activity className="w-4 h-4" /> PAPER TRADING
          </button>
        </div>
      </div>

      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
        {activeTab === 'backtest' && data && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-4xl font-black uppercase tracking-tighter italic">Performance Overview</h2>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">Synthetic Alpha Verification v5.2</p>
                  {isBackfilling && (
                    <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-amber-500/20">
                      Partial Data (Backfilling...)
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex gap-10">
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Entry</p>
                  <p className="text-xs font-bold text-slate-200">{data.analysis.startTime}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Exit</p>
                  <p className="text-xs font-bold text-slate-200">{data.analysis.endTime}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
              <StatCard label="Final Balance" value={`$${Math.abs(parseFloat(stats?.finalBalance || '0')).toLocaleString()}`} variant="green" icon={<DollarSign className="w-4 h-4" />} />
              <StatCard label="Net Profit" value={`$${parseFloat(stats?.totalProfit || '0').toLocaleString()}`} variant="teal" icon={<TrendingUp className="w-4 h-4" />} />
              <StatCard label="Win Rate" value={stats?.winRate || 0} suffix="%" variant="dark" icon={<Activity className="w-4 h-4" />} />
              <StatCard label="Profit Factor" value={stats?.profitFactor || 0} variant="purple" icon={<Scale className="w-4 h-4" />} />
              <StatCard label="Max Drawdown" value={stats?.maxDrawdownPercent || 0} suffix="%" variant="red" icon={<TrendingDown className="w-4 h-4" />} />
              <StatCard label="Total Trades" value={stats?.totalTrades || 0} variant="orange" icon={<Layers className="w-4 h-4" />} />

              <StatCard label="CAGR" value={stats?.cagr || 0} suffix="%" variant="green" icon={<TrendingUp className="w-4 h-4" />} />
              <StatCard label="Expectancy" value={`$${Math.abs(parseFloat(stats?.expectancy || '0')).toFixed(2)}`} variant="teal" icon={<Briefcase className="w-4 h-4" />} />
              <StatCard label="Win/Loss Ratio" value={stats?.winLossRatio || 0} variant="dark" icon={<Activity className="w-4 h-4" />} />
              <StatCard label="Kelly %" value={stats?.kelly || 0} suffix="%" variant="purple" icon={<Target className="w-4 h-4" />} />
              <StatCard label="Recovery Factor" value={stats?.recoveryFactor || 0} variant="red" icon={<Activity className="w-4 h-4" />} />
              <StatCard label="Sharpe Ratio" value={stats?.sharpeRatio || 0} variant="pink" icon={<Gem className="w-4 h-4" />} />
            </div>

            <div className="grid grid-cols-1 gap-8">
              <MarketTrendEquityChart data={stats?.marketTrendData || []} />
              <EquityCurveChart data={stats?.cumulativeProfit || []} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <HourlyTradingStats data={stats?.hourStats || {}} />
              <DayOfWeekAnalysis data={stats?.dayOfWeekAnalysis || {}} />
            </div>

            <ProfitBucketsChart data={stats?.profitBuckets || {}} />

            <DailyProfitHeatmap data={stats?.dailyProfits || {}} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PerformanceBarChart title="Profit by Session" data={stats?.sessionProfit || {}} color="#818cf8" unit="$" />
              <PerformanceBarChart title="Win Rate by Session" data={stats?.sessionWinRates || {}} color="#6ee7b7" unit="%" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PerformanceBarChart title="Profit by Volatility" data={stats?.volProfit || {}} color="#fbbf24" unit="$" />
              <PerformanceBarChart title="Win Rate by Volatility" data={stats?.volWinRates || {}} color="#f97316" unit="%" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PositionDistribution data={stats?.posProfit || {}} />
              <MonthlyYieldChart data={stats?.monthlyProfits || {}} />
            </div>

            {/* AI Report Section */}
            <div className="bg-[#0f172a] border border-white/5 p-10 rounded-[2.5rem] shadow-2xl">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10 bg-slate-900/40 p-8 rounded-3xl border border-white/5">
                <div className="flex items-center gap-6">
                  <div className="bg-emerald-500/20 p-5 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                    <BrainCircuit className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">Synthetic Intelligence Synthesis</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1">Institutional Neural Strategy Layer</p>
                  </div>
                </div>
                <button
                  onClick={generateAiReport}
                  disabled={aiLoading}
                  className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 px-10 py-4.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                >
                  {aiLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {aiLoading ? 'Synthesizing Patterns...' : 'Execute Full Strategic Synthesis'}
                </button>
              </div>

              <div className="p-4">
                {aiInsight ? (
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap border-l-4 border-emerald-500/20 pl-10 animate-in fade-in slide-in-from-left-4 duration-1000">
                    {aiInsight}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center grayscale">
                    <Gem className="w-20 h-20 text-emerald-500 mb-6" />
                    <p className="text-sm font-black uppercase tracking-[0.6em] text-slate-400">Initialize Strategic Neural Mapping</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trades' && data && (
          <div className="bg-[#0a0f1d] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 duration-700">
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <div className="space-y-1">
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">Execution Journal</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Full Temporal Audit of Signal Events</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {journalDisplayStart}-{journalDisplayEnd} of {data.trades.length}
                  </span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-2.5 rounded-2xl">
                  <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">{data.trades.length} Verified Events</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#050912] text-[11px] uppercase font-black text-slate-500 tracking-[0.3em] border-b border-white/5">
                  <tr>
                    <th className="px-10 py-8">Direction</th>
                    <th className="px-10 py-8">Entry Metrics</th>
                    <th className="px-10 py-8">Exit Metrics</th>
                    <th className="px-10 py-8 text-right">Yield Performance</th>
                    <th className="px-10 py-8 text-center">Visual Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {journalRows.map((trade, i) => {
                    const tradeIndex = journalStart + i;
                    const profitStr = trade.profit || trade.avg_profit || '0';
                    const profitVal = parseFloat(profitStr);
                    return (
                    <tr key={tradeIndex} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-10 py-10">
                        <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${trade.isLong ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {trade.isLong ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {trade.isLong ? 'Buy/Long' : 'Sell/Short'}
                        </span>
                      </td>
                      <td className="px-10 py-10">
                        <div className="text-xl font-black text-slate-100 tracking-tighter">${trade.entry_price.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">{trade.entry_time}</div>
                      </td>
                      <td className="px-10 py-10">
                        <div className="text-xl font-black text-slate-100 tracking-tighter">${trade.exit_price.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">{trade.exit_time}</div>
                      </td>
                      <td className="px-10 py-10 text-right">
                        <div className={`text-2xl font-black tracking-tighter ${profitVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {profitVal >= 0 ? '+' : ''}{profitVal.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-10 py-10 text-center">
                        <button onClick={() => jumpToTrade(tradeIndex)} className="p-4 bg-slate-800 hover:bg-emerald-500 rounded-2xl transition-all shadow-lg group-hover:shadow-emerald-500/20"><Eye className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#050912]">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Page {journalSafePage} / {journalTotalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setJournalPage(1)}
                  disabled={journalSafePage <= 1}
                  className="px-4 py-2 bg-white/5 disabled:opacity-30 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all"
                >
                  First
                </button>
                <button
                  onClick={() => setJournalPage((p) => Math.max(1, p - 1))}
                  disabled={journalSafePage <= 1}
                  className="px-4 py-2 bg-white/5 disabled:opacity-30 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all"
                >
                  Prev
                </button>
                <button
                  onClick={() => setJournalPage((p) => Math.min(journalTotalPages, p + 1))}
                  disabled={journalSafePage >= journalTotalPages}
                  className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 disabled:opacity-30 hover:bg-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-400 transition-all"
                >
                  Next
                </button>
                <button
                  onClick={() => setJournalPage(journalTotalPages)}
                  disabled={journalSafePage >= journalTotalPages}
                  className="px-4 py-2 bg-white/5 disabled:opacity-30 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chart' && data && (
          <div className="animate-in zoom-in-95 duration-700">
            <div className="bg-[#0f172a] border border-white/10 p-4 rounded-[3rem] shadow-2xl overflow-hidden">
              <TradingChart candles={data.candles} trades={data.trades} focusedTradeId={focusedTradeIndex} indicatorSettings={indicatorSettings} />
            </div>
          </div>
        )}

        {activeTab === 'robustness' && (
          <RobustnessPanel
            apiUrl={apiUrl}
            symbol={symbol}
            interval={interval}
            startUnix={startDateTime ? String(Math.floor(new Date(startDateTime).getTime() / 1000)) : ''}
            endUnix={endDateTime ? String(Math.floor(new Date(endDateTime).getTime() / 1000)) : ''}
            imbaParams={`&strategy=${strategy}` + (strategy === 'imba-algo'
              ? `&sensitivity=${imbaSensitivity}&riskPercent=${imbaRiskPercent}&tp1Pct=${imbaTP1Pct}&tp1SizePct=${imbaTP1Size}&tp2Pct=${imbaTP2Pct}&tp2SizePct=${imbaTP2Size}&tp3Pct=${imbaTP3Pct}&tp3SizePct=${imbaTP3Size}&tp4Pct=${imbaTP4Pct}&tp4SizePct=${imbaTP4Size}&breakEvenTarget=${imbaBreakEven}&fixedStop=${imbaFixedStop}&slPercent=${imbaSLPct}`
              : '')}
          />
        )}

        {activeTab === 'optimization' && (
          <OptimizationPanel
            apiUrl={apiUrl}
            baseParams={`strategy=${strategy}&symbol=${symbol}&interval=${interval}&start=${startDateTime ? String(Math.floor(new Date(startDateTime).getTime() / 1000)) : ''}&end=${endDateTime ? String(Math.floor(new Date(endDateTime).getTime() / 1000)) : ''}${strategy === 'imba-algo' ? `&sensitivity=${imbaSensitivity}&riskPercent=${imbaRiskPercent}&tp1Pct=${imbaTP1Pct}&tp1SizePct=${imbaTP1Size}&tp2Pct=${imbaTP2Pct}&tp2SizePct=${imbaTP2Size}&tp3Pct=${imbaTP3Pct}&tp3SizePct=${imbaTP3Size}&tp4Pct=${imbaTP4Pct}&tp4SizePct=${imbaTP4Size}&breakEvenTarget=${imbaBreakEven}&fixedStop=${imbaFixedStop}&slPercent=${imbaSLPct}` : ''}`}
            onApplyParams={(p) => {
              if (p.sensitivity !== undefined) updateParams({ imbaSensitivity: p.sensitivity.toString() });
              if (p.tp1Pct !== undefined) updateParams({ imbaTP1Pct: p.tp1Pct.toString() });
              if (p.tp2Pct !== undefined) updateParams({ imbaTP2Pct: p.tp2Pct.toString() });
              if (p.tp3Pct !== undefined) updateParams({ imbaTP3Pct: p.tp3Pct.toString() });
              if (p.tp4Pct !== undefined) updateParams({ imbaTP4Pct: p.tp4Pct.toString() });
              if (p.tp1SizePct !== undefined) updateParams({ imbaTP1Size: p.tp1SizePct.toString() });
              if (p.tp2SizePct !== undefined) updateParams({ imbaTP2Size: p.tp2SizePct.toString() });
              if (p.tp3SizePct !== undefined) updateParams({ imbaTP3Size: p.tp3SizePct.toString() });
              if (p.tp4SizePct !== undefined) updateParams({ imbaTP4Size: p.tp4SizePct.toString() });
              if (p.breakEvenTarget !== undefined) updateParams({ imbaBreakEven: p.breakEvenTarget.toString() });
              if (p.slPercent !== undefined) updateParams({ imbaSLPct: p.slPercent.toString() });
            }}
          />
        )}

        {activeTab === 'papertrading' && (
          <PaperTradingPanel
            apiUrl={apiUrl}
            config={{
              symbol,
              interval,
              strategy,
              balance: parseFloat(balance),
              leverage: parseFloat(leverage),
              fee: parseFloat(fee),
              risk: parseFloat(risk),
              params: strategy === 'imba-algo' ? {
                sensitivity: imbaSensitivity,
                riskPercent: imbaRiskPercent,
                tp1Pct: imbaTP1Pct,
                tp1SizePct: imbaTP1Size,
                tp2Pct: imbaTP2Pct,
                tp2SizePct: imbaTP2Size,
                tp3Pct: imbaTP3Pct,
                tp3SizePct: imbaTP3Size,
                tp4Pct: imbaTP4Pct,
                tp4SizePct: imbaTP4Size,
                breakEvenTarget: imbaBreakEven,
                fixedStop: imbaFixedStop,
                slPercent: imbaSLPct
              } : {}
            }}
          />
        )}
      </main>

      <footer className="border-t border-white/5 p-16 text-center opacity-30">
        <p className="text-[10px] font-black uppercase tracking-[0.6em]">QuantsBack Institutional Analytics • Core Engine v5.2.0 • 2025</p>
      </footer>
    </div>
  );
};

export default App;
