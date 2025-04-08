const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class TradeEngine {
    constructor({ initialBalance = 10000, leverage = 1, mode = 'futures' }) {
        this.balance = initialBalance;
        this.leverage = leverage;
        this.mode = mode;
        this.positions = []; // multiple open trades allowed
    }

    async openPosition({ symbol, price, size, isLong, sl, tp }) {
        const position = await prisma.trade.create({
            data: {
                symbol,
                isLong,
                entryPrice: price,
                positionSize: size,
                status: 'open',
                entryTime: new Date(),
                stopLoss: sl,
                takeProfit: tp
            }
        });
        this.positions.push(position);
        return position;
    }

    async closePosition(positionId, exitPrice) {
        const position = await prisma.trade.findUnique({ where: { id: positionId } });
        if (!position || position.status === 'closed') return null;

        const pnl = position.isLong
            ? (exitPrice - position.entryPrice) * position.positionSize
            : (position.entryPrice - exitPrice) * position.positionSize;

        this.balance += pnl;

        const updated = await prisma.trade.update({
            where: { id: positionId },
            data: {
                exitPrice,
                pnl,
                status: 'closed',
                exitTime: new Date()
            }
        });

        this.positions = this.positions.filter(p => p.id !== positionId);
        return updated;
    }

    async partialExit(positionId, exitPrice) {
        const position = await prisma.trade.findUnique({ where: { id: positionId } });
        if (!position || position.status !== 'open') return null;

        const halfSize = position.positionSize / 2;
        const pnl = position.isLong
            ? (exitPrice - position.entryPrice) * halfSize
            : (position.entryPrice - exitPrice) * halfSize;

        this.balance += pnl;

        await prisma.trade.update({
            where: { id: positionId },
            data: {
                positionSize: halfSize,
                updatedAt: new Date()
            }
        });

        return { pnl, newSize: halfSize };
    }

    async handlePriceUpdate(symbol, currentPrice) {
        const openPositions = await prisma.trade.findMany({
            where: {
                symbol,
                status: 'open'
            }
        });

        for (const pos of openPositions) {
            const hitSL = pos.isLong ? currentPrice <= pos.stopLoss : currentPrice >= pos.stopLoss;
            const hitTP = pos.isLong ? currentPrice >= pos.takeProfit : currentPrice <= pos.takeProfit;

            if (hitSL || hitTP) {
                await this.closePosition(pos.id, currentPrice);
            }
        }
    }

    getBalance() {
        return this.balance;
    }

    async getOpenPositions() {
        return await prisma.trade.findMany({ where: { status: 'open' } });
    }
}

module.exports = TradeEngine;
