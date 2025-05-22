// Description: This file contains the utility functions for the strategy service.

/* convert object ohlcv to object with arrays of high, low, close, open, volume, and time
 * @param {Array} ohlcv - Array of OHLCV data (open, high, low, close, volume).
 * @returns {Object} - Object with arrays of high, low, close, open, volume, and time.
 */

function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString('en-GB', { 
      timeZone: 'Asia/Kolkata', 
      hour12: false 
  });
} 

function convertOHLCVtoArray(ohlcv) {
  const high = ohlcv.map((candle) => candle.high);
  const low = ohlcv.map((candle) => candle.low);
  const close = ohlcv.map((candle) => candle.close);
  const open = ohlcv.map((candle) => candle.open);
  const volume = ohlcv.map((candle) => candle.volume);
  const time = ohlcv.map((candle) => candle.time);
  return { high, low, close, open, volume, time };
}

function convertOHLCVtoHeikinAshi( high, low, close, open, time ) {
  const haOpen = [];
  const haClose = [];
  const haHigh = [];
  const haLow = [];
  for (let i = 0; i < time.length; i++) {
    const _haOpen = i===0 ? open[i] : (haOpen[i - 1] + haClose[i - 1]) / 2;
    const _haClose = (open[i] + high[i] + low[i] + close[i]) / 4;
    const _haHigh = Math.max(high[i], _haOpen, _haClose)
    const _haLow = Math.min(low[i], _haOpen, _haClose)
    haOpen.push(_haOpen);
    haClose.push(_haClose);   
    haHigh.push(_haHigh);
    haLow.push(_haLow);
  }

  return {  haOpen, haHigh,  haLow, haClose, time };
}



function linreg(source, length, offset = 0) {
  const result = [];
  for (let i = 0; i < source.length; i++) {
      if (i < length - 1) {
          result.push(null);
          continue;
      }
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let j = 0; j < length; j++) {
          let x = j;
          let y = source[i - j];
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumX2 += x * x;
      }
      const slope = (length * sumXY - sumX * sumY) / (length * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / length;
      const regValue = intercept + slope * (length - 1 - offset);
      result.push(regValue);
  }
  return result;
}



function calcLinRegCandle(data, config = {}) {
  const {
      signalLength = 11,
      smaSignal = true,
      useLinReg = true,
      linregLength = 11
  } = config;

  const { open, high, low, close } = data;

  const bopen = useLinReg ? linreg(open, linregLength) : open;
  const bhigh = useLinReg ? linreg(high, linregLength) : high;
  const blow = useLinReg ? linreg(low, linregLength) : low;
  const bclose = useLinReg ? linreg(close, linregLength) : close;

  const signal = smaSignal ? sma(bclose, signalLength) : ema(bclose, signalLength);

  const candles = [];
  for (let i = 0; i < bclose.length; i++) {
      if (bopen[i] == null || bhigh[i] == null || blow[i] == null || bclose[i] == null) {
          candles.push(null);
          continue;
      }

      const isBullish = bopen[i] < bclose[i];
      candles.push({
          open: bopen[i],
          high: bhigh[i],
          low: blow[i],
          close: bclose[i],
          color: isBullish ? 'green' : 'red',
          signal: signal[i]
      });
  }

  return candles;
}


function sma(values, length) {
  const result = [];
  for (let i = 0; i < values.length; i++) {
      if (i < length - 1) {
          result.push(null);
      } else {
          const slice = values.slice(i - length + 1, i + 1);
          result.push(math.mean(slice));
      }
  }
  return result;
}

function ema(values, length) {
  const result = [];
  const alpha = 2 / (length + 1);
  let prev = values[0];
  result.push(prev);
  for (let i = 1; i < values.length; i++) {
      const curr = alpha * values[i] + (1 - alpha) * prev;
      result.push(curr);
      prev = curr;
  }
  return result;
}


