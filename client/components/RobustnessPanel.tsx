import React, { useState } from 'react';
import { RefreshCcw, ShieldCheck, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, XCircle, Layers, BarChart2, Zap } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

type RobustnessTab = 'full' | 'monte-carlo' | 'is-oos' | 'walk-forward' | 'sensitivity';

interface Props {
  apiUrl: string;
  symbol: string;
  interval: string;
  startUnix: string;
  endUnix: string;
  imbaParams: string; // pre-built query string fragment
}

const VERDICT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  robust:                { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <CheckCircle className="w-5 h-5" />, label: 'Robust' },
  moderate_degradation:  { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: <AlertTriangle className="w-5 h-5" />, label: 'Moderate Degradation' },
  likely_overfit:        { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    icon: <XCircle className="w-5 h-5" />,       label: 'Likely Overfit' },
  mixed:                 { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: <AlertTriangle className="w-5 h-5" />, label: 'Mixed' },
  fragile:               { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    icon: <XCircle className="w-5 h-5" />,       label: 'Fragile Parameters' },
  moderate:              { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: <AlertTriangle className="w-5 h-5" />, label: 'Moderate Sensitivity' },
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
  const histData = (data.histogram || []).map((b: any) => ({ name: `$${Math.round(b.lo/1000)}k`, count: b.count }));
  const ddHistData = (data.ddHistogram || []).map((b: any) => ({ name: b.label, count: b.count }));
  const sharpeHistData = (data.sharpeHistogram || []).map((b: any) => ({ name: b.label, count: b.count }));
  const adv = data.advancedStats || {};
  const ciData = [
    { p: 'p5',  final: data.finalBalance?.p5,  dd: data.maxDrawdownPct?.p5,  ret: data.totalReturnPct?.p5, sharpe: data.sharpeRatio?.p5 },
    { p: 'p25', final: data.finalBalance?.p25, dd: data.maxDrawdownPct?.p25, ret: data.totalReturnPct?.p25, sharpe: data.sharpeRatio?.p25 },
    { p: 'p50', final: data.finalBalance?.p50, dd: data.maxDrawdownPct?.p50, ret: data.totalReturnPct?.p50, sharpe: data.sharpeRatio?.p50 },
    { p: 'p75', final: data.finalBalance?.p75, dd: data.maxDrawdownPct?.p75, ret: data.totalReturnPct?.p75, sharpe: data.sharpeRatio?.p75 },
    { p: 'p95', final: data.finalBalance?.p95, dd: data.maxDrawdownPct?.p95, ret: data.totalReturnPct?.p95, sharpe: data.sharpeRatio?.p95 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl w-fit">
        <Activity className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">Stress Testing Active: Up to 20% Missed Trades, 5% Execution Noise</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center" title="% of Monte Carlo simulations resulting in a net profit.">
          <div className="text-3xl font-black text-emerald-400">{data.profitProbabilityPct}%</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1 cursor-help border-b border-slate-700 border-dashed inline-block">Profit Probability</div>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 text-center" title="% of simulations resulting in account ruin (drawdown > 90%).">
          <div className="text-3xl font-black text-rose-400">{data.ruinProbabilityPct}%</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1 cursor-help border-b border-slate-700 border-dashed inline-block">Ruin Probability</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center" title="Average of the maximum drawdowns across all simulations.">
          <div className="text-3xl font-black text-amber-400">{data.expectedMaxDrawdownPct}%</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1 cursor-help border-b border-slate-700 border-dashed inline-block">Expected Max DD</div>
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
            <Bar dataKey="count" fill="#10b981" radius={[4,4,0,0]} />
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
            <Bar dataKey="count" fill="#3b82f6" radius={[2,2,0,0]} />
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
            <Bar dataKey="count" fill="#3b82f6" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Robustness Assessment" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] text-slate-600 uppercase tracking-widest border-b border-white/5">
                <th className="pb-4 text-left">Probability</th>
                <th className="pb-4 text-left">Value</th>
                <th className="pb-4 text-left">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-4 font-bold text-slate-300">
                  P(Final &gt; Initial)<br />
                  <span className="text-[10px] text-slate-500 font-normal">— profitable</span>
                </td>
                <td className="py-4 font-black text-emerald-400">{adv.pProfitable ?? 0}%</td>
                <td className="py-4 text-slate-400">Edge mathematically guaranteed</td>
              </tr>
              <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-4 font-bold text-slate-300">
                  P(Final &gt; B&amp;H)<br />
                  <span className="text-[10px] text-slate-500 font-normal">— beats buy-and-hold</span>
                </td>
                <td className="py-4 font-black text-emerald-400">{adv.pBeatsBuyAndHold ?? 0}%</td>
                <td className="py-4 text-slate-400">Strategy adds value vs HODL</td>
              </tr>
              <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-4 font-bold text-slate-300">
                  P(Final &gt; Realized)<br />
                  <span className="text-[10px] text-slate-500 font-normal">— beats realized result</span>
                </td>
                <td className="py-4 font-black text-indigo-400">{adv.pBeatsRealized ?? 0}%</td>
                <td className="py-4 text-slate-400">Cumulative P&amp;L is fixed</td>
              </tr>
              <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-4 font-bold text-slate-300">
                  P(Max DD &gt; 30%)<br />
                  <span className="text-[10px] text-slate-500 font-normal">— moderate tail risk</span>
                </td>
                <td className="py-4 font-black text-emerald-400">{adv.pMaxDD30 ?? 0}%</td>
                <td className="py-4 text-slate-400">HIGH path-dependent DD risk</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-4 font-bold text-slate-300">
                  P(Max DD &gt; 50%)<br />
                  <span className="text-[10px] text-slate-500 font-normal">— severe tail risk</span>
                </td>
                <td className="py-4 font-black text-emerald-400">{adv.pMaxDD50 ?? 0}%</td>
                <td className="py-4 text-slate-400">Account-threatening in most orderings</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── IS/OOS Panel ───────────────────────────────────────────────────────────────
function ISOOSView({ data }: { data: any }) {
  const is = data.inSample, oos = data.outOfSample;
  const bars = [
    { name: 'Win Rate', IS: parseFloat(is?.winRate||0), OOS: parseFloat(oos?.winRate||0) },
    { name: 'Prof Factor', IS: parseFloat(is?.profitFactor||0), OOS: parseFloat(oos?.profitFactor||0) },
    { name: 'Sharpe', IS: parseFloat(is?.sharpeRatio||0), OOS: parseFloat(oos?.sharpeRatio||0) },
    { name: 'Recovery', IS: parseFloat(is?.recoveryFactor||0), OOS: parseFloat(oos?.recoveryFactor||0) },
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
            <Bar dataKey="IS" name="In-Sample" fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="OOS" name="Out-of-Sample" fill="#6366f1" radius={[4,4,0,0]} />
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
      </div>

      <SectionCard title="IS vs OOS Score Per Window" icon={<BarChart2 className="w-4 h-4" />}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={4}>
            <XAxis dataKey="window" tick={{ fontSize: 9, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} />
            <ReferenceLine y={0} stroke="#334155" />
            <Tooltip contentStyle={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }} />
            <Bar dataKey="IS" name="In-Sample" fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="OOS" name="Out-of-Sample" fill="#6366f1" radius={[4,4,0,0]} />
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
                <td className="py-3 font-black text-emerald-400">W{w.window}</td>
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
            <Bar dataKey="sensitivity" radius={[0,4,4,0]}>
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
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Final Validation Status</span>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Key Metrics" icon={<Activity className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-4 text-xs">
             <MetricRow label="Profit Prob" value={`${overall.profitProbabilityPct}%`} tooltip="% of simulated paths that end in profit" />
             <MetricRow label="Ruin Prob" value={`${overall.ruinProbabilityPct}%`} tooltip="% of simulated paths that blow up the account" />
             <MetricRow label="IS/OOS Ratio" value={overall.overfitRatio ?? 'N/A'} tooltip="Ratio of Out-of-Sample to In-Sample performance" />
             <MetricRow label="WF Ratio" value={overall.avgWalkForwardRatio ?? 'N/A'} tooltip="Average Out-of-Sample to In-Sample ratio across walk-forward windows" />
          </div>
        </SectionCard>
      </div>
      
      <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl">
        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Executive Summary</h3>
        <p className="text-slate-300 text-xs leading-relaxed">
          {overall.verdict === 'robust' ? 'This strategy demonstrates high resilience across all stress tests, including noise perturbation, out-of-sample validation, and parameter sensitivity. It is cleared for live execution.' :
           overall.verdict === 'mixed' || overall.verdict === 'moderate_degradation' ? 'This strategy shows moderate robustness but may suffer from partial overfitting. Proceed with caution and reduced position sizing.' :
           'This strategy failed multiple robustness checks and is highly likely to be overfit to historical data. Do not deploy to production.'}
        </p>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
const RobustnessPanel: React.FC<Props> = ({ apiUrl, symbol, interval, startUnix, endUnix, imbaParams }) => {
  const [activeTab, setActiveTab] = useState<RobustnessTab>('full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const TABS: { id: RobustnessTab; label: string; icon: React.ReactNode }[] = [
    { id: 'full',         label: 'Full Report',   icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'monte-carlo',  label: 'Monte Carlo',   icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'is-oos',       label: 'IS / OOS',      icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'walk-forward', label: 'Walk-Forward',  icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'sensitivity',  label: 'Sensitivity',   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ];

  const baseParams = `symbol=${symbol}&interval=${interval}&start=${startUnix}&end=${endUnix}${imbaParams}`;

  const runTest = async (tab: RobustnessTab) => {
    setActiveTab(tab);
    if (results[tab]) return; // cached
    setLoading(true);
    setError(null);
    try {
      let endpoint = `${apiUrl}/api/robustness/${tab}?${baseParams}`;
      if (tab === 'monte-carlo') {
        endpoint += `&dropoutRate=0.20&noiseLevel=0.05&simulations=10000`;
      } else if (tab === 'full') {
        endpoint += `&dropoutRate=0.20&noiseLevel=0.05&simulations=10000`;
      }
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults(prev => ({ ...prev, [tab]: json }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const overall = results['monte-carlo'];

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
      <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => runTest(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === t.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
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

        {!loading && !error && !results[activeTab] && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center opacity-40">
            <ShieldCheck className="w-16 h-16 text-emerald-500" />
            <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Click a tab above to run the test</p>
          </div>
        )}

        {!loading && !error && results[activeTab] && (
          <>
            {activeTab === 'full'         && <FullReportView  data={results[activeTab]} />}
            {activeTab === 'monte-carlo'  && <MonteCarloView  data={results[activeTab]} />}
            {activeTab === 'is-oos'       && <ISOOSView       data={results[activeTab]} />}
            {activeTab === 'walk-forward' && <WalkForwardView data={results[activeTab]} />}
            {activeTab === 'sensitivity'  && <SensitivityView data={results[activeTab]} />}
          </>
        )}
      </div>
    </div>
  );
};

export default RobustnessPanel;
