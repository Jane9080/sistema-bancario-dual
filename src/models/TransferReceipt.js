const { getDbByBank, runQuery, allQuery, getQuery } = require('../database/sqlite');

class TransferReceipt {
    // Criar novo comprovativo
    static async create(bankCode, receiptData) {
        const db = getDbByBank(bankCode);
        
        const result = await runQuery(db, `
            INSERT INTO receipts (
                account_id, reference, type, from_name, from_account,
                to_name, to_account, amount, fee, total, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            receiptData.account_id,
            receiptData.reference,
            receiptData.type,
            receiptData.from_name,
            receiptData.from_account,
            receiptData.to_name,
            receiptData.to_account,
            receiptData.amount,
            receiptData.fee,
            receiptData.total,
            receiptData.status || 'SUCESSO'
        ]);
        
        return { id: result.lastID, ...receiptData };
    }
    
    // Buscar comprovativos por conta
    static async findByAccountId(bankCode, accountId, startDate = null, endDate = null) {
        const db = getDbByBank(bankCode);
        let query = 'SELECT * FROM receipts WHERE account_id = ?';
        const params = [accountId];
        
        if (startDate && endDate) {
            query += ' AND date(created_at) BETWEEN date(?) AND date(?)';
            params.push(startDate, endDate);
        }
        
        query += ' ORDER BY created_at DESC';
        
        return await allQuery(db, query, params);
    }
    
    // Buscar comprovativo por referência
    static async findByReference(bankCode, reference) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, 'SELECT * FROM receipts WHERE reference = ?', [reference]);
    }
    
    // Buscar comprovativo por ID
    static async findById(bankCode, id) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, 'SELECT * FROM receipts WHERE id = ?', [id]);
    }
    
    // Eliminar comprovativo
    static async deleteById(bankCode, id) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, 'DELETE FROM receipts WHERE id = ?', [id]);
    }
}

module.exports = TransferReceipt;