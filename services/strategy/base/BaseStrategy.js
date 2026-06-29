const TradeManager = require('./TradeManager');

/**
 * BaseStrategy — Production Grade Strategy Framework
 * 
 * Enforces strict decoupling, dynamic position sizing based on risk, 
 * and standardized payload generation for backtesting and live execution.
 */
class BaseStrategy {
  constructor(config = {}) {
    this.config = config;
    this.tradeManager = new TradeManager();
    this.pendingTrades = [];
  }

  /**
   * Must be implemented by child classes. 
   * Pre-allocates and computes all indicator arrays here.
   */
  prepareIndicators(ohlcv) {
    throw new Error('prepareIndicators() must be implemented by strategy');
  }

  /**
   * Must be implemented by child classes.
   * Contains the core bar-by-bar evaluation loop.
   */
  generateSignals(ohlcv) {
    throw new Error('generateSignals() must be implemented by strategy');
  }

  /**
   * Standard Position Sizing Formula
   * Size = Risk Amount / SL Distance
   * 
   * @param {number} entryPrice - Expected fill price
   * @param {number} slPrice - Hard stop loss price
   * @param {number} accountBalance - Total equity
   * @param {number} riskPercent - e.g., 0.01 for 1%
   * @param {number} maxLeverage - e.g., 50
   * @returns {number} The calculated quote size for the position
   */
  calculatePositionSize(entryPrice, slPrice, accountBalance, riskPercent, maxLeverage = 50) {
    if (!entryPrice || !slPrice) return 0;
    
    const riskAmount = accountBalance * riskPercent;
    const slDistancePct = Math.abs(entryPrice - slPrice) / entryPrice;
    
    // Safety check: if SL is too tight (< 0.05%), reject trade to avoid fee/slippage destruction
    if (slDistancePct < 0.0005) return 0;

    let targetSize = riskAmount / slDistancePct;
    const maxAllowedSize = accountBalance * maxLeverage;

    // Hard-cap leverage
    if (targetSize > maxAllowedSize) {
      targetSize = maxAllowedSize;
    }

    return targetSize;
  }

  /**
   * Emits a strict, standardized trade signal payload
   */
  emitSignal(payload) {
    // Validate payload against production framework rules
    if (!payload.symbol || !payload.time || !payload.type || !payload.side) {
      throw new Error('Invalid signal payload: Missing required fields');
    }
    
    if (payload.type === 'ENTRY' && !payload.stopLoss) {
      throw new Error('Invalid signal payload: ENTRY must have a hard stopLoss');
    }

    this.pendingTrades.push(payload);
  }

  /**
   * Consumes all pending signals generated on the current tick
   */
  consumeSignals() {
    const signals = [...this.pendingTrades];
    this.pendingTrades = [];
    return signals;
  }
}

module.exports = BaseStrategy;
