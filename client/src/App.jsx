import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Home, BarChart2, TrendingUp, Cpu, Target, Save, RefreshCw, Info, Database } from 'lucide-react'; // Added Database icon

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';

// --- Initial Data (from user prompt) ---
// This data will be used if no data is found in Firestore, and then saved to Firestore.
const initialAnalysisData = {
    "startTime": "12/07/2024, 18:30:00",
    "endTime": "17/06/2025, 04:00:00",
    "totalDays": 339,
    "totalTrades": 540,
    "winRate": "35.19",
    "totalProfit": "127.25",
    "profitFactor": "2.00",
    "maxDrawdown": "-0.45",
    "avgProfit": "0.24",
    "avgRisk": "0.40",
    "sharpeRatio": "0.20",
    "maxWinStreak": 6,
    "maxLossStreak": 10,
    "avgRMultiple": "0.90",
    "largestDrawdown": "7.14",
    "avgDurationWins": "8.81",
    "avgDurationLosses": "8.24",
    "maxProfitDay": "6.30",
    "maxLossDay": "-3.04",
    "maxProfitMonthly": "23.51",
    "maxLossMonthly": "0.97",
    "stoplossTouched": 316,
    "cumulativeProfit": ["0.15", "-0.45", "0.34", "2.30", "6.47", "8.08", "9.82", "9.27", "9.91", "9.46", "9.03", "8.58", "8.18", "11.54", "11.25", "11.61", "11.32", "10.82", "10.77", "10.59", "12.63", "12.25", "13.51", "13.05", "15.22", "14.68", "14.07", "14.41", "14.31", "13.65", "13.34", "13.04", "14.23", "13.67", "13.41", "16.84", "16.26", "16.07", "15.76", "15.82", "15.17", "14.56", "16.25", "16.47", "18.12", "18.23", "17.79", "17.54", "17.58", "20.92", "20.73", "20.23", "21.62", "21.47", "21.78", "24.37", "24.23", "23.99", "23.73", "23.68", "22.95", "22.39", "22.07", "23.39", "24.59", "24.39", "24.16", "23.95", "24.95", "24.70", "24.26", "25.61", "25.30", "27.38", "28.98", "30.79", "30.28", "30.07", "29.82", "30.03", "29.84", "29.69", "29.47", "30.44", "30.28", "29.94", "29.58", "28.88", "32.19", "32.35", "32.21", "31.78", "32.56", "32.13", "35.28", "34.85", "39.57", "39.57", "39.07", "38.86", "38.97", "38.64", "38.30", "37.87", "38.10", "37.97", "37.72", "38.10", "37.61", "37.07", "39.94", "39.86", "39.91", "39.76", "43.16", "42.52", "42.18", "41.84", "41.98", "41.38", "41.13", "40.37", "40.11", "39.87", "40.77", "40.30", "40.12", "39.95", "40.11", "39.81", "39.54", "39.28", "38.72", "38.24", "39.19", "38.77", "38.47", "38.02", "38.62", "41.76", "42.09", "41.44", "41.09", "45.09", "44.72", "44.25", "43.71", "44.50", "44.37", "44.24", "44.10", "44.38", "43.75", "43.55", "42.86", "43.20", "42.85", "42.42", "41.80", "42.76", "43.33", "42.95", "42.67", "42.53", "42.35", "42.16", "41.99", "41.78", "41.63", "42.05", "42.13", "41.47", "40.88", "40.47", "40.22", "40.99", "40.77", "40.44", "39.81", "39.30", "38.92", "38.65", "39.62", "38.93", "40.23", "45.20", "45.45", "46.17", "51.09", "56.09", "55.54", "59.84", "59.57", "59.34", "58.91", "58.44", "57.95", "57.66", "57.45", "58.38", "57.60", "60.89", "60.83", "61.38", "61.44", "64.69", "64.07", "63.37", "62.99", "62.50", "62.00", "64.06", "64.40", "64.78", "64.58", "64.39", "64.61", "64.20", "64.99", "64.40", "65.16", "64.81", "64.22", "69.61", "71.25", "71.21", "70.99", "70.54", "70.69", "70.19", "69.64", "69.00", "68.23", "67.57", "67.38", "66.98", "66.39", "66.12", "65.81", "66.21", "66.98", "67.12", "66.76", "69.55", "72.47", "71.75", "71.03", "71.84", "71.31", "70.96", "71.34", "72.38", "71.86", "71.50", "71.12", "70.73", "69.99", "69.50", "70.13", "70.04", "69.78", "70.80", "70.59", "70.27", "69.96", "70.17", "69.75", "69.33", "71.98", "71.41", "72.61", "72.60", "72.33", "72.03", "74.14", "74.19", "74.34", "74.06", "73.93", "73.64", "73.42", "73.29", "73.19", "72.82", "73.02", "72.72", "72.42", "72.33", "74.74", "74.29", "73.64", "72.98", "72.30", "71.87", "71.97", "71.52", "71.00", "71.68", "71.38", "71.26", "71.02", "70.81", "70.73", "70.61", "70.41", "75.12", "76.71", "76.39", "75.88", "75.37", "75.59", "75.46", "74.99", "74.31", "75.69", "75.35", "76.93", "76.64", "79.82", "79.31", "79.58", "79.08", "79.43", "79.81", "80.56", "80.40", "80.08", "80.35", "80.11", "80.52", "80.69", "79.99", "79.79", "79.53", "79.22", "79.42", "79.18", "78.89", "78.95", "78.51", "78.42", "78.16", "78.56", "78.22", "77.93", "77.54", "77.92", "77.41", "77.10", "77.02", "76.81", "76.63", "76.76", "76.56", "82.82", "82.92", "82.66", "83.63", "83.02", "87.21", "86.72", "87.42", "94.13", "93.47", "92.82", "92.12", "91.69", "91.24", "91.05", "90.48", "90.52", "90.07", "93.40", "93.31", "93.20", "93.48", "92.83", "92.63", "92.15", "91.72", "91.12", "90.44", "90.09", "90.60", "89.95", "89.58", "89.06", "93.56", "93.27", "92.86", "92.47", "92.60", "92.43", "92.28", "92.15", "94.62", "95.15", "95.18", "94.92", "94.64", "93.84", "96.09", "95.64", "95.25", "96.56", "96.89", "96.56", "97.21", "97.31", "96.91", "97.70", "97.24", "98.02", "98.50", "98.67", "97.82", "97.55", "97.85", "97.55", "103.63", "103.04", "102.51", "102.59", "103.87", "105.68", "105.43", "105.15", "104.72", "104.02", "103.73", "103.24", "102.95", "102.56", "102.24", "102.75", "105.91", "112.21", "112.63", "113.16", "112.94", "112.74", "112.48", "112.54", "112.64", "112.00", "111.42", "111.03", "110.88", "110.85", "110.57", "110.56", "111.76", "112.10", "111.78", "111.56", "111.94", "111.74", "112.42", "111.99", "111.72", "111.33", "112.58", "114.76", "116.80", "116.78", "116.79", "116.33", "116.19", "116.19", "117.22", "116.47", "115.96", "115.55", "115.24", "114.72", "114.37", "114.02", "114.58", "114.19", "113.65", "113.43", "113.03", "112.42", "112.68", "112.32", "111.81", "111.57", "111.20", "111.10", "110.92", "110.64", "110.08", "112.15", "113.29", "112.92", "114.23", "113.88", "113.65", "113.28", "112.90", "112.58", "113.13", "114.79", "114.93", "114.61", "114.27", "114.00", "116.31", "116.95", "116.98", "116.80", "116.40", "116.13", "116.17", "116.83", "117.11", "116.92", "117.09", "116.87", "119.25", "118.82", "121.49", "121.28", "121.74", "125.07", "124.76", "124.37", "124.19", "125.50", "125.15", "127.22", "126.72", "126.22", "125.67", "125.35", "125.63", "125.98", "125.85", "125.70", "127.25"],
    "sessionProfit": { "London Session": 14.94, "New York Session": 29.88, "Tokyo Session": 28.25, "Outside Major Sessions": 14.65, "London–New York Overlap": 39.53 },
    "sessionCounts": { "London Session": 161, "New York Session": 76, "Tokyo Session": 112, "Outside Major Sessions": 96, "London–New York Overlap": 95 },
    "sessionWinRates": { "London Session": "35.40", "New York Session": "40.79", "Tokyo Session": "31.25", "Outside Major Sessions": "29.17", "London–New York Overlap": "41.05" },
    "volProfit": { "Low": 41.58, "High": 75.70, "Very Low": 9.82, "Very High": 0.15 },
    "volCounts": { "Low": 275, "High": 211, "Very Low": 48, "Very High": 6 },
    "volWinRates": { "Low": "31.27", "High": "38.86", "Very Low": "41.67", "Very High": "33.33" },
    "posProfit": { "buy": 80.49, "sell": 46.76 },
    "posCounts": { "buy": 372, "sell": 168 },
    "posWinRates": { "buy": "33.60", "sell": "38.69" },
    "bestTrade": { "entry_time": "02/03/2025, 20:45:00", "entry_price": 86377.5, "supertrend": 85989.61298892669, "stoploss": 86518.44501230466, "rsi": 57.62002322012725, "session": "London–New York Overlap", "open": 85159.5, "high": 87288.5, "low": 85111, "close": 86377.5, "volume": 573592, "atr": 513.3699917968955, "ema8": 85538.96597234128, "ema13": 85595.68185000753, "ema200": 85220.70740788736, "sma13": 85610.98076923077, "adx": 0, "isHCandleRanging": false, "h1_highest": 86056, "h1_lowest": 85013.5, "volatility": "High", "losspoint": 911, "maxpoint": 0, "stoploss_touched": true, "isLong": true, "partial_exit_price": 91531.5, "partial_exit_time": "02/03/2025, 22:00:00", "partial_profit": "5.97", "exit_time": "03/03/2025, 06:30:00", "exit_price": 92821.5, "risk_percentage": "0.16", "profit": "7.46", "avg_profit": "6.71" },
    "worstTrade": { "entry_time": "04/04/2025, 15:45:00", "entry_price": 82891.5, "supertrend": 84953.89087274102, "stoploss": 83597.91835372927, "rsi": 41.5925938480985, "session": "London Session", "open": 83644.5, "high": 83757.5, "low": 82723, "close": 82891.5, "volume": 503865, "atr": 583.2789024861784, "ema8": 84009.18484686114, "ema13": 83946.56093909338, "ema200": 83373.24230797133, "sma13": 84087.09615384616, "adx": 0, "isHCandleRanging": false, "h1_highest": 84680, "h1_lowest": 83010, "volatility": "High", "losspoint": 790.0816462707298, "maxpoint": 0, "stoploss_touched": true, "isLong": false, "exit_time": "04/04/2025, 23:00:00", "exit_price": 83597.91835372927, "risk_percentage": "0.85", "profit": "-0.85", "avg_profit": "-0.85" },
    "hourStats": { "0": { "wins": 6, "losses": 18, "count": 24 }, "1": { "wins": 6, "losses": 15, "count": 21 }, "2": { "wins": 8, "losses": 14, "count": 22 }, "3": { "wins": 7, "losses": 13, "count": 20 }, "4": { "wins": 3, "losses": 5, "count": 8 }, "5": { "wins": 5, "losses": 12, "count": 17 }, "6": { "wins": 4, "losses": 13, "count": 17 }, "7": { "wins": 6, "losses": 22, "count": 28 }, "8": { "wins": 6, "losses": 18, "count": 24 }, "9": { "wins": 5, "losses": 17, "count": 22 }, "10": { "wins": 7, "losses": 12, "count": 19 }, "11": { "wins": 11, "losses": 12, "count": 23 }, "12": { "wins": 16, "losses": 22, "count": 38 }, "13": { "wins": 19, "losses": 29, "count": 48 }, "14": { "wins": 22, "losses": 37, "count": 59 }, "15": { "wins": 10, "losses": 11, "count": 21 }, "16": { "wins": 3, "losses": 5, "count": 8 }, "17": { "wins": 6, "losses": 9, "count": 15 }, "18": { "wins": 9, "losses": 12, "count": 21 }, "19": { "wins": 8, "losses": 12, "count": 20 }, "20": { "wins": 4, "losses": 8, "count": 12 }, "21": { "wins": 6, "losses": 16, "count": 22 }, "22": { "wins": 9, "losses": 11, "count": 20 }, "23": { "wins": 4, "losses": 7, "count": 11 } },
    "profitBuckets": { "0": 144, "2": 33, "4": 11, "6": 4, "-2": 348 },
    "dayOfWeekAnalysis": { "Friday": { "profit": "18.04", "winRate": "37.14", "count": 70 }, "Saturday": { "profit": "3.26", "winRate": "26.87", "count": 67 }, "Sunday": { "profit": "24.25", "winRate": "34.34", "count": 99 }, "Monday": { "profit": "36.26", "winRate": "38.75", "count": 80 }, "Tuesday": { "profit": "0.56", "winRate": "32.00", "count": 75 }, "Thursday": { "profit": "26.85", "winRate": "45.83", "count": 72 }, "Wednesday": { "profit": "18.03", "winRate": "31.17", "count": 77 } },
    "dailyProfits": { "2024-07-12": 0.15, "2024-07-13": 0.19000000000000006, "2024-07-14": 1.96, "2024-07-15": 4.17, "2024-07-16": 1.61, "2024-07-17": 1.74, "2024-07-18": 0.08999999999999997, "2024-07-19": -1.73, "2024-07-20": 3.4299999999999997, "2024-07-21": -0.29, "2024-07-23": -0.55, "2024-07-24": -0.18, "2024-07-25": 2.04, "2024-07-28": -0.38, "2024-07-29": 1.26, "2024-07-31": -0.46, "2024-08-01": 1.36, "2024-08-02": -1.07, "2024-08-03": -0.3, "2024-08-04": 3.8, "2024-08-09": -0.58, "2024-08-10": -0.19, "2024-08-11": -0.25, "2024-08-12": -0.65, "2024-08-13": -0.61, "2024-08-14": 1.69, "2024-08-15": 0.22, "2024-08-16": 1.32, "2024-08-18": -0.21, "2024-08-20": 3.34, "2024-08-21": -0.69, "2024-08-22": 1.24, "2024-08-23": 0.31, "2024-08-24": 2.21, "2024-08-25": -0.26, "2024-08-26": -0.05, "2024-08-28": -1.29, "2024-08-29": 1, "2024-08-30": 1, "2024-08-31": -0.44, "2024-09-01": 0.75, "2024-09-02": -0.44, "2024-09-03": 1.04, "2024-09-04": 2.08, "2024-09-05": 1.6, "2024-09-06": 0.8400000000000001, "2024-09-07": 0.21, "2024-09-08": -0.5599999999999999, "2024-09-09": 0.97, "2024-09-10": -0.16, "2024-09-11": -0.7, "2024-09-13": -0.7, "2024-09-14": 3.31, "2024-09-15": 0.01999999999999999, "2024-09-16": -0.43, "2024-09-17": 3.5, "2024-09-18": -0.43, "2024-09-19": 4.72, "2024-09-20": 0, "2024-09-21": -0.71, "2024-09-22": -0.99, "2024-09-23": 0.23, "2024-09-24": -0.38, "2024-09-25": -0.10999999999999999, "2024-09-26": -0.54, "2024-09-28": 2.87, "2024-09-29": -0.03, "2024-10-01": -0.15, "2024-10-02": 2.42, "2024-10-03": -0.8, "2024-10-04": -1.01, "2024-10-05": -0.5, "2024-10-06": 0.43000000000000005, "2024-10-07": -0.35, "2024-10-08": -0.13999999999999999, "2024-10-09": -1.57, "2024-10-10": -0.21999999999999997, "2024-10-11": 3.74, "2024-10-13": 0.33, "2024-10-14": -1, "2024-10-15": 3.16, "2024-10-16": -0.54, "2024-10-18": 0.79, "2024-10-19": -0.13, "2024-10-20": -0.27, "2024-10-21": 0.28, "2024-10-22": -0.8300000000000001, "2024-10-23": -1.75, "2024-10-24": 0.96, "2024-10-25": 0.18999999999999995, "2024-10-26": -0.6000000000000001, "2024-10-27": -0.72, "2024-10-28": 0.5, "2024-10-30": -0.66, "2024-10-31": -0.59, "2024-11-01": -0.41, "2024-11-02": -0.25, "2024-11-03": 0.77, "2024-11-04": -2.0600000000000005, "2024-11-05": 1.3, "2024-11-06": 4.97, "2024-11-07": 0.25, "2024-11-08": 0.72, "2024-11-10": 4.92, "2024-11-12": 5, "2024-11-13": 3.75, "2024-11-14": -0.27, "2024-11-15": -0.23, "2024-11-16": -0.43, "2024-11-17": -1.25, "2024-11-18": 0.7200000000000001, "2024-11-19": -0.78, "2024-11-21": 3.29, "2024-11-24": 0.49000000000000005, "2024-11-25": 0.06, "2024-11-26": 3.25, "2024-11-27": -2.6899999999999995, "2024-11-28": 2.06, "2024-11-29": 0.72, "2024-11-30": -0.39, "2024-12-01": 0.22, "2024-12-02": -0.2099999999999999, "2024-12-04": -0.17999999999999994, "2024-12-05": 5.39, "2024-12-06": 1.64, "2024-12-07": -0.04, "2024-12-08": -0.67, "2024-12-09": -1.54, "2024-12-10": -1.4300000000000002, "2024-12-12": -0.19, "2024-12-13": -0.99, "2024-12-14": -0.27, "2024-12-15": 0.09000000000000002, "2024-12-16": 0.77, "2024-12-17": 0.14, "2024-12-18": -0.36, "2024-12-19": 2.79, "2024-12-20": 1.4800000000000002, "2024-12-22": -0.06999999999999995, "2024-12-23": 1.42, "2024-12-24": -0.52, "2024-12-25": -0.74, "2024-12-26": -1.13, "2024-12-27": -0.49, "2024-12-28": 0.63, "2024-12-29": -0.35, "2024-12-30": 0.49000000000000005, "2024-12-31": -0.1, "2025-01-01": -0.84, "2025-01-02": 2.65, "2025-01-03": -0.57, "2025-01-04": 1.2, "2025-01-05": -0.01, "2025-01-06": -0.5700000000000001, "2025-01-07": 2.11, "2025-01-10": 0.2, "2025-01-11": -0.7, "2025-01-12": -0.6199999999999999, "2025-01-13": -0.6, "2025-01-15": -0.09, "2025-01-16": 2.41, "2025-01-18": -0.45, "2025-01-19": -2.4200000000000004, "2025-01-21": 0.1, "2025-01-23": -0.45, "2025-01-24": 0.16000000000000003, "2025-01-25": -0.3, "2025-01-26": -0.97, "2025-01-27": 4.71, "2025-01-28": 0.25, "2025-01-29": -1.06, "2025-01-30": 1.38, "2025-01-31": -0.34, "2025-02-01": 1.29, "2025-02-03": 3.18, "2025-02-04": -0.51, "2025-02-05": -0.22999999999999998, "2025-02-06": 0.73, "2025-02-07": 0.54, "2025-02-08": -0.24, "2025-02-09": 0.41, "2025-02-11": 0.17, "2025-02-12": -1.47, "2025-02-14": -0.03999999999999998, "2025-02-17": -0.22999999999999998, "2025-02-18": -0.39, "2025-02-19": -1.02, "2025-02-20": 0.38, "2025-02-21": -0.8200000000000001, "2025-02-22": -0.08, "2025-02-23": -0.26, "2025-02-24": -0.2, "2025-02-25": 6.26, "2025-02-26": 0.1, "2025-02-27": 0.71, "2025-02-28": 3.5800000000000005, "2025-03-01": -0.49, "2025-03-02": 0.7, "2025-03-03": 5.3999999999999995, "2025-03-07": -0.7, "2025-03-08": -0.43, "2025-03-10": -0.64, "2025-03-11": -0.57, "2025-03-12": 0.04, "2025-03-13": -0.45, "2025-03-15": 3.33, "2025-03-16": 0.08000000000000002, "2025-03-17": -3.04, "2025-03-18": -1.38, "2025-03-20": 3.8, "2025-03-21": -0.26, "2025-03-22": -0.45, "2025-03-24": 2.47, "2025-03-25": 0.53, "2025-03-26": 0.03, "2025-03-27": -0.54, "2025-03-28": 1, "2025-03-29": 0.92, "2025-03-30": 0, "2025-03-31": 0.75, "2025-04-01": -0.07, "2025-04-02": 1.26, "2025-04-04": -0.6799999999999999, "2025-04-05": 0.02999999999999997, "2025-04-06": -0.3, "2025-04-07": 6.08, "2025-04-08": -1.12, "2025-04-09": 0.08, "2025-04-11": 1.28, "2025-04-13": 1.56, "2025-04-14": -0.71, "2025-04-15": -0.7, "2025-04-16": -0.78, "2025-04-17": -0.6799999999999999, "2025-04-18": -0.32, "2025-04-19": 0.51, "2025-04-21": 3.16, "2025-04-23": 6.3, "2025-04-25": 0.42, "2025-04-26": 0.53, "2025-04-27": -0.68, "2025-04-28": -0.48, "2025-04-29": -1.1199999999999999, "2025-04-30": -0.32000000000000006, "2025-05-01": 1.2, "2025-05-02": 0.020000000000000018, "2025-05-03": -0.22, "2025-05-04": 0.18, "2025-05-05": -0.019999999999999962, "2025-05-06": -0.39, "2025-05-07": 1.25, "2025-05-08": 2.18, "2025-05-09": 2.04, "2025-05-10": -0.02, "2025-05-11": -0.45, "2025-05-12": 0.14, "2025-05-13": -2.45, "2025-05-14": 0.17000000000000004, "2025-05-15": -1.77, "2025-05-16": -0.09999999999999998, "2025-05-17": -1.6800000000000002, "2025-05-19": -0.56, "2025-05-20": 2.07, "2025-05-21": 0.7699999999999999, "2025-05-22": 1.31, "2025-05-23": -0.58, "2025-05-24": -1.07, "2025-05-25": 0.55, "2025-05-26": 1.66, "2025-05-27": 0.14, "2025-05-29": -0.93, "2025-05-31": 2.31, "2025-06-01": 0.09000000000000002, "2025-06-02": -0.23, "2025-06-03": 0.9400000000000001, "2025-06-04": -0.19, "2025-06-05": -0.04999999999999999, "2025-06-06": 1.95, "2025-06-07": 2.67, "2025-06-08": 0.25, "2025-06-10": 3.02, "2025-06-11": -0.5700000000000001, "2025-06-12": 0.9600000000000001, "2025-06-13": 0.5199999999999998, "2025-06-14": -0.03999999999999998, "2025-06-15": 0.06999999999999998, "2025-06-16": 1.55 },
    "monthlyProfits": { "2024-07": 13.05, "2024-08": 10.899999999999997, "2024-09": 15.959999999999999, "2024-10": 0.9699999999999996, "2024-11": 23.51, "2024-12": 5.78, "2025-01": 5.1800000000000015, "2025-02": 11.86, "2025-03": 10.100000000000001, "2025-04": 13.250000000000002, "2025-05": 5.750000000000001, "2025-06": 10.939999999999998 }
};

