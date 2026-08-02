const BaseStrategy = require('./base/BaseStrategy');
const TradeManager = require('./base/TradeManager');
const { formatTimestamp, calculateProfitPercentage } = require('./utils');
const { calculateATR, calculateEMA, calculateRSI } = require('./indicators/index');
const { calculateSessions, calculateVolatility } = require('./indicators/indicators');

/**
 * PDH/PDL Liquidity Sweep Reversal [ICT/SMC Strategy]
 * 
 * Captures liquidity sweeps above Previous Day High (PDH) or below Previous Day Low (PDL),
 * waits for a rejection candle entirely outside the boundary, and triggers an entry
 * on structure break with multi-tier Take Profit targets and automated Break-Even (CTC).
 */
class PdhPdlStrategy extends BaseStrategy {
    constructor(options = {}) {
        super();
        // --- Display / Visual Toggles ---
        this.showPDLines = options.showPDLines !== undefined ? options.showPDLines : true;
        this.showATRTrail = options.showATRTrail !== undefined ? options.showATRTrail : true;
        this.showSwings = options.showSwings !== undefined ? options.showSwings : true;
        this.showSignalBox = options.showSignalBox !== undefined ? options.showSignalBox : true;
        this.showDashboard = options.showDashboard !== undefined ? options.showDashboard : true;

        // --- Stop Loss & Take Profit Configuration ---
        this.slType = options.slType || "Swing High/Low"; // "Swing High/Low" or "Signal Candle High/Low"
        this.slBufferTicks = options.slBufferTicks !== undefined ? Number(options.slBufferTicks) : 2;
        this.tpModel = options.tpModel || "Fixed Multi-Tier R:R"; // "Fixed Multi-Tier R:R", "Trailing Model (ATR)", "Swing-Based Model"
        this.ctcTrigger = options.ctcTrigger || "After Tier 1"; // "Never", "After Tier 1", "After Tier 2", "After Tier 3", "After Tier 4"

        this.tier1RR = options.tier1RR !== undefined ? Number(options.tier1RR) : 1.5;
        this.tier1Pct = options.tier1Pct !== undefined ? Number(options.tier1Pct) : 40.0;
        this.tier2RR = options.tier2RR !== undefined ? Number(options.tier2RR) : 2.5;
        this.tier2Pct = options.tier2Pct !== undefined ? Number(options.tier2Pct) : 30.0;
        this.tier3RR = options.tier3RR !== undefined ? Number(options.tier3RR) : 4.0;
        this.tier3Pct = options.tier3Pct !== undefined ? Number(options.tier3Pct) : 20.0;
        this.tier4RR = options.tier4RR !== undefined ? Number(options.tier4RR) : 6.0;

        // --- ATR / Volatility & Trailing Stop Settings ---
        this.atrLen = options.atrLen !== undefined ? Number(options.atrLen) : 14;
        this.maxCandleAtrMult = options.maxCandleAtrMult !== undefined ? Number(options.maxCandleAtrMult) : 1.5;
        this.maxStopAtrMult = options.maxStopAtrMult !== undefined ? Number(options.maxStopAtrMult) : 2.0;
        this.trailAtrMult = options.trailAtrMult !== undefined ? Number(options.trailAtrMult) : 2.5;

        // --- SMC / Market Structure & Pivot Settings ---
        this.pivotLen = options.pivotLen !== undefined ? Number(options.pivotLen) : 5;

        // --- Session & Time Filters ---
        this.sessionFilter = options.sessionFilter || "London & NY"; // "All", "London", "NY", "London & NY"
        this.maxLossesPerDay = options.maxLossesPerDay !== undefined ? Number(options.maxLossesPerDay) : 2;

        this.riskPercent = options.riskPercent !== undefined ? Number(options.riskPercent) : 1.0;
        this.tradeManager = new TradeManager();
    }

    /**
     * Group candles by UTC date (YYYY-MM-DD) and return previous day high and low for each index.
     */
    calculatePDH_PDL(time, high, low) {
        const getDateStr = (ts) => {
            const d = new Date(ts * 1000);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        };

        const dayStats = {};
        const tradingDays = [];
        const dateStrs = new Array(time.length);

        for (let i = 0; i < time.length; i++) {
            const dateStr = getDateStr(time[i]);
            dateStrs[i] = dateStr;
            if (!dayStats[dateStr]) {
                dayStats[dateStr] = { high: high[i], low: low[i] };
                tradingDays.push(dateStr);
            } else {
                if (high[i] > dayStats[dateStr].high) dayStats[dateStr].high = high[i];
                if (low[i] < dayStats[dateStr].low) dayStats[dateStr].low = low[i];
            }
        }

        const pdh = new Array(time.length).fill(null);
        const pdl = new Array(time.length).fill(null);

        for (let i = 0; i < time.length; i++) {
            const dateStr = dateStrs[i];
            const dayIdx = tradingDays.indexOf(dateStr);
            if (dayIdx > 0) {
                const prevDateStr = tradingDays[dayIdx - 1];
                pdh[i] = dayStats[prevDateStr].high;
                pdl[i] = dayStats[prevDateStr].low;
            }
        }

        return { pdh, pdl, dateStrs };
    }

