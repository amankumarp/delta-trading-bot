const { formatTimestamp , calculateProfitPercentage, convertOHLCVtoHeikinAshi} = require('./utils');
const { crossDown, crossUp, calculateATR,calculateEMA,calculateSMA,calculateRSI,  calculateSupertrend} = require('./indicators/index');
const { calculateJurikVolatility, calculateSessions, calculateVolatility, calculateHFTCandles,isCandleRanging, calculateADX } = require('./indicators/indicators');

class SupertrendAI {
    constructor() {
        this.atrLength = 11;
        this.multiplier = 2.5;
        this.atrMultiplier = 1.5; // ATR multiplier for stoploss
        this.usePercentBaseSl = true; // Use percentage based stoploss
        this.riskPercent = 0.85; // 0.85% risk per trade
        this.partialExitThreshold = 5; // 50% profit for partial exit
        this.useHeikinAshiForSignal = true;
        this.ema8=[];
        this.ema13 = [];
        this.ema200 = [];
        this.sma13 = [];
        this.atr = [];
        this.adx = [];
        this.supertrend = [];
        this.rsi = [];
        this.macd = [];
        this.lowest=[];
        this.highest=[];
        this.trend = [];
        this.activeSignal=null;
    }
    
    generateSignals(data) {
        const { open, high, low, close, time, volume} = data;
   
       
        // Calculate indicators
        if(this.useHeikinAshiForSignal) {
            const ohlcv = { open, high, low, close, time, volume };
            const {haOpen, haHigh, haLow, haClose } = convertOHLCVtoHeikinAshi(high, low, close, open, time );
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
            const {supertrend}= calculateSupertrend(haHigh, haLow, haClose, this.atrLength, this.multiplier);
            this.supertrend = supertrend;
        } else {
            this.atr = calculateATR(high, low, close, this.atrLength);
            this.ema200 = calculateEMA(close, 200);
            this.ema8 = calculateEMA(close, 8);
            this.ema13 = calculateEMA(close, 13);
            this.sma13 = calculateSMA(close, 13); // SMA can be approximated with EMA       
            this.rsi = calculateRSI(close, 14);
            // this.adx = calculateADX(high, low, close, 14);
            // this.volatility = calculateJurikVolatility(close,14,2);
            this.sessions = calculateSessions(time);
            this.volatilityMillionMoves = calculateVolatility(high, low, close);
            
            // Calculate Supertrend
            const {supertrend}= calculateSupertrend(high, low, close, this.atrLength, this.multiplier);
            this.supertrend = supertrend;
        }
        // Calculate MACD
        
        // Generate buy/sell signals based on co
        const candles = [];
        const signals = [];
        let startIndex = 16;
        for (let i = startIndex; i < close.length; i++) {
            const h1_candles = calculateHFTCandles({open:open.slice(i-startIndex,i-1), high:high.slice(i-startIndex,i-1), low:low.slice(i-startIndex,i-1), close:close.slice(i-startIndex,i-1), timestamp:time.slice(i-startIndex,i-1), volume:volume.slice(i-startIndex,i-1)}, 15,60,0);
            const candleRange = isCandleRanging({close:h1_candles.close, high:h1_candles.high, low:h1_candles.low, open:h1_candles.open});

            const isCrossUp = crossUp(close, this.supertrend);
            const isCrossDown = crossDown(close,this.supertrend);
            const emaCrossUp = crossUp(this.ema8, this.ema13);
            const emaCrossDown = crossDown(this.ema8, this.ema13);

            let stoploss = isCrossUp[i]? high[i] - (this.atr[i] * this.atrMultiplier):low[i] + (this.atr[i] * this.atrMultiplier);
            // stoploss = isCrossUp[i] ? stoploss > low[i] ? stoploss = low[i] : stoploss : stoploss < high[i] ? stoploss = high[i] : stoploss;
            // stoploss = isCrossUp[i] ? stoploss > this.supertrend[i] ? stoploss = this.supertrend[i] : stoploss : stoploss < this.supertrend[i] ? stoploss = this.supertrend[i] : stoploss;
            const riskAnalysis = (Math.abs(close[i] - stoploss) / stoploss) * 100; // Calculate risk as percentage of supertrend
            //this.sessions[i] != "Tokyo Session" &&
            let commonCondition =  riskAnalysis <= this.riskPercent//&& new Date(time[i]*1000).getDay() !== 6//&& this.rsi[i] >= 50  && candleRange.isSideways==false;

            const Cbull = isCrossUp[i] && close[i] >= this.sma13[i]  && commonCondition; //&& this.volatility.priceJurikArr[i] > 300 && candleRange.highest <= close[i] && this.sessions[i] != "Tokyo Session";
            const Cbear = isCrossDown[i]&& close[i] <= this.sma13[i] && commonCondition;  //&& this.volatility.priceJurikArr[i] < -300//&& candleRange.lowest >= close[i] && this.sessions[i] != "Tokyo Session";
            const bull = Cbull && !(close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            const bear = Cbear && !(close[i-1] > this.ema200[i]  && close[i] > this.ema200[i])
            const Sbull = Cbull && (close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            const Sbear = Cbear && !(close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            

            // running profit percentage
            const profitPct = this.activeSignal?calculateProfitPercentage(this.activeSignal.bullish, this.activeSignal.close, close[i]):0;

            const partialExitBull = (profitPct > this.partialExitThreshold||emaCrossDown[i] && profitPct > 0) && (this.activeSignal.bullish);
            const partialExitBear = (profitPct > this.partialExitThreshold||emaCrossUp[i] && profitPct > 0) && !(this.activeSignal.bullish);
            const fullExitBull =  isCrossDown[i] && (this.activeSignal?.bullish);
            const fullExitBear = isCrossUp[i] && !(this.activeSignal?.bullish);


            let signal = null;
            let exitSignal = null;
            let partialExit = null;
    
            // check day of week
   
            if(this.activeSignal){
                if((partialExitBull|| partialExitBear )&& this.activeSignal?.partialExit != true) {
                    this.activeSignal.partialExit=true;
                    partialExit = { time:time[i], signal: 'partial exit',  price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    signals.push({...partialExit, profit:profitPct});
                }

                if((fullExitBear||fullExitBull)) {   
                    exitSignal = { time:time[i],signal: 'exit', bullish:!(this.activeSignal.bullish), price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    this.activeSignal = null;
                    signals.push({...exitSignal, profit:profitPct});
                }
 
            } 

            // tp1: tp2: tp3: ,sl: , qntity:
           
            if (Sbull) {
                signal = { signal: 'Smart Buy', bullish:true};
                this.activeSignal = {time:time[i], close: close[i],partialExit:false, volatility: this.volatilityMillionMoves[i].volatilityStatus,session:this.sessions[i],datetime:formatTimestamp(time[i]), ...signal};
            } else if (Sbear) {
                signal = {  signal: 'Smart Sell', bullish:false};
                this.activeSignal = {time:time[i], close: close[i],partialExit:false, volatility: this.volatilityMillionMoves[i].volatilityStatus,session:this.sessions[i],datetime:formatTimestamp(time[i]), ...signal};
            } else if (bull) { 
                signal = {  signal: 'Buy', bullish:true };
                this.activeSignal = {time:time[i],partialExit:false, close: close[i], volatility: this.volatilityMillionMoves[i].volatilityStatus,                session:this.sessions[i],datetime:formatTimestamp(time[i]), ...signal};
            } else if (bear) {
                signal = {  signal: 'Sell', bullish:false };
                this.activeSignal = {time:time[i],partialExit:false, close: close[i],volatility: this.volatilityMillionMoves[i].volatilityStatus, session:this.sessions[i],datetime:formatTimestamp(time[i]), ...signal};
            }
         
            const candle = { 
                time:time[i],
                datetime:formatTimestamp(time[i]),
                stoploss:stoploss,
                open:open[i],   
                high:high[i],
                low:low[i],
                close:close[i],
                volume:volume[i],
                atr:this.atr[i],
                ema200:this.ema200[i],
                sma13:this.sma13[i],
                ema8:this.ema8[i],
                ema13:this.ema13[i],
                rsi:this.rsi[i],
                adx: 0,
                volatility: this.volatilityMillionMoves[i].volatilityStatus,
                isCandleRanging: candleRange.isSideways,
                highest:candleRange.highest,
                lowest:candleRange.lowest,
                session:this.sessions[i],
                supertrend:this.supertrend[i],
                partial_exit:partialExit?"partial_exit":null,
                exit_signal:exitSignal?'exit':null,
                new_signal:signal?signal.signal:null,
                bullish:signal?signal.bullish:null,
                profit: (this.activeSignal?calculateProfitPercentage(this.activeSignal.bullish, this.activeSignal.close, close[i]):null)|| profitPct,
            }
       
            if (signal) signals.push({time:time[i], close: close[i],datetime:formatTimestamp(time[i]), ...signal});   
            candles.push(candle);
        }
        // return {}
        return {signals,candles};
    }
}

module.exports = SupertrendAI;