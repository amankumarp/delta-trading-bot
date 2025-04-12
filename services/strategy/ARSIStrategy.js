const { formatTimestamp , calculateProfitPercentage} = require('./utils');
const { calculateSessions, calculateARSI } = require('./indicators/indicators');

class ARSIStrategy {
    constructor() {
        this.rsiLength = 14;
        this.rsi = [];
        this.arsi = [];
        this.signals=[];
        this.activeSignal=null;
    }
    
    generateSignals(data) {
        const { open, high, low, close, time, volume} = data;
        // Calculate indicators
        this.arsi = calculateARSI(close, this.rsiLength);
        this.sessions = calculateSessions(time);
     
        
        // Generate buy/sell signals based on co
        const candles = [];
        const signals = [];
         
        
        return {signals,candles};
    }
}

module.exports = ARSIStrategy;