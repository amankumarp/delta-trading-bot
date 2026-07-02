
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
import { BacktestAnalytics } from './components/BacktestAnalytics';

type TabType = 'backtest' | 'trades' | 'chart' | 'robustness' | 'optimization' | 'papertrading';
type AppView = 'config' | 'dashboard';
const JOURNAL_PAGE_SIZE = 50;

const App: React.FC = () => {
  const {
    view, activeTab, focusedTradeIndex,
    strategy, symbol, interval, startDateTime, endDateTime, balance, leverage, risk, fee, apiUrl,
    dynamicParams, updateDynamicParam,
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

  const [strategiesMeta, setStrategiesMeta] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${apiUrl}/api/strategies`)
      .then(r => r.json())
      .then(d => {
        if (d.strategies) setStrategiesMeta(d.strategies);
      })
      .catch(e => console.error('Failed to load strategies meta', e));
  }, [apiUrl]);

  const currentStrategyMeta = strategiesMeta.find(s => s.slug === strategy);

  // Re-seed dynamic params if switching to a new strategy and they aren't set
  useEffect(() => {
    if (currentStrategyMeta && currentStrategyMeta.params) {
      currentStrategyMeta.params.forEach((p: any) => {
        if (dynamicParams[p.name] === undefined && p.default !== undefined) {
          updateDynamicParam(p.name, p.default.toString());
        }
      });
    }
  }, [currentStrategyMeta, strategy, dynamicParams, updateDynamicParam]);

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
        <div className="max-w-6xl w-full space-y-10">
          <div className="text-center space-y-4">
            <div className="inline-block bg-emerald-500/10 p-5 rounded-3xl border border-emerald-500/20 shadow-2xl mb-2">
              <TrendingUp className="text-emerald-500 w-12 h-12" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic">QUANTS<span className="text-emerald-500">BACK</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-sm">Synthetic Intelligence Trading Suite</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-8 flex flex-col">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-500 flex items-center gap-3">
                <PlayCircle className="w-5 h-5" /> Selection Engine
              </h2>
              <div className="space-y-4 flex-1">
                {strategiesMeta.filter(s => s.available).map((opt) => (
                  <button
                    key={opt.slug}
                    onClick={() => updateParams({ strategy: opt.slug })}
                    className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 relative group ${strategy === opt.slug
                      ? 'bg-emerald-500/10 border-emerald-500 shadow-2xl'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${strategy === opt.slug ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-slate-500'}`}>
                      <Crosshair className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-widest">{opt.slug.replace(/-/g, ' ')}</h3>
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
              </div>
            </div>

            {/* ── IMBA ALGO Settings Panel (Now Dynamic) ─────────────────────────── */}
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-6 flex flex-col">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-500 flex items-center gap-3">
                <Settings className="w-5 h-5" /> Strategy Params
              </h2>
              <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {currentStrategyMeta && currentStrategyMeta.params && currentStrategyMeta.params.length > 0 ? (
                  <div className="space-y-2 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{currentStrategyMeta.description || 'Strategy Parameters'}</span>
                    </div>

                    {Object.entries(
                      currentStrategyMeta.params.reduce((acc: any, param: any) => {
                        const g = param.group || 'General';
                        if (!acc[g]) acc[g] = [];
                        acc[g].push(param);
                        return acc;
                      }, {})
                    ).map(([group, params]: [string, any]) => (
                      <div key={group} className="space-y-4 pt-4 border-t border-emerald-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[10px] font-black uppercase text-emerald-500/70 tracking-widest">{group}</h4>
                          <div className="h-px bg-emerald-500/10 flex-1"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {params.map((param: any) => {
                            const val = dynamicParams[param.name] ?? param.default?.toString() ?? '';
                            
                            if (param.type === 'boolean') {
                              const isTrue = val === 'true' || val === true;
                              return (
                                <button
                                  key={param.name}
                                  onClick={() => updateDynamicParam(param.name, (!isTrue).toString())}
                                  className={`col-span-1 flex items-center justify-between p-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                                    isTrue ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'
                                  }`}
                                >
                                  {param.label}
                                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    isTrue ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                                  }`}>
                                    {isTrue && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                                  </span>
                                </button>
                              );
                            }

                            if (param.type === 'select') {
                              return (
                                <div key={param.name} className="space-y-1.5 col-span-1">
                                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{param.label}</label>
                                  <select value={val} onChange={e => updateDynamicParam(param.name, e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none cursor-pointer">
                                    {param.options?.map((opt: string) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            }
                            
                            if (param.type === 'days_checkbox') {
                               return (
                                 <div key={param.name} className="space-y-1.5 md:col-span-2">
                                   <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{param.label}</label>
                                   <div className="flex flex-wrap gap-2">
                                     {[
                                       { label: 'Mon', value: '1' }, { label: 'Tue', value: '2' }, { label: 'Wed', value: '3' }, 
                                       { label: 'Thu', value: '4' }, { label: 'Fri', value: '5' }, { label: 'Sat', value: '6' }, { label: 'Sun', value: '7' }
                                     ].map(day => {
                                       const selected = val.split(',').includes(day.value);
                                       return (
                                         <button key={day.value}
                                           onClick={() => {
                                             const current = val ? val.split(',').filter(Boolean) : [];
                                             if (selected) {
                                               updateDynamicParam(param.name, current.filter((d: string) => d !== day.value).join(','));
                                             } else {
                                               updateDynamicParam(param.name, [...current, day.value].sort().join(','));
                                             }
                                           }}
                                           className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                                             selected ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-white/10 text-slate-500 hover:border-white/20'
                                           }`}
                                         >
                                           {day.label}
                                         </button>
                                       );
                                     })}
                                   </div>
                                 </div>
                               );
                            }

                            if (param.type === 'sessions_checkbox') {
                               return (
                                 <div key={param.name} className="space-y-1.5 md:col-span-2">
                                   <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{param.label}</label>
                                   <div className="flex flex-wrap gap-2">
                                     {[
                                       { label: 'All Day', value: '00:00-23:59' },
                                       { label: 'Sydney', value: '02:30-11:30' },
                                       { label: 'Tokyo', value: '05:30-14:30' },
                                       { label: 'London', value: '12:30-21:30' },
                                       { label: 'New York', value: '17:30-02:30' },
                                     ].map(sess => {
                                       const selected = val.split(',').includes(sess.value);
                                       return (
                                         <button key={sess.label}
                                           onClick={() => {
                                             const current = val ? val.split(',').filter(Boolean) : [];
                                             if (selected) {
                                               updateDynamicParam(param.name, current.filter((s: string) => s !== sess.value).join(',') || '00:00-23:59');
                                             } else {
                                               let newSess = current.filter((s: string) => s !== '00:00-23:59');
                                               if (sess.value === '00:00-23:59') newSess = [];
                                               updateDynamicParam(param.name, [...newSess, sess.value].join(','));
                                             }
                                           }}
                                           className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                                             selected ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-white/10 text-slate-500 hover:border-white/20'
                                           }`}
                                         >
                                           {sess.label}
                                         </button>
                                       );
                                     })}
                                   </div>
                                   <input type="text" value={val} onChange={e => updateDynamicParam(param.name, e.target.value)}
                                     placeholder="Custom (e.g. 08:00-16:00)"
                                     className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none mt-2" />
                                 </div>
                               );
                            }

                            return (
                              <div key={param.name} className="space-y-1.5 col-span-1">
                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{param.label}</label>
                                <input type={param.type === 'number' ? 'number' : 'text'} step={param.step} value={val} onChange={e => updateDynamicParam(param.name, e.target.value)}
                                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50">
                    <Crosshair className="w-8 h-8 text-slate-500" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No parameters<br/>for this strategy</p>
                  </div>
                )}

                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={handleRunBacktest}
                    disabled={loading || isBackfilling}
                    className={`w-full text-white py-4.5 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98] ${
                      isBackfilling ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                    }`}
                  >
                    {loading || isBackfilling ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                    {loading ? 'Synthesizing...' : isBackfilling ? 'Backfilling Data...' : 'Run Backtest Strategy'}
                  </button>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => { setActiveTab('papertrading'); setView('dashboard'); }}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Activity className="w-5 h-5" />
                      Paper Trading
                    </button>
                    <button
                      onClick={() => { setActiveTab('optimization'); setView('dashboard'); }}
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Zap className="w-5 h-5" />
                      Optimization
                    </button>
                    <button
                      onClick={() => { setActiveTab('robustness'); setView('dashboard'); }}
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      Robustness
                    </button>
                  </div>
                </div>
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
            <BacktestAnalytics data={data} isBackfilling={isBackfilling} />
        )}

        {activeTab === 'backtest' && !data && !loading && !isBackfilling && (
          <div className="flex flex-col items-center justify-center py-32 opacity-40 text-center animate-in fade-in zoom-in duration-500">
            <LayoutDashboard className="w-16 h-16 text-emerald-500 mb-6" />
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-300">No Performance Data</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm">Please run a backtest simulation to view performance metrics and analytics.</p>
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
                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">QTY: {trade.qnt ? trade.qnt.toFixed(4) : '-'}</div>
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

        {activeTab === 'trades' && !data && !loading && !isBackfilling && (
          <div className="flex flex-col items-center justify-center py-32 opacity-40 text-center animate-in fade-in zoom-in duration-500">
            <List className="w-16 h-16 text-emerald-500 mb-6" />
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-300">No Trade Journal</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm">Please run a backtest simulation to view the detailed trade execution journal.</p>
          </div>
        )}

        {activeTab === 'chart' && data && (
          <div className="animate-in zoom-in-95 duration-700">
            <div className="bg-[#0f172a] border border-white/10 p-4 rounded-[3rem] shadow-2xl overflow-hidden">
              <TradingChart candles={data.candles} trades={data.trades} focusedTradeId={focusedTradeIndex} indicatorSettings={indicatorSettings} />
            </div>
          </div>
        )}

        {activeTab === 'chart' && !data && !loading && !isBackfilling && (
          <div className="flex flex-col items-center justify-center py-32 opacity-40 text-center animate-in fade-in zoom-in duration-500">
            <BarChart className="w-16 h-16 text-emerald-500 mb-6" />
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-300">No Visual Data</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm">Please run a backtest simulation to view the interactive price and indicator chart.</p>
          </div>
        )}

        {activeTab === 'robustness' && (
          <RobustnessPanel
            apiUrl={apiUrl}
            symbol={symbol}
            interval={interval}
            startUnix={startDateTime ? String(Math.floor(new Date(startDateTime).getTime() / 1000)) : ''}
            endUnix={endDateTime ? String(Math.floor(new Date(endDateTime).getTime() / 1000)) : ''}
            imbaParams={`&strategy=${strategy}${Object.entries(dynamicParams).map(([k,v])=>`&${k}=${encodeURIComponent(v)}`).join('')}`}
          />
        )}

        {activeTab === 'optimization' && (
          <OptimizationPanel
            apiUrl={apiUrl}
            baseParams={`strategy=${strategy}&symbol=${symbol}&interval=${interval}&start=${startDateTime ? String(Math.floor(new Date(startDateTime).getTime() / 1000)) : ''}&end=${endDateTime ? String(Math.floor(new Date(endDateTime).getTime() / 1000)) : ''}${Object.entries(dynamicParams).map(([k,v])=>`&${k}=${encodeURIComponent(v)}`).join('')}`}
            onApplyParams={(p) => {
              Object.entries(p).forEach(([k, v]) => {
                if (v !== undefined) {
                  updateDynamicParam(k, v.toString());
                }
              });
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
              params: dynamicParams
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