function calcSmoothedHeikinAshi(data, len = 10, len2 = 10) {
  const o = ema(data.open, len);
  const h = ema(data.high, len);
  const l = ema(data.low, len);
  const c = ema(data.close, len);

  const haclose = [];
  const haopen = [];
  const hahigh = [];
  const halow = [];

  for (let i = 0; i < data.close.length; i++) {
      const currentHAClose = (o[i] + h[i] + l[i] + c[i]) / 4;
      haclose.push(currentHAClose);

      if (i === 0) {
          haopen.push((o[i] + c[i]) / 2);
      } else {
          haopen.push((haopen[i - 1] + haclose[i - 1]) / 2);
      }

      hahigh.push(Math.max(h[i], haopen[i], haclose[i]));
      halow.push(Math.min(l[i], haopen[i], haclose[i]));
  }

  const o2 = ema(haopen, len2);
  const c2 = ema(haclose, len2);
  const h2 = ema(hahigh, len2);
  const l2 = ema(halow, len2);

  const candles = [];
  for (let i = 0; i < data.close.length; i++) {
      if ([o2[i], c2[i], h2[i], l2[i]].some(val => val == null)) {
          candles.push(null);
          continue;
      }

      candles.push({
          open: o2[i],
          high: h2[i],
          low: l2[i],
          close: c2[i],
          color: o2[i] > c2[i] ? 'red' : 'lime'
      });
  }

  return candles;
}


function calculateProfitPercentage(isBullish, entryPrice ,currentPrice) {
              
  let profitPct;
  if (isBullish) {
    // For BUY orders, profit if exit price is higher than entry price.
    profitPct = Number(((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2);
  } else {
    // For SELL orders, profit if exit price is lower than entry price.
    profitPct = Number(((entryPrice - currentPrice) / entryPrice) * 100).toFixed(2);
  }

  return profitPct;
}


function calculateRiskPercentage(trade, offset = 0) {
    const entry_price = trade.entry_price;
    const stop_loss = trade.supertrend + offset;
    let risk;

    if (trade.isLong) {
        risk = entry_price - stop_loss; // Loss if price falls to stop-loss
    } else {
        risk = stop_loss - entry_price; // Loss if price rises to stop-loss
    }

    const risk_percentage = (risk / entry_price) * 100;
    return Math.abs(risk_percentage).toFixed(2); // Return positive percentage
}

function generateTradeReport(data) {
    const report = [];
    let currentEntry = null;

    for (const record of data) {
  
        if (currentEntry && (record.exit_signal === "exit")) {
            const profit = currentEntry.isLong
                ? ((record.close - currentEntry.entry_price) / currentEntry.entry_price * 100).toFixed(2)
                : ((currentEntry.entry_price - record.close) / currentEntry.entry_price * 100).toFixed(2);

            report.push({
               ...currentEntry,
                exit_time: record.datetime,
                exit_price: record.close,
                risk_percentage: calculateRiskPercentage(currentEntry, 0),
                profit: profit
            });

            currentEntry = null;
          
        }

        if (record.new_signal && ["Smart Buy", "Buy", "Smart Sell"].includes(record.new_signal)) {
            currentEntry = {
                entry_time: record.datetime,
                entry_price: record.close,
                supertrend: record.supertrend,
                rsi: record.rsi,
                session: record.session,
                open: record.open,
                high: record.high,
                low: record.low,
                close: record.close,
                volume: record.volume,
                atr: record.atr,
                ema200: record.ema200,
                sma13: record.sma13,
                rsi: record.rsi,
                upperBandVol:record.upperBandVol,
                lowerBandVol: record.lowerBandVol,
                priceJurik: record.priceJurik,
                volatility: record.volatility,
                isLong: record.new_signal.includes("Buy"),
                
            };
        }

    }

    return report;
}


module.exports = { convertOHLCVtoArray,formatTimestamp, convertOHLCVtoHeikinAshi, calculateProfitPercentage,  calcLinRegCandle , calcSmoothedHeikinAshi,generateTradeReport };