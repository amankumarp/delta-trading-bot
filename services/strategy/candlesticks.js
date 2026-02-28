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

function isBullishEngulfing(candle1, candle2) {
  return (candle1.close < candle1.open) && 
         (candle2.close > candle2.open) &&
         (candle2.close > candle1.open) &&
         (candle2.open < candle1.close);
}

function isBearishEngulfing(candle1, candle2) {
  return (candle1.close > candle1.open) && 
         (candle2.close < candle2.open) &&
         (candle2.open > candle1.close) &&
         (candle2.close < candle1.open);
}

function isRedGreen(previousCandle, currentCandle) {
  return (previousCandle.close < previousCandle.open) && 
         (currentCandle.close > currentCandle.open);
}

function isGreenRed(previousCandle, currentCandle) {
  return (previousCandle.close > previousCandle.open) && 
         (currentCandle.close < currentCandle.open);
}

function isCandleBullish(candle) {  
  return candle.close > candle.open;
}

function isCandleBearish(candle) {  
  return candle.open > candle.close;
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
  isBearishRejectionCandle,
  isDoji,
  isCandleBullish,
  isCandleBearish,
  isBullishEngulfing,
  isBearishEngulfing,
  isRedGreen,
  isGreenRed,
  isBigCandle,
};