const { getDbByBank, getQuery, runQuery, allQuery } = require('../database/sqlite');

class Loan {
    // Criar novo empréstimo
    static async create(bankCode, loanData) {
        const db = getDbByBank(bankCode);
        
        const result = await runQuery(db, `
            INSERT INTO loans (
                account_id, amount, remaining_balance, interest_rate,
                monthly_payment, total_parcels, remaining_parcels,
                status, next_due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            loanData.account_id,
            loanData.amount,
            loanData.remaining_balance,
            loanData.interest_rate,
            loanData.monthly_payment,
            loanData.total_parcels,
            loanData.remaining_parcels,
            'active',
            loanData.next_due_date
        ]);
        
        return { id: result.lastID, ...loanData };
    }
    
    // Buscar empréstimo ativo por conta
    static async findActiveByAccountId(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, `
            SELECT * FROM loans 
            WHERE account_id = ? AND status = 'active'
            ORDER BY id DESC LIMIT 1
        `, [accountId]);
    }
    
    // Buscar todos empréstimos de uma conta
    static async findAllByAccountId(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        return await allQuery(db, `
            SELECT * FROM loans 
            WHERE account_id = ? 
            ORDER BY created_at DESC
        `, [accountId]);
    }
    
    // Atualizar empréstimo após pagamento
    static async updateAfterPayment(bankCode, loanId, remainingBalance, remainingParcels, status = 'active') {
        const db = getDbByBank(bankCode);
        return await runQuery(db, `
            UPDATE loans 
            SET remaining_balance = ?, remaining_parcels = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [remainingBalance, remainingParcels, status, loanId]);
    }
    
    // Atualizar data do próximo vencimento
    static async updateNextDueDate(bankCode, loanId, nextDueDate) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, `
            UPDATE loans SET next_due_date = ? WHERE id = ?
        `, [nextDueDate, loanId]);
    }
}

module.exports = Loan;