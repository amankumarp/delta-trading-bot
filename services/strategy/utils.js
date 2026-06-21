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



function generateTradeReport(data) {
    const trades = [];
    let currentEntry = null;

    for (const record of data) {
        if (currentEntry) {
            // Check if stoploss is touched (assumes we can exit exactly at stoploss)
            // To be more realistic, we check if the open gap skipped the stoploss
            let stoplossHit = false;
            let actualExitPrice = currentEntry.stoploss;

            if (currentEntry.isLong) {
                if (record.open <= currentEntry.stoploss) {
                    stoplossHit = true;
                    actualExitPrice = record.open; // Slippage on gap down
                } else if (record.low <= currentEntry.stoploss) {
                    stoplossHit = true;
                    actualExitPrice = currentEntry.stoploss;
                }
            } else {
                if (record.open >= currentEntry.stoploss) {
                    stoplossHit = true;
                    actualExitPrice = record.open; // Slippage on gap up
                } else if (record.high >= currentEntry.stoploss) {
                    stoplossHit = true;
                    actualExitPrice = currentEntry.stoploss;
                }
            }

            if (stoplossHit) {
                currentEntry.stoploss_touched = true;
            }

            // Calculate losspoint (max adverse excursion)
            if (currentEntry.isLong) {
                currentEntry.losspoint = Math.max(currentEntry.losspoint, Number(currentEntry.entry_price) - Number(record.low));
            } else {
                currentEntry.losspoint = Math.max(currentEntry.losspoint, Number(record.high) - Number(currentEntry.entry_price));
            }

            // Update maxpoint capture (max favorable excursion in R-multiples)
            if (!currentEntry.stoploss_touched) {
                const risk = Math.abs(Number(currentEntry.entry_price) - Number(currentEntry.stoploss));
                if (risk > 0) {
                    if (currentEntry.isLong) {
                        currentEntry.maxpoint = Math.max(currentEntry.maxpoint, (Number(record.high) - Number(currentEntry.entry_price)) / risk);
                    } else {
                        currentEntry.maxpoint = Math.max(currentEntry.maxpoint, (Number(currentEntry.entry_price) - Number(record.low)) / risk);
                    }
                }
            }

            // Handle partial exit
            if (record.partial_exit === "partial_exit" && !currentEntry.partial_exit_price) {
                currentEntry.partial_exit_price = record.close;
                currentEntry.partial_exit_time = record.datetime || record.time;

                const partialProfit = currentEntry.isLong
                    ? ((record.close - currentEntry.entry_price) / currentEntry.entry_price * 100)
                    : ((currentEntry.entry_price - record.close) / currentEntry.entry_price * 100);
                currentEntry.partial_profit = partialProfit.toFixed(2);
            }

            // Handle stoploss hit - exit immediately
            if (currentEntry.stoploss_touched && !currentEntry.exit_processed) {
                const profit = currentEntry.isLong
                    ? ((actualExitPrice - currentEntry.entry_price) / currentEntry.entry_price * 100)
                    : ((currentEntry.entry_price - actualExitPrice) / currentEntry.entry_price * 100);
                
                const risk_percentage = Math.abs(((currentEntry.entry_price - currentEntry.stoploss) / currentEntry.entry_price) * 100);

                let finalProfit = profit.toFixed(2);
                if (currentEntry.partial_profit) {
                    // Assuming 50% position closed at partial, 50% at stoploss
                    finalProfit = ((Number(currentEntry.partial_profit) + Number(profit)) / 2).toFixed(2);
                }

                trades.push({
                    ...currentEntry,
                    exit_time: record.datetime || record.time,
                    exit_price: actualExitPrice,
                    risk_percentage: risk_percentage.toFixed(2),
                    profit: profit.toFixed(2),
                    avg_profit: finalProfit,
                    exit_reason: 'stoploss'
                });

                currentEntry.exit_processed = true;
                currentEntry = null;
                continue; // Move to next record after exiting
            }

            // Handle standard exit signal
            if (currentEntry && record.exit_signal === "exit" && !currentEntry.exit_processed) {
                const exit_price = record.close; // Exit at the market close of the signal candle
                
                const profit = currentEntry.isLong
                    ? ((exit_price - currentEntry.entry_price) / currentEntry.entry_price * 100)
                    : ((currentEntry.entry_price - exit_price) / currentEntry.entry_price * 100);

                const risk_percentage = Math.abs(((currentEntry.entry_price - currentEntry.stoploss) / currentEntry.entry_price) * 100);

                let finalProfit = profit.toFixed(2);
                if (currentEntry.partial_profit) {
                    finalProfit = ((Number(currentEntry.partial_profit) + Number(profit)) / 2).toFixed(2);
                }

                trades.push({
                    ...currentEntry,
                    exit_time: record.datetime || record.time,
                    exit_price: exit_price,
                    risk_percentage: risk_percentage.toFixed(2),
                    profit: profit.toFixed(2),
                    avg_profit: finalProfit,
                    exit_reason: profit > 0 ? 'target' : 'signal_reversal'
                });

                currentEntry.exit_processed = true;
                currentEntry = null;
            }
        }

        // Handle new entry signal (can happen on the same candle an old position exited)
        if (!currentEntry && record.new_signal && ["Smart Buy", "Buy", "Smart Sell"].includes(record.new_signal)) {
            currentEntry = {
                entry_time: record.datetime || record.time,
                entry_price: record.close,
                supertrend: record.supertrend,
                stoploss: record.stoploss,
                rsi: record.rsi,
                session: record.session,
                open: record.open,
                high: record.high,
                low: record.low,
                close: record.close,
                volume: record.volume,
                atr: record.atr,
                ema8: record.ema8,
                ema13: record.ema13,
                ema200: record.ema200,
                sma13: record.sma13,
                adx: record.adx,
                isHCandleRanging: record.isCandleRanging,
                h1_highest: record.highest,
                h1_lowest: record.lowest,
                volatility: record.volatility,
                losspoint: 0,
                maxpoint: 0,
                stoploss_touched: false,
                isLong: record.new_signal.includes("Buy"),
                exit_processed: false
            };
        }
    }

    return trades;
}

module.exports = { convertOHLCVtoArray, formatTimestamp, convertOHLCVtoHeikinAshi, calculateProfitPercentage, calcLinRegCandle, calcSmoothedHeikinAshi, generateTradeReport };