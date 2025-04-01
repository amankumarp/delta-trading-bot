require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const config = require("../../config/index");

class ExchangeService {
    constructor(apiKey, apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = config.EXCHANGE_API;
    }

    /**
     * Generate HMAC SHA256 signature
     * @param {string} secret - API secret key
     * @param {string} message - String to sign
     * @returns {string} - HMAC SHA256 signature
     */
    generateSignature(secret, message) {
        return crypto.createHmac("sha256", secret).update(message).digest("hex");
    }

    /**
     * Make an authenticated API request
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @param {string} path - API endpoint path
     * @param {object} query - Query parameters
     * @param {object} body - Request body
     */
    async sendRequest(method, path, query = {}, body = {}) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const queryString = new URLSearchParams(query).toString();
        const fullPath = queryString ? `${path}?${queryString}` : path;
        const payload = method === "GET" ? "" : JSON.stringify(body);
        const signatureData = method + timestamp + "/v2" + fullPath + payload;
        const signature = this.generateSignature(this.apiSecret, signatureData);

        const headers = {
            "api-key": this.apiKey,
            "timestamp": timestamp,
            "signature": signature,
            "User-Agent": "node-rest-client",
            "Content-Type": "application/json",
        };

        try {
            const response = await axios({
                method,
                url: `${this.baseUrl}${fullPath}`,
                headers,
                data: method === "GET" ? undefined : body,
                params: method === "GET" ? query : undefined,
                timeout: 30000, // 30s timeout
            });
            return response.data;
        } catch (error) {
            console.error("Error:", error.response ? error.response.data : error.message);
            throw new Error(`Request failed: ${error.message}`);
        }
    }

    async getCandles(symbol, interval, start, end) {
        return this.sendRequest('GET', '/history/candles', { symbol, resolution: interval, start, end });
    }

    async getProduct(symbol) {
        return this.sendRequest('GET', `/products/${symbol}`);
    }

    async getProducts() {
        return this.sendRequest('GET', '/products');
    }

    async getAssets() {
        return this.sendRequest('GET', '/assets');
    }

    async getOrderBook(symbol) {
        try {
            const response = await this.sendRequest('GET', `/l2orderbook/${symbol}`);
            let bestBuy = response.result.buy.sort((a, b) => b.price - a.price)[0];
            let bestSell = response.result.sell.sort((a, b) => a.price - b.price)[0];
            console.info(`Fetched order book for ${symbol} successfully`);
            return { bestBuy, bestSell };
        } catch (error) {
            console.error(`Error fetching order book: ${error.message}`);
            throw new Error('Failed to fetch order book');
        }
    }

    async getWalletBalances() {
        return this.sendRequest('GET', '/wallet/balances');
    }

    async getOrders() {
        console.info('Fetching pending orders');
        return this.sendRequest('GET', '/orders');
    }

    async placeOrder(symbol, side, quantity, price, type = 'market_order', stopLoss, takeProfit) {
        const orderPayload = {
            product_symbol: symbol,
            side,
            size: quantity,
            limit_price: type === 'limit_order' ? price : undefined,
            order_type: type,
            stop_loss: stopLoss,
            take_profit: takeProfit
        };
        return this.sendRequest('POST', '/orders', {}, orderPayload);
    }

    async editOrder(orderId, price) {
        return this.sendRequest('PUT', `/orders/${orderId}`, { price });
    }

    async cancelOrder(orderId) {
        return this.sendRequest('DELETE', `/orders/${orderId}`);
    }

    async cancelAllOrders() {
        return this.sendRequest('DELETE', '/orders/all');
    }

    async getMarginedPositions() {
        return this.sendRequest('GET', '/positions/margined');
    }

    async getPositions(underlying_asset_symbol) {
        return this.sendRequest('GET', `/positions`, { underlying_asset_symbol });
    }

    async exitAllPositions() {
        return this.sendRequest('POST', '/positions/close_all', {}, {
            close_all_portfolio: true,
            close_all_isolated: true,
            user_id: 0
        });
    }
}

module.exports = ExchangeService;
