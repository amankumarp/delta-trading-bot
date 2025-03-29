
const axios = require('axios');
const crypto = require('crypto');

class ExchangeService {
  constructor(apiKey, apiSecret, baseUrl = 'https://api.delta.exchange') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  // Utility: Generate authentication headers (adjust signing logic as needed)
  generateHeaders(endpoint, method, body = '') {
    const timestamp = Date.now().toString();
    // Payload structure may differ – refer to the latest docs for details.
    const payload = `${timestamp}${method}${endpoint}${body}`;
    const signature = crypto.createHmac('sha256', this.apiSecret)
                            .update(payload)
                            .digest('hex');
    return {
      'api-key': this.apiKey,
      'timestamp': timestamp,
      'signature': signature,
      'Content-Type': 'application/json'
    };
  }

  // 1) Order functions
  async placeOrder(order) {
    const endpoint = '/v2/orders';
    const url = `${this.baseUrl}${endpoint}`;
    const body = JSON.stringify(order);
    const headers = this.generateHeaders(endpoint, 'POST', body);
    try {
      const response = await axios.post(url, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Error placing order:', error.response?.data || error.message);
      throw error;
    }
  }

  async editOrder(orderId, modifications) {
    const endpoint = `/v2/orders/${orderId}`;
    const url = `${this.baseUrl}${endpoint}`;
    const body = JSON.stringify(modifications);
    const headers = this.generateHeaders(endpoint, 'PUT', body);
    try {
      const response = await axios.put(url, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Error editing order:', error.response?.data || error.message);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    const endpoint = `/v2/orders/${orderId}`;
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.generateHeaders(endpoint, 'DELETE');
    try {
      const response = await axios.delete(url, { headers });
      return response.data;
    } catch (error) {
      console.error('Error canceling order:', error.response?.data || error.message);
      throw error;
    }
  }

  // 2) Position management functions

  // Modify position (e.g., adjust margin)
  async modifyPosition(positionId, marginChange) {
    const endpoint = `/v2/positions/${positionId}/margin`;
    const url = `${this.baseUrl}${endpoint}`;
    const body = JSON.stringify({ margin: marginChange });
    const headers = this.generateHeaders(endpoint, 'POST', body);
    try {
      const response = await axios.post(url, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Error modifying position:', error.response?.data || error.message);
      throw error;
    }
  }

  // Exit (close) a single position
  async exitPosition(positionId) {
    const endpoint = `/v2/positions/${positionId}/close`;
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.generateHeaders(endpoint, 'POST');
    try {
      const response = await axios.post(url, {}, { headers });
      return response.data;
    } catch (error) {
      console.error('Error exiting position:', error.response?.data || error.message);
      throw error;
    }
  }

  // Exit all positions
  async exitAllPositions() {
    const endpoint = '/v2/positions/close_all';
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.generateHeaders(endpoint, 'POST');
    try {
      const response = await axios.post(url, {}, { headers });
      return response.data;
    } catch (error) {
      console.error('Error exiting all positions:', error.response?.data || error.message);
      throw error;
    }
  }

  // Trailing stop loss (assumes API supports a trailing stop order creation)
  async trailingStopLoss(orderId, trailingParams) {
    // trailingParams could include { trailValue, triggerPrice, ... }
    const endpoint = `/v2/orders/${orderId}/trailing_stop`;
    const url = `${this.baseUrl}${endpoint}`;
    const body = JSON.stringify(trailingParams);
    const headers = this.generateHeaders(endpoint, 'POST', body);
    try {
      const response = await axios.post(url, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Error setting trailing stop loss:', error.response?.data || error.message);
      throw error;
    }
  }

  // Exit partial quantity from an open position
  async exitPartialQuantity(positionId, quantity) {
    // This implementation assumes an endpoint exists to close a partial quantity.
    // Some platforms require you to modify or split the position.
    const endpoint = `/v2/positions/${positionId}/close_partial`;
    const url = `${this.baseUrl}${endpoint}`;
    const body = JSON.stringify({ quantity });
    const headers = this.generateHeaders(endpoint, 'POST', body);
    try {
      const response = await axios.post(url, body, { headers });
      return response.data;
    } catch (error) {
      console.error('Error exiting partial quantity:', error.response?.data || error.message);
      throw error;
    }
  }

  // 3) Account and order information

  async getAccountBalance() {
    const endpoint = '/v2/wallet/balances';
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.generateHeaders(endpoint, 'GET');
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching account balance:', error.response?.data || error.message);
      throw error;
    }
  }

  async getPendingOrders() {
    const endpoint = '/v2/orders';
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.generateHeaders(endpoint, 'GET');
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching pending orders:', error.response?.data || error.message);
      throw error;
    }
  }

  async getPositions() {
    const endpoint = '/v2/positions';
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.generateHeaders(endpoint, 'GET');
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching positions:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = ExchangeService;