    /**
     * Compute pivot highs and lows without lookahead bias.
     * A pivot high/low at index p is confirmed at index p + len.
     */
    calculatePivots(high, low, len) {
        const pivotHighs = new Array(high.length).fill(null);
        const pivotLows = new Array(low.length).fill(null);

        for (let i = len * 2; i < high.length; i++) {
            const p = i - len;
            let isPH = true;
            let isPL = true;
            for (let j = 1; j <= len; j++) {
                if (high[p] <= high[p - j] || high[p] <= high[p + j]) isPH = false;
                if (low[p] >= low[p - j] || low[p] >= low[p + j]) isPL = false;
            }
            if (isPH) pivotHighs[i] = high[p];
            if (isPL) pivotLows[i] = low[p];
        }

        return { pivotHighs, pivotLows };
    }

    /**
     * Check if trading session is allowed.
     */
    isSessionAllowed(sessionStr, filter) {
        if (filter === "All") return true;
        const isLondon = sessionStr === "London Session" || sessionStr === "London–New York Overlap";
        const isNY = sessionStr === "New York Session" || sessionStr === "London–New York Overlap";
        if (filter === "London") return isLondon;
        if (filter === "NY") return isNY;
        if (filter === "London & NY") return isLondon || isNY;
        return false;
    }

