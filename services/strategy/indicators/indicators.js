const math = require('mathjs');

/**
 * 📌 Calculate Simple Moving Average (SMA)
 * @param {number[]} prices - Array of prices
 * @param {number} period - SMA period
 * @returns {number[]} - SMA values
 */
function calculateSMA(prices, period) {
    return prices.map((_, i, arr) => {
        if (i < period - 1) return null;
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += arr[j];
        }
        return sum / period;
    });
}

/**
 * 📌 Calculate Exponential Moving Average (EMA)
 * @param {number[]} prices - Array of prices
 * @param {number} period - EMA period
 * @returns {number[]} - EMA values
 */
function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}

/**
 * 📌 Calculate Smoothed Moving Average (SMMA)
 * @param {number[]} prices - Array of prices
 * @param {number} period - SMMA period
 * @returns {number[]} - SMMA values
 */
function calculateSMMA(prices, period) {
    let initialSum = 0;
    for(let j=0; j<period; j++) initialSum += prices[j];
    let smma = [initialSum / period];

    for (let i = period; i < prices.length; i++) {
        smma.push((smma[smma.length - 1] * (period - 1) + prices[i]) / period);
    }
    return smma;
}

/**
 * 📌 Calculate Moving Average Convergence Divergence (MACD)
 * @param {number[]} prices - Array of prices
 * @param {number} shortPeriod - Fast EMA period
 * @param {number} longPeriod - Slow EMA period
 * @param {number} signalPeriod - Signal line EMA period
 * @returns {Object} - { macdLine, signalLine, histogram }
 */
function calculateMACD(prices, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const shortEMA = calculateEMA(prices, shortPeriod);
    const longEMA = calculateEMA(prices, longPeriod);
    const macdLine = shortEMA.map((value, i) => value - longEMA[i]);
    const signalLine = calculateEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((value, i) => value - signalLine[i]);

    return { macdLine, signalLine, histogram };
}

/**
 * 📌 Calculate Average True Range (ATR)
 * @param {number[]} highs - Array of high prices
 * @param {number[]} lows - Array of low prices
 * @param {number[]} closes - Array of close prices
 * @param {number} period - ATR period
 * @returns {number[]} - ATR values
 */
