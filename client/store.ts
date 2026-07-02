import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BacktestResponse, IndicatorSettings, IndicatorConfig } from './types';
import { STRATEGY_OPTIONS } from './constants';

interface AppState {
  view: 'config' | 'dashboard';
  activeTab: 'backtest' | 'trades' | 'chart' | 'robustness' | 'optimization' | 'papertrading';
  focusedTradeIndex?: number;
  
  // Backtest Parameters
  strategy: string;
  symbol: string;
  interval: string;
  startDateTime: string;
  endDateTime: string;
  balance: string;
  leverage: string;
  risk: string;
  fee: string;
  apiUrl: string;

  // Dynamic Strategy Parameters
  dynamicParams: Record<string, string>;
  updateDynamicParam: (key: string, value: string) => void;

  // Chart settings
  indicatorSettings: IndicatorSettings;

  // Robustness Settings
  robustnessSimulations: string;
  robustnessDropoutRate: string;
  robustnessNoiseLevel: string;
  robustnessTrainPct: string;
  robustnessWindows: string;
  robustnessStep: string;
  robustnessTcMaxMultiplier: string;
  robustnessTcStep: string;
  robustnessMcMethod: string;
  robustnessSeed: string;
  robustnessNumThreads: string;
  robustnessBlockSize: string;

  // Optimization Settings
  optimizeTopN: string;
  optimizeMinTrades: string;

  // App State Data
  loading: boolean;
  data: BacktestResponse | null;
  error: string | null;
  aiInsight: string | null;
  aiLoading: boolean;
  
  isBackfilling: boolean;
  backfillProgress: string | null;

  robustnessResults: Record<string, any>;

  // Actions
  setView: (view: 'config' | 'dashboard') => void;
  setActiveTab: (tab: 'backtest' | 'trades' | 'chart' | 'robustness' | 'optimization' | 'papertrading') => void;
  setFocusedTradeIndex: (index?: number) => void;
  updateParams: (params: Partial<AppState>) => void;
  
  removeIndicator: (id: string) => void;
  addIndicator: (type: IndicatorConfig['type']) => void;
  updateIndicator: (id: string, updates: Partial<IndicatorConfig>) => void;
  updateParam: (id: string, key: string, value: any) => void;
  
  // Async Actions
  runBacktest: () => Promise<void>;
  setAiInsight: (insight: string | null) => void;
  setAiLoading: (loading: boolean) => void;
  setBackfillProgress: (progress: string | null, isComplete: boolean) => void;
  setRobustnessResults: (results: Record<string, any>) => void;
  updateRobustnessResult: (tab: string, data: any) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'config',
      activeTab: 'backtest',
      focusedTradeIndex: undefined,

      strategy: STRATEGY_OPTIONS[0].id,
      symbol: 'BTC_USDT',
      interval: '15m',
      startDateTime: '2025-03-13T00:00',
      endDateTime: '2025-07-19T23:59',
      balance: '1000000',
      leverage: '50',
      risk: '1',
      fee: '0.05',
      apiUrl: 'http://127.0.0.1:4040',

      dynamicParams: {},
      updateDynamicParam: (key, value) => set((state) => ({
        dynamicParams: { ...state.dynamicParams, [key]: value }
      })),

      robustnessSimulations: '10000',
      robustnessDropoutRate: '0.2',
      robustnessNoiseLevel: '0.05',
      robustnessTrainPct: '0.7',
      robustnessWindows: '5',
      robustnessStep: '0.1',
      robustnessTcMaxMultiplier: '20',
      robustnessTcStep: '0.5',
      robustnessMcMethod: 'bootstrap',
      robustnessSeed: '12345',
      robustnessNumThreads: '4',
      robustnessBlockSize: '',

      optimizeTopN: '10',
      optimizeMinTrades: '5',

      indicatorSettings: {
        indicators: [
          { id: 'ema-1', type: 'EMA', visible: true, color: '#3b82f6', params: { period: 20 } },
          { id: 'rsi-1', type: 'RSI', visible: true, color: '#f59e0b', params: { period: 14 } },
          { id: 'bb-1', type: 'BB', visible: true, color: '#ffffff', params: { period: 20, multiplier: 2.5 } }
        ]
      },

      loading: false,
      data: null,
      error: null,
      aiInsight: null,
      aiLoading: false,
      isBackfilling: false,
      backfillProgress: null,
      robustnessResults: {},

