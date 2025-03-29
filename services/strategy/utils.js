// Description: This file contains the utility functions for the strategy service.

/* convert object ohlcv to object with arrays of high, low, close, open, volume, and time
 * @param {Array} ohlcv - Array of OHLCV data (open, high, low, close, volume).
 * @returns {Object} - Object with arrays of high, low, close, open, volume, and time.
 */
function convertOHLCVtoArray(ohlcv) {
  const high = ohlcv.map((candle) => candle.high);
  const low = ohlcv.map((candle) => candle.low);
  const close = ohlcv.map((candle) => candle.close);
  const open = ohlcv.map((candle) => candle.open);
  const volume = ohlcv.map((candle) => candle.volume);
  const time = ohlcv.map((candle) => candle.time);
  return { high, low, close, open, volume, time };
}

function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString('en-GB', { 
      timeZone: 'Asia/Kolkata', 
      hour12: false 
  });
}



module.exports = { convertOHLCVtoArray,formatTimestamp };