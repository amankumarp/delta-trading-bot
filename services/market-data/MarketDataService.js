const axios = require('axios');

class MarketDataService {
  constructor(baseUrl = 'https://api.delta.exchange') {
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
    const endpoint = `/v2/candles/${symbol}`;
    const params = { timeframe };
    if (startTime && endTime) {
      params.start_time = startTime;
      params.end_time = endTime;
    } else {
      // If not provided, assume API defaults to last 100 candles.
      params.limit = 100;
    }
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching OHLCV data:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = MarketDataService;
