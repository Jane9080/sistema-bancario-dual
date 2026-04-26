const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'kent-jane-banking-secret-key-2024';
const SALT_ROUNDS = 10;

async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

function generateToken(accountId, bankCode, email) {
    console.log('🎫 Gerando token para:', { accountId, bankCode, email });
    const token = jwt.sign(
        { accountId, bankCode, email, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
    console.log('🎫 Token gerado com sucesso');
    return token;
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

function generateAccountNumber(bankCode) {
    const prefix = bankCode.toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
}

function generateUsername(fullName) {
    const nameParts = fullName.trim().split(' ');
    let username = '';
    if (nameParts.length >= 2) {
        username = nameParts[0][0].toLowerCase() + nameParts[nameParts.length - 1].toLowerCase();
    } else {
        username = nameParts[0].toLowerCase();
    }
    const randomDigits = Math.floor(Math.random() * 900 + 100).toString();
    username += randomDigits;
    username = username.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return username;
}

function generateRandomPassword() {
    const chars = "4abcd2e4f6g1h0i9j34kl7mn60op56qrstguvwxyz019";
    let password = "";
    for (let i = 0; i < 10; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
}

function generateConfirmKey() {
    const key = "1925608374";
    let confirmKey = "";
    for (let i = 0; i < 7; i++) {
        confirmKey += key[Math.floor(Math.random() * key.length)];
    }
    return confirmKey;
}

// NIB sem espaços
function generateNIB(bankCode, accountNumber) {
    const accountNumOnly = accountNumber.split('-')[1];
    if (bankCode === 'kent') {
        return `000400000${accountNumOnly.slice(0, 7)}10193`;
    } else {
        return `00030000${accountNumOnly.slice(0, 8)}10176`;
    }
}

// IBAN sem espaços
function generateIBAN(bankCode, accountNumber) {
    const accountNumOnly = accountNumber.split('-')[1];
    if (bankCode === 'kent') {
        return `CV64000400000${accountNumOnly.slice(0, 7)}10193`;
    } else {
        return `CV6400030000${accountNumOnly.slice(0, 8)}10176`;
    }
}

function generateReference() {
    return `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function generateQRData(data) {
    return JSON.stringify(data);
}


/* Gerar token de reset de password (expira em 15 min)
function generateResetToken(accountId, bankCode, email) {
    const crypto = require('crypto');
    const payload = {
        accountId,
        bankCode,
        email,
        type: 'reset',
        exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutos
    };
    const token = crypto.randomBytes(32).toString('hex');
    return token;
}
*/

// Gerar token único para reset de password
function generateResetToken(accountId, bankCode, email) {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
}


module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    generateAccountNumber,
    generateUsername,
    generateRandomPassword,
    generateConfirmKey,
    generateNIB,
    generateIBAN,
    generateReference,
    generateQRData,
    generateResetToken  // ✅ NOVO

};
