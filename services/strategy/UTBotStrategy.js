const { formatTimestamp , calculateProfitPercentage} = require('./utils');
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
        let i= close.length-2;
        console.log('candle', open[i], high[i], low[i], close[i], formatTimestamp(time[i]));
        this.utbot = calculateUtBotAlerts(open, high, low, close, this.rsiLength);
        this.sessions = calculateSessions(time);
        
        
        // Generate buy/sell signals based on co
        const candles = [];
        const signals = [];
         
        
        return {signals,candles};
    }
}

module.exports = UTBotAlertStrategy;