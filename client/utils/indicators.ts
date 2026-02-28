
import { Candle } from '../types';

export const calculateEMA = (data: number[], period: number) => {
  const k = 2 / (period + 1);
  let ema = data[0];
  const results = [ema];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    results.push(ema);
  }
  return results;
};

export const calculateRSI = (data: number[], period: number = 14) => {
  const rsi = new Array(data.length).fill(null);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;

    if (i >= period) {
      if (i > period) {
        const prevDiff = data[i - 1] - data[i - 2];
        const prevGain = prevDiff >= 0 ? prevDiff : 0;
        const prevLoss = prevDiff < 0 ? -prevDiff : 0;
        gains = (gains * (period - 1) + (diff >= 0 ? diff : 0)) / period;
        losses = (losses * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      } else {
        gains /= period;
        losses /= period;
      }
      const rs = gains / (losses || 1);
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }
  return rsi;
};

export const calculateBollingerBands = (data: number[], period: number = 20, multiplier: number = 2) => {
  const results = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      results.push({ middle: null, upper: null, lower: null });
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(slice.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / period);
    results.push({
      middle: mean,
      upper: mean + multiplier * stdDev,
      lower: mean - multiplier * stdDev,
    });
  }
  return results;
};

export const calculateMACD = (data: number[], fast: number = 12, slow: number = 26, signal: number = 9) => {
  const emaFast = calculateEMA(data, fast);
  const emaSlow = calculateEMA(data, slow);
  const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  return { macdLine, signalLine, histogram };
};