    /**
     * Main signal generation lifecycle.
     */
    generateSignals(data) {
        const { open, high, low, close, time, volume } = data;
        const len = close.length;

        const atr = calculateATR(high, low, close, this.atrLen);
        const ema200 = calculateEMA(close, 200);
        const rsi = calculateRSI(close, 14);
        const sessions = calculateSessions(time);
        const volatility = calculateVolatility(high, low, close);
        const { pdh, pdl, dateStrs } = this.calculatePDH_PDL(time, high, low);
        const { pivotHighs, pivotLows } = this.calculatePivots(high, low, this.pivotLen);

        let lastSwingHigh = null;
        let lastSwingLow = null;

        let shortState = 0;
        let longState = 0;
        let sigHigh = null;
        let sigLow = null;

        let dailyLossCount = 0;
        let lastDay = null;

        const candles = [];
        const signals = [];

        const mintick = len > 0 && close[0] > 100 ? 0.01 : 0.0001;
        const slBuffer = this.slBufferTicks * mintick;

        const startIndex = Math.max(this.atrLen, this.pivotLen * 2, 1);

        for (let i = startIndex; i < len; i++) {
            // Update last known swing highs/lows
            if (pivotHighs[i] !== null) lastSwingHigh = pivotHighs[i];
            if (pivotLows[i] !== null) lastSwingLow = pivotLows[i];

            const currentDayStr = dateStrs[i];
            if (lastDay === null || currentDayStr !== lastDay) {
                dailyLossCount = 0;
                lastDay = currentDayStr;
            }

            const maxLossReached = dailyLossCount >= this.maxLossesPerDay;
            const sessionAllowed = this.isSessionAllowed(sessions[i], this.sessionFilter);
            const currentATR = atr[i] || 0;
            const pdh_raw = pdh[i];
            const pdl_raw = pdl[i];

            let newSignal = null;
            let partialExit = null;
            let exitSignal = null;

            // 1. Process active trade updates first
            if (this.tradeManager.hasActivePosition()) {
                const activePos = this.tradeManager.getActivePosition();
                const events = this.tradeManager.update({
                    time: time[i],
                    open: open[i],
                    high: high[i],
                    low: low[i],
                    close: close[i]
                });

                for (const event of events) {
                    if (event.signal === 'partial_exit') {
                        partialExit = {
                            time: time[i],
                            signal: 'partial exit',
                            price: close[i],
                            close: close[i],
                            date: formatTimestamp(time[i]),
                            datetime: formatTimestamp(time[i]),
                            profit: event.profit_pct
                        };
                        signals.push({ ...partialExit });
                    } else if (event.signal === 'exit' || event.signal === 'stoploss') {
                        exitSignal = {
                            time: time[i],
                            signal: event.signal === 'stoploss' ? 'stoploss exit' : 'exit',
                            bullish: activePos.isLong,
                            price: close[i],
                            close: close[i],
                            date: formatTimestamp(time[i]),
                            datetime: formatTimestamp(time[i]),
                            profit: event.profit_pct
                        };
                        signals.push({ ...exitSignal });
                        if (event.profit_pct < 0) {
                            dailyLossCount++;
                        }
                    }
                }
            } else {
                // 2. Evaluate SHORT SETUP PROCESSOR
                if (shortState === 0) {
                    if (pdh_raw !== null && high[i] > pdh_raw) {
                        shortState = 1;
                    }
                } else if (shortState === 1) {
                    const isBearish = close[i] < open[i];
                    const entirelyAbovePDH = pdh_raw !== null && low[i] > pdh_raw;

                    if (isBearish && entirelyAbovePDH) {
                        const candleSize = high[i] - low[i];
                        if (candleSize > currentATR * this.maxCandleAtrMult) {
                            shortState = 0;
                        } else {
                            sigHigh = high[i];
                            sigLow = low[i];
                            shortState = 2;
                        }
                    } else if (pdh_raw !== null && low[i] <= pdh_raw && close[i] > open[i]) {
                        if (high[i] < pdh_raw) {
                            shortState = 0;
                        }
                    }
                } else if (shortState === 2) {
                    if (low[i] < sigLow) {
                        let baseSL = (this.slType === "Swing High/Low" && lastSwingHigh !== null)
                            ? Math.max(lastSwingHigh, sigHigh) : sigHigh;
                        let calculatedSL = baseSL + slBuffer;
                        let stopDist = calculatedSL - close[i];

                        if (stopDist > 0 && stopDist <= (currentATR * this.maxStopAtrMult) && !maxLossReached && sessionAllowed && !this.tradeManager.hasActivePosition()) {
                            newSignal = { signal: 'Sell', bullish: false };

                            let tps = [];
                            if (this.tpModel === "Fixed Multi-Tier R:R") {
                                const remQty = Math.max(0, 100 - this.tier1Pct - this.tier2Pct - this.tier3Pct);
                                tps = [
                                    { price: close[i] - stopDist * this.tier1RR, sizePct: this.tier1Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 1" },
                                    { price: close[i] - stopDist * this.tier2RR, sizePct: this.tier2Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 2" },
                                    { price: close[i] - stopDist * this.tier3RR, sizePct: this.tier3Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 3" },
                                    { price: close[i] - stopDist * this.tier4RR, sizePct: remQty / 100, moveToBreakeven: this.ctcTrigger === "After Tier 4" }
                                ];
                            } else if (this.tpModel === "Swing-Based Model") {
                                const targetPrice = lastSwingLow !== null ? lastSwingLow : close[i] - stopDist * 2.0;
                                tps = [{ price: targetPrice, sizePct: 1.0, moveToBreakeven: this.ctcTrigger !== "Never" }];
                            } else {
                                // Trailing Model (ATR)
                                tps = [{ price: close[i] - stopDist * 2.0, sizePct: this.tier1Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 1" }];
                            }

                            const trailingConfig = this.tpModel === "Trailing Model (ATR)" ? {
                                activationPct: ((stopDist * 2.0) / close[i]) * 100,
                                trailByPct: ((currentATR * this.trailAtrMult) / close[i]) * 100
                            } : null;

                            this.tradeManager.openPosition({
                                time: time[i],
                                price: close[i],
                                side: 'SHORT',
                                stopLoss: calculatedSL,
                                sizeQuote: 1000,
                                takeProfits: tps,
                                trailing: trailingConfig,
                                metadata: { type: 'PDH_SWEEP_SHORT' }
                            });

                            signals.push({
                                time: time[i],
                                close: close[i],
                                price: close[i],
                                date: formatTimestamp(time[i]),
                                datetime: formatTimestamp(time[i]),
                                ...newSignal,
                                stoploss: calculatedSL
                            });
                        }
                        shortState = 0;
                    }
                }

                // 3. Evaluate LONG SETUP PROCESSOR
                if (longState === 0) {
                    if (pdl_raw !== null && low[i] < pdl_raw) {
                        longState = 1;
                    }
                } else if (longState === 1) {
                    const isBullish = close[i] > open[i];
                    const entirelyBelowPDL = pdl_raw !== null && high[i] < pdl_raw;

                    if (isBullish && entirelyBelowPDL) {
                        const candleSize = high[i] - low[i];
                        if (candleSize > currentATR * this.maxCandleAtrMult) {
                            longState = 0;
                        } else {
                            sigHigh = high[i];
                            sigLow = low[i];
                            longState = 2;
                        }
                    } else if (pdl_raw !== null && high[i] >= pdl_raw && close[i] < open[i]) {
                        if (low[i] > pdl_raw) {
                            longState = 0;
                        }
                    }
                } else if (longState === 2) {
                    if (high[i] > sigHigh) {
                        let baseSL = (this.slType === "Swing High/Low" && lastSwingLow !== null)
                            ? Math.min(lastSwingLow, sigLow) : sigLow;
                        let calculatedSL = baseSL - slBuffer;
                        let stopDist = close[i] - calculatedSL;

                        if (stopDist > 0 && stopDist <= (currentATR * this.maxStopAtrMult) && !maxLossReached && sessionAllowed && !this.tradeManager.hasActivePosition()) {
                            newSignal = { signal: 'Buy', bullish: true };

                            let tps = [];
                            if (this.tpModel === "Fixed Multi-Tier R:R") {
                                const remQty = Math.max(0, 100 - this.tier1Pct - this.tier2Pct - this.tier3Pct);
                                tps = [
                                    { price: close[i] + stopDist * this.tier1RR, sizePct: this.tier1Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 1" },
                                    { price: close[i] + stopDist * this.tier2RR, sizePct: this.tier2Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 2" },
                                    { price: close[i] + stopDist * this.tier3RR, sizePct: this.tier3Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 3" },
                                    { price: close[i] + stopDist * this.tier4RR, sizePct: remQty / 100, moveToBreakeven: this.ctcTrigger === "After Tier 4" }
                                ];
                            } else if (this.tpModel === "Swing-Based Model") {
                                const targetPrice = lastSwingHigh !== null ? lastSwingHigh : close[i] + stopDist * 2.0;
                                tps = [{ price: targetPrice, sizePct: 1.0, moveToBreakeven: this.ctcTrigger !== "Never" }];
                            } else {
                                // Trailing Model (ATR)
                                tps = [{ price: close[i] + stopDist * 2.0, sizePct: this.tier1Pct / 100, moveToBreakeven: this.ctcTrigger === "After Tier 1" }];
                            }

                            const trailingConfig = this.tpModel === "Trailing Model (ATR)" ? {
                                activationPct: ((stopDist * 2.0) / close[i]) * 100,
                                trailByPct: ((currentATR * this.trailAtrMult) / close[i]) * 100
                            } : null;

                            this.tradeManager.openPosition({
                                time: time[i],
                                price: close[i],
                                side: 'LONG',
                                stopLoss: calculatedSL,
                                sizeQuote: 1000,
                                takeProfits: tps,
                                trailing: trailingConfig,
                                metadata: { type: 'PDL_SWEEP_LONG' }
                            });

                            signals.push({
                                time: time[i],
                                close: close[i],
                                price: close[i],
                                date: formatTimestamp(time[i]),
                                datetime: formatTimestamp(time[i]),
                                ...newSignal,
                                stoploss: calculatedSL
                            });
                        }
                        longState = 0;
                    }
                }
            }

            const activePos = this.tradeManager.getActivePosition();
            const runningProfitPct = activePos ? calculateProfitPercentage(activePos.isLong, activePos.entry_price, close[i]) : 0;

            const candle = {
                time: time[i],
                datetime: formatTimestamp(time[i]),
                open: open[i],
                high: high[i],
                low: low[i],
                close: close[i],
                volume: volume[i],
                atr: currentATR,
                pdh: pdh_raw,
                pdl: pdl_raw,
                sigHigh: (shortState === 2 || longState === 2) ? sigHigh : null,
                sigLow: (shortState === 2 || longState === 2) ? sigLow : null,
                shortState,
                longState,
                session: sessions[i],
                volatility: volatility[i] ? volatility[i].volatilityStatus : null,
                ema200: ema200[i],
                rsi: rsi[i],
                stoploss: activePos ? activePos.stoploss : null,
                new_signal: newSignal ? newSignal.signal : null,
                bullish: newSignal ? newSignal.bullish : null,
                partial_exit: partialExit ? "partial_exit" : null,
                exit_signal: exitSignal ? "exit" : null,
                profit: runningProfitPct
            };

            candles.push(candle);
        }

        return { signals, candles };
    }
}

module.exports = PdhPdlStrategy;
