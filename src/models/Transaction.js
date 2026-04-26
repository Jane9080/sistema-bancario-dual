const { getDbByBank, runQuery, allQuery, getQuery } = require('../database/sqlite');
const { generateReference } = require('../utils/crypto');

class Transaction {
    // Criar nova transação
    static async create(bankCode, transactionData) {
        const db = getDbByBank(bankCode);
        const reference = generateReference();
        
        const result = await runQuery(db, `
            INSERT INTO transactions (
                account_id, type, amount, balance_after, 
                counterparty, description, reference, fee
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            transactionData.account_id,
            transactionData.type,
            transactionData.amount,
            transactionData.balance_after,
            transactionData.counterparty || null,
            transactionData.description || null,
            reference,
            transactionData.fee || 0
        ]);
        
        return {
            id: result.lastID,
            reference,
            ...transactionData
        };
    }
    
    // Buscar transações de uma conta
    static async findByAccountId(bankCode, accountId, limit = 50, offset = 0) {
        const db = getDbByBank(bankCode);
        return await allQuery(db, `
            SELECT * FROM transactions 
            WHERE account_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [accountId, limit, offset]);
    }
    
    // Buscar transação por referência
    static async findByReference(bankCode, reference) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, 'SELECT * FROM transactions WHERE reference = ?', [reference]);
    }
    
    // Obter extrato com filtros
    static async getStatement(bankCode, accountId, startDate, endDate, type = null) {
        const db = getDbByBank(bankCode);
        let query = `
            SELECT * FROM transactions 
            WHERE account_id = ? 
            AND date(created_at) BETWEEN date(?) AND date(?)
        `;
        const params = [accountId, startDate, endDate];
        
        if (type) {
            query += ` AND type = ?`;
            params.push(type);
        }
        
        query += ` ORDER BY created_at DESC`;
        
        return await allQuery(db, query, params);
    }
    
    // Obter saldo total de transações de um tipo
    static async getTotalByType(bankCode, accountId, type, startDate = null, endDate = null) {
        const db = getDbByBank(bankCode);
        let query = `
            SELECT SUM(amount) as total FROM transactions 
            WHERE account_id = ? AND type = ?
        `;
        const params = [accountId, type];
        
        if (startDate && endDate) {
            query += ` AND date(created_at) BETWEEN date(?) AND date(?)`;
            params.push(startDate, endDate);
        }
        
        const result = await getQuery(db, query, params);
        return result.total || 0;
    }
    
    // Últimas N transações
    static async getLastTransactions(bankCode, accountId, n = 10) {
        const db = getDbByBank(bankCode);
        return await allQuery(db, `
            SELECT * FROM transactions 
            WHERE account_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [accountId, n]);
    }
}

module.exports = Transaction;