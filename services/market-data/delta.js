const axios = require('axios');
const EventBus = require('../../lib/EventBus');

// ─── Phase 6: Circuit Breaker State ───────────────────────────────────────────
const BREAKER = {
  failures: 0,
  maxFailures: 5,
  cooldownMs: 5 * 60 * 1000, // 5 minutes
  nextRetryTime: 0,
  isOpen: function() {
    if (this.failures >= this.maxFailures) {
      if (Date.now() < this.nextRetryTime) {
        return true;
      }
      // Half-open: allow one request through
    }
    return false;
  },
  recordSuccess: function() {
    if (this.failures > 0) {
      console.log('[CircuitBreaker] Upstream recovered. Breaker closed.');
      this.failures = 0;
    }
  },
  recordFailure: function(err) {
    this.failures++;
    if (this.failures === this.maxFailures) {
      this.nextRetryTime = Date.now() + this.cooldownMs;
      console.error(`[CircuitBreaker] Tripped! Upstream API down. Cooldown for ${this.cooldownMs / 1000}s`);
      EventBus.emitError('CircuitBreaker', new Error('Upstream API circuit breaker tripped'));
    }
  }
};

async function fetchCandlesFromDelta(symbol, interval, from, to) {
  if (BREAKER.isOpen()) throw new Error('Circuit breaker open (Delta)');
  
  try {
    const res = await axios.get("https://api.delta.exchange/v2/history/candles", {
      params: { symbol, resolution: interval, start: from, end: to },
      timeout: 30000
    });
    if (res.status !== 200) throw new Error(`Failed to fetch candles: ${res.statusText}`);
    if (!res.data || !res.data.result) throw new Error("Invalid response format from Delta API");
    
    BREAKER.recordSuccess();
    return res.data.result || [];
  } catch (err) {
    BREAKER.recordFailure(err);
    throw err;
  }
}

async function fetchCandlesFromCoinDCX(symbol, interval, from, to) {
  if (BREAKER.isOpen()) throw new Error('Circuit breaker open (CoinDCX)');
  
  try {
    const url = "https://public.coindcx.com/market_data/candlesticks";
    const params = {
      pair: "B-" + symbol,
      resolution: interval,
      from,
      to,
      pcode: 'f'
    };
    
    const res = await axios.get(url, { params, timeout: 30000 });
    if (res.status !== 200) throw new Error(`Failed to fetch candles: ${res.statusText}`);
    if (!res.data.data || !Array.isArray(res.data.data)) throw new Error("Invalid response format from CoinDCX");
    
    BREAKER.recordSuccess();
    return res.data.data;
  } catch (err) {
    BREAKER.recordFailure(err);
    console.error("[delta.js] fetchCandles error:", err.message);
    throw err;
  }
}

module.exports = { fetchCandlesFromDelta, fetchCandlesFromCoinDCX };
