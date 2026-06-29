/**
 * Self-Aware Trend System (SATS) — JS port of Pine Script v1.9.0
 * Author: WillyAlgoTrader → ported to Node.js
 *
 * Engines implemented:
 *  1. Efficiency Ratio (ER)
 *  2. Trend Quality Index (TQI) — 4 factors: ER, Vol, Structure, Momentum
 *  3. Adaptive asymmetric SuperTrend (with TQI band modulation)
 *  4. Character-Flip detection (regime-change flip)
 *  5. Dynamic TP R-multiples (TQI + vol-weighted scaling)
 *  6. Signal score (6-factor composite, 0–102)
 */

const { formatTimestamp, calculateProfitPercentage } = require('./utils');
const { calculateATR, calculateRSI, calculateSMA } = require('./indicators/index');
const BaseStrategy = require('./base/BaseStrategy');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeDiv = (num, den, fallback = 0) =>
    den !== 0 && num != null && den != null ? num / den : fallback;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const mapClamp = (v, inLo, inHi, outLo, outHi) => {
    const t = clamp(safeDiv(v - inLo, inHi - inLo, 0), 0, 1);
    return outLo + t * (outHi - outLo);
};

const mapClampInv = (v, inLo, inHi, outHi, outLow) => {
    const t = clamp(safeDiv(v - inLo, inHi - inLo, 0), 0, 1);
    return outHi - t * (outHi - outLow);
};

// Rolling sum of absolute bar-to-bar changes
const pathLength = (arr, start, len) => {
    let sum = 0;
    for (let i = start; i < start + len; i++) {
        sum += Math.abs(arr[i] - arr[i - 1]);
    }
    return sum;
};

// Rolling highest / lowest over a window ending at index i
const highest = (arr, i, len) => {
    let h = -Infinity;
    for (let j = Math.max(0, i - len + 1); j <= i; j++) h = Math.max(h, arr[j]);
    return h;
};

const lowest = (arr, i, len) => {
    let l = Infinity;
    for (let j = Math.max(0, i - len + 1); j <= i; l = Math.min(l, arr[j++]));
    return l;
};

const sma = (arr, i, len) => {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - len + 1); j <= i; j++, cnt++) sum += arr[j];
    return cnt > 0 ? sum / cnt : 0;
};

const stdev = (arr, i, len) => {
    const m = sma(arr, i, len);
    let v = 0, cnt = 0;
    for (let j = Math.max(0, i - len + 1); j <= i; j++, cnt++) v += (arr[j] - m) ** 2;
    return cnt > 0 ? Math.sqrt(v / cnt) : 0;
};

// ─── SATS Strategy ───────────────────────────────────────────────────────────

class SATSStrategy extends BaseStrategy {
    constructor(opts = {}) {
        super();

        // ── Core params ──────────────────────────────────────────────────
        this.atrLen = opts.atrLen ?? 13;
        this.baseMult = opts.baseMult ?? 2.0;
        this.erLen = opts.erLen ?? 20;
        this.atrBaselineLen = opts.atrBaselineLen ?? 100;
        this.rsiLen = opts.rsiLen ?? 14;
        this.rsiOB = opts.rsiOB ?? 70;
        this.rsiOS = opts.rsiOS ?? 30;
        this.rsiLookback = opts.rsiLookback ?? 20;
        this.volLen = opts.volLen ?? 20;
        this.pivotLen = opts.pivotLen ?? 3;

        // ── TQI params ───────────────────────────────────────────────────
        this.useTqi = opts.useTqi ?? true;
        this.qualityStrength = opts.qualityStrength ?? 0.4;
        this.qualityCurve = opts.qualityCurve ?? 1.5;
        this.useAsymBands = opts.useAsymBands ?? true;
        this.asymStrength = opts.asymStrength ?? 0.5;
        this.useEffAtr = opts.useEffAtr ?? true;
        this.useAdaptive = opts.useAdaptive ?? true;
        this.adaptStrength = opts.adaptStrength ?? 0.5;
        this.tqiWeightEr = opts.tqiWeightEr ?? 0.35;
        this.tqiWeightVol = opts.tqiWeightVol ?? 0.20;
        this.tqiWeightStruct = opts.tqiWeightStruct ?? 0.25;
        this.tqiWeightMom = opts.tqiWeightMom ?? 0.20;
        this.tqiStructLen = opts.tqiStructLen ?? 20;
        this.tqiMomLen = opts.tqiMomLen ?? 10;
        this.multSmoothAlpha = opts.multSmoothAlpha ?? 0.15;

        // ── Character-flip ───────────────────────────────────────────────
        this.useCharFlip = opts.useCharFlip ?? true;
        this.charFlipMinAge = opts.charFlipMinAge ?? 5;
        this.charFlipHigh = opts.charFlipHigh ?? 0.55;
        this.charFlipLow = opts.charFlipLow ?? 0.25;

        // ── Risk / TP ────────────────────────────────────────────────────
        this.slAtrMult = opts.slAtrMult ?? 1.5;
        this.tp1R = opts.tp1R ?? 1.0;
        this.tp2R = opts.tp2R ?? 2.0;
        this.tp3R = opts.tp3R ?? 3.0;
        this.useDynTp = opts.useDynTp ?? false;
        this.dynTpTqiWeight = opts.dynTpTqiWeight ?? 0.6;
        this.dynTpVolWeight = opts.dynTpVolWeight ?? 0.4;
        this.dynTpMinScale = opts.dynTpMinScale ?? 0.5;
        this.dynTpMaxScale = opts.dynTpMaxScale ?? 2.0;
        this.dynTpFloorR1 = opts.dynTpFloorR1 ?? 0.5;
        this.dynTpCeilR3 = opts.dynTpCeilR3 ?? 8.0;
        this.tradeMaxAge = opts.tradeMaxAge ?? 100;
        this.minScore = opts.minScore ?? 0; // 0 = no filter

        // ── Warmup ───────────────────────────────────────────────────────
        this.warmupBars = Math.max(50,
            this.atrLen,
            this.erLen,
            this.rsiLen,
            this.volLen,
            this.atrBaselineLen,
            this.tqiMomLen,
            this.tqiStructLen
        ) + 10;
    }

