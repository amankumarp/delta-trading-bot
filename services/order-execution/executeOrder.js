const logger = require('../logging/logger');
const {sendRequest} = require('./deltaExchange.js');


async function getCandles(symbol, interval, start, end) {
    try {
        const response = await sendRequest('GET', '/history/candles', {
            symbol,
            resolution: interval,
            start,
            end
        });
        return response.result;
    } catch (error) {
        logger.error(`Error fetching OHLCV data: ${error.message}`);
        throw new Error('Failed to fetch OHLCV data');
    }
}

async function getProduct(symbol) {
    try {
        const response = await sendRequest('GET', `/products/${symbol}`);
        return response.result;
    } catch (error) {
        logger.error(`Error fetching product: ${error.message}`);
        throw new Error('Failed to fetch product');
    }
}

async function getProducts() {
    try {
        const response = await sendRequest('GET', `/products`);
        return response.result;
    } catch (error) {
        logger.error(`Error fetching products: ${error.message}`);
        throw new Error('Failed to fetch products');
    }
}

// Get list of all assets
async function getAssets() {
    try {
        const response = await sendRequest('GET', '/assets');
        return response.result;
    } catch (error) {   
        logger.error(`Error fetching assets: ${error.message}`);
        throw new Error('Failed to fetch assets');
    }
}


async function getOrderBook(symbol) {
    try {
        const response = await sendRequest('GET', `/l2orderbook/${symbol}`);
        let bestBuy = response.result.buy.sort((a, b) => b.price - a.price)[0];
        let bestSell = response.result.sell.sort((a, b) => a.price - b.price)[0];
        logger.info(`Fetched order book for ${symbol} successfully`);
        return {
            bestBuy,
            bestSell,
            // buy: response.result.buy,
            // sell: response.result.sell
        };
    }
    catch (error) {
        logger.error(`Error fetching order book: ${error.message}`);
        throw new Error('Failed to fetch order book');
    }
}


async function getWalletBalances() {
    try {
        const response = await sendRequest('GET', '/wallet/balances');
        return response.result;
    } catch (error) {
        logger.error(`Error fetching wallet balances: ${error.message}`);
        throw new Error('Failed to fetch wallet balances');
    }
}


async function getOrders() {
    try {
        const response = await sendRequest('GET', '/orders');

        logger.info('Fetched pending orders successfully');
        return response.result;
    } catch (error) {
        logger.error(`Error fetching pending orders: ${error.message}`);
        throw new Error('Failed to fetch pending orders');
    }
}


async function placeOrder(symbol, side, quantity, price, type = 'market_order', stopLoss = undefined, takeProfit = undefined) {
    try {
        // Construct the order payload
        const orderPayload = {
            product_symbol: symbol,
            side,
            size: quantity,
            limit_price: type === 'limit_order' ? price : undefined,
            order_type: type,
        };

        if (stopLoss) {
            orderPayload.stop_loss = stopLoss;
        }

        if (takeProfit) {
            orderPayload.take_profit = takeProfit;
        }

        const response = await sendRequest('POST', '/orders',  {}, orderPayload);
        
        logger.info(`Order placed successfully: ${JSON.stringify(response.data)}`);
        return response.result;
    } catch (error) {
        logger.error(`Error placing order: ${error.message}`);
        throw new Error('Failed to place order');
    }
}


async function editOrder(orderId, price) {
    try {
        const response = await sendRequest('PUT', `/orders/${orderId}`, {
            price
        });
        if(response.status !== 200) {
            throw new Error('Failed to edit order');
        }
        logger.info(`Order ${orderId} edited successfully`);
    } catch (error) {
        logger.error(`Error editing order ${orderId}: ${error.message}`);
        throw new Error('Failed to edit order');
    }
}


async function cancelOrder(orderId) {
    try {
        const response = await sendRequest('DELETE', `/orders/${orderId}`, {});
        if(response.status !== 200) {
            throw new Error('Failed to cancel order');
        }
        logger.info(`Order ${orderId} cancelled successfully`);
    } catch (error) {
        logger.error(`Error cancelling order ${orderId}: ${error.message}`);
        throw new Error('Failed to cancel order');
    }
}

// cancle all orders
async function cancelAllOrders() {
    try {
        const response = await sendRequest('DELETE', '/orders/all', {});
        if(response.status !== 200) {
            throw new Error('Failed to cancel all orders');
        }
        logger.info('All orders cancelled successfully');
    } catch (error) {
        logger.error(`Error cancelling all orders: ${error.message}`);
        throw new Error('Failed to cancel all orders');
    }
}

/**
 * Fetch all active trades (open positions) from the exchange.
 * @returns {Array} - List of active trades.
 */
async function getMarginedPositions() {
    try {
        const response = await sendRequest('GET', '/positions/margined', {});
        return response.result;
    } catch (error) {
        logger.error(`Error fetching active trades: ${error.message}`);
        throw new Error('Failed to fetch active trades');
    }
}


async function getPositions(underlying_asset_symbol) {
    try {
        const response = await sendRequest('GET', `/positions?underlying_asset_symbol=${underlying_asset_symbol}`,{});
        logger.info('Fetched active trades successfully');
        return response.result;
    } catch (error) {
        logger.error(`Error fetching active trades: ${error.message}`);
        throw new Error('Failed to fetch active trades');
    }
}


async function exitAllPositions() {
    try {
        const response = await sendRequest('POST', '/positions/close_all',{},
            {
                "close_all_portfolio": true,
                "close_all_isolated": true,
                "user_id": 0,
            });
        if(response.status !== 200) {
            throw new Error('Failed to close all positions');
        }
        logger.info('All positions closed successfully');
    } catch (error) {
        logger.error(`Error closing all positions: ${error.message}`);
        throw new Error('Failed to close all positions');
    }
}

module.exports = {
    getCandles,
    getPositions,
    getMarginedPositions,
    cancelAllOrders,
    exitAllPositions,

    getOrderBook,
    getProducts,
    getProduct,
    getAssets,
    getWalletBalances,

    getOrders,
    placeOrder,
    cancelOrder,
    editOrder
};
