
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Candle } from '../types';

interface CandleChartProps {
  data: Candle[];
}

const CandleChart: React.FC<CandleChartProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    // Clear previous
    d3.select(containerRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 60, bottom: 30, left: 40 };
    const width = containerRef.current.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X axis (Time)
    const x = d3.scaleBand()
      .domain(data.map(d => d.time.toString()))
      .range([0, width])
      .padding(0.2);

    // Y axis (Price)
    const yMin = d3.min(data, d => d.low) || 0;
    const yMax = d3.max(data, d => d.high) || 0;
    const yPadding = (yMax - yMin) * 0.1;

    const y = d3.scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([height, 0]);

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('stroke', '#1e293b')
      .attr('stroke-opacity', 0.5)
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''));

    // Candles
    const candles = svg.selectAll('.candle')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'candle');

    // Wicks
    candles.append('line')
      .attr('x1', d => (x(d.time.toString()) || 0) + x.bandwidth() / 2)
      .attr('x2', d => (x(d.time.toString()) || 0) + x.bandwidth() / 2)
      .attr('y1', d => y(d.high))
      .attr('y2', d => y(d.low))
      .attr('stroke', d => d.close >= d.open ? '#10b981' : '#f43f5e')
      .attr('stroke-width', 1);

    // Bodies
    candles.append('rect')
      .attr('x', d => x(d.time.toString()) || 0)
      .attr('y', d => y(Math.max(d.open, d.close)))
      .attr('width', x.bandwidth())
      .attr('height', d => Math.abs(y(d.open) - y(d.close)) || 1)
      .attr('fill', d => d.close >= d.open ? '#10b981' : '#f43f5e');

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .attr('color', '#64748b')
      .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => !(i % Math.ceil(data.length / 10)))).tickFormat(d => {
        const date = new Date(parseInt(d) * 1000);
        return `${date.getHours()}:${date.getMinutes()}`;
      }));

    svg.append('g')
      .attr('transform', `translate(${width}, 0)`)
      .attr('color', '#64748b')
      .call(d3.axisRight(y).ticks(8));

  }, [data]);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 overflow-hidden">
      <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Price Action (Backtest Window)</h3>
      <div ref={containerRef} className="w-full" style={{ minHeight: '400px' }}></div>
    </div>
  );
};

export default CandleChart;