function calculateATR(highs, lows, closes, period) {
    let tr = highs.map((high, i) => {
        if (i === 0) return high - lows[i];
        return Math.max(high - lows[i], Math.abs(high - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    });

    return calculateSMA(tr, period);
}

/**
 * 📌 Calculate Average Directional Index (ADX) with +DI and -DI
 * Uses Wilder's smoothing (RMA) for proper directional movement calculation.
 * @param {number[]} highs - Array of high prices
 * @param {number[]} lows - Array of low prices
 * @param {number[]} closes - Array of close prices
 * @param {number} period - ADX period (default 14)
 * @returns {{ adx: number[], plusDI: number[], minusDI: number[] }}
 */
function calculateADX(highs, lows, closes, period = 14) {
    const len = highs.length;
    const adx = new Array(len).fill(null);
    const plusDI = new Array(len).fill(null);
    const minusDI = new Array(len).fill(null);

    if (len < period + 1) return { adx, plusDI, minusDI };

    // Step 1: Calculate raw +DM, -DM, and TR for each bar
    const rawPlusDM = new Array(len).fill(0);
    const rawMinusDM = new Array(len).fill(0);
    const rawTR = new Array(len).fill(0);

    for (let i = 1; i < len; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        rawPlusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
        rawMinusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
        rawTR[i] = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
    }

    // Step 2: Initial smoothed sums over the first `period` bars (Wilder's method)
    let smoothPlusDM = 0;
    let smoothMinusDM = 0;
    let smoothTR = 0;
    for (let i = 1; i <= period; i++) {
        smoothPlusDM += rawPlusDM[i];
        smoothMinusDM += rawMinusDM[i];
        smoothTR += rawTR[i];
    }

    // Step 3: Calculate +DI, -DI from bar `period` onward using Wilder's smoothing
    const calcDI = (smoothDM, smoothTR) => smoothTR === 0 ? 0 : (smoothDM / smoothTR) * 100;
    
    plusDI[period] = calcDI(smoothPlusDM, smoothTR);
    minusDI[period] = calcDI(smoothMinusDM, smoothTR);

    let dxSum = 0;
    const dxArr = new Array(len).fill(null);
    const sumDI = plusDI[period] + minusDI[period];
    dxArr[period] = sumDI === 0 ? 0 : (Math.abs(plusDI[period] - minusDI[period]) / sumDI) * 100;
    dxSum += dxArr[period];

    for (let i = period + 1; i < len; i++) {
        // Wilder's smoothing: prev - (prev / period) + current
        smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + rawPlusDM[i];
        smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + rawMinusDM[i];
        smoothTR = smoothTR - (smoothTR / period) + rawTR[i];

        plusDI[i] = calcDI(smoothPlusDM, smoothTR);
        minusDI[i] = calcDI(smoothMinusDM, smoothTR);

        const di_sum = plusDI[i] + minusDI[i];
        dxArr[i] = di_sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / di_sum) * 100;

        if (i < period * 2) {
            dxSum += dxArr[i];
        }
    }

    // Step 4: First ADX is the SMA of the first `period` DX values
    if (len > period * 2) {
        adx[period * 2 - 1] = dxSum / period;

        // Subsequent ADX values use Wilder's smoothing
        for (let i = period * 2; i < len; i++) {
            adx[i] = ((adx[i - 1] * (period - 1)) + dxArr[i]) / period;
        }
    }

    return { adx, plusDI, minusDI };
}

/**
 * Calculates the Relative Strength Index (RSI)
 * @param {number[]} prices - Array of closing prices.
 * @param {number} period - Lookback period (default is 14).
 * @returns {number[]} - RSI values.
 */
function calculateRSI(prices, period = 14) {
    let rsi = [];
    let gains = [];
    let losses = [];

    // Calculate initial gains & losses
    for (let i = 1; i < prices.length; i++) {
        let change = prices[i] - prices[i - 1];
        gains.push(Math.max(change, 0)); // Positive changes
        losses.push(Math.abs(Math.min(change, 0))); // Negative changes
    }

    // Calculate initial average gain & loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Compute RSI values
    for (let i = 0; i < prices.length; i++) {
        if (i < period) {
            rsi.push(null); // Not enough data for RSI calculation
        } else {
            let currentGain = gains[i - 1];
            let currentLoss = losses[i - 1];

            // Smoothed moving average (Wilder’s formula)
            avgGain = ((avgGain * (period - 1)) + currentGain) / period;
            avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

            let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            let rsiValue = 100 - (100 / (1 + rs));
            rsi.push(rsiValue);
        }
    }

    return rsi;
}


/**
 * 📌 Standard Deviation (Volatility Indicator)
 * @param {number[]} prices - Array of prices
 * @param {number} period - Period for standard deviation
 * @returns {number[]} - Standard deviation values
 */
function calculateStdDev(prices, period) {
    return prices.map((_, i, arr) => {
        if (i < period - 1) return null;
        const slice = arr.slice(i - period + 1, i + 1);
        if (slice.some(v => v === null || v === undefined || Number.isNaN(v))) return null;
        if (slice.length < 2) return 0;
        const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (slice.length - 1);
        return Math.sqrt(variance);
    });
}

/**
 * 📌 Momentum Indicator (Measures Speed of Price)
 * @param {number[]} prices - Array of prices
 * @param {number} period - Momentum period
 * @returns {number[]} - Momentum values
 */
function calculateMomentum(prices, period) {
    return prices.map((_, i) => (i < period ? null : prices[i] - prices[i - period]));
}

/**
 * 📌 Bollinger Bands (Volatility Bands)
 * @param {number[]} prices - Array of prices
 * @param {number} period - SMA period for middle band
 * @param {number} stdMultiplier - Standard deviation multiplier
 * @returns {Object} - { upperBand, middleBand, lowerBand }
 */
function calculateBollingerBands(prices, period, stdMultiplier) {
    let sma = calculateSMA(prices, period);
    let stdDev = calculateStdDev(prices, period);

    let upperBand = sma.map((smaVal, i) => (smaVal && stdDev[i] ? smaVal + stdMultiplier * stdDev[i] : null));
    let lowerBand = sma.map((smaVal, i) => (smaVal && stdDev[i] ? smaVal - stdMultiplier * stdDev[i] : null));

    return { upperBand, middleBand: sma, lowerBand };
}

/**
 * 📌 Pivot Points (Support & Resistance Levels)
 * @param {number[]} highs - Array of high prices
 * @param {number[]} lows - Array of low prices
 * @param {number[]} closes - Array of close prices
 * @returns {Object} - { pivot, support1, support2, support3, resistance1, resistance2, resistance3 }
 */
function calculatePivotPoints(highs, lows, closes) {
    let pivot = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
    let support1 = 2 * pivot - highs[highs.length - 1];
    let support2 = pivot - (highs[highs.length - 1] - lows[lows.length - 1]);
    let support3 = lows[lows.length - 1] - 2 * (highs[highs.length - 1] - pivot);
    let resistance1 = 2 * pivot - lows[lows.length - 1];
    let resistance2 = pivot + (highs[highs.length - 1] - lows[lows.length - 1]);
    let resistance3 = highs[highs.length - 1] + 2 * (pivot - lows[lows.length - 1]);

    return { pivot, support1, support2, support3, resistance1, resistance2, resistance3 };
}

/**
 * 📌 Accumulation/Distribution Line (Volume & Price Flow)
 * @param {number[]} highs - Array of high prices
 * @param {number[]} lows - Array of low prices
 * @param {number[]} closes - Array of close prices
 * @param {number[]} volumes - Array of volumes
 * @returns {number[]} - ADL values
 */
function calculateADL(highs, lows, closes, volumes) {
    let adl = [0];

    for (let i = 1; i < closes.length; i++) {
        let moneyFlowMultiplier = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / (highs[i] - lows[i]);
        let moneyFlowVolume = moneyFlowMultiplier * volumes[i];
        adl.push(adl[i - 1] + moneyFlowVolume);
    }

    return adl;
}

/**
 * 📌 Chaikin Money Flow (CMF) Indicator
 * @param {number[]} highs - High prices
 * @param {number[]} lows - Low prices
 * @param {number[]} closes - Close prices
 * @param {number[]} volumes - Volume data
 * @param {number} period - CMF period
 * @returns {number[]} - CMF values
 */
function calculateCMF(highs, lows, closes, volumes, period) {
    let adl = calculateADL(highs, lows, closes, volumes);
    return adl.map((_, i) => (i < period - 1 ? null : math.sum(adl.slice(i - period + 1, i + 1)) / math.sum(volumes.slice(i - period + 1, i + 1))));
}

/**
 * 📌 Stochastic Oscillator (Momentum-Based Indicator)
 * @param {number[]} highs - High prices
 * @param {number[]} lows - Low prices
 * @param {number[]} closes - Close prices
 * @param {number} period - Stochastic period
 * @returns {number[]} - %K values
 */
function calculateStochastic(highs, lows, closes, period) {
    return closes.map((_, i) => {
        if (i < period - 1) return null;
        let highestHigh = math.max(highs.slice(i - period + 1, i + 1));
        let lowestLow = math.min(lows.slice(i - period + 1, i + 1));
        return ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
    });
}

/**
 * Calculate the Supertrend Indicator.
 * @param {Array} ohlcv - Array of OHLCV data (open, high, low, close, volume).
 * @param {number} period - ATR period.
 * @param {number} multiplier - Multiplier for the ATR.
 * @returns {Array} - Array of Supertrend values with buy/sell signals.
 */

function calculateSupertrend(high, low, close, period = 10, multiplier = 3) {
    const atr = calculateATR(high, low, close, period); // Ensure ATR is correctly calculated
    const supertrend = [];
    const trend = [];
    const finalUpperBand = [];
    const finalLowerBand = [];
   
    for (let i = 0; i < close.length; i++) {
        if (i < period) {
            supertrend.push(null);
            trend.push(null);
            finalUpperBand.push(null);
            finalLowerBand.push(null);
            continue;
        }

        const currentATR = atr[i];
        const basicUpperBand = (high[i] + low[i]) / 2 + multiplier * currentATR;
        const basicLowerBand = (high[i] + low[i]) / 2 - multiplier * currentATR;
       
        // Get previous values (handling first values)
        const prevFinalUpperBand = i > 0 ? finalUpperBand[i - 1] : basicUpperBand;
        const prevFinalLowerBand = i > 0 ? finalLowerBand[i - 1] : basicLowerBand;
        const prevClose = i > 0 ? close[i - 1] : close[i];

        // Calculate Final Upper & Lower Bands
        finalUpperBand[i] = (basicUpperBand < prevFinalUpperBand || prevClose > prevFinalUpperBand) 
            ? basicUpperBand 
            : prevFinalUpperBand;

        finalLowerBand[i] = (basicLowerBand > prevFinalLowerBand || prevClose < prevFinalLowerBand) 
            ? basicLowerBand 
            : prevFinalLowerBand;

        // Determine Trend
        if (i > period) {
            if (finalUpperBand[i] < close[i]) {
                trend[i] = 1; // Uptrend
            } else if (finalLowerBand[i] > close[i]) {
                trend[i] = -1; // Downtrend
            } else {
                trend[i] = trend[i - 1]; // No change in trend
            }
        } else {
            trend[i] = 1; // Default trend to uptrend
        }
       
        // Assign Supertrend value based on trend
        supertrend[i] = trend[i] === 1 ? finalLowerBand[i] : finalUpperBand[i];
    }
   

    return { supertrend, trend };
}

function calculateBarsSince(conditionArray) {
    let barsSince = [];
    let lastTrueIndex = -1;

    for (let i = 0; i < conditionArray.length; i++) {
        if (conditionArray[i]) {
            lastTrueIndex = i;
            barsSince.push(0);
        } else {
            barsSince.push(lastTrueIndex === -1 ? null : i - lastTrueIndex);
        }
    }

    return barsSince;
}

/**
 * Calculates the lowest value in a given lookback period.
 * @param {number[]} values - Array of values (e.g., lows, closes).
 * @param {number} period - Lookback period.
 * @returns {number[]} - Array of lowest values over the period.
 */
function calculateLowest(values, period) {
    let lowest = [];

    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            lowest.push(null); // Not enough data
        } else {
            lowest.push(Math.min(...values.slice(i - period + 1, i + 1)));
        }
    }

    return lowest;
}

