
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  entry_time: string;
  entry_price: number;
  exit_time: string;
  exit_price: number;
  profit: string;
  risk_percentage: string;
  isLong: boolean;
  session: string;
  volatility: string;
  avg_profit?: string;
  stoploss: number;
  rsi: number;
  atr: number;
  qnt?: number;
  pnl?: number;
  partial_exit_time?: string;
  partial_exit_price?: number;
  partial_profit?: string;
  partial_exit_qnt?: number;
  partial_pnl?: number;
  supertrend?: number;
  ema8?: number;
  ema13?: number;
  ema200?: number;
  sma13?: number;
  adx?: number;
}

export interface HourStat {
  wins: number;
  losses: number;
  count: number;
}

export interface DayAnalysis {
  profit: string;
  winRate: string;
  count: number;
}

export interface IndicatorConfig {
  id: string;
  type: 'EMA' | 'BB' | 'RSI' | 'MACD';
  visible: boolean;
  color: string;
  params: Record<string, number>;
}

export interface IndicatorSettings {
  indicators: IndicatorConfig[];
}

export interface TrendDataPoint {
  time: number;
  equity: number;
  price: number;
  trend: 'Bullish' | 'Bearish' | 'Sideways';
}

export interface Analysis {
  initialBalance: number;
  leverage: number;
  fee: number;
  riskPercentPerTrade: number;
  startTime: string;
  endTime: string;
  totalDays: number;
  totalTrades: number;
  winRate: string;
  totalProfit: string;
  avgProfit: string;
  avgRisk: string;
  grossProfit: string;
  grossLoss: string;
  profitFactor: string;
  bestTrade: Trade;
  worstTrade: Trade;
  maxWinStreak: number;
  maxLossStreak: number;
  avgRMultiple: string;
  sharpeRatio: string;
  sortinoRatio: string;
  expectancy: string;
  winLossRatio: string;
  kelly: string;
  totalFees: string;
  stoplossTouched: number;
  cumulativeProfit: string[];
  maxDrawdown: string;
  maxDrawdownPercent: string;
  finalBalance: string;
  totalReturn: string;
  cagr: string;
  calmarRatio: string;
  sessionProfit: Record<string, number>;
  sessionCounts: Record<string, number>;
  sessionWinRates: Record<string, string>;
  volProfit: Record<string, number>;
  volCounts: Record<string, number>;
  volWinRates: Record<string, string>;
  posProfit: Record<string, number>;
  posCounts: Record<string, number>;
  posWinRates: Record<string, string>;
  hourStats: Record<string, HourStat>;
  profitBuckets: Record<string, number>;
  dayOfWeekAnalysis: Record<string, DayAnalysis>;
  dailyProfits: Record<string, number>;
  monthlyProfits: Record<string, number>;
  marketTrendData?: TrendDataPoint[];
  avgDurationWins: string;
  avgDurationLosses: string;
  recoveryFactor: string;
  largestDrawdown?: string;
  sessions?: any[];
  volatility?: any[];
  positions?: any[];
  daily?: any;
}

export interface BacktestResponse {
  analysis: Analysis;
  trades: Trade[];
  candles: Candle[];
}
