import React, { useState } from 'react';
import { RefreshCcw, ShieldCheck, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, XCircle, Layers, BarChart2, Zap, Settings, X } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useStore } from '../store';

type RobustnessTab = 'full' | 'monte-carlo' | 'is-oos' | 'walk-forward' | 'sensitivity' | 'transaction' | 'statistics' | 'benchmark';

interface Props {
  apiUrl: string;
  symbol: string;
  interval: string;
  startUnix: string;
  endUnix: string;
  imbaParams: string; // pre-built query string fragment
}

const VERDICT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  robust: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <CheckCircle className="w-5 h-5" />, label: 'Robust' },
  highly_robust: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <CheckCircle className="w-5 h-5" />, label: 'Highly Robust' },
  edge_confirmed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <CheckCircle className="w-5 h-5" />, label: 'Edge Confirmed' },
  no_statistical_edge: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: <XCircle className="w-5 h-5" />, label: 'No Statistical Edge' },
  moderate_degradation: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: <AlertTriangle className="w-5 h-5" />, label: 'Moderate Degradation' },
  likely_overfit: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: <XCircle className="w-5 h-5" />, label: 'Likely Overfit' },
  mixed: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: <AlertTriangle className="w-5 h-5" />, label: 'Mixed' },
  fragile: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: <XCircle className="w-5 h-5" />, label: 'Fragile Parameters' },
  moderate: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: <AlertTriangle className="w-5 h-5" />, label: 'Moderate Sensitivity' },
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg = VERDICT_CONFIG[verdict] ?? { color: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10', icon: <Activity className="w-5 h-5" />, label: verdict };
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function MetricRow({ label, value, sub, tooltip }: { label: string; value: string | number; sub?: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0" title={tooltip}>
      <span className={`text-[10px] font-black uppercase tracking-widest text-slate-500 ${tooltip ? 'cursor-help border-b border-slate-700 border-dashed' : ''}`}>{label}</span>
      <div className="text-right">
        <span className="text-sm font-black text-slate-200">{value}</span>
        {sub && <div className="text-[9px] text-slate-600 font-bold uppercase">{sub}</div>}
      </div>
    </div>
  );
}

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-white/5">
        <div className="text-emerald-500">{icon}</div>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-400">{title}</h3>
      </div>
      {children}
    </div>
  );
};