/**
 * Calculates the highest value in a given lookback period.
 * @param {number[]} values - Array of values (e.g., highs, closes).
 * @param {number} period - Lookback period.
 * @returns {number[]} - Array of highest values over the period.
 */
function calculateHighest(values, period) {
    let highest = [];

    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            highest.push(null); // Not enough data
        } else {
            highest.push(Math.max(...values.slice(i - period + 1, i + 1)));
        }
    }

    return highest;
}

/**
 * Calculates Volatility based on ATR, standard deviation, and SMA.
 * @param {number[]} prices - Array of closing prices.
 * @param {number} atrPeriod - ATR period (default: 10).
 * @param {number} stdDevPeriod - Standard Deviation period (default: 20).
 * @returns {object} - { percentVol, volatilityStatus }
 */
function calculateVolatility(highs,lows,closes, atrPeriod = 10, stdDevPeriod = 20) {
    if (closes.length < stdDevPeriod) return null; // Not enough data

    // Step 1: Calculate ATR
    const atr = calculateATR(highs,lows,closes, atrPeriod).map(val => val * 3); // Multiply by 3

    // Step 2: Calculate Standard Deviation & SMA of ATR
    const stdAtr = calculateStdDev(atr , stdDevPeriod); // Last 20 ATR values
    const smaAtr = calculateSMA(atr, stdDevPeriod);

    return closes.map((_,i)=>{
        const topAtrDev = smaAtr[i] + stdAtr[i] * 2;
        const bottomAtrDev = smaAtr[i] - stdAtr[i] * 2;

        const latestAtr = atr[i - 1];
        const calcDev = (latestAtr - bottomAtrDev) / (topAtrDev - bottomAtrDev);
        const percentVol = 40 * calcDev + 30;

        let volatilityStatus;
        if (percentVol < 35) volatilityStatus = "Very Low";
        else if (percentVol < 50) volatilityStatus = "Low";
        else if (percentVol < 70) volatilityStatus = "High";
        else volatilityStatus = "Very High";
    
        return { percentVol, volatilityStatus };
    }) 
}

