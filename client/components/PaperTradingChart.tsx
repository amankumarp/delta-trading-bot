import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';

interface PaperTradingChartProps {
  data: any[];
  openPosition?: any;
}

export const PaperTradingChart: React.FC<PaperTradingChartProps> = ({ data, openPosition }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    
    candlestickSeriesRef.current = candlestickSeries;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (candlestickSeriesRef.current && data && data.length > 0) {
      const formattedData = data.map((d: any) => ({
        time: d.time || d.timestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })).filter((d: any) => d.time && d.open && d.high && d.low && d.close);
      
      try {
        candlestickSeriesRef.current.setData(formattedData);
        
        // Remove existing price lines
        priceLinesRef.current.forEach(line => {
          candlestickSeriesRef.current?.removePriceLine(line);
        });
        priceLinesRef.current = [];
        
        const markers: any[] = [];
        
        if (openPosition) {
           const entryTime = typeof openPosition.entryTime === 'string' ? new Date(openPosition.entryTime).getTime() / 1000 : openPosition.entryTime;
           markers.push({
             time: entryTime,
             position: openPosition.isLong ? 'belowBar' : 'aboveBar',
             color: openPosition.isLong ? '#10b981' : '#ef4444',
             shape: openPosition.isLong ? 'arrowUp' : 'arrowDown',
             text: `ENTRY @ ${openPosition.entryPrice.toFixed(2)}`,
           });

           if (openPosition.stoploss) {
             const slLine = candlestickSeriesRef.current.createPriceLine({
               price: openPosition.stoploss,
               color: '#ef4444',
               lineWidth: 2,
               lineStyle: 2,
               axisLabelVisible: true,
               title: 'SL',
             });
             if (slLine) priceLinesRef.current.push(slLine);
           }
           if (openPosition.takeProfits) {
             openPosition.takeProfits.forEach((tp: any, index: number) => {
               const tpLine = candlestickSeriesRef.current?.createPriceLine({
                 price: tp.targetPrice,
                 color: '#10b981',
                 lineWidth: 1,
                 lineStyle: 2,
                 axisLabelVisible: true,
                 title: `TP${index + 1}`,
               });
               if (tpLine) priceLinesRef.current.push(tpLine);
             });
           }
        }
        
        candlestickSeriesRef.current.setMarkers(markers);
      } catch(e) {
        console.error("Error setting chart data", e);
      }
    }
  }, [data, openPosition]);

  return (
    <div className="w-full relative">
       <div ref={chartContainerRef} className="w-full h-[300px]" />
    </div>
  );
};

export default PaperTradingChart;
