const { formatTimestamp, calculateProfitPercentage, convertOHLCVtoHeikinAshi } = require('./utils');
const { crossDown, crossUp, calculateATR, calculateEMA, calculateSMA, calculateRSI, calculateSupertrend } = require('./indicators/index');
const { calculateJurikVolatility, calculateSessions, calculateVolatility, calculateHFTCandles, isCandleRanging, calculateADX } = require('./indicators/indicators');
const { lowest } = require('technicalindicators');
const BaseStrategy = require('./base/BaseStrategy');

class SupertrendAI extends BaseStrategy {
    constructor() {
        super();
        this.atrLength = 11;
        this.multiplier = 2.5;
        this.atrMultiplier = 1.5; // ATR multiplier for stoploss
        this.usePercentBaseSl = true; // Use percentage based stoploss
        this.riskPercent = 0.85; // 0.85% risk per trade
        this.partialExitThreshold = 2; // 50% profit for partial exit
        this.useHeikinAshiForSignal = false;
        this.ema8 = [];
        this.ema13 = [];
        this.ema200 = [];
        this.sma13 = [];
        this.atr = [];
        this.adx = [];
        this.supertrend = [];
        this.rsi = [];
        this.macd = [];
        this.lowest = [];
        this.highest = [];
        this.trend = [];
        this.activeSignal = null;
    }