function calculateJurikVolatility(prices, lengthJurik = 14, smoothJurik = 2) {
    if (prices.length < lengthJurik) {
        throw new Error("Not enough data to calculate Jurik Volatility Bands");
    }

    let bsJurikmax = NaN;
    let bsJurikmin = NaN;
    let upValues = [];
    let dnValues = [];
    let miValues = [];
    let priceJurikArr = [];

    for (let i = 0; i < prices.length; i++) {
        let vpriceJurik = prices[i];
        let hpriceJurik = Math.max(...prices.slice(Math.max(0, i - lengthJurik + 1), i + 1));
        let lpriceJurik = Math.min(...prices.slice(Math.max(0, i - lengthJurik + 1), i + 1));

        let delJurik1 = hpriceJurik - (isNaN(bsJurikmax) ? hpriceJurik : bsJurikmax);
        let delJurik2 = lpriceJurik - (isNaN(bsJurikmin) ? lpriceJurik : bsJurikmin);

        let lenJurik = Math.sqrt(0.5 * (lengthJurik - 1)) * 1;
        let k = Math.exp(Math.sqrt(1) * Math.log(lenJurik / (lenJurik + 1)));

        if (delJurik1 > 0) {
            bsJurikmax = hpriceJurik;
        } else {
            bsJurikmax = hpriceJurik - k * delJurik1;
        }

        if (delJurik2 < 0) {
            bsJurikmin = lpriceJurik;
        } else {
            bsJurikmin = lpriceJurik - k * delJurik2;
        }

        let dnValueJurik = bsJurikmin;
        let upValueJurik = bsJurikmax;
        let miValueJurik = (upValueJurik + dnValueJurik) / 2.0;
        
        let upValueJuriks = (upValueJurik - miValueJurik) / smoothJurik;
        let dnValueJuriks = (dnValueJurik - miValueJurik) / smoothJurik;
        let priceJurik = (vpriceJurik - miValueJurik) / smoothJurik;

        upValues.push(upValueJuriks);
        dnValues.push(dnValueJuriks);
        miValues.push(miValueJurik);
        priceJurikArr.push(priceJurik);
    }

    return { upValues, dnValues, miValues, priceJurikArr };
}

