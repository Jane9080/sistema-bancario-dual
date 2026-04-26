const { querySingle, insertRecord, updateRecord } = require('../database/supabase');
const { TRANSACTION_TYPES, TAXAS } = require('../utils/constants');
const { isValidAmount } = require('../utils/validators');

async function deposit(bankCode, accountId, amount, description = '') {
    if (!isValidAmount(amount)) throw new Error('Valor inválido');
    
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    if (account.status !== 'active') throw new Error('Conta inativa ou bloqueada');
    
    const newBalance = parseFloat(account.balance) + amount;
    await updateRecord(bankCode, 'accounts', { id: accountId }, { balance: newBalance });
    
    await insertRecord(bankCode, 'transactions', {
        account_id: accountId, type: TRANSACTION_TYPES.DEPOSIT,
        amount: amount, balance_after: newBalance,
        description: description || 'Depósito em numerário', fee: 0
    });
    
    // Notificar
    await insertRecord(bankCode, 'notifications', {
        account_id: accountId, type: 'deposit',
        title: '💰 Depósito', message: `Depósito de ${amount.toLocaleString('pt-CV')} CVE.`
    });
    
    // Email
    try {
        const { sendNotificationEmail } = require('./email');
        await sendNotificationEmail(bankCode, account.holder_email, 'Depósito', '💰 Depósito', `Depósito de ${amount.toLocaleString('pt-CV')} CVE.`);
    } catch(e) {}
    
    return { success: true, message: `Depósito de ${amount} CVE realizado`, newBalance };
}

async function withdraw(bankCode, accountId, amount, description = '') {
    if (!isValidAmount(amount)) throw new Error('Valor inválido');
    
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    if (account.status !== 'active') throw new Error('Conta inativa ou bloqueada');
    
    const taxa = bankCode === 'kent' ? TAXAS.LEVANTAMENTO_KENT : TAXAS.LEVANTAMENTO_JANE;
    const totalDebit = amount + taxa;
    const availableBalance = parseFloat(account.balance) - parseFloat(account.reserved_amount || 0);
    
    if (availableBalance < totalDebit) {
        throw new Error(`Saldo insuficiente. Disponível: ${availableBalance.toLocaleString('pt-CV')} CVE`);
    }
    
    const newBalance = parseFloat(account.balance) - totalDebit;
    await updateRecord(bankCode, 'accounts', { id: accountId }, { balance: newBalance });
    
    await insertRecord(bankCode, 'transactions', {
        account_id: accountId, type: TRANSACTION_TYPES.WITHDRAW,
        amount: amount, balance_after: newBalance,
        description: description || 'Levantamento', fee: taxa
    });
    
    if (taxa > 0) {
        await insertRecord(bankCode, 'transactions', {
            account_id: accountId, type: TRANSACTION_TYPES.FEE,
            amount: taxa, balance_after: newBalance,
            description: 'Taxa de levantamento', fee: 0
        });
    }
    
    await insertRecord(bankCode, 'notifications', {
        account_id: accountId, type: 'withdraw',
        title: '💸 Levantamento', message: `Levantamento de ${amount.toLocaleString('pt-CV')} CVE.`
    });
    
    try {
        const { sendNotificationEmail } = require('./email');
        await sendNotificationEmail(bankCode, account.holder_email, 'Levantamento', '💸 Levantamento', `Levantamento de ${amount.toLocaleString('pt-CV')} CVE.`);
    } catch(e) {}
    
    return { success: true, message: `Levantamento de ${amount} CVE realizado`, fee: taxa, totalDebited: totalDebit, newBalance };
}

module.exports = { deposit, withdraw };