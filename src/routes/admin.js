const express = require('express');
const bcrypt = require('bcrypt');
const { verifyToken } = require('../utils/crypto');
const { query, querySingle, insertRecord, updateRecord, deleteRecord, supabase } = require('../database/supabase');

const router = express.Router();

// Middleware para verificar se é admin
async function adminMiddleware(req, res, next) {
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Token inválido' });
    }
    
    const admin = await querySingle(decoded.bankCode, 'admins', { id: decoded.accountId });
    
    if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    
    req.user = decoded;
    next();
}

// ========== ROTAS ADMIN ==========

router.get('/accounts/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const rows = await query(bankCode, 'accounts', 'id, account_number, holder_name, holder_email, balance, status');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/status/:status', adminMiddleware, async (req, res) => {
    const { bankCode, status } = req.params;
    try {
        const rows = await query(bankCode, 'accounts', 'id, account_number, holder_name, holder_email, balance, status', { status });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Alterar status da conta
router.put('/accounts/:bankCode/:accountId/status', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'blocked'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }
    
    try {
        if (status === 'active') {
            await updateRecord(bankCode, 'accounts', { id: accountId }, { status, account_locked: false, failed_attempts: 0, login_attempts: 0 });
            await insertRecord(bankCode, 'notifications', { account_id: accountId, type: 'account', title: '✅ Conta Ativada', message: 'Sua conta foi ativada pelo administrador.' });
            const acc = await querySingle(bankCode, 'accounts', { id: accountId });
            if (acc?.holder_email) {
                const { sendNotificationEmail } = require('../services/email');
                sendNotificationEmail(bankCode, acc.holder_email, 'Conta Ativada', '✅ Conta Ativada', 'Sua conta foi ativada.').catch(e => {});
            }
            res.json({ success: true, message: 'Conta ativada e desbloqueada com sucesso' });
        } else if (status === 'blocked') {
            await updateRecord(bankCode, 'accounts', { id: accountId }, { status, account_locked: true });
            await insertRecord(bankCode, 'notifications', { account_id: accountId, type: 'account', title: '🔒 Conta Bloqueada', message: 'Sua conta foi bloqueada pelo administrador.' });
            const acc = await querySingle(bankCode, 'accounts', { id: accountId });
            if (acc?.holder_email) {
                const { sendNotificationEmail } = require('../services/email');
                sendNotificationEmail(bankCode, acc.holder_email, 'Conta Bloqueada', '🔒 Conta Bloqueada', 'Sua conta foi bloqueada.').catch(e => {});
            }
            res.json({ success: true, message: 'Conta bloqueada com sucesso' });
        } else {
            await updateRecord(bankCode, 'accounts', { id: accountId }, { status, account_locked: false });
            await insertRecord(bankCode, 'notifications', { account_id: accountId, type: 'account', title: '⏸️ Conta Desativada', message: 'Sua conta foi desativada pelo administrador.' });
            const acc = await querySingle(bankCode, 'accounts', { id: accountId });
            if (acc?.holder_email) {
                const { sendNotificationEmail } = require('../services/email');
                sendNotificationEmail(bankCode, acc.holder_email, 'Conta Desativada', '⏸️ Conta Desativada', 'Sua conta foi desativada.').catch(e => {});
            }
            res.json({ success: true, message: `Conta ${status} com sucesso` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/count', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { count } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode);
        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/count/:status', adminMiddleware, async (req, res) => {
    const { bankCode, status } = req.params;
    try {
        const { count } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode).eq('status', status);
        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/:accountId/transactions', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const rows = await query(bankCode, 'transactions', '*', { account_id: accountId });
        res.json(rows.slice(0, 50));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/:accountId/receipts', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const rows = await query(bankCode, 'receipts', '*', { account_id: accountId });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/:accountId/loans', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const rows = await query(bankCode, 'loans', '*', { account_id: accountId });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/search/:term', adminMiddleware, async (req, res) => {
    const { bankCode, term } = req.params;
    try {
        const { data } = await supabase.from('accounts').select('*').eq('bank', bankCode).or(`holder_name.ilike.%${term}%,holder_email.ilike.%${term}%`);
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/bank/:bankCode/total-balance', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data } = await supabase.from('accounts').select('balance').eq('bank', bankCode);
        const total = data.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
        res.json({ totalBalance: total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { count: total } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode);
        const { count: active } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode).eq('status', 'active');
        const { count: inactive } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode).eq('status', 'inactive');
        const { count: blocked } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode).eq('status', 'blocked');
        const { data } = await supabase.from('accounts').select('balance').eq('bank', bankCode);
        const totalBalance = data.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
        res.json({ total, active, inactive, blocked, totalBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/:accountId/profile', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const row = await querySingle(bankCode, 'accounts', { id: accountId });
        if (!row) return res.status(404).json({ error: 'Conta não encontrada' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/:accountId/transactions-filter', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const rows = await query(bankCode, 'transactions', '*', { account_id: accountId });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/accounts/:bankCode/:accountId/loans-filter', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const rows = await query(bankCode, 'loans', '*', { account_id: accountId });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 16. Formatar o sistema
router.delete('/format/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        await deleteRecord(bankCode, 'transactions', {});
        await deleteRecord(bankCode, 'receipts', {});
        await deleteRecord(bankCode, 'loans', {});
        await deleteRecord(bankCode, 'notifications', {});
        await deleteRecord(bankCode, 'accounts', {});
        
        const bankPasswordHash = await bcrypt.hash('banco123', 10);
        const accountNumber = bankCode === 'kent' ? 'KENT-BANK-001' : 'JANE-BANK-001';
        const bankName = bankCode === 'kent' ? 'Banco Comercial de Kent' : 'Banco Popular de Jane';
        const bankEmail = `banco@${bankCode}.cv`;
        const nib = bankCode === 'kent' ? '000400000BANK0010193' : '00030000BANK0010176';
        const iban = bankCode === 'kent' ? 'CV6400040000BANK0010193' : 'CV6400030000BANK0010176';
        
        await insertRecord(bankCode, 'accounts', {
            account_number: accountNumber, holder_name: bankName, holder_email: bankEmail,
            nib, iban, balance: 2000000000, status: 'active', password_hash: bankPasswordHash
        });
        
        res.json({ success: true, message: 'Sistema formatado e conta do banco recriada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 17, 18, 19 - Ações em massa
router.put('/activate-all/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data: accounts } = await supabase.from('accounts').select('id, holder_email').eq('bank', bankCode).neq('status', 'active').not('holder_email', 'like', 'banco@%');
        await supabase.from('accounts').update({ status: 'active', account_locked: false, failed_attempts: 0 }).eq('bank', bankCode).not('holder_email', 'like', 'banco@%');
        for (const acc of (accounts || [])) {
            await insertRecord(bankCode, 'notifications', { account_id: acc.id, type: 'account', title: '✅ Conta Ativada', message: 'Sua conta foi ativada.' });
        }
        res.json({ success: true, message: `${(accounts || []).length} conta(s) ativada(s)!` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/deactivate-all/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data: accounts } = await supabase.from('accounts').select('id, holder_email').eq('bank', bankCode).in('status', ['active', 'blocked']).not('holder_email', 'like', 'banco@%');
        await supabase.from('accounts').update({ status: 'inactive', account_locked: false }).eq('bank', bankCode).in('status', ['active', 'blocked']).not('holder_email', 'like', 'banco@%');
        for (const acc of (accounts || [])) {
            await insertRecord(bankCode, 'notifications', { account_id: acc.id, type: 'account', title: '⏸️ Conta Desativada', message: 'Sua conta foi desativada.' });
        }
        res.json({ success: true, message: `${(accounts || []).length} conta(s) desativada(s)!` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/block-all/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data: accounts } = await supabase.from('accounts').select('id, holder_email').eq('bank', bankCode).in('status', ['active', 'inactive']).not('holder_email', 'like', 'banco@%');
        await supabase.from('accounts').update({ status: 'blocked', account_locked: true }).eq('bank', bankCode).in('status', ['active', 'inactive']).not('holder_email', 'like', 'banco@%');
        for (const acc of (accounts || [])) {
            await insertRecord(bankCode, 'notifications', { account_id: acc.id, type: 'account', title: '🔒 Conta Bloqueada', message: 'Sua conta foi bloqueada.' });
        }
        res.json({ success: true, message: `${(accounts || []).length} conta(s) bloqueada(s)!` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 20, 21, 22 - Todos extratos/comprovativos/empréstimos
router.get('/all-transactions/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data } = await supabase.from('transactions').select('*, accounts(holder_name, account_number)').eq('bank', bankCode).order('created_at', { ascending: false }).limit(100);
        res.json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/all-receipts/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data } = await supabase.from('receipts').select('*, accounts(holder_name, account_number)').eq('bank', bankCode).order('created_at', { ascending: false }).limit(100);
        res.json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/all-loans/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data } = await supabase.from('loans').select('*, accounts(holder_name, account_number)').eq('bank', bankCode).order('created_at', { ascending: false }).limit(100);
        res.json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 23. Dados do banco
router.get('/bank-info/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const accountNumber = bankCode === 'kent' ? 'KENT-BANK-001' : 'JANE-BANK-001';
        let bankAccount = await querySingle(bankCode, 'accounts', { account_number: accountNumber });
        
        if (!bankAccount) {
            const bankPasswordHash = await bcrypt.hash('banco123', 10);
            const bankName = bankCode === 'kent' ? 'Banco Comercial de Kent' : 'Banco Popular de Jane';
            const bankEmail = `banco@${bankCode}.cv`;
            const nib = bankCode === 'kent' ? '000400000BANK0010193' : '00030000BANK0010176';
            const iban = bankCode === 'kent' ? 'CV6400040000BANK0010193' : 'CV6400030000BANK0010176';
            await insertRecord(bankCode, 'accounts', { account_number: accountNumber, holder_name: bankName, holder_email: bankEmail, nib, iban, balance: 2000000000, status: 'active', password_hash: bankPasswordHash });
            bankAccount = await querySingle(bankCode, 'accounts', { account_number: accountNumber });
        }
        
        res.json({
            bankName: bankCode === 'kent' ? 'Banco Comercial de Kent' : 'Banco Popular de Jane',
            bankCode, accountNumber: bankAccount.account_number, nib: bankAccount.nib, iban: bankAccount.iban, balance: bankAccount.balance
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 24. Respostas de segurança
router.get('/security-answers/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const rows = await query(bankCode, 'accounts', 'id, holder_name, holder_email, security_question_1, security_answer_1, security_question_2, security_answer_2, security_question_3, security_answer_3');
        res.json(rows.filter(r => r.security_answer_1));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 25. Agenda
router.get('/scheduled-transfers/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { data } = await supabase.from('scheduled_transfers').select('*, accounts!inner(holder_name, account_number)').eq('bank', bankCode).order('scheduled_date', { ascending: true }).limit(50);
        res.json((data || []).map(s => ({ ...s, from_name: s.accounts?.holder_name, from_account: s.accounts?.account_number })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 26. Senhas
router.get('/passwords-audit/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const rows = await query(bankCode, 'accounts', 'id, holder_name, holder_email, username, password_hash, confirm_key');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== PERFIL ADMIN ==========
router.get('/profile', adminMiddleware, async (req, res) => {
    try {
        const row = await querySingle(req.user.bankCode, 'admins', { id: req.user.accountId });
        if (!row) return res.status(404).json({ error: 'Admin não encontrado' });
        res.json({ id: row.id, email: row.email, name: row.name, role: row.role });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/change-email', adminMiddleware, async (req, res) => {
    const { newEmail } = req.body;
    if (!newEmail || !newEmail.includes('@')) return res.status(400).json({ error: 'Email inválido' });
    try {
        const existing = await querySingle(req.user.bankCode, 'admins', { email: newEmail });
        if (existing && existing.id != req.user.accountId) return res.status(400).json({ error: 'Email já está em uso' });
        await updateRecord(req.user.bankCode, 'admins', { id: req.user.accountId }, { email: newEmail });
        res.json({ success: true, message: 'Email alterado com sucesso!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/change-password', adminMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    try {
        const admin = await querySingle(req.user.bankCode, 'admins', { id: req.user.accountId });
        if (!admin) return res.status(404).json({ error: 'Admin não encontrado' });
        const isValid = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!isValid) return res.status(401).json({ error: 'Senha atual incorreta' });
        await updateRecord(req.user.bankCode, 'admins', { id: req.user.accountId }, { password_hash: await bcrypt.hash(newPassword, 10) });
        res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== SEGURANÇA DO CLIENTE ==========
router.get('/accounts/:bankCode/:accountId/security-status', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const row = await querySingle(bankCode, 'accounts', { id: accountId });
        if (!row) return res.status(404).json({ error: 'Conta não encontrada' });
        const q1 = row.security_question_1 ? 1 : 0;
        const q2 = row.security_question_2 ? 1 : 0;
        const q3 = row.security_question_3 ? 1 : 0;
        const isBlocked = row.status === 'blocked' || row.account_locked;
        res.json({
            securityQuestionsConfigured: q1 + q2 + q3, totalQuestionsRequired: 3,
            isComplete: (q1 + q2 + q3) === 3,
            securityUpdatedAt: row.security_updated_at,
            twoFactorEnabled: row.two_factor_enabled || false,
            lastPasswordChange: row.last_password_change,
            lastAccess: row.last_login,
            loginAttempts: row.failed_attempts || row.login_attempts || 0,
            accountLocked: isBlocked, status: row.status
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/accounts/:bankCode/:accountId/reset-security', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        await updateRecord(bankCode, 'accounts', { id: accountId }, { security_question_1: null, security_answer_1: null, security_question_2: null, security_answer_2: null, security_question_3: null, security_answer_3: null, security_updated_at: null });
        await insertRecord(bankCode, 'notifications', { account_id: accountId, type: 'security', title: '🔐 Perguntas Resetadas', message: 'Suas perguntas de segurança foram resetadas.' });
        const acc = await querySingle(bankCode, 'accounts', { id: accountId });
        if (acc?.holder_email) {
            const { sendNotificationEmail } = require('../services/email');
            sendNotificationEmail(bankCode, acc.holder_email, 'Perguntas Resetadas', '🔐 Segurança', 'Suas perguntas de segurança foram resetadas.').catch(e => {});
        }
        res.json({ success: true, message: 'Perguntas resetadas.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/accounts/:bankCode/:accountId/security-log', adminMiddleware, async (req, res) => {
    const { bankCode, accountId } = req.params;
    try {
        const pwdHistory = await query(bankCode, 'password_history', '*', { account_id: accountId });
        const loginFails = await query(bankCode, 'login_attempts', '*', { account_id: accountId });
        const events = [
            ...pwdHistory.map(p => ({ event_type: 'password_change', created_at: p.created_at, description: 'Alteração de password' })),
            ...loginFails.filter(l => !l.success).map(l => ({ event_type: 'login_failed', created_at: l.created_at, description: 'Tentativa de login falhou' }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
        res.json(events);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cancelar agendamento
router.delete('/scheduled-transfer/:bankCode/:id', adminMiddleware, async (req, res) => {
    const { bankCode, id } = req.params;
    try {
        const transfer = await querySingle(bankCode, 'scheduled_transfers', { id });
        if (!transfer) return res.status(404).json({ error: 'Agendamento não encontrado' });
        if (transfer.status !== 'pending') return res.status(400).json({ error: 'Já processado' });
        
        await updateRecord(bankCode, 'accounts', { id: transfer.from_account_id }, { reserved_amount: supabase.raw(`reserved_amount - ${transfer.reserved_amount}`) });
        await updateRecord(bankCode, 'scheduled_transfers', { id }, { status: 'cancelled' });
        await insertRecord(bankCode, 'notifications', { account_id: transfer.from_account_id, type: 'transfer', title: 'Agendamento Cancelado', message: `Seu agendamento de ${transfer.amount} CVE foi cancelado.` });
        
        const acc = await querySingle(bankCode, 'accounts', { id: transfer.from_account_id });
        if (acc?.holder_email) {
            const { sendNotificationEmail } = require('../services/email');
            sendNotificationEmail(bankCode, acc.holder_email, 'Agendamento Cancelado', '❌ Cancelado', `Seu agendamento foi cancelado.`).catch(e => {});
        }
        res.json({ success: true, message: 'Agendamento cancelado.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/scheduled-transfer-all/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const pending = await query(bankCode, 'scheduled_transfers', '*', { status: 'pending' });
        if (!pending.length) return res.json({ success: true, message: 'Nenhum pendente' });
        for (const t of pending) {
            await updateRecord(bankCode, 'accounts', { id: t.from_account_id }, { reserved_amount: supabase.raw(`reserved_amount - ${t.reserved_amount}`) });
            await updateRecord(bankCode, 'scheduled_transfers', { id: t.id }, { status: 'cancelled' });
            await insertRecord(bankCode, 'notifications', { account_id: t.from_account_id, type: 'transfer', title: 'Agendamento Cancelado', message: 'Seu agendamento foi cancelado.' });
        }
        res.json({ success: true, message: `${pending.length} cancelados!` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dashboard
router.get('/dashboard/:bankCode', adminMiddleware, async (req, res) => {
    const { bankCode } = req.params;
    try {
        const { count: total } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode);
        const { count: active } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode).eq('status', 'active');
        const { count: inactive } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode).eq('status', 'inactive');
        const { count: blocked } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('bank', bankCode).eq('status', 'blocked');
        const { data: balances } = await supabase.from('accounts').select('balance').eq('bank', bankCode);
        const { data: fees } = await supabase.from('transactions').select('fee').eq('bank', bankCode);
        const { data: topClients } = await supabase.from('accounts').select('id, holder_name, account_number, balance').eq('bank', bankCode).not('holder_email', 'like', 'banco@%').order('balance', { ascending: false }).limit(5);
        const { data: recent } = await supabase.from('transactions').select('type, amount, description, created_at, accounts(holder_name)').eq('bank', bankCode).order('created_at', { ascending: false }).limit(10);
        
        res.json({
            stats: { totalAccounts: total, activeAccounts: active, inactiveAccounts: inactive, blockedAccounts: blocked, totalBalance: (balances || []).reduce((s, a) => s + parseFloat(a.balance || 0), 0), totalFees: (fees || []).reduce((s, a) => s + parseFloat(a.fee || 0), 0) },
            balanceEvolution: [], transactionsByDay: [], feesByDay: [],
            topClients: topClients || [],
            recentActivity: (recent || []).map(r => ({ ...r, holder_name: r.accounts?.holder_name }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;