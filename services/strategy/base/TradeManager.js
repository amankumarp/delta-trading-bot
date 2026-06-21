class TradeManager {
    constructor() {
        this.position = null;
        this.trades = []; // Complete history of trades (for reporting)
    }

    /**
     * Opens a new position.
     * @param {Object} config - { time, price, isLong, stoploss, takeProfits: [{targetPct, qtyPct}], trailing: {activationPct, trailByPct}, metadata }
     */
    openPosition({ time, price, isLong, stoploss, takeProfits = [], trailing = null, metadata = {} }) {
        if (this.position) return; // Prevent opening multiple concurrent positions (can support it later)

        // Convert target percentages to absolute target prices
        const tps = takeProfits.map(tp => ({
            ...tp,
            targetPrice: isLong ? price * (1 + tp.targetPct / 100) : price * (1 - tp.targetPct / 100),
            hit: false,
            moveToBreakeven: tp.moveToBreakeven || false
        })).sort((a, b) => isLong ? a.targetPrice - b.targetPrice : b.targetPrice - a.targetPrice);

        this.position = {
            entry_time: time,
            entry_price: price,
            isLong,
            stoploss,
            initial_stoploss: stoploss, // Keep track of initial SL
            quantity: 100, // Percentage of position remaining
            tps,
            trailing,
            highest_profit_price: price, // For trailing calculations
            metadata,
            exits: [] // Track partial exits
        };

        return { signal: 'entry', price, time, isLong, metadata };
    }

    /**
     * Update the active position with the latest candle.
     * @returns {Array} Array of signals/exits fired on this candle.
     */
    update(candle) {
        if (!this.position) return [];

        const { time, high, low, close } = candle;
        const pos = this.position;
        const events = [];

        // 1. Update highest profit price (for trailing)
        if (pos.isLong) {
            if (high > pos.highest_profit_price) pos.highest_profit_price = high;
        } else {
            if (low < pos.highest_profit_price) pos.highest_profit_price = low;
        }

        // 2. Trailing Stop Loss Logic
        if (pos.trailing) {
            const { activationPct, trailByPct } = pos.trailing;

            const currentProfitPct = pos.isLong
                ? ((pos.highest_profit_price - pos.entry_price) / pos.entry_price) * 100
                : ((pos.entry_price - pos.highest_profit_price) / pos.entry_price) * 100;

            if (currentProfitPct >= activationPct) {
                // Calculate new trailing SL
                let newSl = pos.isLong
                    ? pos.highest_profit_price * (1 - trailByPct / 100)
                    : pos.highest_profit_price * (1 + trailByPct / 100);

                // Only move SL in direction of trade
                if (pos.isLong && newSl > pos.stoploss) {
                    pos.stoploss = newSl;
                } else if (!pos.isLong && newSl < pos.stoploss) {
                    pos.stoploss = newSl;
                }
            }
        }

        // 3. Stoploss Check
        const slHit = pos.isLong ? low <= pos.stoploss : high >= pos.stoploss;
        if (slHit) {
            // Close the remaining quantity
            const exitPx = pos.stoploss; // Assume filled at SL
            events.push(this._executeExit(time, exitPx, pos.quantity, 'stoploss', candle));
            return events; // Position is fully closed, exit early
        }

        // 4. Take Profit Checks (Partial / Fixed)
        for (const tp of pos.tps) {
            if (tp.hit) continue;

            const tpHit = pos.isLong ? high >= tp.targetPrice : low <= tp.targetPrice;
            if (tpHit) {
                tp.hit = true;
                const qtyToExit = pos.quantity * (tp.qtyPct / 100);
                pos.quantity -= qtyToExit;

                events.push(this._executeExit(time, tp.targetPrice, qtyToExit, 'take_profit', candle));

                // Move stoploss to breakeven if configured
                if (tp.moveToBreakeven) {
                    pos.stoploss = pos.entry_price;
                }

                if (pos.quantity <= 0.01) { // Floating point safety
                    return events; // Position fully closed
                }
            }
        }

        return events;
    }

    /**
     * Force close the position at current price (e.g. exit signal)
     */
    closePosition(time, price, reason = 'exit_signal', candle = {}) {
        if (!this.position) return null;
        return this._executeExit(time, price, this.position.quantity, reason, candle);
    }

    /**
     * Internal method to execute an exit and record it.
     */
    _executeExit(time, price, quantity, reason, candle) {
        const pos = this.position;
        const profitPct = pos.isLong
            ? ((price - pos.entry_price) / pos.entry_price) * 100
            : ((pos.entry_price - price) / pos.entry_price) * 100;

        const exitRecord = {
            time,
            price,
            quantity_pct: quantity,
            reason,
            profit_pct: profitPct,
            metadata: candle
        };

        pos.exits.push(exitRecord);
        pos.quantity -= quantity;

        // Determine if this is a partial or full exit
        const type = pos.quantity > 0.01 ? 'partial_exit' : 'exit';

        const returnEvent = { signal: type, ...exitRecord, position: { ...pos } };

        // If position is completely closed, archive it to trade history
        if (pos.quantity <= 0.01) {
            this.trades.push({ ...pos });
            this.position = null; // Clear active position
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
