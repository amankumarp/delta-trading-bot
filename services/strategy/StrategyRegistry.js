'use strict';

/**
 * services/strategy/StrategyRegistry.js
 *
 * PHASE 4 — Strategy Registry.
 *
 * Maps strategy slugs to their class constructors and parameter schemas.
 * Adding a new strategy = 1 line here, zero changes to route handlers.
 *
 * Previously: 5 identical copy-paste GET handlers in index.js, each ~40 lines.
 * Now: 1 generic handler in index.js + this registry.
 *
 * Each registry entry has:
 *   Cls           – Strategy class constructor
 *   parseOpts     – function(query) → opts object (strategy-specific params)
 *   useHeikinAshi – whether to convert candles to Heikin-Ashi before signals
 *   description   – human-readable description
 */

const SupertrendAI     = require('./SupertrendStrategy');
const BollingerBandAI  = require('./bbStrategy');
const SATSStrategy     = require('./SATSStrategy');
const ImbaAlgoStrategy = require('./ImbaAlgoStrategy');

let ScalpingStrategy = null;
try { ScalpingStrategy = require('./ScalpingStrategy'); } catch (_) {}

// ─── Parameter parsers (strategy-specific query params → opts object) ─────────

function parseSupertrendOpts(q) {
  const opts = {};
  if (q.atrPeriod)  opts.atrPeriod  = parseInt(q.atrPeriod);
  if (q.multiplier) opts.multiplier = parseFloat(q.multiplier);
  return opts;
}

function parseBBOpts(q) {
  const opts = {};
  if (q.period)      opts.period      = parseInt(q.period);
  if (q.stdDev)      opts.stdDev      = parseFloat(q.stdDev);
  if (q.rsiPeriod)   opts.rsiPeriod   = parseInt(q.rsiPeriod);
  return opts;
}

function parseScalpingOpts(q) {
  const opts = {};
  if (q.emaFast)     opts.emaFast     = parseInt(q.emaFast);
  if (q.emaSlow)     opts.emaSlow     = parseInt(q.emaSlow);
  if (q.rsiPeriod)   opts.rsiPeriod   = parseInt(q.rsiPeriod);
  if (q.atrPeriod)   opts.atrPeriod   = parseInt(q.atrPeriod);
  if (q.riskReward)  opts.riskReward  = parseFloat(q.riskReward);
  return opts;
}

function parseSATSOpts(q) {
  const opts = {};
  if (q.atrLen)    opts.atrLen    = parseInt(q.atrLen);
  if (q.baseMult)  opts.baseMult  = parseFloat(q.baseMult);
  if (q.erLen)     opts.erLen     = parseInt(q.erLen);
  if (q.useDynTp)  opts.useDynTp  = q.useDynTp === 'true';
  if (q.minScore)  opts.minScore  = parseFloat(q.minScore);
  return opts;
}

function parseImbaOpts(q) {
  const opts = {};
  if (q.sensitivity)     opts.sensitivity     = parseFloat(q.sensitivity);
  if (q.riskPercent)     opts.riskPercent     = parseFloat(q.riskPercent);
  if (q.tp1Pct)          opts.tp1Pct          = parseFloat(q.tp1Pct);
  if (q.tp1SizePct)      opts.tp1SizePct      = parseFloat(q.tp1SizePct);
  if (q.tp2Pct)          opts.tp2Pct          = parseFloat(q.tp2Pct);
  if (q.tp2SizePct)      opts.tp2SizePct      = parseFloat(q.tp2SizePct);
  if (q.tp3Pct)          opts.tp3Pct          = parseFloat(q.tp3Pct);
  if (q.tp3SizePct)      opts.tp3SizePct      = parseFloat(q.tp3SizePct);
  if (q.tp4Pct)          opts.tp4Pct          = parseFloat(q.tp4Pct);
  if (q.tp4SizePct)      opts.tp4SizePct      = parseFloat(q.tp4SizePct);
  if (q.breakEvenTarget) opts.breakEvenTarget = q.breakEvenTarget; // '1'|'2'|'3'|'WITHOUT'
  if (q.fixedStop)       opts.fixedStop       = q.fixedStop === 'true';
  if (q.slPercent)       opts.slPercent       = parseFloat(q.slPercent);
  if (q.rsiLen)          opts.rsiLen          = parseInt(q.rsiLen);
  if (q.rsiOB)           opts.rsiOB           = parseFloat(q.rsiOB);
  if (q.rsiOS)           opts.rsiOS           = parseFloat(q.rsiOS);
  if (q.useRsiFilter)    opts.useRsiFilter    = q.useRsiFilter === 'true';
  return opts;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const REGISTRY = {
  'supertrend-ai': {
    Cls:           SupertrendAI,
    parseOpts:     parseSupertrendOpts,
    useHeikinAshi: false,
    description:   'Supertrend AI — ATR-based adaptive trend following',
  },
  'bb-ai': {
    Cls:           BollingerBandAI,
    parseOpts:     parseBBOpts,
    useHeikinAshi: false,
    description:   'Bollinger Band AI — volatility breakout with RSI filter',
  },
  'scalping-ai': {
    Cls:           ScalpingStrategy,
    parseOpts:     parseScalpingOpts,
    useHeikinAshi: false,
    description:   'BTC Scalping AI — EMA ribbon + MACD + ATR trailing SL',
    disabled:      !ScalpingStrategy,
  },
  'sats': {
    Cls:           SATSStrategy,
    parseOpts:     parseSATSOpts,
    useHeikinAshi: false,
    description:   'Self-Aware Trend System v1.9.0 — adaptive TQI + dynamic TP',
  },
  'imba-algo': {
    Cls:           ImbaAlgoStrategy,
    parseOpts:     parseImbaOpts,
    useHeikinAshi: false,
    description:   'Imba Algo — Fibonacci-based multi-TP trend system',
  },
};

/**
 * Get a registry entry by slug.
 * @param {string} name
 * @returns {{ Cls, parseOpts, useHeikinAshi, description } | null}
 */
function get(name) {
  return REGISTRY[name] || null;
}

/**
 * List all registered strategy slugs.
 * @returns {string[]}
 */
function list() {
  return Object.keys(REGISTRY);
}

/**
 * Get metadata (name + description) for all strategies, for the /strategies endpoint.
 */
function listMeta() {
  return Object.entries(REGISTRY).map(([slug, entry]) => ({
    slug,
    description: entry.description,
    available: !entry.disabled,
  }));
}

module.exports = { get, list, listMeta };
