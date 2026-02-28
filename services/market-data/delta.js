const axios = require('axios');


async function fetchCandlesFromDelta(symbol, interval, from, to) {
  const res = await axios.get("https://api.delta.exchange/v2/history/candles", {
    params: {
      symbol: symbol,
      resolution: interval,
      start: from,
      end: to
    }
  });
  if (res.status !== 200) {
    throw new Error(`Failed to fetch candles: ${res.statusText}`);
  }
  if (!res.data || !res.data.result) {
    throw new Error("Invalid response format from Delta API");
  }
  return res.data.result||[];
}

async function fetchCandlesFromCoinDCX(symbol, interval, from, to) {
  
  try {
    const url = "https://public.coindcx.com/market_data/candlesticks";
    const params = {
      pair: "B-" + symbol,
      resolution: interval,
      from,
      to,
      pcode:'f'
    };

    
    const res = await axios.get(url, { params });

    if (res.status !== 200) {
      throw new Error(`Failed to fetch candles: ${res.statusText}`);
    }
   
    if (!res.data.data || !Array.isArray(res.data.data)) {
      throw new Error("Invalid response format from CoinDCX public candles endpoint");
    }
    return res.data.data;
  } catch (err) {
    console.error("fetchCandles error:", err.message);
    throw err;
  }
}



module.exports = { fetchCandlesFromDelta,fetchCandlesFromCoinDCX };
