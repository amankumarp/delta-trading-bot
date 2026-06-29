'use strict';

/**
 * analytics/optimizer-worker.js
 *
 * PHASE 3 (updated) — Legacy child_process worker adapter.
 *
 * NOTE: As of Phase 3, /api/optimize now uses WorkerPool (worker_threads)
 * which dispatches to lib/worker-entry.js. This file is kept for backward
 * compatibility and as a fallback, but no longer makes HTTP requests.
 *
 * If called via child_process.fork() (legacy), it delegates to Optimizer
 * directly using OHLCV data supplied in the message payload (no HTTP fetch).
 *
 * If called as a standalone script, it exits cleanly.
 */

const path = require('path');
const Optimizer  = require('./Optimizer');
const { unpackOHLCV } = require('../lib/WorkerPool');

// ── Handle messages from a parent process (legacy fork mode) ──────────────────
process.on('message', ({ opts, ohlcv: rawOHLCV, sab }) => {
    try {
        let ohlcv;

        if (sab) {
            // Phase 3: data passed as SharedArrayBuffer (zero-copy)
            ohlcv = unpackOHLCV(sab);
        } else if (rawOHLCV) {
            // Fallback: data passed directly in message (small datasets only)
            ohlcv = rawOHLCV;
        } else {
            process.send({ type: 'error', message: 'No OHLCV data provided to optimizer-worker' });
            process.exit(1);
            return;
        }

        if (!ohlcv || !ohlcv.close || ohlcv.close.length < 50) {
            process.send({ type: 'error', message: 'Insufficient candle data (need ≥ 50 bars)' });
            process.exit(1);
            return;
        }

        const engineOpts = {
            initialBalance:      opts.initialBalance      ?? 10000,
            leverage:            opts.leverage            ?? 200,
            fee:                 opts.fee                 ?? 0.01,
            riskPercentPerTrade: opts.riskPercentPerTrade ?? 1,
        };

        const result = Optimizer.runGrid(ohlcv, engineOpts, {
            mode:        opts.mode        ?? 'fast',
            topN:        opts.topN        ?? 10,
            minTrades:   opts.minTrades   ?? 3,
            verbose:     opts.verbose     ?? false,
            fixedParams: opts.fixedParams ?? {},
            paramSpace:  opts.paramSpace,
        });

        process.send({ type: 'result', data: result });

    } catch (err) {
        process.send({ type: 'error', message: err.message });
    }

    process.exit(0);
});
