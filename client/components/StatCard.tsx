
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  variant?: 'green' | 'dark' | 'purple' | 'red' | 'orange' | 'teal' | 'brown' | 'pink';
  icon?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, prefix, suffix, variant = 'dark', icon }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'green': return 'bg-[#16a34a]';
      case 'dark': return 'bg-[#1e293b]';
      case 'purple': return 'bg-[#7c3aed]';
      case 'red': return 'bg-[#dc2626]';
      case 'orange': return 'bg-[#9a3412]';
      case 'teal': return 'bg-[#0f766e]';
      case 'brown': return 'bg-[#7c2d12]';
      case 'pink': return 'bg-[#be185d]';
      default: return 'bg-[#1e293b]';
    }
  };

  return (
    <div className={`${getVariantStyles()} p-6 rounded-lg shadow-2xl flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02] cursor-default`}>
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="bg-white/10 p-2 rounded-lg text-white">
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{label}</span>
      </div>
      <div className="text-3xl font-black tracking-tight text-white">
        {prefix}{value}{suffix}
      </div>
    </div>
  );
};

export default StatCard;