    // ── 1. Efficiency Ratio ───────────────────────────────────────────────────
    _calcER(close, i) {
        if (i < this.erLen) return 0;
        const change = Math.abs(close[i] - close[i - this.erLen]);
        const volatility = pathLength(close, i - this.erLen + 1, this.erLen);
        return safeDiv(change, volatility, 0);
    }

    // ── 2. TQI (4-factor composite) ───────────────────────────────────────────
    _calcTQI(close, high, low, volume, atr, atrBaseline, er, i) {
        // Factor 1: ER
        const tqiEr = clamp(er, 0, 1);

        // Factor 2: Volatility regime via volume Z-score or vol ratio
        const hasVol = (volume[i] ?? 0) > 0;
        let tqiVol;
        if (hasVol) {
            const vMean = sma(volume, i, this.volLen);
            const vStd = stdev(volume, i, this.volLen);
            const volZ = safeDiv(volume[i] - vMean, vStd, 0);
            tqiVol = mapClamp(volZ, -1, 2, 0, 1);
        } else {
            const volRatio = safeDiv(atr[i], atrBaseline[i] || atr[i], 1);
            tqiVol = mapClamp(volRatio, 0.6, 1.8, 0, 1);
        }

        // Factor 3: Price position in structure (extremity = high quality)
        const strHi = highest(high, i, this.tqiStructLen);
        const strLo = lowest(low, i, this.tqiStructLen);
        const range = strHi - strLo;
        const pricePos = safeDiv(close[i] - strLo, range, 0.5);
        const tqiStruct = clamp(Math.abs(pricePos - 0.5) * 2, 0, 1);

        // Factor 4: Momentum persistence (aligned bars ratio)
        let aligned = 0;
        const windowChange = close[i] - close[i - this.tqiMomLen];
        for (let k = 0; k < this.tqiMomLen; k++) {
            const barChange = close[i - k] - close[i - k - 1];
            if ((windowChange > 0 && barChange > 0) || (windowChange < 0 && barChange < 0)) aligned++;
        }
        const tqiMom = aligned / this.tqiMomLen;

        const wSum = this.tqiWeightEr + this.tqiWeightVol + this.tqiWeightStruct + this.tqiWeightMom;
        const wDen = wSum > 0 ? wSum : 1;
        const raw = (tqiEr * this.tqiWeightEr + tqiVol * this.tqiWeightVol +
            tqiStruct * this.tqiWeightStruct + tqiMom * this.tqiWeightMom) / wDen;

        return {
            tqi: clamp(raw, 0, 1),
            components: { tqiEr, tqiVol, tqiStruct, tqiMom }
        };
    }

