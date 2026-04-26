const express = require('express');
const bcrypt = require('bcrypt');
const { querySingle } = require('../database/supabase');
const { generateToken, verifyToken } = require('../utils/crypto');

const router = express.Router();

// Login do Administrador
router.post('/login', async (req, res) => {
    const { email, password, bankCode } = req.body;
    
    console.log('🔐 Tentativa de login admin:', { email, bankCode });
    
    if (bankCode !== 'kent' && bankCode !== 'jane') {
        return res.status(400).json({ error: 'Banco inválido' });
    }
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password são obrigatórios' });
    }
    
    try {
        const admin = await querySingle(bankCode, 'admins', { email });
        
        console.log('👤 Admin encontrado:', admin ? 'SIM' : 'NÃO');
        
        if (!admin) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        const isValid = await bcrypt.compare(password, admin.password_hash);
        console.log('🔑 Password válida:', isValid);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        const token = generateToken(admin.id, bankCode, admin.email);
        console.log('🎫 Token gerado:', token ? 'SIM' : 'NÃO');
        
        res.json({
            success: true,
            token: token,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('❌ Erro no login do admin:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Verificar token do admin
router.get('/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) return res.status(401).json({ authenticated: false });
    
    try {
        const decoded = verifyToken(token);
        if (!decoded) return res.status(401).json({ authenticated: false });
        
        const admin = await querySingle(decoded.bankCode, 'admins', { id: decoded.accountId });
        
        if (!admin) return res.status(401).json({ authenticated: false });
        
        res.json({
            authenticated: true,
            admin: {
                id: admin.id, name: admin.name, email: admin.email,
                role: admin.role, bankCode: decoded.bankCode
            }
        });
    } catch (error) {
        res.status(401).json({ authenticated: false });
    }
});

module.exports = router;