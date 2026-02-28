class TradeState {
  constructor({ side, entry, stoploss, atr, atrMultiplier }) {
    this.side = side               // LONG | SHORT
    this.entry = entry
    this.stoploss = stoploss

    this.R = Math.abs(entry - stoploss)

    this.tp1 = side === 'LONG'
      ? entry + this.R
      : entry - this.R

    this.tp2 = side === 'LONG'
      ? entry + 2 * this.R
      : entry - 2 * this.R

    this.partialDone = false
    this.atr = atr
    this.atrMultiplier = atrMultiplier
  }

  updateTrailing(price) {
    const trail = this.side === 'LONG'
      ? price - this.atr * this.atrMultiplier
      : price + this.atr * this.atrMultiplier

    if (
      (this.side === 'LONG' && trail > this.stoploss) ||
      (this.side === 'SHORT' && trail < this.stoploss)
    ) {
      this.stoploss = trail
    }
  }

  hitStop(low, high) {
    return this.side === 'LONG'
      ? low <= this.stoploss
      : high >= this.stoploss
  }
}

module.exports = TradeState
