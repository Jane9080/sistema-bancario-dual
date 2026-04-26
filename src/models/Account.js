const { getDbByBank, getQuery, runQuery, allQuery } = require('../database/sqlite');
const { STATUS } = require('../utils/constants');

class Account {
    static async findById(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, 'SELECT * FROM accounts WHERE id = ?', [accountId]);
    }
    
    static async findByAccountNumber(bankCode, accountNumber) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, 'SELECT * FROM accounts WHERE account_number = ?', [accountNumber]);
    }
    
    static async findByEmail(bankCode, email) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, 'SELECT * FROM accounts WHERE holder_email = ?', [email]);
    }
    
    static async findByUsername(bankCode, username) {
        const db = getDbByBank(bankCode);
        return await getQuery(db, 'SELECT * FROM accounts WHERE username = ?', [username]);
    }
    
    // Buscar por NIB (sem espaços)
    static async findByNIB(bankCode, nib) {
        const db = getDbByBank(bankCode);
        const normalizedInput = nib.replace(/\s/g, '');
        const accounts = await allQuery(db, 'SELECT * FROM accounts');
        for (const account of accounts) {
            if (account.nib === normalizedInput) {
                return account;
            }
        }
        return null;
    }
    
    static async updateBalance(bankCode, accountId, newBalance) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, `
            UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [newBalance, accountId]);
    }
    
    static async getBalance(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        const account = await getQuery(db, 'SELECT balance FROM accounts WHERE id = ?', [accountId]);
        return account ? account.balance : 0;
    }
    
    static async isActive(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        const account = await getQuery(db, 'SELECT status FROM accounts WHERE id = ?', [accountId]);
        return account && account.status === STATUS.ACTIVE;
    }
    
    static async blockAccount(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, `UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [STATUS.BLOCKED, accountId]);
    }
    
    static async activateAccount(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, `UPDATE accounts SET status = ?, failed_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [STATUS.ACTIVE, accountId]);
    }
    
    static async listAll(bankCode, limit = 100, offset = 0) {
        const db = getDbByBank(bankCode);
        return await allQuery(db, `SELECT id, account_number, username, holder_name, holder_email, balance, status, created_at FROM accounts ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    }
    
    static async count(bankCode) {
        const db = getDbByBank(bankCode);
        const result = await getQuery(db, 'SELECT COUNT(*) as total FROM accounts');
        return result.total;
    }


// Buscar conta por nome (para encontrar conta do banco)
static async findByHolderName(bankCode, namePattern) {
    const db = getDbByBank(bankCode);
    return await getQuery(db, 'SELECT * FROM accounts WHERE holder_name LIKE ?', [namePattern]);
}

}


module.exports = Account;