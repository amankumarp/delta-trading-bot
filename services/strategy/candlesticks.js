function calculateCandleRange(candle) {
  return Math.abs(candle.high - candle.low);
}

function calculateCandleBodySize(candle) {
  return Math.abs(candle.close - candle.open);
}

function calculateCandleUpperShadow(candle) {
  return candle.high - Math.max(candle.open, candle.close);
}

function calculateCandleLowerShadow(candle) {
  return Math.min(candle.open, candle.close) - candle.low;
}

function isBullishRejectionCandle(candle) {
  const bodySize = calculateCandleBodySize(candle);
  const upperShadow = calculateCandleUpperShadow(candle);
  const lowerShadow = calculateCandleLowerShadow(candle);

  return  bodySize < lowerShadow;
}

function isBearishRejectionCandle(candle) {
  const bodySize = calculateCandleBodySize(candle);
  const upperShadow = calculateCandleUpperShadow(candle);
  const lowerShadow = calculateCandleLowerShadow(candle);

  return bodySize < upperShadow;
}

function isDoji(candle) {
  const bodySize = calculateCandleBodySize(candle);
  return bodySize < 0.1;
}
  

function isBigCandle(candle, threshold) {
  return calculateCandleRange(candle) > threshold;
} 



module.exports = {
  calculateCandleRange,
  calculateCandleBodySize,
  calculateCandleUpperShadow,
  calculateCandleLowerShadow,
  isBullishRejectionCandle,
  isBigCandle,
};