const initialTradesData = [
    { "entry_time": "12/07/2024, 18:30:00", "entry_price": 57498.5, "supertrend": 57451.53886734622, "stoploss": 57185.075138526176, "rsi": 62.624070294773695, "session": "London Session", "open": 57377.5, "high": 57499.5, "low": 57341.5, "close": 57498.5, "volume": 21682, "atr": 209.61657431588338, "ema8": 57282.803964403036, "ema13": 57239.45272660476, "ema200": 57485.48714544848, "sma13": 57184.817307692305, "adx": 0, "isHCandleRanging": false, "h1_highest": 57328, "h1_lowest": 56777.5, "volatility": "Low", "losspoint": 1, "maxpoint": 3.270321298636364, "stoploss_touched": false, "isLong": true, "partial_exit_price": 57582, "partial_exit_time": "13/07/2024, 01:15:00", "partial_profit": "0.15", "exit_time": "13/07/2024, 01:15:00", "exit_price": 57582, "risk_percentage": "0.55", "profit": "0.15", "avg_profit": "0.15" },
    { "entry_time": "13/07/2024, 01:15:00", "entry_price": 57582, "supertrend": 58466.91488932983, "stoploss": 57930.03902976192, "rsi": 39.521259896056186, "session": "New York Session", "open": 57823.5, "high": 57870, "low": 57496, "close": 57582, "volume": 24837, "atr": 289.35935317461553, "ema8": 58011.005076405716, "ema13": 58039.240162342794, "ema200": 57612.30480102414, "sma13": 58112.96153846154, "adx": 0, "isHCandleRanging": false, "h1_highest": 58523.5, "h1_lowest": 57931, "volatility": "Low", "losspoint": 231.4609702380767, "maxpoint": 0.7326764477375804, "stoploss_touched": true, "isLong": false, "exit_time": "13/07/2024, 11:15:00", "exit_price": 57930.03902976192, "risk_percentage": "0.60", "profit": "-0.60", "avg_profit": "-0.60" },
    { "entry_time": "13/07/2024, 11:15:00", "entry_price": 58069.5, "supertrend": 58031.88422305116, "stoploss": 57981.444915970955, "rsi": 66.11480758976037, "session": "Tokyo Session", "open": 57938.5, "high": 58161.5, "low": 57882, "close": 58069.5, "volume": 29199, "atr": 120.03672268603192, "ema8": 57887.94396926363, "ema13": 57871.0978250848, "ema200": 57669.90818754559, "sma13": 57864.721153846156, "adx": 0, "isHCandleRanging": true, "h1_highest": 57986.5, "h1_lowest": 57754, "volatility": "Low", "losspoint": 92, "maxpoint": 1.703479153464007, "stoploss_touched": true, "isLong": true, "partial_exit_price": 58660.5, "partial_exit_time": "13/07/2024, 23:00:00", "partial_profit": "1.02", "exit_time": "14/07/2024, 03:45:00", "exit_price": 58390, "risk_percentage": "0.15", "profit": "0.55", "avg_profit": "0.79" },
    { "entry_time": "14/07/2024, 04:00:00", "entry_price": 58750, "supertrend": 58495.87991416481, "stoploss": 58783.84158486252, "rsi": 49.1737861057403, "session": "Outside Major Sessions", "open": 58378.5, "high": 59018.5, "low": 58318.5, "close": 58750, "volume": 42731, "atr": 156.43894342498442, "ema8": 58618.698507578476, "ema13": 58626.524500109306, "ema200": 58099.13945627028, "sma13": 58623.125, "adx": 0, "isHCandleRanging": true, "h1_highest": 58743, "h1_lowest": 58571, "volatility": "Low", "losspoint": 268.5, "maxpoint": 0, "stoploss_touched": false, "isLong": true, "partial_exit_price": 60026, "partial_exit_time": "14/07/2024, 16:30:00", "partial_profit": "2.17", "exit_time": "14/07/2024, 17:45:00", "exit_price": 59774.5, "risk_percentage": "0.06", "profit": "1.74", "avg_profit": "1.96" },
    { "entry_time": "14/07/2024, 21:15:00", "entry_price": 60078, "supertrend": 60056.85391150363, "stoploss": 59793.055207149984, "rsi": 57.915607400529474, "session": "New York Session", "open": 59930, "high": 60124.5, "low": 59930, "close": 60078, "volume": 14957, "atr": 220.9631952333432, "ema8": 59893.98161580601, "ema13": 59869.3126239829, "ema200": 58966.804470389805, "sma13": 59772.53846153846, "adx": 0, "isHCandleRanging": false, "h1_highest": 60237, "h1_lowest": 59461.5, "volatility": "High", "losspoint": 46.5, "maxpoint": 11.054772991265159, "stoploss_touched": false, "isLong": true, "partial_exit_price": 62692.5, "partial_exit_time": "15/07/2024, 15:30:00", "partial_profit": "4.35", "exit_time": "15/07/2024, 16:30:00", "exit_price": 62474.5, "risk_percentage": "0.48", "profit": "3.99", "avg_profit": "4.17" },
    { "entry_time": "15/07/2024, 20:15:00", "entry_price": 63207, "supertrend": 62415.02875205425, "stoploss": 62834.583024686275, "rsi": 68.85449911993133, "session": "London–New York Overlap", "open": 62986.5, "high": 63220, "low": 62966.5, "close": 63207, "volume": 50392, "atr": 256.94465020914834, "ema8": 62882.033617809866, "ema13": 62821.20075143676, "ema200": 60786.60252299534, "sma13": 62761.480769230766, "adx": 0, "isHCandleRanging": false, "h1_highest": 62980, "h1_lowest": 62290.5, "volatility": "High", "losspoint": 13, "maxpoint": 4.814495898017466, "stoploss_touched": false, "isLong": true, "partial_exit_price": 64491, "partial_exit_time": "16/07/2024, 10:15:00", "partial_profit": "2.03", "exit_time": "16/07/2024, 10:45:00", "exit_price": 63957.5, "risk_percentage": "0.59", "profit": "1.19", "avg_profit": "1.61" },
    { "entry_time": "16/07/2024, 17:00:00", "entry_price": 63761.5, "supertrend": 63730.304388981895, "stoploss": 63298.090218137215, "rsi": 58.71058717390566, "session": "London Session", "open": 63700, "high": 63778.5, "low": 63564, "close": 63761.5, "volume": 63469, "atr": 320.2731879085219, "ema8": 63435.18341275648, "ema13": 63365.400236021436, "ema200": 62462.837483037554, "sma13": 63202.95192307692, "adx": 0, "isHCandleRanging": false, "h1_highest": 63662.5, "h1_lowest": 62374.5, "volatility": "Low", "losspoint": 238.59021813721483, "maxpoint": 1.129669723188984, "stoploss_touched": true, "isLong": true, "partial_exit_price": 64490.5, "partial_exit_time": "17/07/2024, 03:15:00", "partial_profit": "1.14", "exit_time": "17/07/2024, 13:15:00", "exit_price": 65253, "risk_percentage": "0.73", "profit": "2.34", "avg_profit": "1.74" },
    { "entry_time": "18/07/2024, 06:45:00", "entry_price": 64633.5, "supertrend": 64543.74691753474, "stoploss": 64280.438542341806, "rsi": 57.028454416399704, "session": "Tokyo Session", "open": 64402, "high": 64648.5, "low": 64402, "close": 64633.5, "volume": 14533, "atr": 245.3743051054632, "ema8": 64333.93747069581, "ema13": 64315.95190131803, "ema200": 64248.08789946308, "sma13": 64258.83653846154, "adx": 0, "isHCandleRanging": false, "h1_highest": 64526.5, "h1_lowest": 63897.5, "volatility": "High", "losspoint": 44.93854234180617, "maxpoint": 1.4799123174352358, "stoploss_touched": true, "isLong": true, "exit_time": "18/07/2024, 19:45:00", "exit_price": 64280.438542341806, "risk_percentage": "0.55", "profit": "-0.55", "avg_profit": "-0.55" },
    { "entry_time": "18/07/2024, 19:45:00", "entry_price": 64387, "supertrend": 64981.98389882734, "stoploss": 64626.40342581303, "rsi": 34.32593562749979, "session": "London–New York Overlap", "open": 64485, "high": 64592, "low": 64235.5, "close": 64387, "volume": 81142, "atr": 260.6022838753521, "ema8": 64655.71904342538, "ema13": 64690.57569609349, "ema200": 64444.03779903619, "sma13": 64725.769230769234, "adx": 0, "isHCandleRanging": false, "h1_highest": 65119.5, "h1_lowest": 64438, "volatility": "High", "losspoint": 151.5, "maxpoint": 0, "stoploss_touched": false, "isLong": false, "partial_exit_price": 63848.5, "partial_exit_time": "19/07/2024, 02:30:00", "partial_profit": "0.84", "exit_time": "19/07/2024, 04:00:00", "exit_price": 64105.5, "risk_percentage": "0.37", "profit": "0.44", "avg_profit": "0.64" },
    { "entry_time": "19/07/2024, 04:00:00", "entry_price": 64105.5, "supertrend": 63488.808294937975, "stoploss": 63815.43953228565, "rsi": 61.99016700642029, "session": "Outside Major Sessions", "open": 63997.5, "high": 64112, "low": 63965, "close": 64105.5, "volume": 8432, "atr": 197.70697847623458, "ema8": 63847.27702817764, "ema13": 63793.79967100582, "ema200": 64236.11946760538, "sma13": 63742.36538461538, "adx": 0, "isHCandleRanging": false, "h1_highest": 63906, "h1_lowest": 63233, "volatility": "Very Low", "losspoint": 394.4395322856508, "maxpoint": 0.04309446267703728, "stoploss_touched": true, "isLong": true, "exit_time": "19/07/2024, 06:30:00", "exit_price": 63815.43953228565, "risk_percentage": "0.45", "profit": "-0.45", "avg_profit": "-0.45" },
    { "entry_time": "19/07/2024, 06:30:00", "entry_price": 63425, "supertrend": 64019.71334089752, "stoploss": 63697.42598261988, "rsi": 32.82963115315302, "session": "Tokyo Session", "open": 63584.5, "high": 63584.5, "low": 63421, "close": 63425, "volume": 15367, "atr": 184.28398841325676, "ema8": 63733.520975721054, "ema13": 63773.81942103106, "ema200": 64198.52247203535, "sma13": 63861.41346153846, "adx": 0, "isHCandleRanging": true, "h1_highest": 64118, "h1_lowest": 63707, "volatility": "Low", "losspoint": 401.07401738011686, "maxpoint": 0, "stoploss_touched": true, "isLong": false, "exit_time": "19/07/2024, 08:30:00", "exit_price": 63697.42598261988, "risk_percentage": "0.43", "profit": "-0.43", "avg_profit": "-0.43" },
    { "entry_time": "19/07/2024, 08:30:00", "entry_price": 64020, "supertrend": 63950.83530790976, "stoploss": 63734.854534399696, "rsi": 57.06779593273469, "session": "Tokyo Session", "open": 63831, "high": 64098.5, "low": 63815.5, "close": 64020, "volume": 31040, "atr": 242.43031040020287, "ema8": 63810.83960027658, "ema13": 63797.37455185783, "ema200": 64166.22934830088, "sma13": 63741.91346153846, "adx": 0, "isHCandleRanging": false, "h1_highest": 64080, "h1_lowest": 63296, "volatility": "High", "losspoint": 78.5, "maxpoint": 1.6623094426632683, "stoploss_touched": true, "isLong": true, "exit_time": "19/07/2024, 13:00:00", "exit_price": 63734.854534399696, "risk_percentage": "0.45", "profit": "-0.45", "avg_profit": "-0.45" },
    { "entry_time": "19/07/2024, 13:00:00", "entry_price": 63738, "supertrend": 64413.45493720149, "stoploss": 63993.402919211505, "rsi": 39.614399904007385, "session": "London Session", "open": 63989.5, "high": 63989.5, "low": 63662.5, "close": 63738, "volume": 29104, "atr": 220.60194614100394, "ema8": 64079.550149278286, "ema13": 64101.65389028698, "ema200": 64166.811321593756, "sma13": 64159.903846153844, "adx": 0, "isHCandleRanging": true, "h1_highest": 64494, "h1_lowest": 64080.5, "volatility": "Low", "losspoint": 445.0970807884951, "maxpoint": 0.023492292173180936, "stoploss_touched": true, "isLong": false, "exit_time": "19/07/2024, 18:15:00", "exit_price": 63993.402919211505, "risk_percentage": "0.40", "profit": "-0.40", "avg_profit": "-0.40" },
    { "entry_time": "19/07/2024, 18:15:00", "entry_price": 64411.5, "supertrend": 63817.50010891824, "stoploss": 64143.19507689158, "rsi": 65.34110162721404, "session": "London Session", "open": 64266, "high": 64438.5, "low": 64260.5, "close": 64411.5, "volume": 52314, "atr": 196.8699487389498, "ema8": 64155.03261192684, "ema13": 64093.951508237726, "ema200": 64124.99964765986, "sma13": 64050.653846153844, "adx": 0, "isHCandleRanging": false, "h1_highest": 64184, "h1_lowest": 63648, "volatility": "Very Low", "losspoint": 103.69507689157763, "maxpoint": 0.18262803168989575, "stoploss_touched": true, "isLong": true, "partial_exit_price": 66750, "partial_exit_time": "20/07/2024, 04:45:00", "partial_profit": "3.63", "exit_time": "20/07/2024, 06:00:00", "exit_price": 66400, "risk_percentage": "0.42", "profit": "3.09", "avg_profit": "3.36" },
    { "entry_time": "20/07/2024, 20:00:00", "entry_price": 66683, "supertrend": 66655.19671688012, "stoploss": 66491.76443151277, "rsi": 61.934689801729085, "session": "London–New York Overlap", "open": 66592, "high": 66706, "low": 66568, "close": 66683, "volume": 25201, "atr": 142.82371232482149, "ema8": 66545.84041336068, "ema13": 66535.11432081656, "ema200": 65658.30355335794, "sma13": 66517.17307692308, "adx": 0, "isHCandleRanging": true, "h1_highest": 66649.5, "h1_lowest": 66268, "volatility": "High", "losspoint": 23, "maxpoint": 0, "stoploss_touched": false, "isLong": true, "exit_time": "20/07/2024, 20:15:00", "exit_price": 66491.76443151277, "risk_percentage": "0.29", "profit": "-0.29", "avg_profit": "-0.29" },
    { "entry_time": "20/07/2024, 20:45:00", "entry_price": 66716, "supertrend": 66375.09989982318, "stoploss": 66499.05988605822, "rsi": 64.73078922631919, "session": "London–New York Overlap", "open": 66654.5, "high": 66724, "low": 66604, "close": 66716, "volume": 14329, "atr": 149.96007596118514, "ema8": 66597.77916568273, "ema13": 66574.74363934805, "ema200": 65687.30403993979, "sma13": 66544.83653846153, "adx": 0, "isHCandleRanging": true, "h1_highest": 66706, "h1_lowest": 66268, "volatility": "High", "losspoint": 8, "maxpoint": 4.369869558814906, "stoploss_touched": false, "isLong": true, "partial_exit_price": 67043, "partial_exit_time": "21/07/2024, 02:45:00", "partial_profit": "0.49", "exit_time": "21/07/2024, 04:00:00", "exit_price": 66867.5, "risk_percentage": "0.33", "profit": "0.23", "avg_profit": "0.36" },
    { "entry_time": "21/07/2024, 19:45:00", "entry_price": 67102, "supertrend": 67071.11484080687, "stoploss": 66904.44275003952, "rsi": 59.51148494380997, "session": "London–New York Overlap", "open": 66939, "high": 67177.5, "low": 66939, "close": 67102, "volume": 61390, "atr": 182.03816664031316, "ema8": 66883.19952967625, "ema13": 66876.89955892622, "ema200": 66483.02278496877, "sma13": 66867.73076923077, "adx": 0, "isHCandleRanging": true, "h1_highest": 66981.5, "h1_lowest": 66597.5, "volatility": "High", "losspoint": 429.942750039525, "maxpoint": 3.1408617002116728, "stoploss_touched": true, "isLong": true, "exit_time": "21/07/2024, 23:15:00", "exit_price": 66904.44275003952, "risk_percentage": "0.30", "profit": "-0.29", "avg_profit": "-0.29" },
    { "entry_time": "23/07/2024, 01:00:00", "entry_price": 67918, "supertrend": 67145.60209073845, "stoploss": 67580.46416600568, "rsi": 69.65563873520395, "session": "New York Session", "open": 67653, "high": 67953.5, "low": 67611.5, "close": 67918, "volume": 28294, "atr": 248.69055599621655, "ema8": 67531.03993436694, "ema13": 67439.05800804289, "ema200": 67163.90355982754, "sma13": 67383.81730769231, "adx": 0, "isHCandleRanging": false, "h1_highest": 67671, "h1_lowest": 66815, "volatility": "Low", "losspoint": 364.46416600568045, "maxpoint": 0.9835992702498879, "stoploss_touched": true, "isLong": true, "exit_time": "23/07/2024, 06:45:00", "exit_price": 67580.46416600568, "risk_percentage": "0.50", "profit": "-0.50", "avg_profit": "-0.50" },
    { "entry_time": "23/07/2024, 06:45:00", "entry_price": 67233, "supertrend": 67320.01993304567, "stoploss": 67555.50055737804, "rsi": 38.18279595402521, "session": "Tokyo Session", "open": 67374.5, "high": 67477, "low": 67216, "close": 67233, "volume": 18081, "atr": 226.3337049186878, "ema8": 67495.19888428284, "ema13": 67539.40198877986, "ema200": 67272.65971902166, "sma13": 67527.08653846153, "adx": 0, "isHCandleRanging": true, "h1_highest": 67854.5, "h1_lowest": 67226.5, "volatility": "Low", "losspoint": 159.99944262196368, "maxpoint": 0.14883695206682768, "stoploss_touched": true, "isLong": false, "partial_exit_price": 66984, "partial_exit_time": "23/07/2024, 14:45:00", "partial_profit": "0.37", "exit_time": "23/07/2024, 20:00:00", "exit_price": 67555.50055737804, "risk_percentage": "0.48", "profit": "-0.48", "avg_profit": "-0.05" }
];

