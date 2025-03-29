

function calculatePositionAndLotSize(tradeType, accountBalance, riskPercentage, entryPrice, stopLossPrice, lotSize = 0.001) {
    if (!["BUY", "SELL"].includes(tradeType.toUpperCase())) {
        throw new Error("Invalid trade type. Must be 'BUY' or 'SELL'.");
    }
    if (accountBalance <= 0 || riskPercentage <= 0 || entryPrice <= 0 || stopLossPrice <= 0) {
        throw new Error("Invalid input values. All values must be greater than zero.");
    }

    // Calculate stop loss distance in USD
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);

    if (stopLossDistance <= 0) {
        throw new Error("Stop loss distance must be greater than zero.");
    }

    // Calculate risk amount (USD risk per trade)
    const riskAmount = (accountBalance * riskPercentage) / 100;

    // Calculate position size (in BTC)
    const positionSizeBTC = riskAmount / stopLossDistance;

    // Convert BTC position size to lots (1 lot = 0.001 BTC)
    const positionSizeLots = positionSizeBTC / lotSize;

    // Calculate TP levels based on trade type (Buy or Sell)
    const tp1 = tradeType.toUpperCase() === "BUY" ? entryPrice + (stopLossDistance * 1.5) : entryPrice - (stopLossDistance * 1.5); // 1:1.5 RR
    const tp2 = tradeType.toUpperCase() === "BUY" ? entryPrice + (stopLossDistance * 2) : entryPrice - (stopLossDistance * 2);   // 1:2 RR
    const tp3 = tradeType.toUpperCase() === "BUY" ? entryPrice + (stopLossDistance * 3) : entryPrice - (stopLossDistance * 3);   // 1:3 RR

    return {
        tradeType: tradeType.toUpperCase(),
        positionSizeLots: parseFloat(positionSizeLots.toFixed(2)), // Rounded to 2 decimal places
        positionSizeBTC: parseFloat(positionSizeBTC.toFixed(6)),   // Rounded to 6 decimal places (BTC precision)
        stopLossDistance,
        tp1: parseFloat(tp1.toFixed(1)),
        tp2: parseFloat(tp2.toFixed(1)),
        tp3: parseFloat(tp3.toFixed(1))
    };
}

module.exports ={
    calculatePositionAndLotSize
}