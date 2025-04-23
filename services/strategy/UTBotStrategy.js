const { formatTimestamp , calculateProfitPercentage, convertOHLCVtoHeikinAshi} = require('./utils');
const { calculateSessions, calculateARSI, calculateUtBotAlerts } = require('./indicators/indicators');

class UTBotAlertStrategy {
    constructor() {
        this.rsiLength = 14;
        this.rsi = [];
        this.utbot = [];
        this.signals=[];
        this.activeSignal=null;
    }
    
    generateSignals(data) {
        const { open, high, low, close, time, volume} = data;
        // Calculate indicators
        
        const {haOpen, haHigh, haLow, haClose } = convertOHLCVtoHeikinAshi(high, low, close, open, time );
        this.utbot = calculateUtBotAlerts( haHigh, haLow, haClose, 2 ,1);
        this.sessions = calculateSessions(time);
        // Generate buy/sell signals based on co
        const candles = [];
        const signals = [];
      
        for (let i = 1; i < close.length; i++) {
         
            let signal = null;
            let exitSignal = null;
            let profitPct = 0;
            let {buy, sell} = this.utbot[i];
             
            if(this.activeSignal){
                if(buy && this.activeSignal && !(this.activeSignal.bullish)) {   
                    exitSignal = { time:time[i],signal: 'exit', bullish:true, price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    profitPct = calculateProfitPercentage(exitSignal.active.bullish, exitSignal.active.close, exitSignal.price);
                    this.activeSignal = null;
             
                    signals.push({...exitSignal, profit:profitPct});
                }
                else if(sell && (this.activeSignal.bullish)) {
                    exitSignal = { time:time[i],signal: 'exit', bullish:false,price:close[i], date:formatTimestamp(time[i]), active:this.activeSignal};
                    profitPct = calculateProfitPercentage(exitSignal.active.bullish, exitSignal.active.close, exitSignal.price);
                    this.activeSignal=null;
                    signals.push({...exitSignal, profit:profitPct});
                } 
         
            } 
         
            // tp1: tp2: tp3: ,sl: , qntity:
            if (buy && (this.sessions[i] === "London–New York Overlap" || this.sessions[i] === "New York Session") ) { 
                signal = {  signal: 'Buy', bullish:true };
                this.activeSignal = {time:time[i], close: close[i],session:this.sessions[i],datetime:formatTimestamp(time[i]), ...signal};
            } else if (sell && (this.sessions[i] === "London–New York Overlap" || this.sessions[i] === "New York Session")) {
                signal = {  signal: 'Sell', bullish:false };
                this.activeSignal = {time:time[i], close: close[i], session:this.sessions[i],datetime:formatTimestamp(time[i]), ...signal};
            }

            const candle = { 
                time:time[i],
                datetime:formatTimestamp(time[i]),
                open:open[i],   
                high:high[i],
                low:low[i],
                close:close[i],
                volume:volume[i],
                session:this.sessions[i],
                exit_signal:exitSignal?'exit':null,
                new_signal:signal?signal.signal:null,
                bullish:signal?signal.bullish:null,
                profit: (this.activeSignal?calculateProfitPercentage(this.activeSignal.bullish, this.activeSignal.close, close[i]):null)|| profitPct,
            }
       
            if (signal) signals.push({time:time[i], close: close[i],datetime:formatTimestamp(time[i]), ...signal});   
            candles.push(candle);
        }
        
        return {signals,candles};
    }
}

module.exports = UTBotAlertStrategy;