    // ── 3. Dynamic TP scale ───────────────────────────────────────────────────
    _calcDynTpScale(tqi, volRatio) {
        const tqiComp = clamp(tqi, 0, 1);
        const volComp = clamp(mapClamp(volRatio, 0.5, 2.0, 0, 1), 0, 1);
        const wSum = this.dynTpTqiWeight + this.dynTpVolWeight;
        const wDen = wSum > 0 ? wSum : 1;
        const raw = (tqiComp * this.dynTpTqiWeight + volComp * this.dynTpVolWeight) / wDen;
        return this.dynTpMinScale + raw * (this.dynTpMaxScale - this.dynTpMinScale);
    }

    // ── 4. Signal score (6-factor, 0–102) ────────────────────────────────────
    _calcScore(isBuy, close, high, low, atr, er, rsi, volZ, lowerBand, upperBand, i) {
        const BYPASS = 12.0;
        const dirMove = isBuy ? close[i] - close[i - 3] : close[i - 3] - close[i];
        const momScore = mapClamp(safeDiv(dirMove, atr[i], 0), 0.3, 2.0, 0, 17);
        const erScore = mapClamp(er, 0.15, 0.7, 0, 17);
        const vScore = mapClamp(volZ, 0, 3, 0, 17);
        const rsiDepth = isBuy
            ? Math.max(0, this.rsiOS - Math.min(...rsi.slice(Math.max(0, i - this.rsiLookback), i + 1)))
            : Math.max(0, Math.max(...rsi.slice(Math.max(0, i - this.rsiLookback), i + 1)) - this.rsiOB);
        const rsiScore = mapClamp(rsiDepth, 0, 15, 0, 17);
        const pivDist = 0; // simplified — struct score uses bypass
        const structScore = BYPASS;
        const breakDepth = isBuy
            ? Math.max(0, (upperBand[i - 1] ?? 0) - close[i - 1])
            : Math.max(0, close[i - 1] - (lowerBand[i - 1] ?? 0));
        const breakScore = mapClamp(safeDiv(breakDepth, atr[i], 0), 0, 1, 0, 16);
        return momScore + erScore + vScore + rsiScore + structScore + breakScore;
    }

