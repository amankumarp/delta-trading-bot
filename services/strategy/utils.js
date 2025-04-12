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

function convertOHLCVtoHeikinAshi(ohlcv) {
  const ha = [];
  for (let i = 0; i < ohlcv.length; i++) {
    const currentCandle = ohlcv[i];
    const haOpen = i=== 0 ? currentCandle.open : (ha[i - 1].open + ha[i - 1].close) / 2;
    const haClose = (currentCandle.open + currentCandle.high + currentCandle.low + currentCandle.close) / 4;
    const haCandle = {
      time: currentCandle.time,
      open: haOpen,
      close: haClose,
      high: Math.max(currentCandle.high,haOpen, haClose),
      low: Math.min(currentCandle.low, haOpen, haClose),
      volume: currentCandle.volume
    };
  
    ha.push(haCandle);
  }

  return convertOHLCVtoArray(ha);
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

module.exports = { convertOHLCVtoArray,formatTimestamp, convertOHLCVtoHeikinAshi, calculateProfitPercentage};