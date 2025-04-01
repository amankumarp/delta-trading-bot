const axios = require('axios');
const { parseIntervalToSeconds, convertOHLCVtoArray } = require('./utils'); // Import the utility function
class MarketDataService {
  constructor(baseUrl = 'https://api.india.delta.exchange') {
    this.baseUrl = baseUrl;
  }

  // 1) Retrieve all futures pairs available on the exchange
  async getAllFuturesPairs() {
    const endpoint = '/v2/products';
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await axios.get(url);
      // You may want to filter the result to only include futures pairs
      const futuresPairs = response.data.filter(p => p.type === 'future');
      return futuresPairs;
    } catch (error) {
      console.error('Error fetching futures pairs:', error.response?.data || error.message);
      throw error;
    }
  }

  // 2) Get symbol (product) information by symbol name or id
  async getSymbolInfo(symbol) {
    const endpoint = `/v2/products/${symbol}`;
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching symbol info:', error.response?.data || error.message);
      throw error;
    }
  }

  // 3) Get Candle OHLCV Data
  // Provide either a startTime and endTime or if omitted, get the previous 100 candles
  async getCandleOHLCV(symbol, timeframe, startTime = null, endTime = null) {
    // Assume Delta Exchange provides a candle endpoint such as:
    const endpoint = `/v2/history/candles`;

    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    const defaultEnd = now;
    const defaultStart = now - 200 * parseIntervalToSeconds(timeframe); // Previous 100 candles
    const params= {
      symbol,
      resolution: timeframe,
      start: startTime || defaultStart,
      end: endTime || defaultEnd,
    };

    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await axios.get(url, { params });
      return response.data.result;
    } catch (error) {
      console.error('Error fetching OHLCV data:', error.response?.data || error.message);
      throw error;
    }
  }

  async getReverseOHLCVArray(symbol, timeframe, startTime = null, endTime = null){
    let ohlcv = (await this.getCandleOHLCV(symbol,timeframe, startTime, endTime)).reverse();
    return convertOHLCVtoArray(ohlcv);
  }
  
}


module.exports = MarketDataService;
