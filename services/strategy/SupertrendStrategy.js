const { formatTimestamp , calculateProfitPercentage, convertOHLCVtoHeikinAshi} = require('./utils');
const { crossDown, crossUp, calculateATR,calculateEMA,calculateSMA,calculateRSI, calculateMACD, calculateSupertrend, calculateLowest, calculateHighest} = require('./indicators/index');
const { calculateJurikVolatility, calculateSessions, calculateVolatility } = require('./indicators/indicators');

class SupertrendAI {
    constructor() {
        this.atrLength = 11;
        this.multiplier = 2.5;
        this.sidewaysThreshold = 15;
        this.ema200 = [];
        this.sma13 = [];
        this.atr = [];
        this.supertrend = [];
        this.rsi = [];
        this.macd = [];
        this.lowest=[];
        this.highest=[];
        this.trend = [];
        this.activeSignal=null;
        this.useHeikinAshiForSignal = true;
    }
    
    generateSignals(data) {
        const { open, high, low, close, time, volume} = data;
        // Calculate indicators
        if(this.useHeikinAshiForSignal) {
            const ohlcv = { open, high, low, close, time, volume };
            const {haOpen, haHigh, haLow, haClose } = convertOHLCVtoHeikinAshi(high, low, close, open, time );
            this.atr = calculateATR(haHigh, haLow, haClose, this.atrLength);
            this.ema200 = calculateEMA(haClose, 200);
            this.sma13 = calculateSMA(haClose, 13); // SMA can be approximated with EMA
            this.rsi = calculateRSI(haClose, 14);
            this.volatility = calculateJurikVolatility(haClose,14,2);
            this.sessions = calculateSessions(time);
            this.volatilityMillionMoves = calculateVolatility(haHigh, haLow, haClose);
            
            // Calculate Supertrend 
            const {supertrend}= calculateSupertrend(haHigh, haLow, haClose, this.atrLength, this.multiplier);
            this.supertrend = supertrend;
        } else {
            this.atr = calculateATR(high, low, close, this.atrLength);
            this.ema200 = calculateEMA(close, 200);
            this.sma13 = calculateSMA(close, 13); // SMA can be approximated with EMA       
            this.rsi = calculateRSI(close, 14);
            this.volatility = calculateJurikVolatility(close,14,2);
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
        for (let i = 1; i < close.length; i++) {
            const isCrossUp = crossUp(close, this.supertrend);
            const isCrossDown = crossDown(close,this.supertrend);
           
            const Cbull = isCrossUp[i] && close[i] >= this.sma13[i]//&& (this.sessions[i] === "London–New York Overlap" || this.sessions[i] === "New York Session")
            const Cbear = isCrossDown[i]&& close[i] <= this.sma13[i] //&& (this.sessions[i] === "London–New York Overlap" || this.sessions[i] === "New York Session")
            const bull = Cbull && !(close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            const bear = Cbear && !(close[i-1] > this.ema200[i]  && close[i] > this.ema200[i])
            const Sbull = Cbull && (close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            const Sbear = Cbear && !(close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            
            let signal = null;
            let exitSignal = null;
            let partialExit = null;
            let profitPct = 0;
     
            if(this.activeSignal){
                if(isCrossUp[i] && this.activeSignal && !(this.activeSignal.bullish)) {   
                    exitSignal = { time:time[i],signal: 'exit', bullish:true, price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    profitPct = calculateProfitPercentage(exitSignal.active.bullish, exitSignal.active.close, exitSignal.price);
                    this.activeSignal = null;
             
                    signals.push({...exitSignal, profit:profitPct});
                }
                else if(isCrossDown[i] && (this.activeSignal.bullish)) {
                    exitSignal = { time:time[i],signal: 'exit', bullish:false,price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    profitPct = calculateProfitPercentage(exitSignal.active.bullish, exitSignal.active.close, exitSignal.price);
                    this.activeSignal=null;
                    signals.push({...exitSignal, profit:profitPct});
                } 
         
                if(this.rsi[i] >= 80 && (this.activeSignal?.bullish) && this.activeSignal?.partialExit != true) {
                    this.activeSignal.partialExit=true;
                    partialExit = { time:time[i], signal: 'partial exit',  price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    profitPct = calculateProfitPercentage(partialExit.active.bullish, partialExit.active.close, partialExit.price);
                    signals.push({...partialExit, profit:profitPct});
               
                } else if(this.rsi[i] <= 20 &&this.activeSignal && !(this.activeSignal.bullish) && this.activeSignal?.partialExit !== true){
                    this.activeSignal.partialExit=true;
                    partialExit = { time:time[i], signal: 'partial exit', price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    profitPct = calculateProfitPercentage(partialExit.active.bullish, partialExit.active.close, partialExit.price);
                    signals.push({...partialExit, profit:profitPct});
                }
            } else{
                if(isCrossUp[i]) {
                    signal = { signal: 'cross up', bullish:true, price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                }
                else if(isCrossDown[i]) {
                    signal = { signal: 'cross Down', bullish:false, price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
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
                open:open[i],   
                high:high[i],
                low:low[i],
                close:close[i],
                volume:volume[i],
                atr:this.atr[i],
                ema200:this.ema200[i],
                sma13:this.sma13[i],
                rsi:this.rsi[i],
                upperBandVol:this.volatility.upValues[i],
                lowerBandVol:this.volatility.dnValues[i],
                priceJurik:this.volatility.priceJurikArr[i],
                volatility: this.volatilityMillionMoves[i].volatilityStatus,
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