    generateSignals(data) {
        const { open, high, low, close, time, volume } = data;


        // Calculate indicators
        if (this.useHeikinAshiForSignal) {
            const ohlcv = { open, high, low, close, time, volume };
            const { haOpen, haHigh, haLow, haClose } = convertOHLCVtoHeikinAshi(high, low, close, open, time);
            this.atr = calculateATR(haHigh, haLow, haClose, this.atrLength);
            this.ema200 = calculateEMA(haClose, 200);
            this.ema8 = calculateEMA(haClose, 8);
            this.ema13 = calculateEMA(haClose, 13);
            this.sma13 = calculateSMA(haClose, 13); // SMA can be approximated with EMA
            this.rsi = calculateRSI(haClose, 14);
            // this.adx = calculateADX(haHigh, haLow, haClose, 14);
            this.sessions = calculateSessions(time);
            this.volatilityMillionMoves = calculateVolatility(haHigh, haLow, haClose);

            // Calculate Supertrend 
            const { supertrend } = calculateSupertrend(haHigh, haLow, haClose, this.atrLength, this.multiplier);
            this.supertrend = supertrend;
        } else {
            this.atr = calculateATR(high, low, close, this.atrLength);
            this.ema200 = calculateEMA(close, 200);
            this.ema8 = calculateEMA(close, 8);
            this.ema13 = calculateEMA(close, 13);
            this.sma13 = calculateSMA(close, 13); // SMA can be approximated with EMA       
            this.rsi = calculateRSI(close, 14);
            // this.adx = calculateADX(high, low, close, 14);
            this.sessions = calculateSessions(time);
            this.volatilityMillionMoves = calculateVolatility(high, low, close);

            // Calculate Supertrend
            const { supertrend } = calculateSupertrend(high, low, close, this.atrLength, this.multiplier);
            this.supertrend = supertrend;
        }
        // Calculate MACD

        // Generate buy/sell signals based on co
        const candles = [];
        const signals = [];
        let startIndex = 16;
        for (let i = startIndex; i < close.length; i++) {
            const h1_candles = calculateHFTCandles({ open: open.slice(i - startIndex, i - 1), high: high.slice(i - startIndex, i - 1), low: low.slice(i - startIndex, i - 1), close: close.slice(i - startIndex, i - 1), timestamp: time.slice(i - startIndex, i - 1), volume: volume.slice(i - startIndex, i - 1) }, 15, 60, 0);
            const candleRange = isCandleRanging({ close: h1_candles.close, high: h1_candles.high, low: h1_candles.low, open: h1_candles.open });

            const isCrossUp = crossUp(close, this.supertrend);
            const isCrossDown = crossDown(close, this.supertrend);
            const emaCrossUp = crossUp(this.ema8, this.ema13);
            const emaCrossDown = crossDown(this.ema8, this.ema13);
            // let stoploss = isCrossUp[i]?candleRange.lowest: candleRange.highest; // Default stoploss based on candle range
            let stoploss = isCrossUp[i] ? high[i] - (this.atr[i] * this.atrMultiplier) : low[i] + (this.atr[i] * this.atrMultiplier);
            stoploss = isCrossUp[i] ? stoploss > low[i] ? stoploss = low[i] : stoploss : stoploss < high[i] ? stoploss = high[i] : stoploss;
            stoploss = isCrossUp[i] ? stoploss > this.supertrend[i] ? stoploss = this.supertrend[i] : stoploss : stoploss < this.supertrend[i] ? stoploss = this.supertrend[i] : stoploss;
            const riskAnalysis = (Math.abs(close[i] - stoploss) / stoploss) * 100; // Calculate risk as percentage of supertrend
            //this.sessions[i] != "Tokyo Session" &&


            let commonCondition = riskAnalysis <= this.riskPercent;//&& new Date(time[i]*1000).getDay() !== 6//&& this.rsi[i] >= 50  && 

            const Cbull = isCrossUp[i] && close[i] >= this.sma13[i] && commonCondition; //&& this.volatility.priceJurikArr[i] > 300 && candleRange.highest <= close[i] && this.sessions[i] != "Tokyo Session";
            const Cbear = isCrossDown[i] && close[i] <= this.sma13[i] && commonCondition;  //&& this.volatility.priceJurikArr[i] < -300//&& candleRange.lowest >= close[i] && this.sessions[i] != "Tokyo Session";
            const bull = Cbull && !(close[i - 1] > this.ema200[i] && close[i] > this.ema200[i])
            const bear = Cbear && !(close[i - 1] > this.ema200[i] && close[i] > this.ema200[i])
            const Sbull = Cbull && (close[i - 1] > this.ema200[i] && close[i] > this.ema200[i])
            const Sbear = Cbear && !(close[i - 1] > this.ema200[i] && close[i] > this.ema200[i])


            // Check active position events
            const candleData = { time: time[i], open: open[i], high: high[i], low: low[i], close: close[i] };
            const tradeEvents = this.tradeManager.update(candleData);

            let partialExit = null;
            let exitSignal = null;
            let profitPct = 0;

            if (this.tradeManager.hasActivePosition()) {
                const pos = this.tradeManager.getActivePosition();
                profitPct = calculateProfitPercentage(pos.isLong, pos.entry_price, close[i]);

                // Manual full exit condition overlaying TP/SL
                const fullExitBull = isCrossDown[i] && pos.isLong;
                const fullExitBear = isCrossUp[i] && !pos.isLong;

                if (fullExitBull || fullExitBear) {
                    const exitEvent = this.tradeManager.closePosition(time[i], close[i], 'exit_signal', candleData);
                    if (exitEvent) tradeEvents.push(exitEvent);
                }
            }

            // Process generated events
            for (const event of tradeEvents) {
                if (event.signal === 'partial_exit') {
                    partialExit = { ...event, date: formatTimestamp(event.time), active: event.position };
                    signals.push(partialExit);
                } else if (event.signal === 'exit') {
                    exitSignal = { ...event, date: formatTimestamp(event.time), active: event.position };
                    signals.push(exitSignal);
                }
            }

            let signal = null;
            // Only generate new signal if no active position
            if (!this.tradeManager.hasActivePosition()) {
                if (Sbull) {
                    signal = { signal: 'Smart Buy', bullish: true };
                } else if (Sbear) {
                    signal = { signal: 'Smart Sell', bullish: false };
                } else if (bull) {
                    signal = { signal: 'Buy', bullish: true };
                } else if (bear) {
                    signal = { signal: 'Sell', bullish: false };
                }

                if (signal) {
                    const entryEvent = this.tradeManager.openPosition({
                        time: time[i],
                        price: close[i],
                        isLong: signal.bullish,
                        stoploss: stoploss,
                        takeProfits: [{ targetPct: this.partialExitThreshold, qtyPct: 50 }],
                        trailing: { activationPct: 1.5, trailByPct: 0.5 },
                        metadata: {
                            volatility: this.volatilityMillionMoves[i].volatilityStatus,
                            session: this.sessions[i],
                            datetime: formatTimestamp(time[i])
                        }
                    });

                    const newSignal = {
                        time: time[i],
                        close: close[i],
                        datetime: formatTimestamp(time[i]),
                        stoploss: stoploss,
                        ...signal,
                        active: entryEvent // some consumers expect active context
                    };
                    signals.push(newSignal);
                }
            }

            const candle = {
                time: time[i],
                datetime: formatTimestamp(time[i]),
                stoploss: this.tradeManager.hasActivePosition() ? this.tradeManager.getActivePosition().stoploss : stoploss,
                open: open[i],
                high: high[i],
                low: low[i],
                close: close[i],
                volume: volume[i],
                atr: this.atr[i],
                ema200: this.ema200[i],
                sma13: this.sma13[i],
                ema8: this.ema8[i],
                ema13: this.ema13[i],
                rsi: this.rsi[i],
                adx: 0,
                volatility: this.volatilityMillionMoves[i].volatilityStatus,
                isCandleRanging: candleRange.isSideways,
                highest: candleRange.highest,
                lowest: candleRange.lowest,
                session: this.sessions[i],
                supertrend: this.supertrend[i],
                partial_exit: partialExit ? "partial_exit" : null,
                exit_signal: exitSignal ? 'exit' : null,
                new_signal: signal ? signal.signal : null,
                bullish: signal ? signal.bullish : null,
                profit: profitPct,
                remaining_qty: this.tradeManager.hasActivePosition() ? this.tradeManager.getActivePosition().quantity : 0
            }

            candles.push(candle);
        }
        // return {}
        return { signals, candles };
    }
}

module.exports = SupertrendAI;