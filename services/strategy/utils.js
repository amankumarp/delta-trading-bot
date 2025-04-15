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