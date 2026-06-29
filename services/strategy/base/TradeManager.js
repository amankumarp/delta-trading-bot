/**
 * TradeManager — Production Grade State Management
 * 
 * Manages active trade states, enforces scaled profit booking tiers, 
 * trailing stops, and time/regime-based exit validations.
 */
class TradeManager {
    constructor() {
        this.position = null;
        this.trades = []; // Complete history of closed trades
    }

    /**
     * Opens a new position matching the strict payload format.
     */
    openPosition({ time, price, side, stopLoss, sizeQuote, takeProfits = [], trailing = null, metadata = {} }) {
        if (this.position) return null; // Only one active position allowed in standard strategies

        const isLong = side === 'LONG';

        // Map relative percentage targets to absolute prices if necessary, 
        // or just accept them if they are pre-calculated prices.
        const tps = takeProfits.map(tp => ({
            ...tp,
            targetPrice: tp.price,
            hit: false
        })).sort((a, b) => isLong ? a.targetPrice - b.targetPrice : b.targetPrice - a.targetPrice);

        this.position = {
            entry_time: time,
            entry_price: price,
            side,
            isLong,
            stoploss: stopLoss,
            initial_stoploss: stopLoss,
            size_quote: sizeQuote,       // Total position value in quote currency
            quantity_pct: 100,           // Tracks percentage of position remaining
            tps,
            trailing,
            highest_profit_price: price, // Highwater mark for trailing stops
            bars_held: 0,
            metadata,
            exits: [] 
        };

        return { signal: 'entry', price, time, side, sizeQuote, metadata };
    }

    /**
     * Evaluates an active position against the current candle.
     * Checks Hard Stop, Take Profits, and Trailing Stops.
     */
    update(candle) {
        if (!this.position) return [];

        const { time, high, low, close } = candle;
        const pos = this.position;
        const events = [];

        pos.bars_held++;

        // 1. Update Highwater Mark
        if (pos.isLong) {
            if (high > pos.highest_profit_price) pos.highest_profit_price = high;
        } else {
            if (low < pos.highest_profit_price) pos.highest_profit_price = low;
        }

        // 2. Evaluate Active Trailing Stop (Chandelier or basic trailing)
        if (pos.trailing && pos.trailing.activationPct) {
            const currentProfitPct = pos.isLong
                ? ((pos.highest_profit_price - pos.entry_price) / pos.entry_price) * 100
                : ((pos.entry_price - pos.highest_profit_price) / pos.entry_price) * 100;

            if (currentProfitPct >= pos.trailing.activationPct) {
                let newSl = pos.isLong
                    ? pos.highest_profit_price * (1 - pos.trailing.trailByPct / 100)
                    : pos.highest_profit_price * (1 + pos.trailing.trailByPct / 100);

                // Ratchet SL only in the direction of profit
                if (pos.isLong && newSl > pos.stoploss) pos.stoploss = newSl;
                if (!pos.isLong && newSl < pos.stoploss) pos.stoploss = newSl;
            }
        }

        // 3. Evaluate Hard Stop Loss
        const slHit = pos.isLong ? low <= pos.stoploss : high >= pos.stoploss;
        if (slHit) {
            // Fill at SL price, close remaining quantity
            events.push(this._executeExit(time, pos.stoploss, pos.quantity_pct, 'stoploss', candle));
            return events; 
        }

        // 4. Evaluate Scaled Profit Booking Tiers
        for (const tp of pos.tps) {
            if (tp.hit) continue;

            const tpHit = pos.isLong ? high >= tp.targetPrice : low <= tp.targetPrice;
            if (tpHit) {
                tp.hit = true;
                const qtyToExit = tp.sizePct * 100;
                
                events.push(this._executeExit(time, tp.targetPrice, qtyToExit, 'take_profit', candle));

                // Standard Rule: Move SL to breakeven after TP1
                if (tp.moveToBreakeven) {
                    pos.stoploss = pos.entry_price;
                }

                if (pos.quantity_pct <= 0.01) {
                    return events; // Position fully closed
                }
            }
        }

        return events;
    }

    /**
     * Force close via Regime Flip or Time Stop.
     */
    forceClose(time, price, reason = 'regime_flip', candle = {}) {
        if (!this.position) return null;
        return this._executeExit(time, price, this.position.quantity_pct, reason, candle);
    }

    /**
     * Internal execution accounting
     */
    _executeExit(time, price, quantityPct, reason, candle) {
        const pos = this.position;
        
        // Cannot exit more than we have
        const actualExitQty = Math.min(quantityPct, pos.quantity_pct);
        
        const profitPct = pos.isLong
            ? ((price - pos.entry_price) / pos.entry_price) * 100
            : ((pos.entry_price - price) / pos.entry_price) * 100;

        const exitRecord = {
            time,
            price,
            quantity_pct: actualExitQty,
            reason,
            profit_pct: profitPct,
            bars_held: pos.bars_held,
            metadata: candle
        };

        pos.exits.push(exitRecord);
        pos.quantity_pct -= actualExitQty;

        const type = pos.quantity_pct > 0.01 ? 'partial_exit' : 'exit';
        const returnEvent = { signal: type, ...exitRecord, position: { ...pos } };

        // Archive if fully closed
        if (pos.quantity_pct <= 0.01) {
            this.trades.push({ ...pos });
            this.position = null; 
        }

        return returnEvent;
    }

    hasActivePosition() {
        return this.position !== null;
    }

    getActivePosition() {
        return this.position;
    }
}

module.exports = TradeManager;