function calculateSessions(timeArray) {
    const detectSession = (timestamp) =>{
        const date = new Date(timestamp * 1000);
        const utcHour = date.getUTCHours();
        const utcMinute = date.getUTCMinutes();
        const totalMinutes = utcHour * 60 + utcMinute;
    
        const inRange = (min, max) => totalMinutes >= min && totalMinutes < max;
    
        const TOKYO_START = 0 * 60 + 0;    // 00:00 UTC
        const TOKYO_END   = 5 * 60 + 55;   // 05:55 UTC
    
        const LONDON_START = 7 * 60 + 30;  // 07:30 UTC
        const LONDON_END   = 15 * 60 + 25; // 15:25 UTC
    
        const NY_START = 13 * 60 + 30;     // 13:30 UTC
        const NY_END   = 19 * 60 + 55;     // 19:55 UTC
    
        const inTokyo = inRange(TOKYO_START, TOKYO_END);
        const inLondon = inRange(LONDON_START, LONDON_END);
        const inNY = inRange(NY_START, NY_END);
        const inOverlap = inLondon && inNY;
    
        if (inOverlap) return "London–New York Overlap";
        if (inTokyo) return "Tokyo Session";
        if (inLondon) return "London Session";
        if (inNY) return "New York Session";
        return "Outside Major Sessions";
    }
    
    return timeArray.map(detectSession);
}

