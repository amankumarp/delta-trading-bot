'use strict';

/**
 * services/strategy/index.js
 *
 * PHASE 4 — Strategy Service (refactored with StrategyRegistry).
 *
 * Before: 5 identical copy-paste route handlers (~40 lines each = 200+ lines)
 * After:  1 generic handler + StrategyRegistry lookup (~30 lines total)
 *
 * Adding a new strategy = 1 line in StrategyRegistry.js, zero changes here.
 *
 * Routes:
 *   GET /strategy/:name   – run a named strategy on candle data
 *   GET /strategies       – list all available strategies with metadata
 *   GET /health           – service health check
 */

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const { convertOHLCVtoArray, generateTradeReport } = require('./utils');
const registry = require('./StrategyRegistry');

// Phase 2 — single canonical trade builder (replaces local generateImbaTradeReport)
const { generateImbaTradeReport } = require('../../lib/TradeBuilder');

const app  = express();
const PORT = process.env.STRATEGY_SERVICE_PORT || 3002;
const MARKET_DATA_URL = process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3000/api';
const crypto = require('crypto');

app.use(cors());
app.use(express.json());

let requestCount = 0;

// ── Phase 6: Structured Request Logging with Correlation ID ───────────────────
app.use((req, res, next) => {
  requestCount++;
  req.id = req.headers['x-correlation-id'] || crypto.randomUUID();
  const start = Date.now();
  res.setHeader('X-Correlation-ID', req.id);
  
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      req_id: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      latency_ms: elapsed,
      service: 'strategy'
    }));
  });
  next();
});

// ─── GET /strategies ──────────────────────────────────────────────────────────

app.get('/strategies', (req, res) => {
  res.json({ strategies: registry.listMeta() });
});

// ─── GET /health ──────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'strategy', 
    port: PORT, 
    uptime: process.uptime(),
    requests: requestCount
  });
});

// ─── GET /strategy/:name — SINGLE GENERIC HANDLER ────────────────────────────

/**
 * Replaces 5 copy-paste handlers for:
 *   /strategy/supertrend-ai
 *   /strategy/bb-ai
 *   /strategy/scalping-ai
 *   /strategy/sats
 *   /strategy/imba-algo
 */
app.get('/strategy/:name', async (req, res) => {
  const { name }  = req.params;
  const { symbol, interval, start, end, onlytrade } = req.query;

  // ── Registry lookup ──────────────────────────────────────────────────────
  const entry = registry.get(name);
  if (!entry) {
    return res.status(404).json({ error: `Unknown strategy: ${name}`, available: registry.list() });
  }
  if (entry.disabled) {
    return res.status(503).json({ error: `Strategy '${name}' is not available on this server` });
  }
  if (!symbol || !interval) {
    return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
  }

  try {
    // ── Fetch candle data from Market Data Service ────────────────────────
    const mdRes = await axios.get(`${MARKET_DATA_URL}/candles`, {
      params: { symbol, interval, from: start, to: end },
      timeout: 30_000,
    });

    const ohlcv   = convertOHLCVtoArray(mdRes.data);
    const { open, high, low, close, time, volume } = ohlcv;

    console.log(`[strategy/${name}] ${symbol} ${interval} — ${close.length} candles`);

    // ── Instantiate strategy and generate signals ─────────────────────────
    const opts     = entry.parseOpts(req.query);
    const strategy = new entry.Cls(opts);
    const response = strategy.generateSignals({ open, high, low, close, time, volume });

    // ── Build response ────────────────────────────────────────────────────
    if (onlytrade) {
      // For ImbaAlgo use the richer trade reporter; all others use the generic one
      const trades = name === 'imba-algo'
        ? generateImbaTradeReport(response.candles)
        : generateTradeReport(response.candles);

      return res.json({
        trades,
        candles:  response.candles,
        summary:  response.summary,   // may be undefined for non-imba strategies
      });
    }

    return res.json({
      signal:   response.signals,
      candles:  response.candles,
      summary:  response.summary,
    });

  } catch (error) {
    console.error(`[strategy/${name}] Error:`, error.message);
    res.status(500).json({ error: `Failed to generate ${name} signals`, details: error.message });
  }
});

// ─── Backward-compat aliases (old hard-coded paths still work) ────────────────
// These redirect to the generic handler — no logic duplication.
for (const slug of registry.list()) {
  // /strategy/imba-algo is already handled by :name above.
  // The loop is a no-op here but makes the intent explicit and
  // allows future middleware (auth, rate-limit) to be added per-slug.
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[strategy] Service running on port ${PORT}`);
  console.log(`[strategy] Available strategies: ${registry.list().join(', ')}`);
});