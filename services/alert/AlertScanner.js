const config = require('./AlertConfig');
const indicators = require('../strategy/indicators/indicators');

class AlertScanner {

    /**
     * Run all configured scans for the given timeframe.
     * @param {string} symbol - e.g. 'BTCUSDT'
     * @param {string} timeframe - e.g. '15m', '1h', '4h', '1d'
     * @param {Object} candles - formatted OHLCV array data {open:[], high:[], low:[], close:[], volume:[], time:[]}
     * @returns {Array} Array of alert objects
     */
    static scan(symbol, timeframe, candles) {
        const tfConfig = config.timeframes[timeframe];
        if (!tfConfig) return [];

        let alerts = [];
        const { open, high, low, close, volume, time } = candles;

        // Ensure we have enough data
        if (close.length < config.params.ema.slow) return alerts;

        const lastIdx = close.length - 1;
        const currentClose = close[lastIdx];
        const currentTime = time[lastIdx];
        const prevClose = close[lastIdx - 1];

        // 1. RSI Alerts
        if (tfConfig.rsiOversoldOverbought) {
            const rsiArr = indicators.calculateRSI(close, config.params.rsi.period);
            const currentRsi = rsiArr[lastIdx];
            const prevRsi = rsiArr[lastIdx - 1];

            if (currentRsi >= config.params.rsi.overbought && prevRsi < config.params.rsi.overbought) {
                alerts.push({ type: 'RSI_OVERBOUGHT', message: `🔴 RSI crossed above ${config.params.rsi.overbought} (${currentRsi.toFixed(1)})` });
            } else if (currentRsi <= config.params.rsi.oversold && prevRsi > config.params.rsi.oversold) {
                alerts.push({ type: 'RSI_OVERSOLD', message: `🟢 RSI crossed below ${config.params.rsi.oversold} (${currentRsi.toFixed(1)})` });
            }
        }

        // 2. Volume Spike / Volatility
        if (tfConfig.volumeSpike) {
            const volSma = indicators.calculateSMA(volume, config.params.volume.smaPeriod);
            const currentVolSma = volSma[lastIdx - 1]; // SMA before this candle
            if (volume[lastIdx] > currentVolSma * config.params.volume.spikeMultiplier) {
                alerts.push({ type: 'VOLUME_SPIKE', message: `🚀 Unusually high volume detected! (${(volume[lastIdx] / currentVolSma).toFixed(1)}x average)` });
            }
            // Bollinger Band Expansion (Volatility Spike)
            const bb = indicators.calculateBollingerBands(close, 20, 2);
            const bbWidth = (bb.upperBand[lastIdx] - bb.lowerBand[lastIdx]) / bb.middleBand[lastIdx];
            const prevBbWidth = (bb.upperBand[lastIdx - 1] - bb.lowerBand[lastIdx - 1]) / bb.middleBand[lastIdx - 1];
            if (bbWidth > prevBbWidth * 1.5) { // 50% expansion
                alerts.push({ type: 'VOLATILITY_SPIKE', message: `💥 Bollinger Bands expanding rapidly (Volatility Spike)` });
            }
        }

        // 3. Fair Value Gap (FVG)
        if (tfConfig.fvg) {
            // FVG is a 3 candle pattern. Check the most recently closed pattern (idx-1, idx-2, idx-3)
            const p1H = high[lastIdx - 3], p1L = low[lastIdx - 3];
            const p2H = high[lastIdx - 2], p2L = low[lastIdx - 2];
            const p3H = high[lastIdx - 1], p3L = low[lastIdx - 1];

            // Bullish FVG: low of candle 3 is higher than high of candle 1
            if (p3L > p1H) {
                const gapPct = ((p3L - p1H) / p1H) * 100;
                if (gapPct >= config.params.fvg.minGapPct) {
                    alerts.push({ type: 'FVG_BULLISH', message: `🟩 Bullish FVG formed between $${p1H.toFixed(2)} and $${p3L.toFixed(2)}` });
                }
            }
            // Bearish FVG: high of candle 3 is lower than low of candle 1
            if (p3H < p1L) {
                const gapPct = ((p1L - p3H) / p3H) * 100;
                if (gapPct >= config.params.fvg.minGapPct) {
                    alerts.push({ type: 'FVG_BEARISH', message: `🟥 Bearish FVG formed between $${p3H.toFixed(2)} and $${p1L.toFixed(2)}` });
                }
            }
        }

        // 4. EMA Crossover
        if (tfConfig.emaCross) {
            const emaFast = indicators.calculateEMA(close, config.params.ema.fast);
            const emaSlow = indicators.calculateEMA(close, config.params.ema.slow);

            const fastCurrent = emaFast[lastIdx], slowCurrent = emaSlow[lastIdx];
            const fastPrev = emaFast[lastIdx - 1], slowPrev = emaSlow[lastIdx - 1];

            if (fastCurrent > slowCurrent && fastPrev <= slowPrev) {
                alerts.push({ type: 'EMA_CROSS_UP', message: `📈 EMA ${config.params.ema.fast} crossed ABOVE EMA ${config.params.ema.slow} (Bullish)` });
            } else if (fastCurrent < slowCurrent && fastPrev >= slowPrev) {
                alerts.push({ type: 'EMA_CROSS_DOWN', message: `📉 EMA ${config.params.ema.fast} crossed BELOW EMA ${config.params.ema.slow} (Bearish)` });
            }
        }

        // Swing point calculation (used by S/R, Liquidity Sweeps, Patterns, and Fibs)
        const swings = indicators.detectSwings ? indicators.detectSwings(high, low, config.params.swing.lookback) : { swingHighs: [], swingLows: [] };

        if (swings.swingHighs.length > 0 && swings.swingLows.length > 0) {
            const lastSwingHigh = swings.swingHighs[swings.swingHighs.length - 1];
            const lastSwingLow = swings.swingLows[swings.swingLows.length - 1];

            // 5. Liquidity Sweep (Sweeping recent swing points and rejecting)
            if (tfConfig.liqSweep) {
                // Bullish Sweep: Price dipped below last swing low but closed above it
                if (low[lastIdx] < lastSwingLow.price && close[lastIdx] > lastSwingLow.price) {
                    alerts.push({ type: 'LIQ_SWEEP_BULLISH', message: `🧹 Bullish Liquidity Sweep! Swept lows at $${lastSwingLow.price.toFixed(2)} and rejected.` });
                }
                // Bearish Sweep: Price poked above last swing high but closed below it
                if (high[lastIdx] > lastSwingHigh.price && close[lastIdx] < lastSwingHigh.price) {
                    alerts.push({ type: 'LIQ_SWEEP_BEARISH', message: `🧹 Bearish Liquidity Sweep! Swept highs at $${lastSwingHigh.price.toFixed(2)} and rejected.` });
                }
            }

            // 6. Fibonacci Retracement Levels
            if (tfConfig.fibonacci && swings.swingHighs.length >= 2 && swings.swingLows.length >= 2) {
                // Determine major trend from the last two swings to draw Fibs
                const p1 = swings.swingLows[swings.swingLows.length - 2].price;
                const p2 = swings.swingHighs[swings.swingHighs.length - 1].price;
                const range = Math.abs(p2 - p1);

                // Only alert if price is actively testing the level
                const tolerance = (config.params.fibonacci.tolerancePct / 100) * currentClose;

                config.params.fibonacci.levels.forEach(level => {
                    const fibLvlUp = p1 + (range * level); // Upward retracement
                    const fibLvlDn = p2 - (range * level); // Downward retracement

                    if (Math.abs(low[lastIdx] - fibLvlDn) <= tolerance) {
                        alerts.push({ type: 'FIB_TEST', message: `📏 Price testing bullish ${level} Fibonacci retracement ($${fibLvlDn.toFixed(2)})` });
                    }
                    if (Math.abs(high[lastIdx] - fibLvlUp) <= tolerance) {
                        alerts.push({ type: 'FIB_TEST', message: `📏 Price testing bearish ${level} Fibonacci retracement ($${fibLvlUp.toFixed(2)})` });
                    }
                });
            }

            // 7. S/R Approaching
            // Simple generic check: price is within 0.5% of a major historical swing
            if (tfConfig.supportResistance) {
                const srTolerance = 0.005 * currentClose;
                if (Math.abs(currentClose - lastSwingHigh.price) <= srTolerance && prevClose < currentClose) {
                    alerts.push({ type: 'RESISTANCE_TEST', message: `🧱 Price approaching Major Resistance at $${lastSwingHigh.price.toFixed(2)}` });
                }
                if (Math.abs(currentClose - lastSwingLow.price) <= srTolerance && prevClose > currentClose) {
                    alerts.push({ type: 'SUPPORT_TEST', message: `🧱 Price approaching Major Support at $${lastSwingLow.price.toFixed(2)}` });
                }
            }
        }

        // 8. Daily Breakout (Day High / Day Low)
        if (tfConfig.dailyBreakout && timeframe === '15m' && time.length > 96) {
            // Get previous day's high/low (approx 96 15m candles)
            const prevDayCandles = {
                high: high.slice(lastIdx - 96, lastIdx),
                low: low.slice(lastIdx - 96, lastIdx)
            };
            const dailyHigh = Math.max(...prevDayCandles.high);
            const dailyLow = Math.min(...prevDayCandles.low);

            if (currentClose > dailyHigh && prevClose <= dailyHigh) {
                alerts.push({ type: 'DAILY_BREAKOUT_UP', message: `☀️ Daily High Breakout! Passed $${dailyHigh.toFixed(2)}` });
            }
            if (currentClose < dailyLow && prevClose >= dailyLow) {
                alerts.push({ type: 'DAILY_BREAKOUT_DOWN', message: `🌑 Daily Low Breakdown! Fell below $${dailyLow.toFixed(2)}` });
            }
        }

        return alerts.map(a => ({ ...a, symbol, timeframe, price: currentClose, time: currentTime }));
    }
}

module.exports = AlertScanner;