      setView: (view) => set({ view }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setFocusedTradeIndex: (focusedTradeIndex) => set({ focusedTradeIndex }),
      
      updateParams: (params) => set((state) => ({ ...state, ...params })),
      
      removeIndicator: (id) => set((state) => ({
        indicatorSettings: {
          indicators: state.indicatorSettings.indicators.filter(i => i.id !== id)
        }
      })),

      addIndicator: (type) => set((state) => {
        const id = `${type.toLowerCase()}-${Date.now()}`;
        const colors: Record<string, string> = { EMA: '#3b82f6', BB: '#ffffff', RSI: '#f59e0b', MACD: '#8b5cf6' };
        const params: Record<string, any> = {
          EMA: { period: 20 },
          BB: { period: 20, multiplier: 2 },
          RSI: { period: 14 },
          MACD: { fast: 12, slow: 26, signal: 9 }
        };
        const newIndicator: IndicatorConfig = {
          id, type, visible: true, color: colors[type] || '#3b82f6', params: params[type] || {}
        };
        return {
          indicatorSettings: {
            indicators: [...state.indicatorSettings.indicators, newIndicator]
          }
        };
      }),

      updateIndicator: (id, updates) => set((state) => ({
        indicatorSettings: {
          indicators: state.indicatorSettings.indicators.map(ind => 
            ind.id === id ? { ...ind, ...updates } : ind
          )
        }
      })),

      updateParam: (id, key, value) => set((state) => ({
        indicatorSettings: {
          indicators: state.indicatorSettings.indicators.map(ind =>
            ind.id === id ? { ...ind, params: { ...ind.params, [key]: value } } : ind
          )
        }
      })),

      setAiInsight: (aiInsight) => set({ aiInsight }),
      setAiLoading: (aiLoading) => set({ aiLoading }),
      setBackfillProgress: (progress, isComplete) => set((state) => {
        if (isComplete) {
          // Once complete, trigger a re-run of the backtest to get full data
          setTimeout(() => state.runBacktest(), 500);
          return { isBackfilling: false, backfillProgress: null };
        }
        return { isBackfilling: true, backfillProgress: progress };
      }),
      setRobustnessResults: (robustnessResults) => set({ robustnessResults }),
      updateRobustnessResult: (tab, data) => set((state) => ({
        robustnessResults: { ...state.robustnessResults, [tab]: data }
      })),

      runBacktest: async () => {
        const state = get();
        set({ loading: true, error: null, aiInsight: null, isBackfilling: false, backfillProgress: null, robustnessResults: {} });

        try {
          const startUnix = state.startDateTime ? Math.floor(new Date(state.startDateTime).getTime() / 1000) : '';
          const endUnix = state.endDateTime ? Math.floor(new Date(state.endDateTime).getTime() / 1000) : '';

          let url = `${state.apiUrl}/api/analyze?symbol=${state.symbol}&interval=${state.interval}&start=${startUnix}&end=${endUnix}&strategy=${state.strategy}`;
          const query = new URLSearchParams();
          query.append('symbol', state.symbol);
          query.append('interval', state.interval);
          query.append('start', startUnix.toString());
          query.append('end', endUnix.toString());
          query.append('strategy', state.strategy);
          if (state.balance) query.append('balance', state.balance);
          if (state.leverage) query.append('leverage', state.leverage);
          if (state.risk) query.append('risk', state.risk);
          if (state.fee) query.append('fee', state.fee);

          Object.entries(state.dynamicParams).forEach(([key, val]) => {
            query.append(key, val);
          });

          const response = await fetch(`${state.apiUrl}/api/analyze?${query.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
          });

          if (!response.ok) throw new Error(`API error ${response.status}`);
          const result = await response.json();
          
          if (response.status === 202 && result.status === 'partial') {
            set({ 
              data: result, 
              view: 'dashboard', 
              loading: false, 
              isBackfilling: true, 
              backfillProgress: result.message || 'Fetching historical data...' 
            });
          } else {
            set({ 
              data: result, 
              view: 'dashboard', 
              loading: false,
              isBackfilling: false,
              backfillProgress: null
            });
          }
        } catch (err: any) {
          console.warn("Falling back to local simulation data.");
          set({ 
            view: 'dashboard',
            error: "Remote execution unavailable. Local simulation active.",
            loading: false
          });
        }
      }
    }),
    {
      name: 'trading-bot-storage',
      partialize: (state) => ({
        strategy: state.strategy,
        symbol: state.symbol,
        interval: state.interval,
        startDateTime: state.startDateTime,
        endDateTime: state.endDateTime,
        balance: state.balance,
        leverage: state.leverage,
        risk: state.risk,
        fee: state.fee,
        dynamicParams: state.dynamicParams,
        robustnessSimulations: state.robustnessSimulations,
        robustnessDropoutRate: state.robustnessDropoutRate,
        robustnessNoiseLevel: state.robustnessNoiseLevel,
        robustnessTrainPct: state.robustnessTrainPct,
        robustnessWindows: state.robustnessWindows,
        robustnessStep: state.robustnessStep,
        robustnessMcMethod: state.robustnessMcMethod,
        robustnessSeed: state.robustnessSeed,
        robustnessNumThreads: state.robustnessNumThreads,
        robustnessBlockSize: state.robustnessBlockSize,
        optimizeTopN: state.optimizeTopN,
        optimizeMinTrades: state.optimizeMinTrades,
        indicatorSettings: state.indicatorSettings
      }),
    }
  )
);
