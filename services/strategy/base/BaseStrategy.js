class BaseStrategy {
  constructor() {
    this.pendingTrade = null
  }

  prepareIndicators(data) {
    throw new Error('prepareIndicators() not implemented')
  }

  onCandle(index, data) {
    throw new Error('onCandle() not implemented')
  }

  emitTrade(tradePayload) {
    this.pendingTrade = tradePayload
  }

  consumeTrade() {
    const t = this.pendingTrade
    this.pendingTrade = null
    return t
  }
}

module.exports = BaseStrategy
