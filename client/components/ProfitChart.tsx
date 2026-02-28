
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface ProfitChartProps {
  data: string[];
}

const ProfitChart: React.FC<ProfitChartProps> = ({ data }) => {
  const chartData = data.map((val, idx) => ({
    trade: idx + 1,
    profit: parseFloat(val)
  }));

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 h-[400px]">
      <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Equity Curve</h3>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="trade" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}%`} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area 
            type="monotone" 
            dataKey="profit" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#colorProfit)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProfitChart;
