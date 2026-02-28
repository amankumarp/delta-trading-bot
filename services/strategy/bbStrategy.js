const { formatTimestamp, calculateProfitPercentage} = require('./utils');
const { crossDown, crossUp, calculateATR, calculateEMA, calculateSMA, calculateRSI, calculateBollingerBands} = require('./indicators/index');
const {  calculateSessions, calculateVolatility, calculateHFTCandles, isCandleRanging, calculateBarsSince } = require('./indicators/indicators');
const { isBearishRejectionCandle,isBigCandle,isDoji, isBullishRejectionCandle } = require('./candlesticks');
const BaseStrategy = require('./base/BaseStrategy');

class BollingerBandAI extends BaseStrategy {
    constructor() {
        super();
        this.bbPeriod = 20;
        this.bbStdDev = 2;
        this.atrLength = 14;
        this.atrMultiplier = 1.3;
        this.usePercentBaseSl = true;
        this.riskPercent = 1;
        this.partialExitThreshold = 1
        this.atr = [];
        this.rsi = [];
        this.sessions = [];
        this.ema200 = [];
        this.bbUpper = [];
        this.bbMiddle = [];
        this.bbLower = [];
        this.volatility = [];
        this.activeSignal = null;
    }
    
    generateSignals(data) {
        const { open, high, low, close, time, volume} = data;
        this.atr = calculateATR(high, low, close, this.atrLength);
        this.ema200 = calculateEMA(close, 200);
        this.rsi = calculateRSI(close, 14);
        this.sessions = calculateSessions(time);
        this.volatility = calculateVolatility(high, low, close);

        // Calculate Bollinger Bands
        const {upperBand, middleBand, lowerBand} = calculateBollingerBands(close, this.bbPeriod, this.bbStdDev);
        this.bbUpper = upperBand;
        this.bbMiddle = middleBand;
        this.bbLower = lowerBand;
        
        // Generate buy/sell signals
        const candles = [];
        const signals = [];
        let startIndex = Math.max(this.bbPeriod, 200) + 1;
        for (let i = startIndex; i < close.length; i++) {
            const h1_candles = calculateHFTCandles({
                open: open.slice(i-startIndex, i-1), 
                high: high.slice(i-startIndex, i-1), 
                low: low.slice(i-startIndex, i-1), 
                close: close.slice(i-startIndex, i-1), 
                timestamp: time.slice(i-startIndex, i-1), 
                volume: volume.slice(i-startIndex, i-1)
            }, 15, 60, 0);
            
            const candleRange = isCandleRanging({
                close: h1_candles.close, 
                high: h1_candles.high, 
                low: h1_candles.low, 
                open: h1_candles.open
            });
     
            // BB signal detection - bounce from bands
            const touchedLowerBand = low[i] <= this.bbLower[i] && close[i] > this.bbLower[i];
            const touchedUpperBand = high[i] >= this.bbUpper[i] && close[i] < this.bbUpper[i];
            
            // BB squeeze detection - bands getting tighter
            const bbWidth = (this.bbUpper[i] - this.bbLower[i]) / this.bbMiddle[i];
            const bbWidthPrev = (this.bbUpper[i-1] - this.bbLower[i-1]) / this.bbMiddle[i-1];
            const bbSqueeze = bbWidth < bbWidthPrev;
            
            // Price crosses middle band
            const crossAboveMiddle = crossUp(close, this.bbMiddle);
            const crossBelowMiddle = crossDown(close, this.bbMiddle);
            
            
            // Stoploss calculation
            let stoploss = touchedUpperBand ? 
                high[i] + (this.atr[i] * this.atrMultiplier): 
                low[i] - (this.atr[i] * this.atrMultiplier);
            
            // Adjust stoploss to be within bounds of the Bollinger Bands
            stoploss = touchedUpperBand ? 
                (stoploss < this.bbUpper[i] ? this.bbUpper[i] : stoploss): 
                (stoploss > this.bbLower[i] ? this.bbLower[i] : stoploss);

            const riskAnalysis = (Math.abs(close[i] - stoploss) / stoploss) * 100;
            
            let commonCondition = riskAnalysis <= this.riskPercent;
            
            // Buy conditions: bounce from lower band + bullish confirmation
            const Cbull = touchedLowerBand &&  close[i] > this.bbLower[i] && isBullishRejectionCandle({open: open[i], high: high[i], low: low[i], close: close[i]}) &&  commonCondition;
            
            // Sell conditions: bounce from upper band + bearish confirmation
            const Cbear = touchedUpperBand &&  close[i] < this.bbUpper[i] &&  isBearishRejectionCandle({open: open[i], high: high[i], low: low[i], close: close[i]})&& commonCondition;
            
            const bull = Cbull && !(close[i] > this.ema200[i]);
            const bear = Cbear && !(close[i] > this.ema200[i]);
            const Sbull = Cbull && (close[i] > this.ema200[i]);
            const Sbear = Cbear && !(close[i] > this.ema200[i]);
      
            // Running profit percentage
            const profitPct = this.activeSignal ? 
                calculateProfitPercentage(this.activeSignal.bullish, this.activeSignal.close, close[i]) : 0;
            
            let partialExitBull = (profitPct > this.partialExitThreshold || 
                                    close[i] >= this.bbUpper[i]) && 
                                   (this.activeSignal?.bullish);
            
            let  partialExitBear = (profitPct > this.partialExitThreshold || 
                                    close[i] <= this.bbLower[i]) && 
                                   !(this.activeSignal?.bullish);
            
            let fullExitBull = (crossBelowMiddle[i] || close[i] < this.bbMiddle[i]) && partialExitBull &&
                                (this.activeSignal?.bullish);
            
            let fullExitBear = (crossAboveMiddle[i] || close[i] > this.bbMiddle[i]) && partialExitBear &&
                                !(this.activeSignal?.bullish);
            
            let signal = null;
            let exitSignal = null;
            let partialExit = null;
    
            if(this.activeSignal) {
                // calculate entry candle to current candle movement and time calculation 
                let activeSince = time[i] - this.activeSignal.time;
                let moveSince = Math.abs(close[i] - this.activeSignal.close)
                if(profitPct >= (this.riskPercent*2)) {
                    if((close[i] < this.ema200[i] && this.activeSignal.bullish) || (close[i] < this.ema200[i] && !this.activeSignal.bullish)){
                        fullExitBear = true
                    }  else {
                        this.activeSignal.stoploss = this.activeSignal.close
                        partialExitBear = true
                    }
                  
                }
                //TODO: how much time to take to achive 1:2 on basis of that decide trailing on momentum
                //TODO: check higher timeframe bollinger band status or exit basis of that
                //TODO: check if ema 200 against book fast profit (against trend)
                //TODO: if after achiveing 1:2 trail sl ctc 
                //TODO: average range candle range 
                //TODO: mode: trailing , protective, tight trailing after big candle movement
                
               
                if((partialExitBull || partialExitBear) && this.activeSignal?.partialExit != true) {
                    this.activeSignal.partialExit = true;
                    partialExit = { 
                        time: time[i], 
                        signal: 'partial exit',  
                        price: close[i], 
                        date: formatTimestamp(time[i]), 
                        active: this.activeSignal
                    };
                    signals.push({...partialExit, profit: profitPct});
                }
                
                if(fullExitBear || fullExitBull) {   
                    exitSignal = { 
                        time: time[i],
                        signal: 'exit', 
                        bullish: this.activeSignal.bullish, 
                        price: close[i], 
                        date: formatTimestamp(time[i]), 
                        active: this.activeSignal
                    };
                    this.activeSignal = null;
                    signals.push({...exitSignal, profit: profitPct});
                }

                if(isStoplossHit(this.activeSignal, close[i], low[i], high[i])) {
                    exitSignal = { 
                        time: time[i],
                        signal: 'stoploss exit', 
                        bullish: this.activeSignal.bullish, 
                        price: close[i], 
                        date: formatTimestamp(time[i]), 
                        active: this.activeSignal
                    };
                    this.activeSignal = null;
                    signals.push({...exitSignal, profit: profitPct});
                }
                
            } 
           
            if (Sbull) {
                signal = { signal: 'Smart Buy', bullish: true};
                this.activeSignal = {
                    time: time[i], 
                    close: close[i],
                    partialExit: false, 
                    session: this.sessions[i],
                    volatility: this.volatility[i].volatilityStatus,
                    datetime: formatTimestamp(time[i]), 
                    stoploss: stoploss,
                    ...signal
                };
            } else if (Sbear) {
                signal = { signal: 'Smart Sell', bullish: false};
                this.activeSignal = {
                    time: time[i], 
                    close: close[i],
                    partialExit: false, 
                    session: this.sessions[i],
                    volatility: this.volatility[i].volatilityStatus,
                    datetime: formatTimestamp(time[i]), 
                    stoploss: stoploss,
                    ...signal
                };
            } else if (bull) { 
                signal = { signal: 'Buy', bullish: true };
                this.activeSignal = {
                    time: time[i],
                    partialExit: false, 
                    close: close[i],             
                    session: this.sessions[i],
                    volatility: this.volatility[i].volatilityStatus,
                    datetime: formatTimestamp(time[i]), 
                    stoploss: stoploss,
                    ...signal
                };
            } else if (bear) {
                signal = { signal: 'Sell', bullish: false };
                this.activeSignal = {
                    time: time[i],
                    partialExit: false, 
                    close: close[i],
                    session: this.sessions[i],
                    volatility: this.volatility[i].volatilityStatus,
                    datetime: formatTimestamp(time[i]), 
                    stoploss: stoploss,
                    ...signal
                };
            }
         
            const candle = { 
                time: time[i],
                datetime: formatTimestamp(time[i]),
                stoploss: stoploss,
                open: open[i],   
                high: high[i],
                low: low[i],
                close: close[i],
                volume: volume[i],
                atr: this.atr[i],
                ema200: this.ema200[i],
                rsi: this.rsi[i],
                bbUpper: this.bbUpper[i],
                bbMiddle: this.bbMiddle[i],
                bbLower: this.bbLower[i],
                bbWidth: bbWidth,
                volatility: this.volatility[i].volatilityStatus,
                isCandleRanging: candleRange.isSideways,
                highest: candleRange.highest,
                lowest: candleRange.lowest,
                session: this.sessions[i],
                partial_exit: partialExit ? "partial_exit" : null,
                exit_signal: exitSignal ? 'exit' : null,
                new_signal: signal ? signal.signal : null,
                bullish: signal ? signal.bullish : null,
                profit: (this.activeSignal ? 
                        calculateProfitPercentage(this.activeSignal.bullish, this.activeSignal.close, close[i]) : null) || profitPct,
            };
       
            if (signal) signals.push({
                time: time[i], 
                close: close[i],
                datetime: formatTimestamp(time[i]), 
                ...signal
            });   
            candles.push(candle);
        }
        
        return {signals, candles};
    }
}


function isStoplossHit(activeSignal, currentClose, currentLow, currentHigh) {
    if (!activeSignal) return false;
    if (activeSignal.bullish) {
        return currentLow <= activeSignal.stoploss;
    } else {
        return currentHigh >= activeSignal.stoploss;
    }
}   

module.exports = BollingerBandAI;