// ── Monte Carlo Panel ──────────────────────────────────────────────────────────
function MonteCarloView({ data }: { data: any }) {
  const { robustnessDropoutRate, robustnessNoiseLevel } = useStore();
  const histData = (data.histogram || []).map((b: any) => ({ name: `$${Math.round(b.lo / 1000)}k`, count: b.count }));
  const ddHistData = (data.ddHistogram || []).map((b: any) => ({ name: b.label, count: b.count }));
  const sharpeHistData = (data.sharpeHistogram || []).map((b: any) => ({ name: b.label, count: b.count }));
  const ciData = [
    { p: 'p5', final: data.finalBalance?.p5, dd: data.maxDrawdownPct?.p5, ret: data.totalReturnPct?.p5, sharpe: data.sharpeRatio?.p5 },
    { p: 'p25', final: data.finalBalance?.p25, dd: data.maxDrawdownPct?.p25, ret: data.totalReturnPct?.p25, sharpe: data.sharpeRatio?.p25 },
    { p: 'p50', final: data.finalBalance?.p50, dd: data.maxDrawdownPct?.p50, ret: data.totalReturnPct?.p50, sharpe: data.sharpeRatio?.p50 },
    { p: 'p75', final: data.finalBalance?.p75, dd: data.maxDrawdownPct?.p75, ret: data.totalReturnPct?.p75, sharpe: data.sharpeRatio?.p75 },
    { p: 'p95', final: data.finalBalance?.p95, dd: data.maxDrawdownPct?.p95, ret: data.totalReturnPct?.p95, sharpe: data.sharpeRatio?.p95 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl w-fit">
        <Activity className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">
          Stress Testing Active: Up to {parseFloat(robustnessDropoutRate) * 100}% Missed Trades, {parseFloat(robustnessNoiseLevel) * 100}% Execution Noise
        </span>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Methodology</span>
          <span className="text-lg font-black text-white block uppercase">{data.method || 'Bootstrap'}</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2" title="% of Monte Carlo simulations resulting in a net profit.">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Profit Prob</span>
          <span className="text-lg font-black text-emerald-400 block">{data.probabilityMetrics?.positiveReturn ?? 0}%</span>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2" title="% of simulations resulting in account ruin (margin call).">
          <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block mb-1">Ruin Prob</span>
          <span className="text-lg font-black text-rose-400 block">{data.riskOfRuin?.marginCall ?? 0}%</span>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2" title="Average of the maximum drawdowns across all simulations.">
          <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block mb-1">Expected Max DD</span>
          <span className="text-lg font-black text-amber-400 block">{data.expectedMaxDrawdownPct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Worst Case Scenario (p5)</h3>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">Final Balance</span>
            <span className="text-sm font-black text-rose-400">${data.finalBalance?.p5?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">Max Drawdown</span>
            <span className="text-sm font-black text-rose-400">{data.maxDrawdownPct?.p95?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Return</span>
            <span className="text-sm font-black text-rose-400">{data.totalReturnPct?.p5?.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Best Case Scenario (p95)</h3>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">Final Balance</span>
            <span className="text-sm font-black text-emerald-400">${data.finalBalance?.p95?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">Max Drawdown</span>
            <span className="text-sm font-black text-emerald-400">{data.maxDrawdownPct?.p5?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Return</span>
            <span className="text-sm font-black text-emerald-400">{data.totalReturnPct?.p95?.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <SectionCard title="Final Balance Distribution" icon={<BarChart2 className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={histData}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }} />
            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title={`Distribution Across ${data.simulations?.toLocaleString() ?? 10000} Simulations`} icon={<Layers className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] text-slate-600 uppercase tracking-widest border-b border-white/5">
                <th className="pb-3 text-left">Statistic</th>
                <th className="pb-3 text-right">Net Return %</th>
                <th className="pb-3 text-right">Max DD %</th>
                <th className="pb-3 text-right">Win Rate %</th>
                <th className="pb-3 text-right">Profit Factor</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Mean', key: 'mean' },
                { label: 'Median', key: 'median' },
                { label: 'P5 (worst 5%)', key: 'p5' },
                { label: 'P25', key: 'p25' },
                { label: 'P75', key: 'p75' },
                { label: 'P95 (best 5%)', key: 'p95' },
                { label: 'Min', key: 'min' },
                { label: 'Max', key: 'max' },
              ].map(row => {
                const ret = data.distributionTable?.netReturn?.[row.key] ?? 0;
                const dd = data.distributionTable?.maxDD?.[row.key] ?? 0;
                const wr = data.distributionTable?.winRate?.[row.key] ?? 0;
                const pf = data.distributionTable?.profitFactor?.[row.key] ?? 0;
                return (
                  <tr key={row.key} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-2.5 font-black text-slate-300">{row.label}</td>
                    <td className={`py-2.5 text-right font-bold ${ret >= 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-400">{(-Math.abs(dd)).toFixed(2)}%</td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">{wr.toFixed(2)}%</td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">{pf.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Drawdown Distribution (Histogram)" icon={<BarChart2 className="w-4 h-4" />}>
        <div className="mb-4">
          <span className="text-[10px] font-bold text-slate-400">Max Drawdown Distribution Across {data.simulations?.toLocaleString() ?? 10000} Shuffles</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={ddHistData}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#3b82f6' }} cursor={{ fill: '#ffffff0a' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Sharpe-like Ratio Distribution" icon={<BarChart2 className="w-4 h-4" />}>
        <div className="mb-4">
          <span className="text-[10px] font-bold text-slate-400">Sharpe-like Ratio Distribution Across {data.simulations?.toLocaleString() ?? 10000} Shuffles</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sharpeHistData}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} itemStyle={{ color: '#3b82f6' }} cursor={{ fill: '#ffffff0a' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Risk of Ruin & Probabilities" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <MetricRow label="P(Profit > 0)" value={`${data.probabilityMetrics?.positiveReturn ?? 0}%`} />
            <MetricRow label="P(Sharpe > 0)" value={`${data.probabilityMetrics?.positiveExpectancy ?? 0}%`} />
            <MetricRow label="P(Beat Buy & Hold)" value={`${data.probabilityMetrics?.beatBuyAndHold ?? 0}%`} />
            <MetricRow label="P(Beat Realized)" value={`${data.probabilityMetrics?.beatRealized ?? 0}%`} />
          </div>
          <div className="space-y-2">
            <MetricRow label="P(Margin Call)" value={`${data.riskOfRuin?.marginCall ?? 0}%`} />
            <MetricRow label="P(Drawdown > 20%)" value={`${data.probabilityMetrics?.drawdown20 ?? 0}%`} />
            <MetricRow label="P(Drawdown > 30%)" value={`${data.riskOfRuin?.drawdown30 ?? 0}%`} />
            <MetricRow label="P(Drawdown > 50%)" value={`${data.riskOfRuin?.drawdown50 ?? 0}%`} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── IS/OOS Panel ───────────────────────────────────────────────────────────────
function ISOOSView({ data }: { data: any }) {
  const is = data.inSample, oos = data.outOfSample;
  const bars = [
    { name: 'Win Rate', IS: parseFloat(is?.winRate || 0), OOS: parseFloat(oos?.winRate || 0) },
    { name: 'Prof Factor', IS: parseFloat(is?.profitFactor || 0), OOS: parseFloat(oos?.profitFactor || 0) },
    { name: 'Sharpe', IS: parseFloat(is?.sharpeRatio || 0), OOS: parseFloat(oos?.sharpeRatio || 0) },
    { name: 'Recovery', IS: parseFloat(is?.recoveryFactor || 0), OOS: parseFloat(oos?.recoveryFactor || 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <VerdictBadge verdict={data.verdict} />
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" title="Ratio of Out-of-Sample score to In-Sample score. Values < 0.5 indicate severe overfitting.">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block cursor-help border-b border-slate-700 border-dashed inline-block mb-1">Overfit Ratio</span>
          <span className="text-lg font-black text-white block">{data.overfitRatio ?? 'N/A'}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" title="Percentage drop in performance from In-Sample to Out-of-Sample.">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block cursor-help border-b border-slate-700 border-dashed inline-block mb-1">Performance Drop</span>
          <span className="text-lg font-black text-rose-400 block">{data.performanceDegradationPct ?? 'N/A'}%</span>
        </div>
        <div className="text-[10px] text-slate-500 font-bold">Split: {data.split?.trainPct} IS / {data.split?.testPct} OOS</div>
      </div>

      <SectionCard title="IS vs OOS Comparison" icon={<Activity className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bars} barGap={4}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }} />
            <Bar dataKey="IS" name="In-Sample" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="OOS" name="Out-of-Sample" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4">
        {([['In-Sample', is], ['Out-of-Sample', oos]] as [string, any][]).map(([title, d]) => (
          <SectionCard key={title} title={title} icon={<TrendingUp className="w-4 h-4" />}>
            <div className="text-[9px] text-slate-600 uppercase font-black">{d?.tradeCount} trades</div>
            <MetricRow label="Score" value={d?.score ?? 'N/A'} tooltip="Proprietary composite score based on profit, drawdown, and win rate" />
            <MetricRow label="Win Rate" value={`${d?.winRate}%`} tooltip="Percentage of trades that were profitable" />
            <MetricRow label="Profit Factor" value={d?.profitFactor} tooltip="Gross Profit divided by Gross Loss" />
            <MetricRow label="Sharpe" value={d?.sharpeRatio} tooltip="Risk-adjusted return (mean return per trade / standard deviation)" />
            <MetricRow label="Max DD%" value={`${d?.maxDrawdownPct}%`} tooltip="Maximum peak-to-trough drop in balance" />
            <MetricRow label="Total Return" value={`${d?.totalReturn}%`} tooltip="Total net profit percentage relative to initial balance" />
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

// ── Walk-Forward Panel ────────────────────────────────────────────────────────
function WalkForwardView({ data }: { data: any }) {
  const windows: any[] = data.windowResults || [];
  const chartData = windows.map(w => ({ window: `W${w.window}`, IS: w.isScore, OOS: w.oosScore }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <VerdictBadge verdict={data.verdict} />
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" title="Average ratio of Out-of-Sample score to In-Sample score across all sliding windows.">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block cursor-help border-b border-slate-700 border-dashed inline-block mb-1">Avg WF Ratio</span>
          <span className="text-lg font-black text-white block">{data.avgOverfitRatio}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pass Rate</span>
          <span className="text-lg font-black text-emerald-400 block">{data.passRatePct}%</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Stability</span>
          <span className="text-lg font-black text-indigo-400 block">{data.stabilityScore}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Drift</span>
          <span className={`text-lg font-black block ${data.driftScore < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{data.driftScore}</span>
        </div>
      </div>

      <SectionCard title="IS vs OOS Score Per Window" icon={<BarChart2 className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={4}>
            <XAxis dataKey="window" tick={{ fontSize: 9, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
            <ReferenceLine y={0} stroke="#334155" />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }} />
            <Bar dataKey="IS" name="In-Sample" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="OOS" name="Out-of-Sample" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[9px] text-slate-600 uppercase tracking-widest border-b border-white/5">
              <th className="pb-3 text-left">Window</th>
              <th className="pb-3 text-right">IS Trades</th>
              <th className="pb-3 text-right">OOS Trades</th>
              <th className="pb-3 text-right">IS Score</th>
              <th className="pb-3 text-right">OOS Score</th>
              <th className="pb-3 text-right">WF Ratio</th>
              <th className="pb-3 text-right">OOS Win%</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w: any) => (
              <tr key={w.window} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="py-3 font-black text-emerald-400">
                  W{w.window}
                  {w.window === data.bestWindow && <span className="ml-2 text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded uppercase">Best</span>}
                  {w.window === data.worstWindow && <span className="ml-2 text-[8px] bg-rose-500/20 text-rose-400 px-1 py-0.5 rounded uppercase">Worst</span>}
                </td>
                <td className="py-3 text-right text-slate-400">{w.isTrades}</td>
                <td className="py-3 text-right text-slate-400">{w.oosTrades}</td>
                <td className="py-3 text-right text-slate-200 font-bold">{w.isScore}</td>
                <td className="py-3 text-right font-bold" style={{ color: w.oosScore >= 0 ? '#34d399' : '#f87171' }}>{w.oosScore}</td>
                <td className="py-3 text-right font-bold" style={{ color: (w.overfitRatio ?? 0) >= 0.8 ? '#34d399' : (w.overfitRatio ?? 0) >= 0.5 ? '#fbbf24' : '#f87171' }}>{w.overfitRatio}</td>
                <td className="py-3 text-right text-slate-300">{w.outOfSample?.winRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionCard title="Aggregate OOS Performance" icon={<TrendingUp className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <MetricRow label="Trades" value={data.aggregateOos?.tradeCount} tooltip="Total number of trades executed out-of-sample across all windows" />
          <MetricRow label="Score" value={data.aggregateOos?.score} tooltip="Composite performance score on aggregated out-of-sample data" />
          <MetricRow label="Win Rate" value={`${data.aggregateOos?.winRate}%`} tooltip="Percentage of winning trades out-of-sample" />
          <MetricRow label="Profit Factor" value={data.aggregateOos?.profitFactor} tooltip="Gross profit / Gross loss out-of-sample" />
          <MetricRow label="Sharpe" value={data.aggregateOos?.sharpeRatio} tooltip="Risk-adjusted return for out-of-sample trades" />
          <MetricRow label="Max DD%" value={`${data.aggregateOos?.maxDrawdownPct}%`} tooltip="Maximum drawdown experienced out-of-sample" />
        </div>
      </SectionCard>
    </div>
  );
}

// ── Sensitivity Panel ─────────────────────────────────────────────────────────
function SensitivityView({ data }: { data: any }) {
  const params: any[] = data.params || [];
  const barData = params.slice(0, 12).map(p => ({
    name: p.param, sensitivity: Math.abs(p.sensitivityPct ?? 0),
    drop: p.scoreDrop, color: Math.abs(p.sensitivityPct ?? 0) > 20 ? '#f87171' : Math.abs(p.sensitivityPct ?? 0) > 10 ? '#fbbf24' : '#34d399'
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <VerdictBadge verdict={data.robustnessVerdict} />
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" title="Strategy score with original parameters before any nudging.">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block cursor-help border-b border-slate-700 border-dashed inline-block mb-1">Baseline Score</span>
          <span className="text-lg font-black text-white block">{data.baselineScore}</span>
        </div>
        {data.highSensitivityParams?.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2" title="Parameters that caused a >20% score drop when shifted by 10%.">
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block cursor-help border-b border-rose-700 border-dashed inline-block mb-1">High Sensitivity Params</span>
            <span className="text-xs font-bold text-rose-300 block">{data.highSensitivityParams.join(', ')}</span>
          </div>
        )}
      </div>

      <SectionCard title="Sensitivity by Parameter (score drop on ±10% nudge)" icon={<Activity className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 9, fill: '#475569' }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} width={80} />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }}
              formatter={(v: any) => [`${v.toFixed(1)}%`, 'Sensitivity']} />
            <Bar dataKey="sensitivity" radius={[0, 4, 4, 0]}>
              {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[9px] text-slate-600 uppercase tracking-widest border-b border-white/5">
              <th className="pb-3 text-left">Parameter</th>
              <th className="pb-3 text-right">Value</th>
              <th className="pb-3 text-right">Score (up)</th>
              <th className="pb-3 text-right">Score (down)</th>
              <th className="pb-3 text-right">Drop</th>
              <th className="pb-3 text-right">Sensitivity</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p: any) => (
              <tr key={p.param} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="py-3 font-black text-slate-300">{p.param}</td>
                <td className="py-3 text-right text-slate-400">{p.baseline}</td>
                <td className="py-3 text-right text-emerald-400">{p.scoreUp ?? '—'}</td>
                <td className="py-3 text-right text-indigo-400">{p.scoreDown ?? '—'}</td>
                <td className="py-3 text-right text-rose-400">{p.scoreDrop?.toFixed(3)}</td>
                <td className="py-3 text-right font-black" style={{ color: Math.abs(p.sensitivityPct ?? 0) > 20 ? '#f87171' : Math.abs(p.sensitivityPct ?? 0) > 10 ? '#fbbf24' : '#34d399' }}>
                  {p.sensitivityPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.interactions && data.interactions.length > 0 && (
        <SectionCard title="Parameter Interaction Matrix" icon={<Layers className="w-4 h-4"/>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.interactions.map((int: any, i: number) => (
              <MetricRow 
                key={i} 
                label={int.pair} 
                value={`${int.interactionType}`} 
                sub={`Exp: ${int.expectedDrop} | Act: ${int.actualDrop}`}
                tooltip="Interaction type (Synergistic, Antagonistic, Linear) based on combined performance drop vs sum of individual drops"
              />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Transaction Cost Stressing Panel ──────────────────────────────────────────
function TransactionCostView({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <VerdictBadge verdict={data.verdict} />
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block cursor-help border-b border-slate-700 border-dashed inline-block mb-1">Breakdown Multiplier</span>
          <span className="text-lg font-black text-white block">{data.breakdownMultiplier}x</span>
        </div>
      </div>
      <SectionCard title="Transaction Cost Curve" icon={<TrendingDown className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.curve}>
            <XAxis dataKey="multiplier" tick={{ fontSize: 9, fill: '#475569' }} tickFormatter={(v: any) => `${v}x`} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
            <Area type="monotone" dataKey="return" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[9px] text-slate-600 uppercase tracking-widest border-b border-white/5">
              <th className="pb-3 text-left">Multiplier</th>
              <th className="pb-3 text-right">Cost Per Side</th>
              <th className="pb-3 text-right">Net Return</th>
              <th className="pb-3 text-right">Profit Factor</th>
              <th className="pb-3 text-right">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {data.curve?.map((c: any) => (
              <tr key={c.multiplier} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2.5 font-black text-slate-300">{c.multiplier.toFixed(1)}x</td>
                <td className="py-2.5 text-right font-bold text-slate-400">{c.cost.toFixed(4)}</td>
                <td className={`py-2.5 text-right font-bold ${c.return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{c.return.toFixed(2)}%</td>
                <td className="py-2.5 text-right font-bold text-indigo-400">{c.PF.toFixed(2)}</td>
                <td className="py-2.5 text-right font-bold text-slate-300">{c.sharpe.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Statistical Tests Panel ───────────────────────────────────────────────────
function StatisticalTestsView({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-4 items-center">
          <VerdictBadge verdict={data.verdict} />
        </div>
        {data.explanation && (
          <p className="text-xs text-slate-400 italic bg-white/5 border border-white/10 p-3 rounded-lg leading-relaxed">
            {data.explanation}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Significance & Edge" icon={<BarChart2 className="w-4 h-4" />}>
          <MetricRow label="T-Statistic" value={data.tTest?.tStat} tooltip="T-stat against 0 mean return" />
          <MetricRow label="P-Value" value={data.tTest?.pValueEstimate} tooltip="P-Value of T-Stat" />
          <MetricRow label="Bootstrap Sig." value={`${(data.bootstrapSignificance * 100).toFixed(1)}%`} tooltip="Empirical probability of positive mean" />
          <MetricRow label="Estimated PBO" value={`${data.pboEstimatePct}%`} tooltip="Estimated Probability of Backtest Overfitting (Heuristic)" />
        </SectionCard>

        <SectionCard title="Distribution & Assumptions" icon={<Activity className="w-4 h-4" />}>
          <MetricRow label="Runs Test Z" value={data.runsTest?.zScore} tooltip="Z-score for randomness of win/loss streaks" />
          <MetricRow label="Is Random (Runs)" value={data.runsTest?.isRandom ? 'Yes' : 'No'} tooltip="Are trade outcomes independent?" />
          <MetricRow label="Jarque-Bera Stat" value={data.jarqueBera?.jbStat} tooltip="Test for normality" />
          <MetricRow label="Is Normal (JB)" value={data.jarqueBera?.isNormal ? 'Yes' : 'No'} tooltip="Is return distribution normal?" />
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Deflated Sharpe" icon={<ShieldCheck className="w-4 h-4" />}>
          <MetricRow label="DSR Z-Score" value={data.deflatedSharpeRatio?.dsrZScore} tooltip="Sharpe adjusted for skewness/kurtosis" />
          <MetricRow label="WRC Proxy" value={data.whiteRealityCheck?.p_value} tooltip="White Reality Check approach" />
        </SectionCard>

        <SectionCard title="Structural Shift" icon={<TrendingUp className="w-4 h-4" />}>
          <MetricRow label="Mann-Whitney Z" value={data.mannWhitneyU?.zScore} tooltip="Test between 1st and 2nd half of trades" />
          <MetricRow label="Dist. Shift" value={data.mannWhitneyU?.distributionShift ? 'Detected' : 'None'} tooltip="Did performance degrade significantly?" />
        </SectionCard>
      </div>
    </div>
  );
}

// ── Benchmark Comparison Panel ────────────────────────────────────────────────
function BenchmarkView({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <SectionCard title="Benchmark Comparison" icon={<Zap className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <MetricRow label="Benchmark" value={data.benchmark} />
            <MetricRow label="Strategy CAGR" value={`${data.strategyCAGRPct}%`} />
            <MetricRow label="Benchmark CAGR" value={`${data.benchmarkCAGRPct}%`} />
            <MetricRow label="Excess Return" value={`${data.excessReturnPct}%`} />
            <MetricRow label="Relative DD" value={`${data.relativeDrawdownPct}%`} tooltip="Difference in drawdown vs benchmark" />
          </div>
          <div className="space-y-2">
            <MetricRow label="Alpha" value={data.alpha} />
            <MetricRow label="Beta" value={data.beta} />
            <MetricRow label="Correlation" value={data.correlation} />
            <MetricRow label="Tracking Error" value={data.trackingError} />
            <MetricRow label="Information Ratio" value={data.informationRatio} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Full Report Panel ─────────────────────────────────────────────────────────
function FullReportView({ data }: { data: any }) {
  const { overall } = data;
  if (!overall) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Overall Verdict" icon={<ShieldCheck className="w-4 h-4" />}>
          <div className="flex flex-col items-center justify-center py-6 h-full">
            <VerdictBadge verdict={overall.verdict} />
            <div className="mt-4 text-center">
              <div className="text-3xl font-black text-white">{overall.score ?? 'N/A'}<span className="text-sm text-slate-500">/100</span></div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 block">Final Robustness Score</span>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Key Metrics" icon={<Activity className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <MetricRow label="Confidence" value={overall.confidence ?? 'N/A'} tooltip="Overall confidence in the statistical edge" />
            <MetricRow label="Live Readiness" value={overall.liveReadiness ?? 'N/A'} tooltip="Is this strategy safe for live deployment?" />
            <MetricRow label="Profit Prob" value={`${overall.probabilityMetrics?.positiveReturn ?? 0}%`} tooltip="% of simulated paths that end in profit" />
            <MetricRow label="Ruin Prob" value={`${overall.riskOfRuin?.marginCall ?? 0}%`} tooltip="% of simulated paths that blow up the account" />
            <MetricRow label="IS/OOS Ratio" value={overall.overfitRatio ?? 'N/A'} tooltip="Ratio of Out-of-Sample to In-Sample performance" />
            <MetricRow label="WF Ratio" value={overall.avgWalkForwardRatio ?? 'N/A'} tooltip="Average Out-of-Sample to In-Sample ratio across walk-forward windows" />
          </div>
        </SectionCard>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl">
        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Executive Summary</h3>
        <p className="text-slate-300 text-xs leading-relaxed">
          {overall.verdict === 'robust' || overall.verdict === 'highly_robust' ? 'This strategy demonstrates high resilience across all stress tests, including noise perturbation, out-of-sample validation, and parameter sensitivity. It is cleared for live execution.' :
            overall.verdict === 'mixed' || overall.verdict === 'moderate_degradation' ? 'This strategy shows moderate robustness but may suffer from partial overfitting. Proceed with caution and reduced position sizing.' :
            overall.verdict === 'highly_overfit' ? 'This strategy failed multiple robustness checks and displays an extreme Probability of Backtest Overfitting (PBO). The statistical edge is an illusion. Do not deploy to production.' :
              'This strategy failed multiple robustness checks and is highly likely to be overfit to historical data. Do not deploy to production.'}
        </p>
      </div>

      {data.validationSummary && (
        <SectionCard title="Validation Summary" icon={<ShieldCheck className="w-4 h-4"/>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-widest">Pre-Validation</h4>
              <ul className="text-xs text-slate-300 list-disc pl-4 space-y-1">
                {data.validationSummary.pre?.warnings?.length > 0 ? data.validationSummary.pre.warnings.map((msg: string, i: number) => <li key={i}>{msg}</li>) : <li>No pre-validation warnings.</li>}
              </ul>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-indigo-400 mb-2 uppercase tracking-widest">Post-Validation</h4>
              <ul className="text-xs text-slate-300 list-disc pl-4 space-y-1">
                {data.validationSummary.post?.warnings?.length > 0 ? data.validationSummary.post.warnings.map((msg: string, i: number) => <li key={i} className="text-rose-400 font-bold">{msg}</li>) : <li>No post-validation warnings.</li>}
                {data.validationSummary.post?.errors?.length > 0 && data.validationSummary.post.errors.map((msg: string, i: number) => <li key={`err-${i}`} className="text-red-500 font-black">{msg}</li>)}
              </ul>
            </div>
          </div>
        </SectionCard>
      )}

      {(data.transactionCostStressing || data.statisticalTests) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {data.transactionCostStressing && (
            <SectionCard title="Transaction Cost Stressing" icon={<TrendingDown className="w-4 h-4" />}>
              <div className="flex flex-col items-center justify-center py-4">
                <VerdictBadge verdict={data.transactionCostStressing.verdict} />
                <div className="grid grid-cols-2 gap-4 mt-6 w-full text-xs">
                  <MetricRow label="Base Cost" value={`${(data.transactionCostStressing.baseCostPerSide * 100).toFixed(3)}%`} tooltip="Sum of fee, slippage, and spread per side" />
                  <MetricRow label="Breakdown At" value={`${data.transactionCostStressing.breakdownMultiplier}x`} tooltip="Multiplier of base costs at which net profit is <= 0 or Sharpe < 0.5" />
                </div>
              </div>
            </SectionCard>
          )}

          {data.statisticalTests && (
            <SectionCard title="Statistical Tests (T-Test)" icon={<BarChart2 className="w-4 h-4" />}>
              <div className="flex flex-col items-center justify-center py-4">
                <VerdictBadge verdict={data.statisticalTests.verdict} />
                <div className="grid grid-cols-2 gap-4 mt-6 w-full text-xs">
                  <MetricRow label="T-Statistic" value={data.statisticalTests.tTest?.tStat} tooltip="T-statistic measuring mean trade return against 0" />
                  <MetricRow label="P-Value" value={data.statisticalTests.tTest?.pValueEstimate} tooltip="Probability that edge is due to random chance" />
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

const RobustnessPanel: React.FC<Props> = ({ apiUrl, symbol, interval, startUnix, endUnix, imbaParams }) => {
  const [activeTab, setActiveTab] = useState<RobustnessTab>('full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    robustnessResults, updateRobustnessResult, updateParams,
    robustnessSimulations, robustnessDropoutRate, robustnessNoiseLevel,
    robustnessTrainPct, robustnessWindows, robustnessStep,
    robustnessTcMaxMultiplier, robustnessTcStep,
    robustnessMcMethod, robustnessSeed, robustnessNumThreads, robustnessBlockSize
  } = useStore();

  const TABS: { id: RobustnessTab; label: string; icon: React.ReactNode }[] = [
    { id: 'full', label: 'Full Report', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'monte-carlo', label: 'Monte Carlo', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'is-oos', label: 'IS / OOS', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'walk-forward', label: 'Walk-Forward', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'sensitivity', label: 'Sensitivity', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'transaction', label: 'Tx Stress', icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { id: 'statistics', label: 'Statistics', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'benchmark', label: 'Benchmark', icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  const baseParams = `symbol=${symbol}&interval=${interval}&start=${startUnix}&end=${endUnix}${imbaParams}`;

  const fetchFullAndDistribute = async (forceRefresh = false) => {
    if (!forceRefresh && robustnessResults['full']) return;

    setLoading(true);
    setError(null);
    try {
      let endpoint = `${apiUrl}/api/robustness/full?${baseParams}`;
      endpoint += `&dropoutRate=${robustnessDropoutRate}&noiseLevel=${robustnessNoiseLevel}`;
      endpoint += `&trainPct=${robustnessTrainPct}&windows=${robustnessWindows}&step=${robustnessStep}`;
      endpoint += `&mcSimulations=${robustnessSimulations}&wfWindows=${robustnessWindows}`;
      endpoint += `&tcMax=${robustnessTcMaxMultiplier}&tcStep=${robustnessTcStep}`;
      endpoint += `&mcMethod=${robustnessMcMethod}&seed=${robustnessSeed}&numThreads=${robustnessNumThreads}&blockSize=${robustnessBlockSize}`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // The full endpoint returns { meta, monteCarlo, inSampleOutOfSample, walkForward, parameterSensitivity, transactionCostStressing, statisticalTests, ... }
      // We can distribute these pieces to their respective tabs to avoid duplicate API calls

      updateRobustnessResult('full', json);
      if (json.monteCarlo) updateRobustnessResult('monte-carlo', json.monteCarlo);
      if (json.inSampleOutOfSample) updateRobustnessResult('is-oos', json.inSampleOutOfSample);
      if (json.walkForward) updateRobustnessResult('walk-forward', json.walkForward);
      if (json.parameterSensitivity) updateRobustnessResult('sensitivity', json.parameterSensitivity);
      if (json.transactionCostStressing) updateRobustnessResult('transaction', json.transactionCostStressing);
      if (json.statisticalTests) updateRobustnessResult('statistics', json.statisticalTests);
      if (json.benchmarkComparison) updateRobustnessResult('benchmark', json.benchmarkComparison);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runTest = (tab: RobustnessTab) => {
    setActiveTab(tab);
  };

  const loadAll = async (forceRefresh = false) => {
    await fetchFullAndDistribute(forceRefresh);
  };

  React.useEffect(() => {
    if (!robustnessResults['full']) {
      loadAll(false);
    }
  }, [baseParams]);

  const overall = robustnessResults['monte-carlo'];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter italic">Robustness Lab</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1">Overfitting Detection & Strategy Validation</p>
        </div>
        {overall && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MC Profit Prob</span>
            <span className="text-2xl font-black text-emerald-400">{overall.profitProbabilityPct}%</span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => runTest(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            Config
          </button>
          <button
            onClick={() => loadAll(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Running Analysis...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <XCircle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-black text-rose-400 uppercase tracking-widest">{error}</p>
            <p className="text-[10px] text-slate-600">Run a backtest first to populate data.</p>
          </div>
        )}

        {!loading && !error && !robustnessResults[activeTab] && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center opacity-40">
            <ShieldCheck className="w-16 h-16 text-emerald-500" />
            <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Click a tab above to run the test</p>
          </div>
        )}

        {!loading && !error && robustnessResults[activeTab] && (
          <>
            {activeTab === 'full' && <FullReportView data={robustnessResults[activeTab]} />}
            {activeTab === 'monte-carlo' && <MonteCarloView data={robustnessResults[activeTab]} />}
            {activeTab === 'is-oos' && <ISOOSView data={robustnessResults[activeTab]} />}
            {activeTab === 'walk-forward' && <WalkForwardView data={robustnessResults[activeTab]} />}
            {activeTab === 'sensitivity' && <SensitivityView data={robustnessResults[activeTab]} />}
            {activeTab === 'transaction' && <TransactionCostView data={robustnessResults[activeTab]} />}
            {activeTab === 'statistics' && <StatisticalTestsView data={robustnessResults[activeTab]} />}
            {activeTab === 'benchmark' && <BenchmarkView data={robustnessResults[activeTab]} />}
          </>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0f1d] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Robustness Configuration
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Simulations (MC)</label>
                  <input type="number" value={robustnessSimulations} onChange={e => updateParams({ robustnessSimulations: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Dropout Rate</label>
                  <input type="number" step="0.01" value={robustnessDropoutRate} onChange={e => updateParams({ robustnessDropoutRate: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Noise Level</label>
                  <input type="number" step="0.01" value={robustnessNoiseLevel} onChange={e => updateParams({ robustnessNoiseLevel: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Train Pct (IS/OOS)</label>
                  <input type="number" step="0.01" value={robustnessTrainPct} onChange={e => updateParams({ robustnessTrainPct: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Walk-Forward Windows</label>
                  <input type="number" value={robustnessWindows} onChange={e => updateParams({ robustnessWindows: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Sensitivity Step</label>
                  <input type="number" step="0.01" value={robustnessStep} onChange={e => updateParams({ robustnessStep: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">TC Max Multiplier</label>
                  <input type="number" step="0.5" value={robustnessTcMaxMultiplier} onChange={e => updateParams({ robustnessTcMaxMultiplier: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">TC Nudge Step</label>
                  <input type="number" step="0.1" value={robustnessTcStep} onChange={e => updateParams({ robustnessTcStep: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Monte Carlo Method</label>
                  <select value={robustnessMcMethod} onChange={e => updateParams({ robustnessMcMethod: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none">
                    <option value="bootstrap">Bootstrap</option>
                    <option value="block_bootstrap">Block Bootstrap</option>
                    <option value="shuffle">Shuffle</option>
                    <option value="parametric">Parametric</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">RNG Seed</label>
                  <input type="number" value={robustnessSeed} onChange={e => updateParams({ robustnessSeed: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" placeholder="12345" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Num Threads</label>
                  <input type="number" min="1" max="16" value={robustnessNumThreads} onChange={e => updateParams({ robustnessNumThreads: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Block Size (Block MC)</label>
                  <input type="number" value={robustnessBlockSize} onChange={e => updateParams({ robustnessBlockSize: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-emerald-500 outline-none" placeholder="Auto" />
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
                  loadAll(true);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                Apply & Rerun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RobustnessPanel;
