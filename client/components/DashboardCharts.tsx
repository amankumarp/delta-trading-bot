
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, AreaChart, Area, ComposedChart, Line, ReferenceArea
} from 'recharts';
import { TrendDataPoint } from '../types';

const MAX_RECHART_POINTS = 1200;

const sampleByIndex = <T,>(items: T[], maxItems = MAX_RECHART_POINTS) => {
  if (items.length <= maxItems) return items;

  const result: T[] = [];
  const last = items.length - 1;
  const step = last / (maxItems - 1);

  for (let i = 0; i < maxItems; i += 1) {
    result.push(items[Math.round(i * step)]);
  }

  return result;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e293b] border border-slate-700 p-3 rounded-lg shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs font-bold" style={{ color: p.color || p.fill }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
            {p.unit || ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// --- Market Trend vs Equity Chart ---
export const MarketTrendEquityChart: React.FC<{ data: TrendDataPoint[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  // We want to visualize the background based on the 'trend' property
  // and overlay the 'equity' as a line.
  const chartData = sampleByIndex(data).map((d, i) => ({
    ...d,
    index: i,
    label: new Date(d.time * 1000).toLocaleDateString(),
    // We add helper fields for background coloring in the bar chart
    isBull: d.trend === 'Bullish' ? 100 : 0,
    isBear: d.trend === 'Bearish' ? 100 : 0,
    isSide: d.trend === 'Sideways' ? 100 : 0,
  }));

  return (
    <div className="bg-[#0f172a] border border-white/5 p-8 rounded-xl h-[450px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">Equity vs Market Regime</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase">Bullish</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-rose-500/10 border border-rose-500/30 rounded-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase">Bearish</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-slate-500/10 border border-slate-500/30 rounded-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase">Sideways</span></div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="label" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} hide />
          <YAxis yAxisId="equity" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} orientation="left" />
          <YAxis yAxisId="bg" hide domain={[0, 100]} />

          <Tooltip content={<CustomTooltip />} />

          {/* Background Areas */}
          <Bar yAxisId="bg" dataKey="isBull" fill="#10b981" fillOpacity={0.05} barSize={100} isAnimationActive={false} />
          <Bar yAxisId="bg" dataKey="isBear" fill="#f43f5e" fillOpacity={0.05} barSize={100} isAnimationActive={false} />
          <Bar yAxisId="bg" dataKey="isSide" fill="#64748b" fillOpacity={0.05} barSize={100} isAnimationActive={false} />

          <Area
            yAxisId="equity"
            type="monotone"
            dataKey="equity"
            stroke="#818cf8"
            strokeWidth={3}
            fill="url(#equityGrad)"
            fillOpacity={0.1}
            name="Cumulative Yield"
            unit="%"
          />
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Cumulative Equity Curve ---
export const EquityCurveChart: React.FC<{ data: string[] }> = ({ data }) => {
  const chartData = sampleByIndex(data.map((val, idx) => ({ trade: idx + 1, profit: parseFloat(val) })));
  return (
    <div className="bg-[#0f172a] border border-white/5 p-8 rounded-xl h-[450px]">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Cumulative Profit</h3>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="trade" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tick={{ dy: 10 }} />
          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#equityGradient)" strokeWidth={3} name="Profit" unit="$" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Hourly Stats Chart ---
export const HourlyTradingStats: React.FC<{ data: Record<string, { wins: number; losses: number; count: number }> }> = ({ data }) => {
  const chartData = (Object.entries(data) as [string, { wins: number; losses: number; count: number }][]).map(([hour, stats]) => ({
    hour: hour.padStart(2, '0'),
    Wins: stats.wins,
    Losses: stats.losses,
  })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

  return (
    <div className="bg-[#0f172a] border border-white/5 p-6 rounded-xl h-[400px]">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Hourly Trading Stats</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="hour" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend iconType="rect" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
          <Bar dataKey="Wins" stackId="a" fill="#22d3ee" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Losses" stackId="a" fill="#f97316" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Day of Week Analysis ---
export const DayOfWeekAnalysis: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const chartData = order.map(day => ({
    name: day,
    profit: parseFloat(data[day]?.profit || 0)
  }));

  return (
    <div className="bg-[#0f172a] border border-white/5 p-6 rounded-xl h-[400px]">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Day of Week Analysis</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend verticalAlign="bottom" height={36} iconType="rect" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
          <Bar dataKey="profit" name="Profit" fill="#818cf8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Profit Buckets ---
export const ProfitBucketsChart: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));
  return (
    <div className="bg-[#0f172a] border border-white/5 p-8 rounded-xl h-[400px]">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Profit Buckets</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Legend iconType="rect" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
          <Bar dataKey="value" name="Number of Trades" fill="#818cf8" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.name === "4% Profit" ? "#d1d5db" : "#818cf8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Daily Profit Heatmap ---
export const DailyProfitHeatmap: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getColor = (val: number) => {
    if (val === 0) return '#1e293b';
    if (val > 2.0) return '#16a34a';
    if (val > 0.5) return '#4ade80';
    if (val > 0) return '#86efac';
    if (val < -2.0) return '#dc2626';
    if (val < -0.5) return '#f87171';
    return '#fca5a5';
  };

  const today = new Date();
  const weeksCount = 52;
  const weeks = [];

  for (let i = 0; i < weeksCount; i++) {
    const week = [];
    for (let j = 0; j < 7; j++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (weeksCount - 1 - i) * 7 - (6 - j));
      const dateStr = date.toISOString().split('T')[0];
      week.push({ date: dateStr, value: data[dateStr] || 0, month: date.getMonth() });
    }
    weeks.push(week);
  }

  return (
    <div className="bg-[#0f172a] border border-white/5 p-8 rounded-xl">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Daily Profit Heatmap</h3>
      <div className="flex gap-4">
        <div className="flex flex-col gap-2 pt-6">
          {days.map((d, i) => (
            <span key={d} className={`text-[9px] font-black uppercase h-3.5 flex items-center ${i % 2 === 0 ? 'text-slate-500' : 'text-transparent'}`}>{d}</span>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
          <div className="flex gap-1.5 min-w-max">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1.5">
                <div className="h-4 text-[9px] font-black text-slate-600 uppercase">
                  {wi % 4 === 0 && months[week[0].month]}
                </div>
                {week.map((day, di) => (
                  <div
                    key={di}
                    title={`${day.date}: ${day.value.toFixed(2)}%`}
                    className="w-3.5 h-3.5 rounded-sm transition-all hover:scale-125 cursor-pointer"
                    style={{ backgroundColor: getColor(day.value) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-6 text-[9px] font-black text-slate-500 uppercase">
        <span>Less Profit/More Loss</span>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#fca5a5]"></div>
          <div className="w-3 h-3 rounded-sm bg-[#f87171]"></div>
          <div className="w-3 h-3 rounded-sm bg-[#dc2626]"></div>
          <div className="w-3 h-3 rounded-sm bg-[#1e293b]"></div>
          <div className="w-3 h-3 rounded-sm bg-[#86efac]"></div>
          <div className="w-3 h-3 rounded-sm bg-[#4ade80]"></div>
          <div className="w-3 h-3 rounded-sm bg-[#16a34a]"></div>
        </div>
        <span>More Profit/Less Loss</span>
        <div className="ml-4 flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#1e293b]"></div>
          <span>No Trade Day</span>
        </div>
      </div>
    </div>
  );
};

// --- Monthly Yield ---
export const MonthlyYieldChart: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const chartData = Object.entries(data).map(([month, val]) => ({ month, val }));
  return (
    <div className="bg-[#0f172a] border border-white/5 p-8 rounded-xl h-[400px]">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">Monthly Profits</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Legend iconType="rect" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
          <Bar dataKey="val" name="Monthly Profit" fill="#bef264" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Multi-purpose Performance Bar ---
export const PerformanceBarChart: React.FC<{ title: string; data: Record<string, any>; color: string; unit?: string }> = ({ title, data, color, unit = "" }) => {
  const chartData = Object.entries(data).map(([name, val]) => ({ name, val: parseFloat(String(val)) }));
  return (
    <div className="bg-[#0f172a] border border-white/5 p-6 rounded-xl h-[350px]">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest">{title}</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
          <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="val" name={title} fill={color} radius={[4, 4, 0, 0]} unit={unit}>
            {chartData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.val < 0 ? "#f43f5e" : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PositionDistribution: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: Math.abs(Number(value) || 0)
  }));
  const COLORS = ['#818cf8', '#6ee7b7', '#f43f5e', '#fbbf24'];

  return (
    <div className="bg-[#0f172a] border border-white/5 p-8 rounded-xl h-[450px] flex flex-col items-center">
      <h3 className="text-sm font-black text-slate-100 mb-6 uppercase tracking-widest w-full text-left">Profit by Position (Buy/Sell)</h3>
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={120}
            paddingAngle={8}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
