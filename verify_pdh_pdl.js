const assert = require('assert');
const registry = require('./services/strategy/StrategyRegistry');

console.log('--- Verifying PDH/PDL Sweep Reversal Strategy Integration ---');

// 1. Verify registry entry
const entry = registry.get('pdh-pdl-sweep');
assert.ok(entry, 'Strategy "pdh-pdl-sweep" must be present in StrategyRegistry');
assert.strictEqual(entry.description, 'PDH/PDL Sweep Reversal — ICT/SMC Liquidity Sweep Reversal with Multi-Tier TP');

// 2. Verify listMeta()
const metas = registry.listMeta();
const pdhMeta = metas.find(m => m.slug === 'pdh-pdl-sweep');
assert.ok(pdhMeta, 'pdh-pdl-sweep must be returned by listMeta()');
console.log('✅ Registry & Meta check passed:', pdhMeta.slug, '|', pdhMeta.description);

// 3. Generate mock 1-hour candles over 3 UTC days (72 candles)
const time = [];
const open = [];
const high = [];
const low = [];
const close = [];
const volume = [];

// Start at 2024-06-01 00:00:00 UTC (1717200000)
const baseTime = 1717200000;
let price = 100.0;

for (let i = 0; i < 72; i++) {
    const ts = baseTime + i * 3600;
    time.push(ts);
    volume.push(1000);

    const dayIdx = Math.floor(i / 24);
    if (dayIdx === 0) {
        // Day 1: range 95.0 to 105.0
        const o = 100.0;
        const c = i === 12 ? 105.0 : (i === 18 ? 95.0 : 100.0);
        const h = Math.max(o, c) + 0.5;
        const l = Math.min(o, c) - 0.5;
        open.push(o);
        high.push(h);
        low.push(l);
        close.push(c);
    } else if (dayIdx === 1) {
        // Day 2: PDH is ~105.5, PDL is ~94.5
        // Let's create a liquidity sweep ABOVE PDH around noon UTC (London/NY overlap ~13:00 UTC, i = 37)
        if (i === 36) {
            // Candle sweeps above 105.5
            open.push(105.0);
            high.push(106.5); // sweeps PDH!
            low.push(104.9);
            close.push(106.2);
        } else if (i === 37) {
            // Bearish rejection candle entirely above PDH (105.5)
            open.push(106.2);
            high.push(106.3);
            low.push(105.6); // > 105.5
            close.push(105.7); // close < open (bearish) -> shortState becomes 2, sigLow = 105.6
        } else if (i === 38) {
            // Structure break below sigLow (105.6)
            open.push(105.7);
            high.push(105.8);
            low.push(104.8); // < 105.6 -> TRIGGERS SHORT ENTRY!
            close.push(105.0);
        } else if (i > 38 && i <= 45) {
            // Price drops toward take profit levels
            const drop = (i - 38) * 1.5;
            open.push(105.0 - drop + 1.5);
            high.push(105.0 - drop + 1.5);
            low.push(105.0 - drop - 0.5);
            close.push(105.0 - drop);
        } else {
            open.push(100.0);
            high.push(101.0);
            low.push(99.0);
            close.push(100.0);
        }
    } else {
        // Day 3
        open.push(100.0);
        high.push(101.0);
        low.push(99.0);
        close.push(100.0);
    }
}

// 4. Run PdhPdlStrategy
const Cls = entry.Cls;
const strategy = new Cls(entry.parseOpts({ sessionFilter: 'All' }));
const result = strategy.generateSignals({ time, open, high, low, close, volume });

const expectedLength = 72 - 14; // startIndex = 14 (atrLen)
assert.strictEqual(result.candles.length, expectedLength, `Must return ${expectedLength} candles`);
assert.ok(result.signals, 'Must return signals array');

// Check that PDH/PDL were populated for Day 2 (i >= 24, which in result.candles is index >= 10)
const day2Candle = result.candles[16];
assert.ok(day2Candle.pdh > 0 && day2Candle.pdl > 0, 'PDH and PDL must be calculated for Day 2');
console.log('✅ PDH/PDL Boundary check passed: Day 2 PDH =', day2Candle.pdh, 'PDL =', day2Candle.pdl);

// Check if any signal was generated
console.log('✅ Total signals generated:', result.signals.length);
result.signals.forEach((s, idx) => {
    console.log(`   [Signal ${idx+1}] ${s.datetime} | Type: ${s.signal} | Price: ${s.price} | Profit: ${s.profit !== undefined ? s.profit.toFixed(2) + '%' : 'N/A'}`);
});

assert.ok(result.signals.length > 0, 'At least one signal (entry/exit) should be generated from the sweep scenario');
console.log('--- ALL PDH/PDL STRATEGY TESTS PASSED SUCCESSFULLY! ---');
