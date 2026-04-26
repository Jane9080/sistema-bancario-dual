const { getDbByBank, runQuery, allQuery, getQuery } = require('../database/sqlite');

class Notification {
    // Criar notificação
    static async create(bankCode, notificationData) {
        const db = getDbByBank(bankCode);
        
        const result = await runQuery(db, `
            INSERT INTO notifications (account_id, type, title, message, read)
            VALUES (?, ?, ?, ?, ?)
        `, [
            notificationData.account_id,
            notificationData.type,
            notificationData.title,
            notificationData.message,
            0
        ]);
        
        return { id: result.lastID, ...notificationData };
    }
    
    // Buscar notificações não lidas
    static async getUnread(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        return await allQuery(db, `
            SELECT * FROM notifications 
            WHERE account_id = ? AND read = 0 
            ORDER BY created_at DESC
        `, [accountId]);
    }
    
    // Buscar todas notificações
    static async getAll(bankCode, accountId, limit = 20) {
        const db = getDbByBank(bankCode);
        return await allQuery(db, `
            SELECT * FROM notifications 
            WHERE account_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [accountId, limit]);
    }
    
    // Marcar como lida
    static async markAsRead(bankCode, notificationId) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, `
            UPDATE notifications SET read = 1 WHERE id = ?
        `, [notificationId]);
    }
    
    // Marcar todas como lidas
    static async markAllAsRead(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, `
            UPDATE notifications SET read = 1 WHERE account_id = ?
        `, [accountId]);
    }
    
    // Eliminar notificação
    static async deleteById(bankCode, notificationId) {
        const db = getDbByBank(bankCode);
        return await runQuery(db, 'DELETE FROM notifications WHERE id = ?', [notificationId]);
    }
    
    // Contar não lidas
    static async countUnread(bankCode, accountId) {
        const db = getDbByBank(bankCode);
        const result = await getQuery(db, `
            SELECT COUNT(*) as total FROM notifications 
            WHERE account_id = ? AND read = 0
        `, [accountId]);
        return result.total;
    }
}

module.exports = Notification;