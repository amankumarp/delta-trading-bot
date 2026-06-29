const fs = require('fs');
let code = fs.readFileSync('client/App.tsx', 'utf8');

const replacements = {
  'setStrategy': 'strategy',
  'setSymbol': 'symbol',
  'setIntervalVal': 'interval',
  'setStartDateTime': 'startDateTime',
  'setEndDateTime': 'endDateTime',
  'setBalance': 'balance',
  'setLeverage': 'leverage',
  'setRisk': 'risk',
  'setFee': 'fee',
  'setImbaSensitivity': 'imbaSensitivity',
  'setImbaRiskPercent': 'imbaRiskPercent',
  'setImbaTP1Pct': 'imbaTP1Pct',
  'setImbaTP1Size': 'imbaTP1Size',
  'setImbaTP2Pct': 'imbaTP2Pct',
  'setImbaTP2Size': 'imbaTP2Size',
  'setImbaTP3Pct': 'imbaTP3Pct',
  'setImbaTP3Size': 'imbaTP3Size',
  'setImbaTP4Pct': 'imbaTP4Pct',
  'setImbaTP4Size': 'imbaTP4Size',
  'setImbaBreakEven': 'imbaBreakEven',
  'setImbaSLPct': 'imbaSLPct',
  'setImbaRsiLen': 'imbaRsiLen',
  'setImbaRsiOB': 'imbaRsiOB',
  'setImbaRsiOS': 'imbaRsiOS'
};

for (const [setter, key] of Object.entries(replacements)) {
  const regex = new RegExp(setter + '\\(([^)]+)\\)', 'g');
  code = code.replace(regex, `updateParams({ ${key}: $1 })`);
}

// Special case for booleans which might be used like setImbaFixedStop(e.target.checked)
code = code.replace(/setImbaFixedStop\(([^)]+)\)/g, `updateParams({ imbaFixedStop: $1 })`);
code = code.replace(/setImbaUseRsi\(([^)]+)\)/g, `updateParams({ imbaUseRsi: $1 })`);
code = code.replace(/setApiUrl\(([^)]+)\)/g, `updateParams({ apiUrl: $1 })`);

fs.writeFileSync('client/App.tsx', code);
