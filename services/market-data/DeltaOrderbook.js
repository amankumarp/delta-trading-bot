const WebSocket = require('ws');
const EventBus = require('../../lib/EventBus');

class DeltaOrderbook {
    constructor() {
        this.ws = null;
        this.books = {}; // { 'BTCUSD': { bids: [{price, size}], asks: [{price, size}], ltp: number } }
        this.subscriptions = new Set();
        this.connect();
    }

    connect() {
        this.ws = new WebSocket('wss://socket.delta.exchange');
        
        this.ws.on('open', () => {
            console.log('[DeltaOrderbook] Connected to WebSocket');
            this.resubscribe();
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'l2_orderbook') {
                    this.handleL2Update(msg);
                } else if (msg.type === 'v2/ticker') {
                    this.handleTicker(msg);
                }
            } catch (e) {
                // ignore parsing errors
            }
        });

        this.ws.on('close', () => {
            console.log('[DeltaOrderbook] Disconnected. Reconnecting in 5s...');
            setTimeout(() => this.connect(), 5000);
        });
        
        this.ws.on('error', (err) => {
            console.error('[DeltaOrderbook] WebSocket error:', err.message);
        });
    }

    resubscribe() {
        if (this.ws.readyState === WebSocket.OPEN && this.subscriptions.size > 0) {
            const symbols = Array.from(this.subscriptions);
            this.ws.send(JSON.stringify({
                "type": "subscribe",
                "payload": {
                    "channels": [
                        { "name": "l2_orderbook", "symbols": symbols },
                        { "name": "v2/ticker", "symbols": symbols }
                    ]
                }
            }));
        }
    }

    subscribe(symbol) {
        if (!this.subscriptions.has(symbol)) {
            this.subscriptions.add(symbol);
            this.resubscribe();
        }
    }

    handleL2Update(msg) {
        const symbol = msg.symbol;
        if (!this.books[symbol]) {
            this.books[symbol] = { bids: [], asks: [], ltp: 0 };
        }
        
        if (msg.buy) {
            this.books[symbol].bids = msg.buy.map(b => ({ price: parseFloat(b.limit_price || b.price), size: parseFloat(b.size) }))
                .sort((a, b) => b.price - a.price);
        }
        if (msg.sell) {
            this.books[symbol].asks = msg.sell.map(a => ({ price: parseFloat(a.limit_price || a.price), size: parseFloat(a.size) }))
                .sort((a, b) => a.price - b.price);
        }
    }
    
    handleTicker(msg) {
        const symbol = msg.symbol;
        if (!this.books[symbol]) {
            this.books[symbol] = { bids: [], asks: [], ltp: 0 };
        }
        if (msg.spot_price) {
            this.books[symbol].ltp = parseFloat(msg.spot_price);
        } else if (msg.close) {
            this.books[symbol].ltp = parseFloat(msg.close);
        } else if (msg.price) {
            this.books[symbol].ltp = parseFloat(msg.price);
        } else if (msg.mark_price) {
            this.books[symbol].ltp = parseFloat(msg.mark_price);
        }
    }

    getExecutionPrice(symbol, isLong, quantity) {
        if (!this.books[symbol]) return null;
        
        const book = this.books[symbol];
        // To open a long, you buy from the asks. To open a short (or close a long), you sell to the bids.
        const levels = isLong ? book.asks : book.bids; 
        
        if (!levels || levels.length === 0) {
            return book.ltp || null; // Fallback to LTP
        }
        
        if (quantity <= 0) {
            return levels[0].price;
        }
        
        let remainingQty = quantity;
        let totalCost = 0;
        
        for (const level of levels) {
            const fillQty = Math.min(remainingQty, level.size);
            totalCost += fillQty * level.price;
            remainingQty -= fillQty;
            
            if (remainingQty <= 0) break;
        }
        
        // If the book is too thin, assume we sweep up to a reasonable slippage boundary
        if (remainingQty > 0) {
            const worstPrice = levels[levels.length - 1].price;
            // Additional slippage for illiquid books
            totalCost += remainingQty * (isLong ? worstPrice * 1.002 : worstPrice * 0.998);
        }
        
        return totalCost / quantity;
    }
    
    getLTP(symbol) {
        return this.books[symbol]?.ltp || null;
    }
}

module.exports = new DeltaOrderbook();
