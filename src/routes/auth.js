const express = require('express');
const { registerAccount, login, recoverAccount } = require('../services/auth');
const { querySingle, insertRecord, updateRecord } = require('../database/supabase');
const bcrypt = require('bcrypt');
const router = express.Router();

// 📝 REGISTAR CONTA
router.post('/register/:bankCode', async (req, res) => {
    try {
        const { bankCode } = req.params;
        
        if (bankCode !== 'kent' && bankCode !== 'jane') {
            return res.status(400).json({ error: 'Banco inválido' });
        }
        
        const accountData = {
            holder_name: req.body.holder_name || req.body.name,
            holder_email: req.body.holder_email || req.body.email,
            holder_phone: req.body.holder_phone || req.body.phone,
            mother_name: req.body.mother_name,
            father_name: req.body.father_name,
            age: req.body.age,
            birth_date: req.body.birth_date,
            marital_status: req.body.marital_status,
            passport_number: req.body.passport_number,
            nif: req.body.nif,
            address: req.body.address,
            password: req.body.password,
            security_question_1: req.body.security_question_1,
            security_answer_1: req.body.security_answer_1,
            security_question_2: req.body.security_question_2,
            security_answer_2: req.body.security_answer_2,
            security_question_3: req.body.security_question_3,
            security_answer_3: req.body.security_answer_3
        };
        
        if (!accountData.holder_name) return res.status(400).json({ error: 'Nome é obrigatório' });
        if (!accountData.holder_email) return res.status(400).json({ error: 'Email é obrigatório' });
        if (!accountData.password) return res.status(400).json({ error: 'Password é obrigatória' });
        if (accountData.password.length < 6) return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
        
        const result = await registerAccount(bankCode, accountData);
        res.status(201).json(result);
    } catch (error) {
        console.error('Erro no registo:', error);
        res.status(400).json({ error: error.message });
    }
});

// 🔐 LOGIN
router.post('/login/:bankCode', async (req, res) => {
    try {
        const { bankCode } = req.params;
        
        if (bankCode !== 'kent' && bankCode !== 'jane') {
            return res.status(400).json({ error: 'Banco inválido' });
        }
        
        const { email, password } = req.body;
        if (!email) return res.status(400).json({ error: 'Email é obrigatório' });
        if (!password) return res.status(400).json({ error: 'Password é obrigatória' });
        
        const ipAddress = req.ip || req.connection.remoteAddress || '0.0.0.0';
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        const result = await login(bankCode, email, password, ipAddress, userAgent);
        
        if (result.user?.id) {
            try {
                await insertRecord(bankCode, 'login_attempts', {
                    account_id: result.user.id, success: true, ip_address: ipAddress, user_agent: userAgent
                });
            } catch(e) {}
            
            try {
                await updateRecord(bankCode, 'accounts', { id: result.user.id }, {
                    last_login: new Date().toISOString(), login_attempts: 0
                });
            } catch(e) {}
        }
        
        res.cookie('auth_token', result.token, {
            httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax'
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('Erro no login:', error);
        
        try {
            const { bankCode } = req.params;
            const { email } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress || '0.0.0.0';
            const userAgent = req.headers['user-agent'] || 'unknown';
            
            const account = await querySingle(bankCode, 'accounts', { holder_email: email });
            if (account) {
                await insertRecord(bankCode, 'login_attempts', {
                    account_id: account.id, success: false, ip_address: ipAddress, user_agent: userAgent
                });
            }
        } catch (logError) {}
        
        res.status(401).json({ error: error.message });
    }
});

// 🔓 LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: 'Logout efetuado com sucesso' });
});

// ✅ VERIFICAR SESSÃO
router.get('/verify', (req, res) => {
    const token = req.cookies?.auth_token;
    if (!token) return res.status(401).json({ authenticated: false });
    
    try {
        const { verifyToken } = require('../utils/crypto');
        const decoded = verifyToken(token);
        if (!decoded) return res.status(401).json({ authenticated: false });
        
        res.json({ 
            authenticated: true, 
            user: { accountId: decoded.accountId, bankCode: decoded.bankCode, email: decoded.email }
        });
    } catch (error) {
        res.status(401).json({ authenticated: false });
    }
});

// Verificar token de reset
router.get('/reset-password/verify/:token', async (req, res) => {
    const { token } = req.params;
    const { bankCode } = req.query;
    
    try {
        const resetData = await querySingle(bankCode, 'reset_tokens', { token, used: 0 });
        if (!resetData || new Date(resetData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Link inválido ou expirado' });
        }
        res.json({ valid: true, accountId: resetData.account_id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Redefinir password com token
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { bankCode, newPassword } = req.body;
    
    try {
        const resetData = await querySingle(bankCode, 'reset_tokens', { token, used: 0 });
        if (!resetData || new Date(resetData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Link inválido ou expirado' });
        }
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
        }
        
        const newHash = await bcrypt.hash(newPassword, 10);
        await updateRecord(bankCode, 'accounts', { id: resetData.account_id }, { 
            password_hash: newHash, last_password_change: new Date().toISOString() 
        });
        await updateRecord(bankCode, 'reset_tokens', { token }, { used: 1 });
        
        res.json({ success: true, message: 'Password redefinida com sucesso! Faça login.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Carregar perguntas de segurança para recuperação
router.post('/recover/:bankCode', async (req, res) => {
    const { bankCode } = req.params;
    const { email } = req.body;
    
    try {
        const account = await querySingle(bankCode, 'accounts', { holder_email: email });
        if (!account) return res.status(404).json({ error: 'Email não encontrado' });
        if (!account.security_question_1) return res.status(400).json({ error: 'Esta conta não tem perguntas de segurança configuradas' });
        
        res.json({
            questions: [account.security_question_1, account.security_question_2, account.security_question_3]
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Verificar respostas e enviar email
router.post('/recover-verify/:bankCode', async (req, res) => {
    const { bankCode } = req.params;
    const { email, answers } = req.body;
    
    try {
        const { recoverAccount } = require('../services/auth');
        const result = await recoverAccount(bankCode, email, answers);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;