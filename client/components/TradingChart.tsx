
import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ColorType, LineStyle, MouseEventParams } from 'lightweight-charts';
import { Candle, Trade, IndicatorSettings } from '../types';
import { calculateEMA, calculateBollingerBands, calculateRSI, calculateMACD } from '../utils/indicators';
import { DollarSign, Percent, TrendingUp, TrendingDown, Clock, X, Info } from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  trades: Trade[];
  focusedTradeId?: number;
  indicatorSettings: IndicatorSettings;
}

const TradingChart: React.FC<TradingChartProps> = ({ candles, trades, focusedTradeId, indicatorSettings }) => {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<HTMLDivElement>(null);
  
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const chartInstances = useRef<{
    main: IChartApi | null;
    rsi: IChartApi | null;
    macd: IChartApi | null;
  }>({ main: null, rsi: null, macd: null });

  const seriesRef = useRef<any>({});

  const parseTime = (dateStr: string) => {
    const [datePart, timePart] = dateStr.split(', ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, min, sec] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, min, sec).getTime() / 1000;
  };

  useEffect(() => {
    if (!mainChartRef.current || !candles.length) return;

    // --- Main Chart Init ---
    const mainChart = createChart(mainChartRef.current, {
      layout: { 
        background: { type: ColorType.Solid, color: '#0f172a' }, 
        textColor: '#64748b',
        fontSize: 10,
        fontFamily: 'Inter'
      },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: mainChartRef.current.clientWidth,
      height: 500,
      timeScale: { borderColor: '#1e293b', timeVisible: true, borderVisible: true },
      crosshair: { mode: 0, vertLine: { color: '#475569', width: 1, style: 3 }, horzLine: { color: '#475569', width: 1, style: 3 } },
    });
    chartInstances.current.main = mainChart;

    const candleSeries = mainChart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#f43f5e', borderVisible: false,
      wickUpColor: '#10b981', wickDownColor: '#f43f5e',
    });
    seriesRef.current.candles = candleSeries;

    const prices = candles.map(c => c.close);
    const formattedCandles = candles.map(c => ({
      time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    // --- Dynamic Indicators Rendering ---
    indicatorSettings.indicators.forEach((ind) => {
      if (!ind.visible) return;

      if (ind.type === 'EMA') {
        const period = ind.params.period || 20;
        const emaData = calculateEMA(prices, period).map((v, i) => ({ time: candles[i].time as any, value: v }));
        const emaSeries = mainChart.addLineSeries({ color: ind.color, lineWidth: 1.5, title: `EMA ${period}` });
        emaSeries.setData(emaData);
      } else if (ind.type === 'BB') {
        const period = ind.params.period || 20;
        const multiplier = ind.params.multiplier || 2;
        const bbData = calculateBollingerBands(prices, period, multiplier);
        const bbUpper = mainChart.addLineSeries({ color: ind.color, lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Upper' });
        const bbLower = mainChart.addLineSeries({ color: ind.color, lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Lower' });
        bbUpper.setData(bbData.map((v, i) => ({ time: candles[i].time as any, value: v.upper || 0 })).filter(d => d.value !== 0));
        bbLower.setData(bbData.map((v, i) => ({ time: candles[i].time as any, value: v.lower || 0 })).filter(d => d.value !== 0));
      } else if (ind.type === 'RSI' && rsiChartRef.current) {
        if (!chartInstances.current.rsi) {
          const rsiChart = createChart(rsiChartRef.current, {
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#64748b' },
            width: rsiChartRef.current.clientWidth, height: 120,
            grid: { vertLines: { visible: false }, horzLines: { color: '#1e293b' } },
            timeScale: { visible: false },
          });
          chartInstances.current.rsi = rsiChart;
          const rsi70 = rsiChart.addLineSeries({ color: 'rgba(244, 63, 94, 0.2)', lineWidth: 1, lineStyle: LineStyle.Dashed });
          const rsi30 = rsiChart.addLineSeries({ color: 'rgba(16, 185, 129, 0.2)', lineWidth: 1, lineStyle: LineStyle.Dashed });
          rsi70.setData(candles.map(c => ({ time: c.time as any, value: 70 })));
          rsi30.setData(candles.map(c => ({ time: c.time as any, value: 30 })));
        }
        const rsiSeries = chartInstances.current.rsi.addLineSeries({ color: ind.color, lineWidth: 1.5, title: `RSI ${ind.params.period}` });
        const rsiVal = calculateRSI(prices, ind.params.period || 14);
        rsiSeries.setData(rsiVal.map((v, i) => ({ time: candles[i].time as any, value: v })).filter(d => d.value !== null));
      } else if (ind.type === 'MACD' && macdChartRef.current) {
        if (!chartInstances.current.macd) {
          const macdChart = createChart(macdChartRef.current, {
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#64748b' },
            width: macdChartRef.current.clientWidth, height: 150,
            grid: { vertLines: { visible: false }, horzLines: { color: '#1e293b' } },
            timeScale: { borderColor: '#1e293b', timeVisible: true },
          });
          chartInstances.current.macd = macdChart;
        }
        const { macdLine, signalLine, histogram } = calculateMACD(prices, ind.params.fast || 12, ind.params.slow || 26, ind.params.signal || 9);
        const mLine = chartInstances.current.macd.addLineSeries({ color: ind.color, lineWidth: 1.5 });
        const sLine = chartInstances.current.macd.addLineSeries({ color: '#f59e0b', lineWidth: 1 });
        const hGram = chartInstances.current.macd.addHistogramSeries({ color: '#475569' });
        mLine.setData(macdLine.map((v, i) => ({ time: candles[i].time as any, value: v })));
        sLine.setData(signalLine.map((v, i) => ({ time: candles[i].time as any, value: v })));
        hGram.setData(histogram.map((v, i) => ({ 
          time: candles[i].time as any, 
          value: v, 
          color: v >= 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(244, 63, 94, 0.5)' 
        })));
      }
    });

    // --- Interactive Markers ---
    const markers: any[] = [];
    trades.forEach((trade, idx) => {
      const entryT = parseTime(trade.entry_time);
      const exitT = parseTime(trade.exit_time);

      markers.push({
        time: entryT,
        position: trade.isLong ? 'belowBar' : 'aboveBar',
        color: trade.isLong ? '#10b981' : '#f43f5e',
        shape: trade.isLong ? 'arrowUp' : 'arrowDown',
        text: `ENTRY`,
        id: `trade-entry-${idx}`
      });

      markers.push({
        time: exitT,
        position: 'aboveBar',
        color: parseFloat(trade.profit) >= 0 ? '#fbbf24' : '#64748b',
        shape: 'circle',
        text: `EXIT`,
        id: `trade-exit-${idx}`
      });
    });
    candleSeries.setMarkers(markers);

    // Marker Click Tooltip Logic
    mainChart.subscribeClick((param: MouseEventParams) => {
      if (param.hoveredMarkerId) {
        const tradeIdx = parseInt(String(param.hoveredMarkerId).split('-').pop() || '0');
        setSelectedTrade(trades[tradeIdx]);
      } else {
        setSelectedTrade(null);
      }
    });

    // Sync Time Scales
    const sync = (source: IChartApi, targets: IChartApi[]) => {
      source.timeScale().subscribeVisibleTimeRangeChange((range) => {
        targets.forEach(t => t.timeScale().setVisibleRange(range as any));
      });
    };
    
    if (chartInstances.current.main) {
      const targets = [chartInstances.current.rsi, chartInstances.current.macd].filter(Boolean) as IChartApi[];
      sync(chartInstances.current.main, targets);
      targets.forEach(t => sync(t, [chartInstances.current.main, ...targets.filter(inner => inner !== t)]));
    }

    const handleResize = () => {
      const w = mainChartRef.current?.clientWidth || 0;
      mainChart.applyOptions({ width: w });
      chartInstances.current.rsi?.applyOptions({ width: w });
      chartInstances.current.macd?.applyOptions({ width: w });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mainChart.remove();
      chartInstances.current.rsi?.remove();
      chartInstances.current.macd?.remove();
      chartInstances.current.rsi = null;
      chartInstances.current.macd = null;
    };
  }, [candles, trades, indicatorSettings]);

  // Handle Track on Chart Logic
  useEffect(() => {
    if (!chartInstances.current.main || !seriesRef.current.candles) return;
    
    if (focusedTradeId !== undefined && trades[focusedTradeId]) {
      const trade = trades[focusedTradeId];
      const entryTime = parseTime(trade.entry_time);
      const exitTime = parseTime(trade.exit_time);

      const duration = exitTime - entryTime;
      const padding = Math.max(duration * 2, 3600 * 4);
      
      chartInstances.current.main.timeScale().setVisibleRange({
        from: (entryTime - padding / 2) as any,
        to: (exitTime + padding / 2) as any,
      });

      if (seriesRef.current.slLine) seriesRef.current.candles.removePriceLine(seriesRef.current.slLine);
      if (seriesRef.current.entryLine) seriesRef.current.candles.removePriceLine(seriesRef.current.entryLine);

      seriesRef.current.slLine = seriesRef.current.candles.createPriceLine({
        price: trade.stoploss, color: '#f43f5e', lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SL'
      });
      seriesRef.current.entryLine = seriesRef.current.candles.createPriceLine({
        price: trade.entry_price, color: '#10b981', lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'ENTRY'
      });
      
      setSelectedTrade(trade);
    }
  }, [focusedTradeId, trades]);

  return (
    <div className="flex flex-col gap-4 w-full bg-[#0f172a] rounded-[2.5rem] p-6 relative group overflow-hidden">
      <div className="absolute top-8 left-10 z-10 flex items-center gap-4 bg-slate-900/90 border border-slate-700/50 p-3 px-5 rounded-2xl backdrop-blur-xl shadow-2xl">
         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Temporal Flow Visualizer v2.1</span>
      </div>

      {selectedTrade && (
        <div className="absolute top-8 right-10 z-50 animate-in slide-in-from-right-10 duration-500">
           <div className="bg-slate-900/95 border border-emerald-500/30 p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl w-72 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                 <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${selectedTrade.isLong ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    <span className="text-[11px] font-black uppercase text-white tracking-widest">{selectedTrade.isLong ? 'LONG' : 'SHORT'}</span>
                 </div>
                 <button onClick={() => setSelectedTrade(null)} className="text-slate-500 hover:text-white transition-all"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Entry</span>
                    <span className="text-sm font-black text-white">${selectedTrade.entry_price.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Exit</span>
                    <span className="text-sm font-black text-white">${selectedTrade.exit_price.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5"><Clock className="w-3 h-3" /> Time</span>
                    <span className="text-[10px] font-bold text-slate-300">{selectedTrade.entry_time.split(', ')[1]}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5"><Percent className="w-3 h-3" /> Yield</span>
                    <span className={`text-lg font-black tracking-tighter ${parseFloat(selectedTrade.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {parseFloat(selectedTrade.profit) > 0 ? '+' : ''}{selectedTrade.profit}%
                    </span>
                 </div>
                 <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[9px] font-black text-slate-500 uppercase">Analysis</span>
                    <div className="flex items-center gap-1.5">
                       {parseFloat(selectedTrade.profit) >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                       <span className={`text-[9px] font-black uppercase ${parseFloat(selectedTrade.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {parseFloat(selectedTrade.profit) >= 0 ? 'Win' : 'Loss'}
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div ref={mainChartRef} className="w-full rounded-3xl overflow-hidden border border-white/5 shadow-inner" />
      <div ref={rsiChartRef} className="w-full rounded-2xl overflow-hidden border border-white/5 bg-slate-900/50" />
      <div ref={macdChartRef} className="w-full rounded-2xl overflow-hidden border border-white/5 bg-slate-900/50" />
    </div>
  );
};

export default TradingChart;
