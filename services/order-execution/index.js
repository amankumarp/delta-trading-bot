const express = require('express');
const logger = require('../logging/logger');
const {    
    getOrders,
    getPositions,
    exitAllPositions,
    getMarginedPositions,
    getOrderBook,
    getProduct,
    getProducts,
    getAssets,
    getWalletBalances,
    placeOrder 
} = require('./executeOrder');
// require('./websocketService'); // Import the WebSocket service

const app = express();
const PORT = process.env.TRADE_MANAGEMENT_SERVICE_PORT || 3005;

app.use(express.json()); // Parse JSON request bodies

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/product', (req, res) => {
    const symbol = req.query.symbol || 'BTCUSD';
    getProduct(symbol)
        .then((product) => res.json(product))
        .catch((error) => {
            logger.error(`Error fetching product: ${error.message}`);
            res.status(500).json({ error: 'Failed to fetch product' });
        });
})

app.get('/products', (req, res) => {
    getProducts()
        .then((products) => res.json(products))
        .catch((error) => {
            logger.error(`Error fetching products: ${error.message}`);
            res.status(500).json({ error: 'Failed to fetch products' });
        });
})

// Route to fetch pending orders
app.get('/orders', async (req, res) => {
    try {
        const orders = await getOrders();
        res.json(orders);
    } catch (error) {
        logger.error(`Error fetching pending orders: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Route to fetch active trades
app.get('/positions', async (req, res) => {
    try {
        const underlying_asset_symbol = req.query.underlying_asset_symbol || 'USD';
        const activeTrades = await getPositions(underlying_asset_symbol);
        res.json(activeTrades);
    } catch (error) {
        logger.error(`Error fetching active trades: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch active trades' });
    }
});

app.get('/margined-positions', async (req, res) => {
    try {
        const marginedPositions = await getMarginedPositions();
        res.json(marginedPositions);
    } catch (error) {
        logger.error(`Error fetching margined positions: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch margined positions' });
    }
}
);

app.get('/order-book', async (req, res) => {
    try {
        const symbol = req.query.symbol || 'BTCUSD';
        const orderBook = await getOrderBook(symbol);
        res.json(orderBook);
    } catch (error) {
        logger.error(`Error fetching order book: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch order book' });
    }
}
);

app.get('/assets', async (req, res) => {
    try {
        const assets = await getAssets();
        res.json(assets);
    } catch (error) {
        logger.error(`Error fetching assets: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
}
);

app.get('/wallet-balances', async (req, res) => {   
    try {
        const walletBalances = await getWalletBalances();
        res.json(walletBalances);
    } catch (error) {
        logger.error(`Error fetching wallet balances: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch wallet balances' });
    }
}
);

// Route to place an order
app.post('/place-order', async (req, res) => {
    const { symbol, side, quantity, orderType, price, stopprice, takeprofitprice } = req.body;

    if (!symbol || !side || !quantity ) {
        logger.warn('Missing required parameters: symbol, side, quantity');
        return res.status(400).json({ error: 'Missing required parameters: symbol, side, quantity' });
    }
    if (orderType === 'limit_order' && !price) {
        logger.warn('Missing required parameter: price');
        return res.status(400).json({ error: 'Missing required parameter: price' });
    }
    try {
        // symbol, side, quantity, price, type = 'market_order', stopLoss = null, takeProfit = null)
        const order = await placeOrder(symbol, side, quantity, price , orderType, stopprice, takeprofitprice);
        res.json(order);
    } catch (error) {
        logger.error(`Error placing order: ${error.message}`);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

app.post('/exit-all-positions', async (req, res) => {   
    try {
        const result = await exitAllPositions();
        res.json(result);
    } catch (error) {
        logger.error(`Error exiting all positions: ${error.message}`);
        res.status(500).json({ error: 'Failed to exit all positions' });
    }
}
);


// Start the Trade Management Service
app.listen(PORT, () => {
    logger.info(`Trade Management Service running on port ${PORT}`);
});