    // ── Main signal generator ─────────────────────────────────────────────────
    generateSignals(data) {
        const { open, high, low, close, time, volume } = data;
        const n = close.length;

        // ── Pre-compute indicators ────────────────────────────────────────
        const rawAtr = calculateATR(high, low, close, this.atrLen);
        const rsiArr = calculateRSI(close, this.rsiLen);
        const sma13 = calculateSMA(close, 13);

        // ATR baseline (SMA of ATR)
        const atrBaseline = rawAtr.map((_, i) => sma(rawAtr, i, this.atrBaselineLen));

        // Precompute ER per bar
        const erArr = close.map((_, i) => (i >= this.erLen ? this._calcER(close, i) : 0));

        // Vol Z-score per bar
        const volZArr = close.map((_, i) => {
            if (!volume || !volume[i] || volume[i] === 0) return 0;
            const vMean = sma(volume, i, this.volLen);
            const vStd = stdev(volume, i, this.volLen);
            return safeDiv(volume[i] - vMean, vStd, 0);
        });

        // ── State for adaptive SuperTrend ─────────────────────────────────
        const lowerBandArr = new Array(n).fill(null);
        const upperBandArr = new Array(n).fill(null);
        const stTrendArr = new Array(n).fill(1);
        const tqiArr = new Array(n).fill(0.5);

        let activeMultSm = null;
        let passiveMultSm = null;
        let trendStartBar = 0;

        for (let i = 0; i < n; i++) {
            const er = erArr[i];
            const atr = rawAtr[i] ?? 0;
            const atrBase = atrBaseline[i] ?? atr;
            const volRatio = safeDiv(atr, atrBase, 1);

            // Effective ATR (efficiency-weighted)
            const effAtr = this.useEffAtr ? atr * (0.5 + 0.5 * er) : atr;

            // TQI
            let tqi = 0.5;
            if (this.useTqi && i >= Math.max(this.tqiMomLen, this.tqiStructLen)) {
                const res = this._calcTQI(close, high, low, volume, rawAtr, atrBaseline, er, i);
                tqi = res.tqi;
            }
            tqiArr[i] = tqi;

            // Legacy ER adaptation
            const legacyFactor = this.useAdaptive ? 1.0 + this.adaptStrength * (0.5 - er) : 1.0;

            // TQI multiplier
            const qualDev = this.useTqi ? Math.pow(1.0 - tqi, this.qualityCurve) : 0.5;
            const tqiMult = 1.0 - this.qualityStrength + this.qualityStrength * (0.6 + 0.8 * qualDev);
            const symMult = this.baseMult * legacyFactor * tqiMult;

            let activeRaw = symMult;
            let passiveRaw = symMult;
            if (this.useTqi && this.useAsymBands) {
                activeRaw = symMult * (1.0 - this.asymStrength * tqi * 0.3);
                passiveRaw = symMult * (1.0 + this.asymStrength * tqi * 0.4);
            }

            activeMultSm = activeMultSm == null ? activeRaw : activeMultSm * (1 - this.multSmoothAlpha) + activeRaw * this.multSmoothAlpha;
            passiveMultSm = passiveMultSm == null ? passiveRaw : passiveMultSm * (1 - this.multSmoothAlpha) + passiveRaw * this.multSmoothAlpha;

            const prevTrend = i === 0 ? 1 : stTrendArr[i - 1];
            const lowerMult = prevTrend === 1 ? activeMultSm : passiveMultSm;
            const upperMult = prevTrend === 1 ? passiveMultSm : activeMultSm;

            const src = close[i];
            const lbRaw = src - lowerMult * effAtr;
            const ubRaw = src + upperMult * effAtr;

            const prevLB = i > 0 ? lowerBandArr[i - 1] : null;
            const prevUB = i > 0 ? upperBandArr[i - 1] : null;

            lowerBandArr[i] = (prevLB != null && close[i - 1] > prevLB)
                ? Math.max(lbRaw, prevLB)
                : lbRaw;
            upperBandArr[i] = (prevUB != null && close[i - 1] < prevUB)
                ? Math.min(ubRaw, prevUB)
                : ubRaw;

            // Price-based flips
            const priceFlipUp = prevTrend === -1 && i > 0 && close[i] > (upperBandArr[i - 1] ?? Infinity);
            const priceFlipDown = prevTrend === 1 && i > 0 && close[i] < (lowerBandArr[i - 1] ?? -Infinity);

            // Character-flip
            const prevTqi = i > 0 ? tqiArr[i - 1] : 0.5;
            const trendAge = i - trendStartBar;
            const charFlipBase = this.useCharFlip && this.useTqi &&
                prevTqi > this.charFlipHigh && tqi < this.charFlipLow &&
                trendAge >= this.charFlipMinAge;
            const charFlipDown = charFlipBase && prevTrend === 1 && close[i] < src;
            const charFlipUp = charFlipBase && prevTrend === -1 && close[i] > src;

            const flipUp = priceFlipUp || charFlipUp;
            const flipDown = priceFlipDown || charFlipDown;

            let newTrend = prevTrend;
            if (flipUp) newTrend = 1;
            else if (flipDown) newTrend = -1;
            stTrendArr[i] = newTrend;

            if (newTrend !== prevTrend) trendStartBar = i;
        }

        // ── Signal loop ───────────────────────────────────────────────────
        const signals = [];
        const candles = [];

        for (let i = this.warmupBars; i < n; i++) {
            const er = erArr[i];
            const atr = rawAtr[i] ?? 0;
            const atrBase = atrBaseline[i] ?? atr;
            const volRatio = safeDiv(atr, atrBase, 1);
            const tqi = tqiArr[i];
            const rsi = rsiArr[i] ?? 50;
            const volZ = volZArr[i];

            const prevTrend = stTrendArr[i - 1];
            const curTrend = stTrendArr[i];
            const flipUp = curTrend === 1 && prevTrend === -1;
            const flipDown = curTrend === -1 && prevTrend === 1;

            // ── Dynamic TP R-multiples ──────────────────────────────────
            const dynScale = this.useDynTp ? this._calcDynTpScale(tqi, volRatio) : 1.0;
            const tp1Floor = this.dynTpFloorR1;
            const tp2Floor = this.dynTpFloorR1 * (this.tp2R / Math.max(this.tp1R, 0.01));
            const tp3Floor = this.dynTpFloorR1 * (this.tp3R / Math.max(this.tp1R, 0.01));
            const rawTp1R = this.useDynTp ? clamp(this.tp1R * dynScale, tp1Floor, this.dynTpCeilR3) : this.tp1R;
            const rawTp2R = this.useDynTp ? clamp(this.tp2R * dynScale, tp2Floor, this.dynTpCeilR3) : this.tp2R;
            const rawTp3R = this.useDynTp ? clamp(this.tp3R * dynScale, tp3Floor, this.dynTpCeilR3) : this.tp3R;

            // Sort to guarantee tp1 ≤ tp2 ≤ tp3
            const sorted = [rawTp1R, rawTp2R, rawTp3R].sort((a, b) => a - b);
            const [liveTp1R, liveTp2R, liveTp3R] = sorted;

            // ── Candle update (TP/SL tracking) ──────────────────────────
            const candleData = { time: time[i], open: open[i], high: high[i], low: low[i], close: close[i] };
            const tradeEvents = this.tradeManager.update(candleData);

            let partialExit = null;
            let exitSignal = null;
            let profitPct = 0;

            if (this.tradeManager.hasActivePosition()) {
                const pos = this.tradeManager.getActivePosition();
                profitPct = calculateProfitPercentage(pos.isLong, pos.entry_price, close[i]);

                // SuperTrend direction change → exit
                const fullExitBull = flipDown && pos.isLong;
                const fullExitBear = flipUp && !pos.isLong;
                if (fullExitBull || fullExitBear) {
                    const ev = this.tradeManager.forceClose(time[i], close[i], 'exit_signal', candleData);
                    if (ev) tradeEvents.push(ev);
                }
            }

            for (const event of tradeEvents) {
                if (event.signal === 'partial_exit') {
                    partialExit = { ...event, date: formatTimestamp(event.time), active: event.position };
                    signals.push(partialExit);
                } else if (event.signal === 'exit') {
                    exitSignal = { ...event, date: formatTimestamp(event.time), active: event.position };
                    signals.push(exitSignal);
                }
            }

            // ── New signal ───────────────────────────────────────────────
            let signal = null;
            if (!this.tradeManager.hasActivePosition() && (flipUp || flipDown)) {
                const isBuy = flipUp;
                const score = this._calcScore(isBuy, close, high, low, rawAtr, er, rsiArr, volZ, lowerBandArr, upperBandArr, i);

                if (score >= this.minScore) {
                    const entry = close[i];
                    let sl;

                    if (isBuy) {
                        const slBase = low[i];
                        sl = Math.min(slBase - this.slAtrMult * atr, entry - this.slAtrMult * atr);
                    } else {
                        const slBase = high[i];
                        sl = Math.max(slBase + this.slAtrMult * atr, entry + this.slAtrMult * atr);
                    }

                    const risk = Math.abs(entry - sl);
                    const riskPct = (risk / entry) * 100;

                    const entryEvent = this.tradeManager.openPosition({
                        time: time[i],
                        price: entry,
                        isLong: isBuy,
                        stoploss: sl,
                        takeProfits: [
                            { targetPct: riskPct * liveTp1R, qtyPct: 33, moveToBreakeven: true },
                            { targetPct: riskPct * liveTp2R, qtyPct: 33, moveToBreakeven: false },
                            { targetPct: riskPct * liveTp3R, qtyPct: 34, moveToBreakeven: false }
                        ],
                        trailing: null,
                        metadata: {
                            tqi: tqi.toFixed(3),
                            er: er.toFixed(3),
                            score: score.toFixed(1),
                            dynScale: dynScale.toFixed(2),
                            tpMode: this.useDynTp ? 'dynamic' : 'fixed',
                            tp1R: liveTp1R,
                            tp2R: liveTp2R,
                            tp3R: liveTp3R,
                            datetime: formatTimestamp(time[i]),
                            riskPct: riskPct.toFixed(2)
                        }
                    });

                    signal = {
                        time: time[i],
                        close: close[i],
                        datetime: formatTimestamp(time[i]),
                        stoploss: sl,
                        signal: isBuy ? 'SATS Buy' : 'SATS Sell',
                        bullish: isBuy,
                        score,
                        tqi,
                        er,
                        dynScale,
                        liveTp1R,
                        liveTp2R,
                        liveTp3R,
                        active: entryEvent
                    };
                    signals.push(signal);
                }
            }

            const stLine = stTrendArr[i] === 1 ? lowerBandArr[i] : upperBandArr[i];
            candles.push({
                time: time[i],
                datetime: formatTimestamp(time[i]),
                open: open[i],
                high: high[i],
                low: low[i],
                close: close[i],
                volume: volume[i],
                atr: atr,
                er: er,
                tqi: tqi,
                stTrend: stTrendArr[i],
                stLine,
                lowerBand: lowerBandArr[i],
                upperBand: upperBandArr[i],
                rsi,
                volZ,
                dynScale,
                stoploss: this.tradeManager.hasActivePosition()
                    ? this.tradeManager.getActivePosition().stoploss
                    : null,
                partial_exit: partialExit ? 'partial_exit' : null,
                exit_signal: exitSignal ? 'exit' : null,
                new_signal: signal ? signal.signal : null,
                bullish: signal ? signal.bullish : null,
                profit: profitPct,
                remaining_qty: this.tradeManager.hasActivePosition()
                    ? this.tradeManager.getActivePosition().quantity
                    : 0
            });
        }

        return { signals, candles };
    }
}

module.exports = SATSStrategy;
