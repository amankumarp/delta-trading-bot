/**
 * Configuration for the Alert Service.
 * Define which alerts are enabled per timeframe for specific assets.
 */
module.exports = {
    enabledAssets: ['BTC_USDT'],

    // Specific alert configurations per timeframe
    timeframes: {
        '15m': {
            rsiOversoldOverbought: true,
            volumeSpike: true,
            fvg: true,
            liqSweep: false,
            supportResistance: false,
            trendline: false,
            fibonacci: false,
            patternDetect: false,
            emaCross: false,
            pullback: false,
        },
        '1h': {
            rsiOversoldOverbought: true,
            volumeSpike: true,
            fvg: true,
            liqSweep: true,
            supportResistance: true,
            trendline: false,
            fibonacci: true,
            patternDetect: true,
            emaCross: true,
            pullback: true,
        },
        '4h': {
            rsiOversoldOverbought: true,
            volumeSpike: true,
            fvg: true,
            liqSweep: true,
            supportResistance: true,
            trendline: true,
            fibonacci: true,
            patternDetect: true,
            emaCross: true,
            pullback: true,
        },
        '1d': {
            rsiOversoldOverbought: true,
            volumeSpike: true,
            fvg: true,
            liqSweep: true,
            supportResistance: true,
            trendline: true,
            fibonacci: true,
            patternDetect: true,
            emaCross: true,
            pullback: true,
            dailyBreakout: true // Special daily alert
        }
    },

    // Alert Thresholds & Parameters
    params: {
        rsi: { overbought: 70, oversold: 30, period: 14 },
        volume: { spikeMultiplier: 2.5, smaPeriod: 20 },
        ema: { fast: 50, slow: 200 },
        fibonacci: { levels: [0.5, 0.618], tolerancePct: 0.2 }, // 0.2% tolerance around fib levels
        swing: { lookback: 5 }, // 5 candles left and right for a swing high/low
        fvg: { minGapPct: 0.1 } // Minimum gap size in percentage
    }
};