function calculateARSI(close, length = 14, highlightMovements = true) {
    const arsi = [];
    const alphaArr = [];
    let prevArsi = 0;

    for (let i = 0; i < close.length; i++) {
        const currentPrice = close[i];

        // Calculate RSI (for alpha)
        const rsi = calculateRSI(close.slice(0, i + 1), length);
      
        const alpha = 2 * Math.abs((rsi[i] / 100) - 0.5);
        alphaArr.push(alpha);

        const currentArsi = alpha * currentPrice + (1 - alpha) * (arsi[i - 1] ?? currentPrice);
        arsi.push(currentArsi);
    }


    return  arsi;
}

function calculateUtBotAlerts( high, low, close, sensitivity = 1, atrPeriod = 10) {
    const result = [{
        index: 0,
        buy:false,
        sell:false,
        pos: 0,
        trailingStop: 0,
    }];
    const atr = calculateATR(high, low, close, atrPeriod);
    const trailingStop = [0];
    const ema = calculateEMA(close, 1);
    let pos = [0];

    for (let i = 1; i < close.length; i++) {
        const src = close[i];
        const srcPrev = close[i - 1];
        const atrValue = atr[i];
        const nLoss = sensitivity * Number(atrValue);
        const prevStop = trailingStop[i - 1] ?? 0;
     
        let iff_1 = src > prevStop ? src - nLoss : src + nLoss;
        let iff_2 = src < prevStop && srcPrev < prevStop ? Math.min(prevStop, src + nLoss) : iff_1;
        let xATRTrailingStop = src > prevStop && srcPrev > prevStop ? Math.max(prevStop, src - nLoss) : iff_2;
        
        trailingStop.push(xATRTrailingStop);

        let prevPos = pos[i - 1] ?? 0;
     
        let iff_3 = srcPrev > prevStop && src < prevStop ? -1 : prevPos;
        let currPos = srcPrev < prevStop && src > prevStop ? 1 : iff_3;
        pos.push(currPos);

        const above = ema[i - 1] <= prevStop && ema[i] > xATRTrailingStop;
        const below = ema[i - 1] >= prevStop && ema[i] < xATRTrailingStop;
        
        const buy = src > xATRTrailingStop && above;
        const sell = src < xATRTrailingStop && below;
        // console.log('candle', open[i], high[i], low[i], close[i], buy, sell, formatTimestamp(time[i]));
     
        result.push({
            index: i,
            buy,
            sell,
            pos: currPos,
            trailingStop: xATRTrailingStop,
        });
    }

    return result;
}

function calculateHFTCandles({ open, high, low, close, volume, timestamp },  intervalMinutes, targetMinutes, offsetMinutes = 0) {
  const intervalSec = intervalMinutes * 60;
  const targetSec = targetMinutes * 60;
  const groupSize = targetSec / intervalSec;
  const offsetSec = offsetMinutes * 60;

  // Align timestamp based on target interval and offset
  function alignTimestamp(ts) {
    return Math.floor((ts - offsetSec) / targetSec) * targetSec + offsetSec;
  }

  const grouped = {};

  // Group candles based on aligned timestamp
   for (let i = 0; i < timestamp.length; i++) {
        const alignedTs = alignTimestamp(timestamp[i]);
        if (!grouped[alignedTs]) grouped[alignedTs] = [];

        grouped[alignedTs].push({
            open: open[i],
            high: high[i],
            low: low[i],
            close: close[i],
            volume: volume[i],
            timestamp: timestamp[i],
        });
  }

  // Aggregate each group
 const result = {
    timestamp: [],
    open: [],
    high: [],
    low: [],
    close: [],
    volume: [],
  };

   // Aggregate
  for (const groupKey in grouped) {
    const group = grouped[groupKey];
    if (group.length < groupSize) continue;

    result.timestamp.push(Number(groupKey));
    result.open.push(group[0].open);
    result.high.push(Math.max(...group.map(c => c.high)));
    result.low.push(Math.min(...group.map(c => c.low)));
    result.close.push(group[group.length - 1].close);
    result.volume.push(group.reduce((sum, c) => sum + c.volume, 0));
  }
   

  return result;
}

