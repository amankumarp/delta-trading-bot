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

    generateSignature(secret, message) {
        return crypto.createHmac("sha256", secret).update(message).digest("hex");
    }

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
    

    async exitOrder(product_id, exit_lots, side) {
        // if order is sell then side is buy or if order is buy then side is sell
        const order = {
            "product_id":product_id,
            "size":exit_lots,
            "order_type":"market_order",
            "reduce_only":true,
            "cancel_orders_accepted":"true",
            "side":side
        };

        return this.sendRequest('POST', `/orders`, {}, order);
    }

    async editOrder(order_id, product_id, stop_price) {
        const order = {
            "id":order_id,
            "order_type":"market_order",
            "product_id":product_id,
            "stop_price":stop_price
        };
        return this.sendRequest('PUT', `/orders`, {}, order);
    }

    async placeOrder(symbol, side, size_lots, price, type = 'market_order', stopLoss, takeProfit) {
        const orderPayload = {
            product_symbol: symbol,
            side,
            size: size_lots,
            limit_price: type === 'limit_order' ? price : undefined,
            order_type: type,
            reduce_only: false,
        };
    
        if (stopLoss) {
            orderPayload.bracket_stop_trigger_method = "mark_price",
            orderPayload.bracket_stop_loss_price = stopLoss;
        }

        if (takeProfit) {
            orderPayload.bracket_stop_trigger_method = "mark_price",
            orderPayload.bracket_take_profit_price = takeProfit;
        }

        return this.sendRequest('POST', '/orders', {}, orderPayload);
    }

   async bracketOrder(symbol, stopLoss, takeProfit) {
        const orderPayload = {
            product_symbol:  symbol,
            bracket_stop_trigger_method: "mark_price",
        }
       
        if (stopLoss) {
            orderPayload.stop_loss_order = {
                order_type: "market_order",
                stop_price: stopLoss
            }
        }
        if (takeProfit) {
            orderPayload.take_profit_order = {
                order_type: "market_order",
                stop_price: takeProfit
            }
        }

        return this.sendRequest('POST', '/orders/bracket', {}, orderPayload);
   }

   async editBracketOrder(order_id,product_id, product_symbol, order_type="market_order", stoploss, takeProfit) {
        const orderPayload = {
            "id": order_id,
            "product_id": product_id,
            "product_symbol": product_symbol,
            "bracket_stop_trigger_method": "mark_price"
        }
     
        if(stoploss) {
            if(order_type=="limit_order"){
                orderPayload.bracket_stop_loss_limit_price = stoploss;
            } else {
                orderPayload.bracket_stop_loss_price = stoploss;
            }

        } 
        if (takeProfit) {
            if(order_type=="limit_order"){
                orderPayload.bracket_take_profit_limit_price = takeProfit;
            } else {
                orderPayload.bracket_take_profit_price = takeProfit;
            }
        }

        return this.sendRequest('PUT', '/orders/bracket', {}, orderPayload);
   }

    async cancelOrder(order) {
        return this.sendRequest('DELETE', `/orders`, {}, {id: order.id, product_id: order.product_id});
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
