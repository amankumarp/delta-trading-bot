
import { GoogleGenAI } from "@google/genai";
import { Analysis, Trade } from "../types";

export const getStrategyAnalysis = async (analysis: Analysis, trades: Trade[]) => {
  // Use the process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Act as a professional algorithmic trading analyst. 
    Analyze the following backtest results for a BTC strategy and provide a concise, high-impact summary.
    
    Stats:
    - Win Rate: ${analysis.winRate}%
    - Total Profit: ${analysis.totalProfit}%
    - Profit Factor: ${analysis.profitFactor}
    - Max Drawdown: ${analysis.maxDrawdown}%
    - Sharpe Ratio: ${analysis.sharpeRatio}
    - Total Trades: ${analysis.totalTrades}
    
    Session Performance:
    ${JSON.stringify(analysis.sessionProfit)}
    
    Best Trade Profit: ${analysis.bestTrade.profit}%
    Worst Trade Profit: ${analysis.worstTrade.profit}%
    
    Questions to answer:
    1. Is this strategy robust?
    2. What are the key risks based on drawdown and profit factor?
    3. Which trading session seems most optimal?
    4. One specific recommendation to improve the strategy.
    
    Format the response in clean markdown with headers.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Access response.text property directly as per guidelines
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to generate AI insights. Check your API configuration.";
  }
};
