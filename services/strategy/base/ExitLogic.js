class ExitLogic {
  static manage(trade, candle) {
    const { close, high, low } = candle

    // 1️⃣ Stoploss check
    if (trade.hitStop(low, high)) {
      return { type: 'STOPLOSS' }
    }

    // 2️⃣ Partial exit at 1R
    if (!trade.partialDone) {
      if (
        (trade.side === 'LONG' && close >= trade.tp1) ||
        (trade.side === 'SHORT' && close <= trade.tp1)
      ) {
        trade.partialDone = true
        return { type: 'PARTIAL_EXIT', price: close }
      }
    }

    // 3️⃣ Trailing after partial
    if (trade.partialDone) {
      trade.updateTrailing(close)
    }

    // 4️⃣ Final exit at 2R
    if (
      (trade.side === 'LONG' && close >= trade.tp2) ||
      (trade.side === 'SHORT' && close <= trade.tp2)
    ) {
      return { type: 'FULL_EXIT', price: close }
    }

    return null
  }
}

module.exports = ExitLogic
