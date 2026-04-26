const express = require('express');
const { verifyToken } = require('../utils/crypto');
const { querySingle, query } = require('../database/supabase');
const { transferSameBank, transferInterBank } = require('../services/transfer');
const { deposit, withdraw } = require('../services/account');

const router = express.Router();

async function authMiddleware(req, res, next) {
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
}

router.get('/accounts/:bankCode/:accountId', authMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    if (req.user.accountId != accountId) return res.status(403).json({ error: 'Acesso negado' });
    const account = await querySingle(bankCode, 'accounts', { id: parseInt(accountId) });
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json({ id: account.id, account_number: account.account_number, holder_name: account.holder_name, holder_email: account.holder_email, balance: account.balance, status: account.status });
});

router.get('/transactions/:bankCode/:accountId', authMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    if (req.user.accountId != accountId) return res.status(403).json({ error: 'Acesso negado' });
    const transactions = await query(bankCode, 'transactions', '*', { account_id: parseInt(accountId) });
    res.json(transactions.slice(0, 50));
});

router.post('/deposit/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { amount, description } = req.body;
    try {
        const result = await deposit(bankCode, req.user.accountId, amount, description);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/withdraw/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { amount, description } = req.body;
    try {
        const result = await withdraw(bankCode, req.user.accountId, amount, description);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/transfer/same/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { to_account, amount, description, confirm_key } = req.body;
    try {
        const result = await transferSameBank(bankCode, req.user.accountId, to_account, amount, description, confirm_key);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/transfer/inter/:fromBankCode', authMiddleware, async (req, res) => {
    const { fromBankCode } = req.params;
    const { to_bank, to_account, amount, description, confirm_key } = req.body;
    try {
        const result = await transferInterBank(fromBankCode, req.user.accountId, to_bank, to_account, amount, description, confirm_key);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Alterar password
router.post('/auth/change-password/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { currentPassword, newPassword } = req.body;
    try {
        const { changePassword } = require('../services/auth');
        const result = await changePassword(bankCode, req.user.accountId, currentPassword, newPassword);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ========== EMPRÉSTIMOS ==========
const { requestLoan, payMonthlyInstallment, getLoanStatus } = require('../services/loan');

router.post('/loan/request/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { amount, months, confirm_key } = req.body;
    try {
        const result = await requestLoan(bankCode, req.user.accountId, amount, months, confirm_key);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/loan/pay/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { confirm_key } = req.body;
    try {
        const result = await payMonthlyInstallment(bankCode, req.user.accountId, confirm_key);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/loan/status/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const result = await getLoanStatus(bankCode, req.user.accountId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ========== PERFIL ==========
router.get('/profile/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const account = await querySingle(bankCode, 'accounts', { id: req.user.accountId });
        if (!account) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }
        res.json({
            holder_name: account.holder_name,
            holder_email: account.holder_email,
            holder_phone: account.holder_phone,
            mother_name: account.mother_name,
            father_name: account.father_name,
            age: account.age,
            birth_date: account.birth_date,
            marital_status: account.marital_status,
            passport_number: account.passport_number,
            nif: account.nif,
            address: account.address,
            account_number: account.account_number,
            nib: account.nib,
            iban: account.iban,
            username: account.username,
            confirm_key: account.confirm_key,
            balance: account.balance,
            status: account.status,
            created_at: account.created_at
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== COMPROVATIVOS ==========
const { listReceipts, getReceipt, deleteReceipt } = require('../services/receipt');
const path = require('path');
const fs = require('fs');

router.get('/receipts/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { startDate, endDate } = req.query;
    try {
        const receipts = await listReceipts(bankCode, req.user.accountId, startDate, endDate);
        res.json(receipts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/receipts/:bankCode/download/:id', authMiddleware, async (req, res) => {
    const { bankCode, id } = req.params;
    try {
        const receipt = await getReceipt(bankCode, id);
        if (!receipt) return res.status(404).json({ error: 'Comprovativo não encontrado' });
        const filename = `comprovativo_${receipt.reference}.pdf`;
        const filepath = path.join(__dirname, '../../receipts', filename);
        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Ficheiro não encontrado' });
        res.download(filepath, filename);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/receipts/:bankCode/view/:id', authMiddleware, async (req, res) => {
    const { bankCode, id } = req.params;
    try {
        const receipt = await getReceipt(bankCode, id);
        if (!receipt) return res.status(404).json({ error: 'Comprovativo não encontrado' });
        const filename = `comprovativo_${receipt.reference}.pdf`;
        const filepath = path.join(__dirname, '../../receipts', filename);
        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Ficheiro não encontrado' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
        fs.createReadStream(filepath).pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/receipts/:bankCode/:id', authMiddleware, async (req, res) => {
    const { bankCode, id } = req.params;
    try {
        const receipt = await getReceipt(bankCode, id);
        if (!receipt) return res.status(404).json({ error: 'Comprovativo não encontrado' });
        const filename = `comprovativo_${receipt.reference}.pdf`;
        const filepath = path.join(__dirname, '../../receipts', filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        await deleteReceipt(bankCode, id);
        res.json({ success: true, message: 'Comprovativo eliminado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== NOTIFICAÇÕES ==========
const { 
    getUnreadNotifications, 
    getAllNotifications, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    countUnread
} = require('../services/notification');

router.get('/notifications/unread/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const notifications = await getUnreadNotifications(bankCode, req.user.accountId);
        const count = await countUnread(bankCode, req.user.accountId);
        res.json({ notifications, unreadCount: count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/notifications/all/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    try {
        const notifications = await getAllNotifications(bankCode, req.user.accountId, limit);
        const unreadCount = await countUnread(bankCode, req.user.accountId);
        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/notifications/read/:bankCode/:id', authMiddleware, async (req, res) => {
    const { bankCode, id } = req.params;
    try {
        await markAsRead(bankCode, id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/notifications/read-all/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        await markAllAsRead(bankCode, req.user.accountId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/notifications/:bankCode/:id', authMiddleware, async (req, res) => {
    const { bankCode, id } = req.params;
    try {
        await deleteNotification(bankCode, id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download por referência (para admin)
router.get('/receipts/:bankCode/download-by-ref/:reference', async (req, res) => {
    const { bankCode, reference } = req.params;
    const token = req.query.token;
    
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    
    const { verifyToken } = require('../utils/crypto');
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Token inválido' });
    
    const receipt = await querySingle(bankCode, 'receipts', { reference });
    if (!receipt) return res.status(404).json({ error: 'Comprovativo não encontrado' });
    
    const filename = `comprovativo_${receipt.reference}.pdf`;
    const filepath = path.join(__dirname, '../../receipts', filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Ficheiro não encontrado' });
    res.download(filepath, filename);
});

// Visualizar por referência (abre no navegador)
router.get('/receipts/:bankCode/view-by-ref/:reference', async (req, res) => {
    const { bankCode, reference } = req.params;
    const token = req.query.token;
    
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    
    const { verifyToken } = require('../utils/crypto');
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Token inválido' });
    
    const receipt = await querySingle(bankCode, 'receipts', { reference });
    if (!receipt) return res.status(404).json({ error: 'Comprovativo não encontrado' });
    
    const filename = `comprovativo_${receipt.reference}.pdf`;
    const filepath = path.join(__dirname, '../../receipts', filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Ficheiro não encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    fs.createReadStream(filepath).pipe(res);
});

// Eliminar comprovativo (admin)
router.delete('/admin/receipts/:bankCode/:id', async (req, res) => {
    const { bankCode, id } = req.params;
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    
    const { verifyToken } = require('../utils/crypto');
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Token inválido' });
    
    const admin = await querySingle(bankCode, 'admins', { id: decoded.accountId });
    if (!admin) return res.status(403).json({ error: 'Acesso negado' });
    
    const receipt = await querySingle(bankCode, 'receipts', { id });
    if (!receipt) return res.status(404).json({ error: 'Comprovativo não encontrado' });
    
    const filename = `comprovativo_${receipt.reference}.pdf`;
    const filepath = path.join(__dirname, '../../receipts', filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    
    await deleteReceipt(bankCode, id);
    res.json({ success: true, message: 'Comprovativo eliminado' });
});

// ========== PERGUNTAS DE SEGURANÇA ==========
router.get('/security-questions/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { getSecurityQuestions } = require('../services/auth');
        const result = await getSecurityQuestions(bankCode, req.user.accountId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/security-questions/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    const { currentPassword, questions, answers, confirmKey } = req.body;
    try {
        const { updateSecurityQuestions } = require('../services/auth');
        const result = await updateSecurityQuestions(bankCode, req.user.accountId, currentPassword, questions, answers, confirmKey);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ========== AGENDAMENTO DE TRANSFERÊNCIAS ==========
router.post('/schedule-transfer/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { scheduleTransfer } = require('../services/auth');
        const result = await scheduleTransfer(bankCode, req.user.accountId, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/scheduled-transfers/:bankCode', authMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { listScheduledTransfers } = require('../services/auth');
        const result = await listScheduledTransfers(bankCode, req.user.accountId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/scheduled-transfer/:bankCode/:id', authMiddleware, async (req, res) => {
    const { bankCode, id } = req.params;
    try {
        const { cancelScheduledTransfer } = require('../services/auth');
        const result = await cancelScheduledTransfer(bankCode, req.user.accountId, parseInt(id));
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;