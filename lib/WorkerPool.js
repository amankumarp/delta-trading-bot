'use strict';

/**
 * lib/WorkerPool.js
 *
 * PHASE 3 — Worker Thread Pool for CPU-heavy compute.
 *
 * Replaces child_process.fork() with worker_threads, which:
 *   - Starts in ~5ms vs ~80ms for fork (reuses V8 isolate)
 *   - Supports SharedArrayBuffer for zero-copy OHLCV transfer
 *   - Workers are pooled and reused across requests (not created per-request)
 *   - Queues tasks when all workers are busy (no request drops)
 *
 * Usage:
 *   const pool = require('../lib/WorkerPool');
 *   const result = await pool.run('optimize', { ohlcvShared, opts });
 *   const result = await pool.run('backtest',   { ohlcvShared, opts });
 *   const result = await pool.run('robustness', { ohlcvShared, opts });
 */

const { Worker, isMainThread, parentPort, workerData, receiveMessageOnPort, MessageChannel } = require('worker_threads');
const os   = require('os');
const path = require('path');
const EventEmitter = require('events');

// Number of workers = CPU cores minus 1 (leave one for Express event loop)
const POOL_SIZE = Math.max(1, os.cpus().length - 1);
const WORKER_SCRIPT = path.join(__dirname, 'worker-entry.js');

// ─── OHLCV SharedArrayBuffer helpers ─────────────────────────────────────────

/**
 * Pack a columnar OHLCV object into a single SharedArrayBuffer.
 * Layout: [n, open[0..n-1], high[0..n-1], low[0..n-1], close[0..n-1], time[0..n-1], volume[0..n-1]]
 *
 * @param {{ open, high, low, close, time, volume }} ohlcv – Float64Arrays or plain arrays
 * @returns {{ sab: SharedArrayBuffer, n: number }}
 */
function packOHLCV(ohlcv) {
  const n   = ohlcv.close instanceof Float64Array ? ohlcv.close.length : ohlcv.close.length;
  // 1 header slot (n) + 6 channels × n slots, each 8 bytes (Float64)
  const sab = new SharedArrayBuffer((1 + 6 * n) * 8);
  const view = new Float64Array(sab);

  view[0] = n;
  for (let i = 0; i < n; i++) {
    view[1 + 0 * n + i] = ohlcv.open[i];
    view[1 + 1 * n + i] = ohlcv.high[i];
    view[1 + 2 * n + i] = ohlcv.low[i];
    view[1 + 3 * n + i] = ohlcv.close[i];
    view[1 + 4 * n + i] = ohlcv.time[i];
    view[1 + 5 * n + i] = ohlcv.volume[i];
  }

  return { sab, n };
}

/**
 * Unpack a SharedArrayBuffer back into columnar OHLCV arrays.
 * Called inside worker-entry.js.
 *
 * @param {SharedArrayBuffer} sab
 * @returns {{ open, high, low, close, time, volume }} – Float64Arrays (zero-copy views)
 */
function unpackOHLCV(sab) {
  const view = new Float64Array(sab);
  const n    = view[0];

  return {
    open:   view.subarray(1 + 0 * n, 1 + 1 * n),
    high:   view.subarray(1 + 1 * n, 1 + 2 * n),
    low:    view.subarray(1 + 2 * n, 1 + 3 * n),
    close:  view.subarray(1 + 3 * n, 1 + 4 * n),
    time:   view.subarray(1 + 4 * n, 1 + 5 * n),
    volume: view.subarray(1 + 5 * n, 1 + 6 * n),
  };
}

// ─── Worker Pool ──────────────────────────────────────────────────────────────

class WorkerPool extends EventEmitter {
  constructor(workerScript, size) {
    super();
    this._script  = workerScript;
    this._size    = size;
    this._workers = [];   // { worker, busy, id }
    this._queue   = [];   // { task, resolve, reject }
    this._ready   = false;

    this._init();
  }

  _init() {
    for (let i = 0; i < this._size; i++) {
      this._spawnWorker(i);
    }
    this._ready = true;
    console.log(`[WorkerPool] Initialised ${this._size} worker threads (${WORKER_SCRIPT})`);
  }

  _spawnWorker(id) {
    const worker = new Worker(this._script, { workerData: { workerId: id } });

    const entry = { worker, busy: false, id };
    this._workers.push(entry);

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker #${id} error:`, err.message);
      // Replace dead worker
      this._workers = this._workers.filter(w => w.id !== id);
      this._spawnWorker(id);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`[WorkerPool] Worker #${id} exited with code ${code}, respawning`);
        this._workers = this._workers.filter(w => w.id !== id);
        this._spawnWorker(id);
      }
    });
  }

  /**
   * Run a task on the next available worker.
   * If all workers are busy the task is queued and resolved when a worker frees up.
   *
   * @param {string} taskName  – 'optimize' | 'backtest' | 'robustness' | 'sensitivity'
   * @param {object} payload   – must include { sab } (SharedArrayBuffer from packOHLCV)
   * @param {object} [opts]    – additional serialisable options
   * @param {function} [onProgress] – optional callback for progress updates
   * @returns {Promise<any>}
   */
  run(taskName, payload, opts = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const task = { taskName, payload, opts, resolve, reject, onProgress };
      const freeWorker = this._workers.find(w => !w.busy);

      if (freeWorker) {
        this._dispatch(freeWorker, task);
      } else {
        this._queue.push(task);
      }
    });
  }

  _dispatch(entry, task) {
    entry.busy = true;

    const { port1, port2 } = new MessageChannel();

    entry.worker.postMessage(
      { taskName: task.taskName, payload: task.payload, opts: task.opts, port: port2 },
      [port2] // transfer ownership of port2 to worker
    );

    port1.on('message', (msg) => {
      if (msg && msg.type === 'progress') {
        if (task.onProgress) task.onProgress(msg);
        return;
      }

      port1.close();
      entry.busy = false;

      // Drain queue
      if (this._queue.length) {
        const next = this._queue.shift();
        this._dispatch(entry, next);
      }

      if (msg.error) {
        task.reject(new Error(msg.error));
      } else {
        task.resolve(msg.result);
      }
    });
  }

  /**
   * Gracefully shut down all workers.
   */
  async shutdown() {
    await Promise.all(this._workers.map(w => w.worker.terminate()));
    this._workers = [];
    console.log('[WorkerPool] All workers terminated');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _pool = null;

/**
 * Get the shared WorkerPool singleton.
 * Workers are created lazily on first call.
 */
function getPool() {
  if (!_pool) {
    _pool = new WorkerPool(WORKER_SCRIPT, POOL_SIZE);
  }
  return _pool;
}

module.exports = { getPool, packOHLCV, unpackOHLCV, POOL_SIZE };
