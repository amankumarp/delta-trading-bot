const { formatTimestamp } = require('./utils');
const { crossDown, crossUp, calculateATR,calculateEMA,calculateSMA,calculateRSI, calculateMACD, calculateSupertrend,calculateSupportResistance, calculateLowest, calculateHighest} = require('./indicators/index');

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
    }
    calculateProfitPercentage(exitSignal) {
        const exitPrice = exitSignal.price;
        const activeTrade = exitSignal.active;
        
        if (!activeTrade || typeof activeTrade.entryPrice === 'undefined') {
          throw new Error("Active trade information with entryPrice is required");
        }
      
        const entryPrice = activeTrade.entryPrice;
      
        let profitPct;
        if (activeTrade.bullish) {
          // For BUY orders, profit if exit price is higher than entry price.
          profitPct = ((exitPrice - entryPrice) / entryPrice) * 100;
        } else {
          // For SELL orders, profit if exit price is lower than entry price.
          profitPct = ((entryPrice - exitPrice) / entryPrice) * 100;
        }
      
        return profitPct;
      }
    generateSignals(data) {
        const { open, high, low, close, time, volume} = data;
        // Calculate indicators
        this.atr = calculateATR(high, low, close, this.atrLength);
        this.ema200 = calculateEMA(close, 200);
        this.sma13 = calculateSMA(close, 13); // SMA can be approximated with EMA
        this.rsi = calculateRSI(close, 14);
        this.macd = calculateMACD(close, 12, 26, 9);
        // this.volatility  = calculateVolatility(high, low, close, 10,20);
        // console.log(this.volatility);
        // this.lowest = calculateLowest(low, 20);
        // this.highest = calculateHighest(high, 20);

        // Calculate Supertrend 
        const {supertrend}= calculateSupertrend(high, low, close, this.atrLength, this.multiplier);
        this.supertrend = supertrend;
        // Generate buy/sell signals based on co
        const candles = [];
        const signals = [];
        for (let i = 1; i < close.length; i++) {
            const isCrossUp = crossUp(close, this.supertrend);
            const isCrossDown = crossDown(close,this.supertrend);
           
            const Cbull = isCrossUp[i] && close[i] >= this.sma13[i]
            const Cbear = isCrossDown[i]&& close[i] <= this.sma13[i]
            const bull = Cbull && !(close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            const bear = Cbear && !(close[i-1] > this.ema200[i]  && close[i] > this.ema200[i])
            const Sbull = Cbull && (close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            const Sbear = Cbear && !(close[i-1] > this.ema200[i] && close[i] > this.ema200[i])
            
            let signal = null;
            let exitSignal = null;
            if(this.activeSignal){
                if(isCrossUp[i] && !(this.activeSignal.bullish)) {
                    exitSignal = { signal: 'exit', bullish:true, price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    this.activeSignal=null;
                    signals.push(exitSignal);
                }
                else if(isCrossDown[i] && (this.activeSignal.bullish)) {
                    exitSignal = { signal: 'exit', bullish:false,price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    this.activeSignal=null;
                    signals.push(exitSignal);
                } 
            } else{
                if(isCrossUp[i]) {
                    signal = { signal: 'cross up', bullish:true, price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
    
                }
                else if(isCrossDown[i]) {
                    signal = { signal: 'cross Down', bullish:false,price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
      
                } 
            }
            // tp1: tp2: tp3: ,sl: , qntity:
            if (Sbull) {
                signal = { signal: 'Smart Buy', bullish:true};
                this.activeSignal = {time:time[i], close: close[i],datetime:formatTimestamp(time[i]), ...signal};
            } else if (Sbear) {
                signal = {  signal: 'Smart Sell', bullish:false};
                this.activeSignal = {time:time[i], close: close[i],datetime:formatTimestamp(time[i]), ...signal};
            } else if (bull) { 
                signal = {  signal: 'Buy', bullish:true };
                this.activeSignal = {time:time[i], close: close[i],datetime:formatTimestamp(time[i]), ...signal};
            } else if (bear) {
                signal = {  signal: 'Sell', bullish:false };
                this.activeSignal = {time:time[i], close: close[i],datetime:formatTimestamp(time[i]), ...signal};
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
                macd:this.macd[i]?.histogram,
                supertrend:this.supertrend[i],
                // support: this.lowest[i],
                // resistance: this.highest[i],
                exit_signal:exitSignal?'exit':null,
                new_signal:signal?signal.signal:null,
                bullish:signal?signal.bullish:null
            }
            if (signal) signals.push({time:time[i], close: close[i],datetime:formatTimestamp(time[i]), ...signal});   
            candles.push(candle);
        }
        // return {}
        return {signals,
            candles};
    }
}

module.exports = SupertrendAI;