// Define common colors for charts
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1', '#00c49f', '#0088fe'];

// Helper function to format currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

// Card component for displaying key metrics
const StatCard = ({ title, value, unit, icon, color }) => (
    <div className={`p-4 rounded-xl shadow-lg bg-gradient-to-br from-gray-800 to-gray-900 text-white flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-300 ${color}`}>
        <div className="text-3xl mb-2">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-300 mb-1">{title}</h3>
        <p className="text-3xl font-bold">{value}{unit}</p>
    </div>
);

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-gray-700 rounded-lg shadow-md text-white border border-gray-600">
                <p className="font-bold text-lg mb-1">{label}</p>
                {payload.map((p, index) => (
                    <p key={index} style={{ color: p.color }}>
                        {`${p.name}: ${p.value}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// New component for GitHub-style daily profit chart
const GitHubDailyProfitsChart = ({ dailyProfits, startTime, endTime }) => {
    // Determine the date range for the calendar view
    const parsedStartDate = startTime ? new Date(startTime.split(', ')[0]) : new Date();
    parsedStartDate.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC

    const parsedEndDate = endTime ? new Date(endTime.split(', ')[0]) : new Date();
    parsedEndDate.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC

    // Adjust start date to the beginning of the year of the earliest trade, or current year if no trades
    const displayStartDate = new Date(parsedStartDate.getFullYear(), 0, 1); // January 1st of the start year
    displayStartDate.setUTCHours(0, 0, 0, 0);

    // Adjust end date to the end of the year of the latest trade, or current year if no trades
    const displayEndDate = new Date(parsedEndDate.getFullYear(), 11, 31); // December 31st of the end year
    displayEndDate.setUTCHours(0, 0, 0, 0);


    const days = [];
    let currentDate = new Date(displayStartDate);

    while (currentDate <= displayEndDate) {
        days.push(new Date(currentDate));
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Use UTC date to avoid timezone issues
    }

    // Prepare data for the heatmap
    const profitsMap = new Map();
    Object.entries(dailyProfits).forEach(([dateStr, profit]) => {
        profitsMap.set(dateStr, parseFloat(profit));
    });

    // Determine min/max profits for color scaling (excluding 0 for neutral)
    const profitValues = Array.from(profitsMap.values()).filter(p => p !== 0);
    const minProfit = profitValues.length > 0 ? Math.min(...profitValues) : 0;
    const maxProfit = profitValues.length > 0 ? Math.max(...profitValues) : 0;

    const getColor = (profit) => {
        if (profit === 0) return 'bg-gray-700'; // Break even
        if (profit > 0) {
            // Scale green based on positive profit
            const intensity = Math.min(1, profit / (maxProfit === 0 ? 1 : maxProfit));
            if (intensity > 0.75) return 'bg-green-600';
            if (intensity > 0.5) return 'bg-green-500';
            if (intensity > 0.25) return 'bg-green-400';
            return 'bg-green-300';
        } else {
            // Scale red based on negative profit
            const intensity = Math.min(1, Math.abs(profit) / (Math.abs(minProfit) === 0 ? 1 : Math.abs(minProfit)));
            if (intensity > 0.75) return 'bg-red-600';
            if (intensity > 0.5) return 'bg-red-500';
            if (intensity > 0.25) return 'bg-red-400';
            return 'bg-red-300';
        }
    };

    // Group days by week and fill leading nulls for aligning to Sunday
    const weeks = [];
    let currentWeek = [];
    let firstDayOffset = displayStartDate.getUTCDay(); // Day of week for displayStartDate (0=Sunday)

    for (let i = 0; i < firstDayOffset; i++) {
        currentWeek.push(null);
    }

    days.forEach((day) => {
        currentWeek.push(day);
        if (day.getUTCDay() === 6) { // Sunday (end of week based on getUTCDay())
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });
    if (currentWeek.length > 0) {
        // Pad the end of the last week if it doesn't end on Saturday
        for (let i = currentWeek.length; i < 7; i++) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Generate month headers
    const monthHeaders = [];
    let currentMonthIdx = displayStartDate.getUTCMonth();
    let currentYear = displayStartDate.getUTCFullYear();
    let daysInMonthCount = 0;

    // Adjust the first month's starting position based on the first day of displayStartDate
    const startOffsetForFirstMonth = displayStartDate.getUTCDay(); // Days from Sunday to start of first month

    for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i];
        for (let j = 0; j < week.length; j++) {
            const day = week[j];
            if (day && (day.getUTCMonth() !== currentMonthIdx || day.getUTCFullYear() !== currentYear)) {
                // New month or year, push previous header if it exists
                if (daysInMonthCount > 0) {
                    monthHeaders.push({
                        name: `${monthNames[currentMonthIdx]} ${currentYear}`,
                        span: Math.ceil(daysInMonthCount / 7), // Approximate span in weeks
                    });
                }
                currentMonthIdx = day.getUTCMonth();
                currentYear = day.getUTCFullYear();
                daysInMonthCount = 1;
            } else if (day) {
                daysInMonthCount++;
            }
        }
    }
    // Add the last month header
    if (daysInMonthCount > 0) {
        monthHeaders.push({
            name: `${monthNames[currentMonthIdx]} ${currentYear}`,
            span: Math.ceil(daysInMonthCount / 7),
        });
    }


    return (
        <div className="flex flex-col items-start space-y-2 overflow-x-auto p-4 bg-gray-800 rounded-xl shadow-lg">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-4">Daily Profit Heatmap (GitHub-style)</h3>
            <div className="flex w-full min-w-max">
                <div className="flex flex-col w-10 text-right text-xs font-medium text-gray-400 pt-6 pr-1 flex-shrink-0">
                    {dayNames.map((day, index) => (
                        // Only show Mon, Wed, Fri for less clutter, or all for detail
                        (index === 1 || index === 3 || index === 5) ? (
                            <div key={day} className="h-5 flex items-center justify-end">{day}</div>
                        ) : (
                            <div key={day} className="h-5 flex items-center justify-end opacity-0">.</div>
                        )
                    ))}
                </div>
                <div className="flex flex-col flex-grow overflow-x-auto">
                    {/* Month headers dynamic based on weeks */}
                    <div className="flex">
                        {weeks.map((week, weekIdx) => {
                            // Find the month of the first day in this week that is not null
                            const firstDayInWeek = week.find(day => day !== null);
                            const monthOfFirstDay = firstDayInWeek ? firstDayInWeek.getUTCMonth() : null;
                            const yearOfFirstDay = firstDayInWeek ? firstDayInWeek.getUTCFullYear() : null;

                            // Check if this week starts a new month or is the very first week with content
                            const previousWeekLastDayMonth = (weekIdx > 0 && weeks[weekIdx-1].some(d => d !== null)) ?
                                (weeks[weekIdx-1].findLast(d => d !== null).getUTCMonth()) : -1;
                            const previousWeekLastDayYear = (weekIdx > 0 && weeks[weekIdx-1].some(d => d !== null)) ?
                                (weeks[weekIdx-1].findLast(d => d !== null).getUTCFullYear()) : -1;

                            const isNewMonth = (firstDayInWeek && (monthOfFirstDay !== previousWeekLastDayMonth || yearOfFirstDay !== previousWeekLastDayYear));

                            // Calculate the number of actual content days in this week that are part of the new month
                            let daysInNewMonthInWeek = 0;
                            if (isNewMonth) {
                                for(let i = 0; i < week.length; i++) {
                                    if(week[i] && week[i].getUTCMonth() === monthOfFirstDay && week[i].getUTCFullYear() === yearOfFirstDay) {
                                        daysInNewMonthInWeek++;
                                    }
                                }
                            }

                            // Only render month name if it's the start of a new month within the calendar view,
                            // or for the very first non-null day if it's not Jan 1st.
                            // This logic is still a bit tricky to get perfect for month headers with variable week starts.
                            // A simpler approach for month headers is often to display them above fixed column spans.
                            // For simplicity and alignment, we'll try to place them dynamically, or fall back to
                            // a fixed header if this becomes too complex.
                            // For now, let's keep it simple and approximate.
                            // A better solution would involve calculating the exact column span for each month.
                            // For a truly "GitHub-like" experience, the months usually sit above fixed-width weeks.

                            return (
                                <div key={`month-col-${weekIdx}`} className="flex flex-col flex-shrink-0">
                                    {isNewMonth && (
                                        <div className="text-center text-xs font-semibold text-gray-400 absolute"
                                            style={{
                                                left: `${(weekIdx * 28) + 40}px`, // Adjust based on cell width + margin + day name column
                                                marginTop: '-20px' // Position above the grid
                                            }}
                                        >
                                            {firstDayInWeek ? `${monthNames[monthOfFirstDay]}` : ''}
                                        </div>
                                    )}
                                    {/* Placeholder for the actual week column, which follows */}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-grow overflow-x-auto">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col ml-1 flex-shrink-0">
                                {week.map((day, dayIndex) => {
                                    const dateKey = day ? day.toISOString().slice(0, 10) : null;
                                    const profit = profitsMap.get(dateKey) || 0;
                                    const tooltipText = day ?
                                        `${day.toDateString()}\nProfit: ${formatCurrency(profit)}` : 'No data';
                                    return (
                                        <div
                                            key={dayIndex}
                                            className={`w-5 h-5 rounded-sm m-0.5 flex items-center justify-center text-xs text-transparent hover:text-white cursor-pointer transition-colors duration-100 ${day ? getColor(profit) : 'bg-gray-900 opacity-50'}`}
                                            title={tooltipText}
                                        >
                                            {/* {day ? day.getUTCDate() : ''} */}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Legend for the heatmap */}
            <div className="flex justify-center items-center gap-2 text-sm text-gray-400 mt-4 self-center">
                <span className="text-white">Less Profit/More Loss</span>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-red-300 rounded-sm"></div>
                    <div className="w-4 h-4 bg-red-400 rounded-sm"></div>
                    <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                    <div className="w-4 h-4 bg-red-600 rounded-sm"></div>
                </div>
                <div className="w-4 h-4 bg-gray-700 rounded-sm" title="Break Even"></div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-green-300 rounded-sm"></div>
                    <div className="w-4 h-4 bg-green-400 rounded-sm"></div>
                    <div className="w-4 h-4 bg-green-500 rounded-sm"></div>
                    <div className="w-4 h-4 bg-green-600 rounded-sm"></div>
                </div>
                <span className="text-white">More Profit/Less Loss</span>
                <div className="w-4 h-4 bg-gray-900 opacity-50 rounded-sm" title="No Trade Day"></div>
                <span className="text-white">No Trade Day</span>
            </div>
        </div>
    );
};


// Main App component
const App = () => {
    const [analysisData, setAnalysisData] = useState(initialAnalysisData);
    const [tradesData, setTradesData] = useState(initialTradesData);
    const [loading, setLoading] = useState(true);
    const [firebaseApp, setFirebaseApp] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // State for navigation

    // State for AI Analysis
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // State for Monte Carlo Simulation
    const [numSimulations, setNumSimulations] = useState(100);
    const [monteCarloResults, setMonteCarloResults] = useState([]);
    const [mcLoading, setMcLoading] = useState(false);
    const [mcStats, setMcStats] = useState(null);

    // State for Trade Hypothesis Testing
    const [hypothesisCriteria, setHypothesisCriteria] = useState({
        session: '',
        volatility: '',
        isLong: '',
        minProfit: '',
        maxDrawdown: ''
    });
    const [hypothesisResults, setHypothesisResults] = useState(null);

    // New states for API Integration
    const [apiSymbol, setApiSymbol] = useState('BTCUSD');
    const [apiInterval, setApiInterval] = useState('15m');
    const [apiStartDate, setApiStartDate] = useState(''); // YYYY-MM-DD
    const [apiEndDate, setApiEndDate] = useState('');     // YYYY-MM-DD
    const [apiLoadingData, setApiLoadingData] = useState(false);
    const [apiError, setApiError] = useState('');


    // Firebase Initialization and Authentication
    useEffect(() => {
        try {
            // Get __app_id from global scope or default
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            // Parse __firebase_config from global scope or default to empty object
            const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

            if (Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config is empty. Cannot initialize Firebase.");
                setLoading(false);
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setFirebaseApp(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Listen for authentication state changes
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    // If user is authenticated, set userId and mark auth as ready
                    setUserId(user.uid);
                    setIsAuthReady(true);
                    console.log("Firebase signed in:", user.uid);
                } else {
                    // If no user, try to sign in with custom token if available, else anonymously
                    try {
                        const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                        if (initialToken) {
                            await signInWithCustomToken(firebaseAuth, initialToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    } catch (error) {
                        console.error("Error during Firebase sign-in:", error);
                        // Still mark auth as ready to proceed with UI even if sign-in fails
                        setIsAuthReady(true);
                        setLoading(false); // Stop loading if sign-in failed
                    }
                }
            });

            return () => unsubscribe(); // Cleanup auth listener on component unmount
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            setLoading(false);
        }
    }, []);

    // Load data from Firestore once authenticated
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            // Wait until Firebase is initialized and auth state is ready
            console.log("Waiting for Firebase or User ID to be ready for data loading...");
            return;
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const analysisDocRef = doc(db, `artifacts/${appId}/users/${userId}/trade_analysis`, 'summary');
        const tradesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/trades_data`);

        // Subscribe to real-time updates for analysis data
        const unsubscribeAnalysis = onSnapshot(analysisDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setAnalysisData(docSnap.data());
                console.log("Analysis data loaded from Firestore.");
            } else {
                console.log("No analysis data found in Firestore. Using initial data and saving it.");
                setAnalysisData(initialAnalysisData);
                // Save initial data to Firestore if not found
                saveDataToFirestore(initialAnalysisData, initialTradesData);
            }
            setLoading(false); // Stop main loading once analysis data is processed
        }, (error) => {
            console.error("Error fetching analysis data:", error);
            setLoading(false); // Stop loading even on error
        });

        // Subscribe to real-time updates for trades data
        const unsubscribeTrades = onSnapshot(query(tradesCollectionRef), (snapshot) => {
            const fetchedTrades = [];
            snapshot.forEach((doc) => {
                fetchedTrades.push(doc.data());
            });
            setTradesData(fetchedTrades);
            console.log("Trades data loaded from Firestore.");
            if (fetchedTrades.length === 0 && initialTradesData.length > 0) {
                // If trades collection is empty, and we have initial data, save it
                saveDataToFirestore(initialAnalysisData, initialTradesData);
            }
        }, (error) => {
            console.error("Error fetching trades data:", error);
        });

        // Cleanup Firestore listeners on component unmount
        return () => {
            unsubscribeAnalysis();
            unsubscribeTrades();
        };
    }, [db, userId, isAuthReady, initialAnalysisData, initialTradesData]); // Dependencies for useEffect

    // Function to save data to Firestore
    const saveDataToFirestore = useCallback(async (analysis, trades) => {
        if (!db || !userId) {
            console.error("Firestore DB or User ID not available for saving.");
            return;
        }
        setLoading(true); // Indicate saving process
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            // Save analysis data to a single document
            const analysisDocRef = doc(db, `artifacts/${appId}/users/${userId}/trade_analysis`, 'summary');
            await setDoc(analysisDocRef, analysis);
            console.log("Analysis data saved to Firestore!");

            // Delete all existing trade documents before adding new ones
            const tradesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/trades_data`);
            const existingTradesSnapshot = await getDocs(query(tradesCollectionRef));
            const deletePromises = [];
            existingTradesSnapshot.forEach((tradeDoc) => {
                deletePromises.push(deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/trades_data`, tradeDoc.id)));
            });
            await Promise.all(deletePromises); // Wait for all deletions to complete
            console.log("Existing trades deleted.");

            // Add new trade documents
            const addPromises = [];
            for (const trade of trades) {
                // Firestore automatically generates an ID if addDoc is used on a collection
                addPromises.push(setDoc(doc(tradesCollectionRef), trade)); // Use setDoc to create a new document with auto-ID
            }
            await Promise.all(addPromises); // Wait for all additions to complete
            console.log("Trades data saved to Firestore!");

        } catch (error) {
            console.error("Error saving data to Firestore:", error);
        } finally {
            setLoading(false); // End saving process
        }
    }, [db, userId]); // Dependencies for saveDataToFirestore

    // Memoized derived data for charts to prevent unnecessary re-renders
    const cumulativeProfitChartData = useMemo(() =>
        analysisData.cumulativeProfit.map((profit, index) => ({
            index: index + 1,
            profit: parseFloat(profit)
        }))
    , [analysisData.cumulativeProfit]);

    const sessionProfitChartData = useMemo(() =>
        Object.entries(analysisData.sessionProfit).map(([name, profit]) => ({
            name,
            profit
        }))
    , [analysisData.sessionProfit]);

    const volatilityProfitChartData = useMemo(() =>
        Object.entries(analysisData.volProfit).map(([name, profit]) => ({
            name,
            profit
        }))
    , [analysisData.volProfit]);

    const posProfitChartData = useMemo(() =>
        Object.entries(analysisData.posProfit).map(([name, profit]) => ({
            name,
            value: profit
        }))
    , [analysisData.posProfit]);

    // Daily profits data is now passed directly to GitHubDailyProfitsChart component
    // const dailyProfitsChartData = useMemo(() =>
    //     Object.entries(analysisData.dailyProfits).map(([date, profit]) => ({
    //         date,
    //         profit: parseFloat(profit)
    //     })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    // , [analysisData.dailyProfits]);

    const monthlyProfitsChartData = useMemo(() =>
        Object.entries(analysisData.monthlyProfits).map(([month, profit]) => ({
            month,
            profit: parseFloat(profit)
        }))
    , [analysisData.monthlyProfits]);

    const hourStatsChartData = useMemo(() =>
        Object.entries(analysisData.hourStats).map(([hour, stats]) => ({
            hour: parseInt(hour),
            wins: stats.wins,
            losses: stats.losses,
            count: stats.count
        })).sort((a, b) => a.hour - b.hour)
    , [analysisData.hourStats]);

    const dayOfWeekAnalysisChartData = useMemo(() =>
        Object.entries(analysisData.dayOfWeekAnalysis).map(([day, stats]) => ({
            day,
            profit: parseFloat(stats.profit),
            winRate: parseFloat(stats.winRate)
        }))
    , [analysisData.dayOfWeekAnalysis]);

    const profitBucketsChartData = useMemo(() =>
        Object.entries(analysisData.profitBuckets).map(([bucket, count]) => ({
            bucket: bucket === "0" ? "Break Even" : `${bucket}% Profit`,
            count
        }))
    , [analysisData.profitBuckets]);

    const pieChartColors = COLORS.slice(0, posProfitChartData.length);

    // Monte Carlo Simulation Logic
    const runMonteCarloSimulation = useCallback(() => {
        if (tradesData.length === 0) {
            console.warn("No trades data available for Monte Carlo simulation.");
            setMonteCarloResults([]);
            setMcStats(null);
            return;
        }

        setMcLoading(true);
        const simulations = [];
        let totalFinalProfit = 0;
        let minFinalProfit = Infinity;
        let maxFinalProfit = -Infinity;

        // Perform simulations
        for (let s = 0; s < numSimulations; s++) {
            let currentProfit = 0;
            const equityCurve = [0]; // Start at 0 for initial equity

            // Create a shuffled copy of tradesData for each simulation
            const shuffledTrades = [...tradesData].sort(() => 0.5 - Math.random());

            for (const trade of shuffledTrades) {
                // Ensure profit is treated as a number
                currentProfit += parseFloat(trade.profit);
                equityCurve.push(currentProfit);
            }
            simulations.push(equityCurve);
            totalFinalProfit += currentProfit;
            minFinalProfit = Math.min(minFinalProfit, currentProfit);
            maxFinalProfit = Math.max(maxFinalProfit, currentProfit);
        }

        setMonteCarloResults(simulations);
        setMcStats({
            avgFinalProfit: totalFinalProfit / numSimulations,
            minFinalProfit,
            maxFinalProfit,
            numSimulations
        });
        setMcLoading(false);
    }, [tradesData, numSimulations]);

    // Feature Analysis with Gemini AI
    const analyzeWithGemini = useCallback(async () => {
        setAiLoading(true);
        setAiResponse(''); // Clear previous AI response
        try {
            // Prepare a sample of trades to send to Gemini (due to context window limits)
            const summarizedTrades = tradesData.slice(0, 50).map(trade => ({
                entry_time: trade.entry_time,
                session: trade.session,
                volatility: trade.volatility,
                isLong: trade.isLong ? 'Buy' : 'Sell',
                profit: parseFloat(trade.profit)
            }));

            // Construct the prompt for Gemini
            const payload = {
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Analyze the following trading data and answer the question:\n\n${aiPrompt}\n\nTrade Data (sample of first ${summarizedTrades.length} trades):\n${JSON.stringify(summarizedTrades, null, 2)}\n\n(Focus on general patterns and insights based on this sample. Provide concise and actionable insights.)`
                    }]
                }]
            };

            const apiKey = ""; // Canvas will automatically provide this at runtime
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Gemini API error:", errorData);
                setAiResponse(`Error from AI: ${errorData.error?.message || response.statusText}`);
                return;
            }

            const result = await response.json();

            // Check for valid response structure
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setAiResponse(text);
            } else {
                setAiResponse("No valid response received from AI. Please try a different prompt.");
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            setAiResponse(`Failed to connect to AI: ${error.message}. Please check your network or try again.`);
        } finally {
            setAiLoading(false);
        }
    }, [aiPrompt, tradesData]);

    // Trade Hypothesis Testing Logic
    const testTradeHypothesis = useCallback(() => {
        const { session, volatility, isLong, minProfit, maxDrawdown } = hypothesisCriteria;

        const filteredTrades = tradesData.filter(trade => {
            let match = true;

            if (session && trade.session !== session) {
                match = false;
            }
            if (volatility && trade.volatility !== volatility) {
                match = false;
            }
            // isLong needs to be compared correctly (boolean vs string 'true'/'false')
            if (isLong !== '' && trade.isLong !== (isLong === 'true')) {
                match = false;
            }
            if (minProfit !== '' && parseFloat(trade.profit) < parseFloat(minProfit)) {
                match = false;
            }
            // Simplified maxDrawdown for individual trade loss threshold
            if (maxDrawdown !== '' && parseFloat(trade.profit) < -Math.abs(parseFloat(maxDrawdown))) {
                 match = false;
            }

            return match;
        });

        if (filteredTrades.length === 0) {
            setHypothesisResults({
                totalTrades: 0,
                totalProfit: 0,
                winRate: 0,
                avgProfit: 0,
                largestLoss: 0,
                largestWin: 0
            });
            return;
        }

        const totalProfit = filteredTrades.reduce((sum, trade) => sum + parseFloat(trade.profit), 0);
        const wins = filteredTrades.filter(trade => parseFloat(trade.profit) > 0).length;
        const winRate = (wins / filteredTrades.length) * 100;
        const avgProfit = totalProfit / filteredTrades.length;
        const largestLoss = Math.min(...filteredTrades.map(trade => parseFloat(trade.profit)));
        const largestWin = Math.max(...filteredTrades.map(trade => parseFloat(trade.profit)));

        setHypothesisResults({
            totalTrades: filteredTrades.length,
            totalProfit: totalProfit.toFixed(2),
            winRate: winRate.toFixed(2),
            avgProfit: avgProfit.toFixed(2),
            largestLoss: largestLoss.toFixed(2),
            largestWin: largestWin.toFixed(2)
        });
    }, [tradesData, hypothesisCriteria]);

    // Handle hypothesis criteria changes
    const handleHypothesisChange = (e) => {
        const { name, value } = e.target;
        setHypothesisCriteria(prev => ({ ...prev, [name]: value }));
    };

    // Function to convert YYYY-MM-DD to Unix timestamp in seconds
    const dateToUnixSeconds = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return Math.floor(date.getTime() / 1000); // Convert milliseconds to seconds
    };

    // Function to fetch data from the external API
    const fetchExternalData = useCallback(async () => {
        setApiLoadingData(true);
        setApiError('');
        try {
            const startTimestamp = dateToUnixSeconds(apiStartDate);
            const endTimestamp = dateToUnixSeconds(apiEndDate);

            if (!apiSymbol || !apiInterval || !startTimestamp || !endTimestamp) {
                setApiError("Please fill all API fields (Symbol, Interval, Start Date, End Date).");
                setApiLoadingData(false);
                return;
            }

            const apiUrl = `http://localhost:4040/api/analyze?symbol=${apiSymbol}&interval=${apiInterval}&start=${startTimestamp}&end=${endTimestamp}`;
            console.log("Fetching from API:", apiUrl);

            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log("API Response:", data);

            // Assuming API returns data in a similar structure to initialAnalysisData and initialTradesData
            if (data.analysis && data.trades) {
                setAnalysisData(data.analysis);
                setTradesData(data.trades);
                // Also save to Firestore
                saveDataToFirestore(data.analysis, data.trades);
            } else {
                setApiError("API response did not contain expected 'analysis' and 'trades' keys. Ensure the API returns JSON with 'analysis' and 'trades' properties.");
            }

        } catch (error) {
            console.error("Error fetching external data:", error);
            setApiError(`Failed to fetch data: ${error.message}`);
        } finally {
            setApiLoadingData(false);
        }
    }, [apiSymbol, apiInterval, apiStartDate, apiEndDate, saveDataToFirestore]);


    // Show a loading spinner until data is fetched/initialized
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="flex items-center space-x-2">
                    <RefreshCw className="animate-spin text-indigo-500" size={32} />
                    <span className="text-xl">Loading Dashboard Data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-inter flex flex-col lg:flex-row">
            {/* Sidebar Navigation */}
            <nav className="w-full lg:w-64 bg-gray-900 shadow-xl p-6 flex flex-col justify-between sticky top-0 h-auto lg:h-screen z-10">
                <div>
                    <h1 className="text-2xl font-extrabold text-indigo-400 mb-8 flex items-center gap-2">
                        <BarChart2 className="inline-block" size={28} /> Trade Dashboard
                    </h1>
                    <ul>
                        <li className="mb-3">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center gap-3 transition-all duration-200 ${activeTab === 'overview' ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-300'}`}
                            >
                                <Home size={20} /> Overview
                            </button>
                        </li>
                        <li className="mb-3">
                            <button
                                onClick={() => setActiveTab('analysis')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center gap-3 transition-all duration-200 ${activeTab === 'analysis' ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-300'}`}
                            >
                                <BarChart2 size={20} /> Detailed Analysis
                            </button>
                        </li>
                        <li className="mb-3">
                            <button
                                onClick={() => setActiveTab('trades')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center gap-3 transition-all duration-200 ${activeTab === 'trades' ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-300'}`}
                            >
                                <TrendingUp size={20} /> Trades List
                            </button>
                        </li>
                        <li className="mb-3">
                            <button
                                onClick={() => setActiveTab('monte-carlo')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center gap-3 transition-all duration-200 ${activeTab === 'monte-carlo' ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-300'}`}
                            >
                                <Cpu size={20} /> Monte Carlo
                            </button>
                        </li>
                        <li className="mb-3">
                            <button
                                onClick={() => setActiveTab('gemini-ai')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center gap-3 transition-all duration-200 ${activeTab === 'gemini-ai' ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-300'}`}
                            >
                                <Info size={20} /> Gemini AI Analysis
                            </button>
                        </li>
                        <li className="mb-3">
                            <button
                                onClick={() => setActiveTab('hypothesis')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center gap-3 transition-all duration-200 ${activeTab === 'hypothesis' ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-300'}`}
                            >
                                <Target size={20} /> Hypothesis Testing
                            </button>
                        </li>
                        <li className="mb-3">
                            <button
                                onClick={() => setActiveTab('api-data')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center gap-3 transition-all duration-200 ${activeTab === 'api-data' ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-300'}`}
                            >
                                <Database size={20} /> External Data
                            </button>
                        </li>
                    </ul>
                </div>
                {/* User ID and Save/Load Buttons */}
                <div className="mt-8 pt-6 border-t border-gray-800">
                    {userId && (
                        <p className="text-sm text-gray-400 mb-4 break-words">
                            User ID: <span className="font-mono text-indigo-300">{userId}</span>
                        </p>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={() => saveDataToFirestore(analysisData, tradesData)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2"
                            disabled={loading} // Disable if already loading/saving
                        >
                            <Save size={18} /> Save
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                {activeTab === 'overview' && (
                    <section id="overview" className="mb-12">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8">Performance Overview</h2>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
                            <StatCard title="Total Profit" value={formatCurrency(parseFloat(analysisData.totalProfit))} unit="" icon="💰" color="from-green-600 to-green-800" />
                            <StatCard title="Win Rate" value={`${analysisData.winRate}`} unit="%" icon="📈" color="from-blue-600 to-blue-800" />
                            <StatCard title="Profit Factor" value={analysisData.profitFactor} unit="" icon="📊" color="from-purple-600 to-purple-800" />
                            <StatCard title="Max Drawdown" value={`${analysisData.maxDrawdown}`} unit="%" icon="📉" color="from-red-600 to-red-800" />
                            <StatCard title="Total Trades" value={analysisData.totalTrades} unit="" icon="🔄" color="from-yellow-600 to-yellow-800" />
                            <StatCard title="Avg Profit/Trade" value={formatCurrency(parseFloat(analysisData.avgProfit))} unit="" icon="🎯" color="from-teal-600 to-teal-800" />
                            <StatCard title="Avg Risk/Trade" value={formatCurrency(parseFloat(analysisData.avgRisk))} unit="" icon="⚠️" color="from-orange-600 to-orange-800" />
                            <StatCard title="Sharpe Ratio" value={analysisData.sharpeRatio} unit="" icon="💎" color="from-pink-600 to-pink-800" />
                        </div>

                        {/* Cumulative Profit Chart */}
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Cumulative Profit</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={cumulativeProfitChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="index" stroke="#cbd5e0" />
                                    <YAxis stroke="#cbd5e0" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="profit" stroke="#8884d8" activeDot={{ r: 8 }} name="Profit" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Best and Worst Trades */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-4">Best Trade</h3>
                                {analysisData.bestTrade ? (
                                    <ul className="text-gray-300 space-y-2">
                                        <li><span className="font-semibold text-white">Profit:</span> {formatCurrency(parseFloat(analysisData.bestTrade.profit))}</li>
                                        <li><span className="font-semibold text-white">Entry Time:</span> {analysisData.bestTrade.entry_time}</li>
                                        <li><span className="font-semibold text-white">Session:</span> {analysisData.bestTrade.session}</li>
                                        <li><span className="font-semibold text-white">Volatility:</span> {analysisData.bestTrade.volatility}</li>
                                        <li><span className="font-semibold text-white">Long Position:</span> {analysisData.bestTrade.isLong ? 'Yes' : 'No'}</li>
                                    </ul>
                                ) : (
                                    <p className="text-gray-400">No best trade data available.</p>
                                )}
                            </div>
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-4">Worst Trade</h3>
                                {analysisData.worstTrade ? (
                                    <ul className="text-gray-300 space-y-2">
                                        <li><span className="font-semibold text-white">Profit:</span> {formatCurrency(parseFloat(analysisData.worstTrade.profit))}</li>
                                        <li><span className="font-semibold text-white">Entry Time:</span> {analysisData.worstTrade.entry_time}</li>
                                        <li><span className="font-semibold text-white">Session:</span> {analysisData.worstTrade.session}</li>
                                        <li><span className="font-semibold text-white">Volatility:</span> {analysisData.worstTrade.volatility}</li>
                                        <li><span className="font-semibold text-white">Long Position:</span> {analysisData.worstTrade.isLong ? 'Yes' : 'No'}</li>
                                    </ul>
                                ) : (
                                    <p className="text-gray-400">No worst trade data available.</p>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'analysis' && (
                    <section id="detailed-analysis" className="mb-12">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8">Detailed Analysis</h2>

                        {/* Session Profit and Win Rate */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Profit by Session</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={sessionProfitChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#cbd5e0" />
                                        <YAxis stroke="#cbd5e0" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="profit" fill="#8884d8" name="Profit" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Win Rate by Session</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={Object.entries(analysisData.sessionWinRates).map(([name, winRate]) => ({ name, winRate: parseFloat(winRate) }))}
                                        margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#cbd5e0" />
                                        <YAxis stroke="#cbd5e0" label={{ value: "Win Rate (%)", angle: -90, position: 'insideLeft', fill: '#cbd5e0' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="winRate" fill="#82ca9d" name="Win Rate" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Volatility Profit and Win Rate */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Profit by Volatility</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={volatilityProfitChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#cbd5e0" />
                                        <YAxis stroke="#cbd5e0" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="profit" fill="#ffc658" name="Profit" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Win Rate by Volatility</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={Object.entries(analysisData.volWinRates).map(([name, winRate]) => ({ name, winRate: parseFloat(winRate) }))}
                                        margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="name" stroke="#cbd5e0" />
                                        <YAxis stroke="#cbd5e0" label={{ value: "Win Rate (%)", angle: -90, position: 'insideLeft', fill: '#cbd5e0' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="winRate" fill="#ff8042" name="Win Rate" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Position Profit Pie Chart */}
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Profit by Position (Buy/Sell)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={posProfitChartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {posProfitChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={pieChartColors[index % pieChartColors.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Daily Profits - Now GitHub-style heatmap */}
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8">
                            <GitHubDailyProfitsChart
                                dailyProfits={analysisData.dailyProfits}
                                startTime={analysisData.startTime}
                                endTime={analysisData.endTime}
                            />
                        </div>

                        {/* Monthly Profits */}
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Monthly Profits</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthlyProfitsChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="month" stroke="#cbd5e0" />
                                    <YAxis stroke="#cbd5e0" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="profit" fill="#d0ed57" name="Monthly Profit" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Hourly Stats and Day of Week Analysis */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Hourly Trading Stats</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={hourStatsChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="hour" stroke="#cbd5e0" />
                                        <YAxis stroke="#cbd5e0" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="wins" fill="#8dd1e1" name="Wins" stackId="a" />
                                        <Bar dataKey="losses" fill="#ff7300" name="Losses" stackId="a" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Day of Week Analysis</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={dayOfWeekAnalysisChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis dataKey="day" stroke="#cbd5e0" />
                                        <YAxis yAxisId="left" stroke="#cbd5e0" label={{ value: "Profit", angle: -90, position: 'insideLeft', fill: '#cbd5e0' }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#00c49f" label={{ value: "Win Rate (%)", angle: 90, position: 'insideRight', fill: '#00c49f' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="profit" fill="#83a6ed" name="Profit" />
                                        <Line yAxisId="right" type="monotone" dataKey="winRate" stroke="#00c49f" name="Win Rate" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Profit Buckets */}
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-200 mb-6">Profit Buckets</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={profitBucketsChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="bucket" stroke="#cbd5e0" />
                                    <YAxis stroke="#cbd5e0" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="count" fill="#8884d8" name="Number of Trades" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>
                )}

                {activeTab === 'trades' && (
                    <section id="trades-list" className="mb-12">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8">Trades List</h2>
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Entry Time</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Session</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Volatility</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Position</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Profit</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Risk %</th>
                                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Stoploss Touched</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-800 divide-y divide-gray-700">
                                    {tradesData.map((trade, index) => (
                                        <tr key={index} className="hover:bg-gray-700">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-100">{trade.entry_time}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{trade.session}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{trade.volatility}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{trade.isLong ? 'Buy' : 'Sell'}</td>
                                            <td className={`px-3 py-2 whitespace-nowrap text-sm ${parseFloat(trade.profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(parseFloat(trade.profit))}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{trade.risk_percentage}%</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{trade.stoploss_touched ? 'Yes' : 'No'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {activeTab === 'monte-carlo' && (
                    <section id="monte-carlo" className="mb-12">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8">Monte Carlo Simulation</h2>
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8">
                            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                                <label htmlFor="numSimulations" className="text-gray-300 text-lg">Number of Simulations:</label>
                                <input
                                    type="number"
                                    id="numSimulations"
                                    value={numSimulations}
                                    onChange={(e) => setNumSimulations(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="flex-1 w-full sm:w-auto bg-gray-700 text-white border border-gray-600 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    min="1"
                                />
                                <button
                                    onClick={runMonteCarloSimulation}
                                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2"
                                    disabled={mcLoading}
                                >
                                    {mcLoading ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={18} /> Running...
                                        </>
                                    ) : (
                                        'Run Simulation'
                                    )}
                                </button>
                            </div>

                            {mcStats && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                                    <div className="p-3 bg-gray-700 rounded-lg shadow-sm">
                                        <p className="text-sm text-gray-400">Average Final Profit</p>
                                        <p className="text-xl font-bold text-green-400">{formatCurrency(mcStats.avgFinalProfit)}</p>
                                    </div>
                                    <div className="p-3 bg-gray-700 rounded-lg shadow-sm">
                                        <p className="text-sm text-gray-400">Min Final Profit</p>
                                        <p className="text-xl font-bold text-red-400">{formatCurrency(mcStats.minFinalProfit)}</p>
                                    </div>
                                    <div className="p-3 bg-gray-700 rounded-lg shadow-sm">
                                        <p className="text-sm text-gray-400">Max Final Profit</p>
                                        <p className="text-xl font-bold text-blue-400">{formatCurrency(mcStats.maxFinalProfit)}</p>
                                    </div>
                                </div>
                            )}

                            {monteCarloResults.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis stroke="#cbd5e0" label={{ value: "Number of Trades", position: "insideBottom", offset: 0, fill: '#cbd5e0' }} />
                                        <YAxis stroke="#cbd5e0" label={{ value: "Profit", angle: -90, position: 'insideLeft', fill: '#cbd5e0' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        {monteCarloResults.map((equityCurve, index) => (
                                            <Line
                                                key={`mc-line-${index}`}
                                                data={equityCurve.map((profit, i) => ({ index: i, profit }))}
                                                dataKey="profit"
                                                dot={false}
                                                stroke={index === 0 ? '#FFD700' : `rgba(136, 132, 216, ${1 / Math.sqrt(numSimulations)})`} // Golden for first, lighter purple for others
                                                strokeWidth={index === 0 ? 2 : 0.5}
                                                isAnimationActive={false} // Disable animation for many lines
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-400 mt-8">Run the simulation to see equity curves.</p>
                            )}
                        </div>
                    </section>
                )}

                {activeTab === 'gemini-ai' && (
                    <section id="gemini-ai" className="mb-12">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8">Gemini AI Feature Analysis</h2>
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                            <p className="text-gray-300 mb-4">
                                Leverage Gemini AI to gain deeper insights from your trading data.
                                Ask questions like: "What patterns do you see in profitable trades during the New York session?" or "Suggest improvements based on volatility performance."
                            </p>
                            <div className="mb-4">
                                <label htmlFor="ai-prompt" className="block text-gray-300 text-sm font-bold mb-2">
                                    Your Question for Gemini AI:
                                </label>
                                <textarea
                                    id="ai-prompt"
                                    className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 bg-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-indigo-500 focus:border-indigo-500"
                                    rows="4"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder="e.g., Analyze the relationship between RSI and trade outcome."
                                ></textarea>
                            </div>
                            <button
                                onClick={analyzeWithGemini}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2"
                                disabled={aiLoading || !aiPrompt.trim()}
                            >
                                {aiLoading ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={18} /> Analyzing...
                                    </>
                                ) : (
                                    'Get AI Insights'
                                )}
                            </button>
                            {aiResponse && (
                                <div className="mt-6 p-4 bg-gray-700 rounded-lg shadow-inner text-gray-200 whitespace-pre-wrap">
                                    <h4 className="font-semibold text-lg mb-2 text-indigo-300">AI Response:</h4>
                                    {aiResponse}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {activeTab === 'hypothesis' && (
                    <section id="hypothesis-testing" className="mb-12">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8">Trade Hypothesis Testing</h2>
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8">
                            <p className="text-gray-300 mb-4">
                                Test specific trading hypotheses against your historical data.
                                Filter trades by various criteria and see their collective performance.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label htmlFor="hypo-session" className="block text-gray-300 text-sm font-bold mb-2">Session:</label>
                                    <select
                                        id="hypo-session"
                                        name="session"
                                        value={hypothesisCriteria.session}
                                        onChange={handleHypothesisChange}
                                        className="block w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Any Session</option>
                                        {Object.keys(analysisData.sessionProfit).map(session => (
                                            <option key={session} value={session}>{session}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="hypo-volatility" className="block text-gray-300 text-sm font-bold mb-2">Volatility:</label>
                                    <select
                                        id="hypo-volatility"
                                        name="volatility"
                                        value={hypothesisCriteria.volatility}
                                        onChange={handleHypothesisChange}
                                        className="block w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Any Volatility</option>
                                        {Object.keys(analysisData.volProfit).map(vol => (
                                            <option key={vol} value={vol}>{vol}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="hypo-isLong" className="block text-gray-300 text-sm font-bold mb-2">Position Type:</label>
                                    <select
                                        id="hypo-isLong"
                                        name="isLong"
                                        value={hypothesisCriteria.isLong}
                                        onChange={handleHypothesisChange}
                                        className="block w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Any Position</option>
                                        <option value="true">Buy (Long)</option>
                                        <option value="false">Sell (Short)</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="hypo-minProfit" className="block text-gray-300 text-sm font-bold mb-2">Minimum Profit (abs):</label>
                                    <input
                                        type="number"
                                        id="hypo-minProfit"
                                        name="minProfit"
                                        value={hypothesisCriteria.minProfit}
                                        onChange={handleHypothesisChange}
                                        className="block w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g., 0.5"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="hypo-maxDrawdown" className="block text-gray-300 text-sm font-bold mb-2">Max Single Trade Loss (abs):</label>
                                    <input
                                        type="number"
                                        id="hypo-maxDrawdown"
                                        name="maxDrawdown"
                                        value={hypothesisCriteria.maxDrawdown}
                                        onChange={handleHypothesisChange}
                                        className="block w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g., 1.0"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={testTradeHypothesis}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                                Test Hypothesis
                            </button>

                            {hypothesisResults && (
                                <div className="mt-6 p-4 bg-gray-700 rounded-lg shadow-inner text-gray-200">
                                    <h4 className="font-semibold text-lg mb-3 text-indigo-300">Hypothesis Test Results:</h4>
                                    <ul className="space-y-2">
                                        <li><span className="font-semibold text-white">Total Trades:</span> {hypothesisResults.totalTrades}</li>
                                        <li><span className="font-semibold text-white">Total Profit:</span> {formatCurrency(parseFloat(hypothesisResults.totalProfit))}</li>
                                        <li><span className="font-semibold text-white">Win Rate:</span> {hypothesisResults.winRate}%</li>
                                        <li><span className="font-semibold text-white">Average Profit/Trade:</span> {formatCurrency(parseFloat(hypothesisResults.avgProfit))}</li>
                                        <li><span className="font-semibold text-white">Largest Win:</span> {formatCurrency(parseFloat(hypothesisResults.largestWin))}</li>
                                        <li><span className="font-semibold text-white">Largest Loss:</span> {formatCurrency(parseFloat(hypothesisResults.largestLoss))}</li>
                                    </ul>
                                    {hypothesisResults.totalTrades === 0 && (
                                        <p className="mt-4 text-orange-400">No trades matched the specified criteria.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {activeTab === 'api-data' && (
                    <section id="api-data" className="mb-12">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-8">Fetch External Data</h2>
                        <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
                            <p className="text-gray-300 mb-4">
                                Fetch new trading data from an external API. The dashboard will update with the new data.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label htmlFor="api-symbol" className="block text-gray-300 text-sm font-bold mb-2">Symbol (e.g., BTCUSD):</label>
                                    <input
                                        type="text"
                                        id="api-symbol"
                                        value={apiSymbol}
                                        onChange={(e) => setApiSymbol(e.target.value)}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-100 bg-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="BTCUSD"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="api-interval" className="block text-gray-300 text-sm font-bold mb-2">Interval (e.g., 15m):</label>
                                    <input
                                        type="text"
                                        id="api-interval"
                                        value={apiInterval}
                                        onChange={(e) => setApiInterval(e.target.value)}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-100 bg-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="15m"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="api-start-date" className="block text-gray-300 text-sm font-bold mb-2">Start Date:</label>
                                    <input
                                        type="date"
                                        id="api-start-date"
                                        value={apiStartDate}
                                        onChange={(e) => setApiStartDate(e.target.value)}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-100 bg-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="api-end-date" className="block text-gray-300 text-sm font-bold mb-2">End Date:</label>
                                    <input
                                        type="date"
                                        id="api-end-date"
                                        value={apiEndDate}
                                        onChange={(e) => setApiEndDate(e.target.value)}
                                        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-100 bg-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={fetchExternalData}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center gap-2"
                                disabled={apiLoadingData}
                            >
                                {apiLoadingData ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={18} /> Fetching...
                                    </>
                                ) : (
                                    'Fetch Data'
                                )}
                            </button>
                            {apiError && (
                                <div className="mt-4 p-3 bg-red-800 text-red-100 rounded-lg shadow-inner">
                                    Error: {apiError}
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

export default App;
