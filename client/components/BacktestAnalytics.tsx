import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, ShieldAlert, Target, DollarSign, Crosshair, BarChart2, Scale, Percent, AlertCircle } from 'lucide-react';
import { 
    MarketTrendEquityChart, 
    EquityCurveChart, 
    HourlyTradingStats, 
    DayOfWeekAnalysis, 
    ProfitBucketsChart, 
    DailyProfitHeatmap, 
    MonthlyYieldChart, 
    PerformanceBarChart, 
    PositionDistribution 
} from './DashboardCharts';
import StatCard from './StatCard';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Bar, Scatter, ScatterChart, ZAxis, Cell
} from 'recharts';

export const BacktestAnalytics: React.FC<{ data: any, isBackfilling: boolean }> = ({ data, isBackfilling }) => {
    
    // Process stats in the component
    const stats = useMemo(() => {
        if (!data?.analysis) return null;
        const raw = data.analysis;
        
        // Transform sessions, volatility, positions
        const sessionProfit: Record<string, number> = {};
        const sessionWinRates: Record<string, number> = {};
        raw.sessions?.forEach((s: any) => {
            const [key, value] = Object.entries(s)[0] as [string, any];
            sessionProfit[key] = value.profit;
            sessionWinRates[key] = parseFloat(value.winRate);
        });
        
        const volProfit: Record<string, number> = {};
        const volWinRates: Record<string, number> = {};
        raw.volatility?.forEach((v: any) => {
            const [key, value] = Object.entries(v)[0] as [string, any];
            volProfit[key] = value.profit;
            volWinRates[key] = parseFloat(value.winRate);
        });

        const posProfit: Record<string, number> = {};
        raw.positions?.forEach((p: any) => {
            const [key, value] = Object.entries(p)[0] as [string, any];
            posProfit[key] = value.profit;
        });

        // Market Regime
        const regimeProfit: Record<string, number> = {};
        const regimeWinRates: Record<string, number> = {};
        if (raw.marketRegimeAnalysis) {
            Object.entries(raw.marketRegimeAnalysis).forEach(([key, value]: [string, any]) => {
                regimeProfit[key] = parseFloat(value.netProfit);
                regimeWinRates[key] = parseFloat(value.winRate);
            });
        }

        // Exit Analysis
        const exitProfit: Record<string, number> = {};
        if (raw.exitAnalysis) {
            Object.entries(raw.exitAnalysis).forEach(([key, value]: [string, any]) => {
                exitProfit[key] = parseFloat(value.contributionPct);
            });
        }

        const dailyProfits: Record<string, number> = {};
        const monthlyProfits: Record<string, number> = {};
        const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        if (raw.daily) {
            Object.entries(raw.daily).forEach(([dateStr, metrics]: [string, any]) => {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    dailyProfits[isoDate] = metrics.profit;
                    const monthName = `${monthsNames[parseInt(parts[1], 10) - 1]} ${parts[2]}`;
                    monthlyProfits[monthName] = (monthlyProfits[monthName] || 0) + metrics.profit;
                }
            });
        }

        const safeRaw = { ...raw };
        delete safeRaw.volatility;
        delete safeRaw.sessions;
        delete safeRaw.positions;
        delete safeRaw.marketRegimeAnalysis;
        delete safeRaw.exitAnalysis;

        return {
            ...safeRaw,
            sessionProfit,
            sessionWinRates,
            volProfit,
            volWinRates,
            posProfit,
            dailyProfits,
            monthlyProfits,
            regimeProfit,
            regimeWinRates,
            exitProfit
        };
    }, [data]);

    const formatCurrency = (val: string | number | undefined, precision = 2) => {
        if (val === undefined || val === null || val === '') return '$0.00';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return '$0.00';
        
        const isNegative = num < 0;
        const formatted = Math.abs(num).toLocaleString(undefined, {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
        });
        return isNegative ? `-$${formatted}` : `$${formatted}`;
    };

    if (!stats) return null;

    const calculateGrade = () => {
        const pf = Math.max(0, Math.min(100, (parseFloat(stats.profitFactor || '1') - 1.0) * (100 / 1.5)));
        const md = Math.max(0, Math.min(100, 100 - (Math.abs(parseFloat(stats.maxDrawdown || '0')) * (100 / 30))));
        const wr = Math.max(0, Math.min(100, (parseFloat(stats.winRate || '0') - 30) * (100 / 40)));
        const sr = Math.max(0, Math.min(100, parseFloat(stats.sharpeRatio || '0') * (100 / 3.0)));
        const rf = Math.max(0, Math.min(100, parseFloat(stats.recoveryFactor || '0') * (100 / 5.0)));
        const score = (pf * 0.3) + (md * 0.25) + (wr * 0.2) + (sr * 0.15) + (rf * 0.1);
        
        if (score >= 90) return { grade: 'A+', score: score.toFixed(1), color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
        if (score >= 80) return { grade: 'A', score: score.toFixed(1), color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
        if (score >= 70) return { grade: 'B', score: score.toFixed(1), color: 'text-blue-400', bg: 'bg-blue-400/10' };
        if (score >= 60) return { grade: 'C', score: score.toFixed(1), color: 'text-amber-400', bg: 'bg-amber-400/10' };
        if (score >= 50) return { grade: 'D', score: score.toFixed(1), color: 'text-orange-500', bg: 'bg-orange-500/10' };
        return { grade: 'F', score: score.toFixed(1), color: 'text-rose-500', bg: 'bg-rose-500/10' };
    };

    const gradeData = calculateGrade();

    // Advanced Drawdown Data
    const topDrawdowns = stats.topDrawdowns || [];
    const drawdownTimeline = stats.drawdownTimeline || [];
    
    // Drawdown chart data
    const ddChartData = drawdownTimeline.map((dd: number, idx: number) => ({ index: idx, drawdown: dd }));

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10 pb-20">
            {/* Header & Meta */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic">Performance Overview</h2>
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">Synthetic Alpha Verification</p>
                        {isBackfilling && (
                            <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-amber-500/20">
                                Partial Data (Backfilling...)
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-10">
                    <div className={`flex flex-col items-center justify-center px-6 py-2 rounded-xl border border-white/5 ${gradeData.bg}`}>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Strategy Grade</span>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-black ${gradeData.color}`}>{gradeData.grade}</span>
                            <span className={`text-xs font-bold ${gradeData.color} opacity-70`}>{gradeData.score}/100</span>
                        </div>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Entry</p>
                        <p className="text-xs font-bold text-slate-200">{stats.startTime}</p>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Exit</p>
                        <p className="text-xs font-bold text-slate-200">{stats.endTime}</p>
                    </div>
                </div>
            </div>

            {/* Top Level Exec Summary */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><Target className="w-4 h-4" /> 1. Executive Summary</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
                    <StatCard label="Final Balance" value={formatCurrency(stats.finalBalance)} variant="green" icon={<DollarSign className="w-4 h-4" />} />
                    <StatCard label="Net Profit" value={formatCurrency(stats.netProfitValue || stats.totalProfit)} variant={parseFloat(stats.netProfitValue || stats.totalProfit || '0') >= 0 ? "teal" : "red"} icon={<TrendingUp className="w-4 h-4" />} />
                    <StatCard label="Gross Profit" value={formatCurrency(stats.grossProfitValue || stats.totalProfit)} variant={parseFloat(stats.grossProfitValue || stats.totalProfit || '0') >= 0 ? "teal" : "red"} icon={<TrendingUp className="w-4 h-4" />} />
                    <StatCard label="Total Return" value={stats.totalReturn || 0} suffix="%" variant={parseFloat(stats.totalReturn || '0') >= 0 ? "teal" : "red"} icon={<Percent className="w-4 h-4" />} />
                    <StatCard label="Win Rate" value={stats.winRate || 0} suffix="%" variant="dark" icon={<Activity className="w-4 h-4" />} />
                    <StatCard label="Profit Factor" value={stats.profitFactor || 0} variant="purple" icon={<Scale className="w-4 h-4" />} />
                    
                    <StatCard label="Total Trades" value={stats.totalTrades || 0} variant="orange" icon={<Crosshair className="w-4 h-4" />} />
                    <StatCard label="CAGR" value={stats.cagr || 0} suffix="%" variant={parseFloat(stats.cagr || '0') >= 0 ? "green" : "red"} icon={<TrendingUp className="w-4 h-4" />} />
                    <StatCard label="Expectancy" value={formatCurrency(stats.expectancy)} variant={parseFloat(stats.expectancy || '0') >= 0 ? "teal" : "red"} icon={<Target className="w-4 h-4" />} />
                    <StatCard label="Avg Win" value={formatCurrency(stats.avgWin)} variant="green" icon={<TrendingUp className="w-4 h-4" />} />
                    <StatCard label="Avg Loss" value={formatCurrency(stats.avgLoss)} variant="red" icon={<TrendingDown className="w-4 h-4" />} />
                    <StatCard label="Avg Risk" value={stats.avgRisk || 0} suffix="%" variant="dark" icon={<ShieldAlert className="w-4 h-4" />} />
                </div>
            </div>

            {/* Transaction & Execution Costs */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> 2. Transaction & Execution Analytics</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                    <StatCard label="Commission Paid" value={formatCurrency(stats.totalCommission || 0)} variant="red" icon={<DollarSign className="w-4 h-4" />} />
                    <StatCard label="Total Slippage" value={formatCurrency(stats.totalSlippageValue || 0)} variant="red" icon={<TrendingDown className="w-4 h-4" />} />
                    <StatCard label="Funding Cost" value={formatCurrency(stats.totalFundingCost || 0)} variant="orange" icon={<DollarSign className="w-4 h-4" />} />
                    <StatCard label="Avg Hold Duration" value={stats.avgHoldingHours || 0} suffix=" hrs" variant="dark" icon={<Activity className="w-4 h-4" />} />
                    <StatCard label="Funding Rate" value={stats.fundingRateSetting || 0} suffix="% / 8h" variant="dark" icon={<Percent className="w-4 h-4" />} />
                </div>
            </div>

            {/* Risk Metrics */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> 7. Risk Metrics</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
                    <StatCard label="Sharpe Ratio" value={stats.sharpeRatio || 0} variant="pink" icon={<Activity className="w-4 h-4" />} />
                    <StatCard label="Sortino Ratio" value={stats.sortinoRatio || 0} variant="pink" icon={<Activity className="w-4 h-4" />} />
                    <StatCard label="Calmar Ratio" value={stats.calmarRatio || 0} variant="purple" icon={<Scale className="w-4 h-4" />} />
                    <StatCard label="Omega Ratio" value={stats.omegaRatio || 0} variant="purple" icon={<Scale className="w-4 h-4" />} />
                    <StatCard label="Recovery Factor" value={stats.recoveryFactor || 0} variant="red" icon={<Activity className="w-4 h-4" />} />
                    <StatCard label="Ulcer Index" value={stats.ulcerIndex || 0} variant="dark" icon={<AlertCircle className="w-4 h-4" />} />
                    
                    <StatCard label="Value at Risk (95%)" value={stats.valueAtRisk95 || 0} suffix="%" variant="red" icon={<TrendingDown className="w-4 h-4" />} />
                    <StatCard label="Cond. VaR (95%)" value={stats.conditionalVaR95 || 0} suffix="%" variant="red" icon={<TrendingDown className="w-4 h-4" />} />
                    <StatCard label="Tail Ratio" value={stats.tailRatio || 0} variant="dark" icon={<Scale className="w-4 h-4" />} />
                    <StatCard label="Downside Dev" value={stats.downsideDeviation || 0} suffix="%" variant="dark" icon={<TrendingDown className="w-4 h-4" />} />
                    <StatCard label="Volatility" value={stats.historicalVolatility || 0} suffix="%" variant="orange" icon={<Activity className="w-4 h-4" />} />
                    <StatCard label="Pain Index" value={stats.painIndex || 0} variant="dark" icon={<AlertCircle className="w-4 h-4" />} />
                </div>
            </div>

            {/* Drawdown Analysis */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4" /> 3. Drawdown Analysis</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-[#0f172a] border border-white/5 p-8 rounded-xl h-[450px]">
                        <h4 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Drawdown Timeline</h4>
                        <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={ddChartData}>
                                <defs>
                                    <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="index" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} domain={[0, 'auto']} reversed />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                                <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" fill="url(#ddGradient)" strokeWidth={2} name="Drawdown" unit="%" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="bg-[#0f172a] border border-white/5 p-6 rounded-xl flex flex-col h-[450px]">
                        <h4 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Top Drawdowns</h4>
                        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                            {topDrawdowns.map((dd: any, i: number) => (
                                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-black text-rose-400">#{i + 1} • -{dd.lossPct}%</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{dd.days} Days</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                        <span>Start: {dd.start}</span>
                                        <span>Rec: {dd.recovery}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Core Equity & Trend */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> 2. Equity Performance</h3>
                <div className="grid grid-cols-1 gap-8">
                    <MarketTrendEquityChart data={stats.marketTrendData || []} />
                    <EquityCurveChart data={stats.cumulativeProfit || []} />
                </div>
            </div>

            {/* Market Regime & Exit Analysis */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4" /> 13. Market Regime & 15. Exit Analysis</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <PerformanceBarChart title="Profit by Market Regime" data={stats.regimeProfit || {}} color="#818cf8" unit="$" />
                    <PerformanceBarChart title="Exit Strategy Contribution (%)" data={stats.exitProfit || {}} color="#10b981" unit="%" />
                </div>
            </div>

            {/* Additional Sections from existing dashboard */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> 16. Categorical Analysis</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <PerformanceBarChart title="Profit by Session" data={stats.sessionProfit || {}} color="#818cf8" unit="$" />
                    <PerformanceBarChart title="Win Rate by Session" data={stats.sessionWinRates || {}} color="#6ee7b7" unit="%" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <PerformanceBarChart title="Profit by Volatility" data={stats.volProfit || {}} color="#fbbf24" unit="$" />
                    <PerformanceBarChart title="Win Rate by Volatility" data={stats.volWinRates || {}} color="#f97316" unit="%" />
                </div>
            </div>

            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> 17. Time & Distribution Analysis</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <HourlyTradingStats data={stats.hourStats || {}} />
                    <DayOfWeekAnalysis data={stats.dayOfWeekAnalysis || {}} />
                </div>
                
                <ProfitBucketsChart data={stats.profitBuckets || {}} />
                <DailyProfitHeatmap data={stats.dailyProfits || {}} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <PositionDistribution data={stats.posProfit || {}} />
                    <MonthlyYieldChart data={stats.monthlyProfits || {}} />
                </div>
            </div>

        </div>
    );
};