// Function to check if the market is sideways
function isCandleRanging(candles, rangeThresholdPercent = 0.7, closeRangePercent = 0.5) {
    
    const highest = Math.max(...candles.high);
    const lowest = Math.min(...candles.low);

  // Step 1: Calculate the range for each candle (high - low)
  const ranges = candles.high.map((high, i) => high - candles.low[i]);
  
  // Step 2: Calculate average price to normalize ranges
  const avgPrice = candles.close.reduce((sum, price) => sum + price, 0) / candles.close.length;
  
  // Step 3: Convert ranges to percentage of average price
  const rangePercentages = ranges.map(range => (range / avgPrice) * 100);
  
  // Step 4: Check if all ranges are below the threshold
  const isRangeSmall = rangePercentages.every(range => range <= rangeThresholdPercent);
  
  // Step 5: Calculate the range of closing prices
  const maxClose = Math.max(...candles.close);
  const minClose = Math.min(...candles.close);
  const closeRange = ((maxClose - minClose) / avgPrice) * 100;
  
  // Step 6: Check if closing price range is below the threshold
  const isCloseStable = closeRange <= closeRangePercent;
  
  // Step 7: Return result
  return {
    isSideways: isRangeSmall && isCloseStable,
    ranges: rangePercentages,
    closeRangePercent: closeRange,
    highest,
    lowest
  };
}


function detectSwings(high, low, lookback = 5) {
    const swingHighs = [];
    const swingLows = [];

    for (let i = lookback; i < high.length - lookback; i++) {
        let isHigh = true;
        let isLow = true;

        for (let j = 1; j <= lookback; j++) {
            if (high[i] <= high[i - j] || high[i] <= high[i + j])
                isHigh = false;

            if (low[i] >= low[i - j] || low[i] >= low[i + j])
                isLow = false;
        }

        if (isHigh) swingHighs.push({ index: i, price: high[i] });
        if (isLow) swingLows.push({ index: i, price: low[i] });
    }

    return { swingHighs, swingLows };
}


function buildValidatedTrendline(swings, type = "up") {
    if (swings.length < 3) return null;

    const validTouches = [];
    
    for (let i = 0; i < swings.length - 2; i++) {
        const p1 = swings[i];
        const p2 = swings[i + 1];

        const slope = (p2.price - p1.price) / (p2.index - p1.index);

        // Reject steep slope
        if (Math.abs(slope) > 0.5) continue;

        let touchCount = 2;

        for (let j = i + 2; j < swings.length; j++) {
            const projected = slope * swings[j].index + 
                (p1.price - slope * p1.index);

            const distance = Math.abs(projected - swings[j].price);

            if (distance < swings[j].price * 0.002) { // 0.2% tolerance
                touchCount++;
            }
        }

        if (touchCount >= 3) {
            validTouches.push({
                slope,
                intercept: p1.price - slope * p1.index,
                touchCount
            });
        }
    }

    return validTouches.length ? validTouches[validTouches.length - 1] : null;
}

module.exports = {  
    calculateEMA, 
    calculateATR,
    calculateADX,
    calculateRSI,
    calculateMACD,
    calculateSMA,
    calculateSMMA,
    calculateStdDev,
    calculateMomentum,
    calculateBollingerBands,
    calculatePivotPoints,
    calculateADL,
    calculateStochastic,
    calculateSupertrend,
    calculateBarsSince,
    calculateLowest,
    calculateHighest,
    calculateCMF,
    calculateVolatility,
    calculateSessions,
    calculateJurikVolatility,
    calculateUtBotAlerts,
    calculateARSI,
    calculateHFTCandles,
    isCandleRanging
};