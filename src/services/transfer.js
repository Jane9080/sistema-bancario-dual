const { query, querySingle, insertRecord, updateRecord, supabase } = require('../database/supabase');
const { TAXAS, STATUS, TRANSACTION_TYPES } = require('../utils/constants');
const { generateReference } = require('../utils/crypto');
const { isValidAmount } = require('../utils/validators');

// Transferência dentro do mesmo banco
async function transferSameBank(bankCode, fromAccountId, toAccountNumber, amount, description = '', confirmKey = '') {
    if (!confirmKey) throw new Error('Chave de confirmação é obrigatória');
    if (!isValidAmount(amount)) throw new Error('Valor inválido');
    
    const fromAccount = await querySingle(bankCode, 'accounts', { id: fromAccountId });
    if (!fromAccount) throw new Error('Conta de origem não encontrada');
    if (fromAccount.status !== STATUS.ACTIVE) throw new Error('Conta de origem está inativa ou bloqueada');
    if (fromAccount.confirm_key !== confirmKey) throw new Error('Chave de confirmação inválida');
    
    if (fromAccount.account_number === toAccountNumber) {
        throw new Error('Não é permitido transferir para a própria conta');
    }
    
    const taxa = TAXAS.MESMO_BANCO;
    const totalDebit = amount + taxa;
    const availableBalance = parseFloat(fromAccount.balance) - parseFloat(fromAccount.reserved_amount || 0);
    if (availableBalance < totalDebit) {
        throw new Error(`Saldo insuficiente. Disponível: ${availableBalance.toLocaleString('pt-CV')} CVE. Necessita: ${totalDebit.toLocaleString('pt-CV')} CVE`);
    }
    
    const toAccount = await querySingle(bankCode, 'accounts', { account_number: toAccountNumber });
    if (!toAccount) throw new Error('Conta de destino não encontrada');
    if (toAccount.status !== STATUS.ACTIVE) throw new Error('Conta de destino está inativa ou bloqueada');
    if (toAccount.id === fromAccount.id) throw new Error('Não é permitido transferir para a própria conta');
    
    const newFromBalance = parseFloat(fromAccount.balance) - totalDebit;
    await updateRecord(bankCode, 'accounts', { id: fromAccountId }, { balance: newFromBalance });
    
    const outRef = generateReference();
    await insertRecord(bankCode, 'transactions', {
        account_id: fromAccountId, type: TRANSACTION_TYPES.TRANSFER_OUT,
        amount: amount, balance_after: newFromBalance,
        counterparty: toAccountNumber,
        description: description || `Transferência para ${toAccountNumber}`, fee: taxa,
        reference: outRef
    });
    
    const newToBalance = parseFloat(toAccount.balance) + amount;
    await updateRecord(bankCode, 'accounts', { id: toAccount.id }, { balance: newToBalance });
    
    await insertRecord(bankCode, 'transactions', {
        account_id: toAccount.id, type: TRANSACTION_TYPES.TRANSFER_IN,
        amount: amount, balance_after: newToBalance,
        counterparty: fromAccount.account_number,
        description: description || `Transferência de ${fromAccount.account_number}`, fee: 0,
        reference: outRef + '-IN'
    });
    
    if (taxa > 0) {
        await insertRecord(bankCode, 'transactions', {
            account_id: fromAccountId, type: TRANSACTION_TYPES.FEE,
            amount: taxa, balance_after: newFromBalance,
            description: `Taxa de transferência`, fee: 0,
            reference: outRef + '-FEE'
        });
    }
    
    // Comprovativo
    const receiptRef = outRef;
    try {
        await insertRecord(bankCode, 'receipts', {
            account_id: fromAccountId, reference: receiptRef, type: 'SAME_BANK',
            from_name: fromAccount.holder_name, from_account: fromAccount.account_number,
            to_name: toAccount.holder_name, to_account: toAccount.account_number,
            amount: amount, fee: taxa, total: totalDebit, status: 'SUCESSO'
        });
        
        const { generateReceiptPDF } = require('./receipt');
        await generateReceiptPDF(bankCode, {
            account_id: fromAccountId, reference: receiptRef, type: 'SAME_BANK',
            from_name: fromAccount.holder_name, from_account: fromAccount.account_number,
            to_name: toAccount.holder_name, to_account: toAccount.account_number,
            amount: amount, fee: taxa, total: totalDebit, status: 'SUCESSO'
        });
        
        // Email com comprovativo
        try {
            const fs = require('fs');
            const path = require('path');
            const pdfPath = path.join(__dirname, '../../receipts', `comprovativo_${receiptRef}.pdf`);
            if (fs.existsSync(pdfPath)) {
                const pdfBuffer = fs.readFileSync(pdfPath);
                const nodemailer = require('nodemailer');
                const emailConfigs = {
                    kent: { email: process.env.KENT_EMAIL, pass: process.env.KENT_EMAIL_PASS, name: 'Banco Comercial de Kent', color: '#1e3a5f' },
                    jane: { email: process.env.JANE_EMAIL, pass: process.env.JANE_EMAIL_PASS, name: 'Banco Popular de Jane', color: '#0f5b3a' }
                };
                const config = emailConfigs[bankCode];
                const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: config.email, pass: config.pass } });
                await transporter.sendMail({
                    from: `"${config.name}" <${config.email}>`,
                    to: fromAccount.holder_email,
                    subject: `📄 Comprovativo de Transferência - ${config.name}`,
                    html: `<div style="font-family:Arial;max-width:500px;margin:0 auto;padding:20px;"><div style="background:${config.color};color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;"><h2>${config.name}</h2><p>Comprovativo de Transferência</p></div><div style="background:#f8fafc;padding:20px;border-radius:0 0 12px 12px;"><p><strong>Valor:</strong> ${amount.toLocaleString('pt-CV')} CVE</p><p><strong>Destino:</strong> ${toAccount.holder_name}</p><p>Comprovativo em anexo.</p></div></div>`,
                    attachments: [{ filename: `comprovativo_${receiptRef}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
                });
            }
        } catch(e) { console.log('⚠️ Email comprovativo:', e.message); }
    } catch(e) { console.log('⚠️ Comprovativo:', e.message); }
    
    // Notificações
    await insertRecord(bankCode, 'notifications', {
        account_id: fromAccountId, type: 'transfer',
        title: '📤 Transferência Enviada',
        message: `Enviou ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name} (${toAccountNumber}).`
    });
    await insertRecord(bankCode, 'notifications', {
        account_id: toAccount.id, type: 'transfer',
        title: '📥 Transferência Recebida',
        message: `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name} (${fromAccount.account_number}).`
    });
    
    // Emails de notificação
    try {
        const { sendNotificationEmail } = require('./email');
        await sendNotificationEmail(bankCode, fromAccount.holder_email, 'Transferência Enviada', '📤 Transferência Enviada', `Enviou ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name}.`);
        await sendNotificationEmail(bankCode, toAccount.holder_email, 'Transferência Recebida', '📥 Transferência Recebida', `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name}.`);
    } catch(e) { console.log('⚠️ Email notificação:', e.message); }
    
    return {
        success: true,
        message: `Transferência de ${amount} CVE realizada com sucesso`,
        fee: taxa, totalDebited: totalDebit, newBalance: newFromBalance, reference: outRef
    };
}

// Transferência inter-bancária
async function transferInterBank(fromBankCode, fromAccountId, toBankCode, toAccountNumber, amount, description = '', confirmKey = '') {
    if (!confirmKey) throw new Error('Chave de confirmação é obrigatória');
    if (!isValidAmount(amount)) throw new Error('Valor inválido');
    
    const normalizedNIB = toAccountNumber.replace(/\s/g, '');
    
    let taxa;
    if (fromBankCode === 'kent' && toBankCode === 'jane') taxa = TAXAS.KENT_PARA_JANE;
    else if (fromBankCode === 'jane' && toBankCode === 'kent') taxa = TAXAS.JANE_PARA_KENT;
    else throw new Error('Bancos inválidos para transferência inter-bancária');
    
    const fromAccount = await querySingle(fromBankCode, 'accounts', { id: fromAccountId });
    if (!fromAccount) throw new Error('Conta de origem não encontrada');
    if (fromAccount.status !== STATUS.ACTIVE) throw new Error('Conta de origem está inativa ou bloqueada');
    if (fromAccount.confirm_key !== confirmKey) throw new Error('Chave de confirmação inválida');
    
    const totalDebit = amount + taxa;
    const availableBalance = parseFloat(fromAccount.balance) - parseFloat(fromAccount.reserved_amount || 0);
    if (availableBalance < totalDebit) {
        throw new Error(`Saldo insuficiente. Disponível: ${availableBalance.toLocaleString('pt-CV')} CVE. Necessita: ${totalDebit.toLocaleString('pt-CV')} CVE`);
    }
    
    // Procurar destino pelo NIB ou número de conta
    let toAccount = await querySingle(toBankCode, 'accounts', { nib: normalizedNIB });
    if (!toAccount) toAccount = await querySingle(toBankCode, 'accounts', { account_number: normalizedNIB });
    if (!toAccount) throw new Error('Conta de destino não encontrada');
    if (toAccount.status !== STATUS.ACTIVE) throw new Error('Conta de destino está inativa ou bloqueada');
    
    const reference = generateReference();
    
    // Registar transferência interbancária
    await supabase.from('interbank_transfers').insert({
        reference, from_bank: fromBankCode, from_account: fromAccount.account_number,
        to_bank: toBankCode, to_account: toAccount.account_number,
        amount, fee: taxa, status: 'pending'
    });
    
    const newFromBalance = parseFloat(fromAccount.balance) - totalDebit;
    await updateRecord(fromBankCode, 'accounts', { id: fromAccountId }, { balance: newFromBalance });
    
    await insertRecord(fromBankCode, 'transactions', {
        account_id: fromAccountId, type: TRANSACTION_TYPES.TRANSFER_OUT,
        amount: amount, balance_after: newFromBalance,
        counterparty: `${toBankCode.toUpperCase()}:${toAccount.account_number}`,
        description: description || `Transferência inter-bancária para ${toBankCode.toUpperCase()}`, fee: taxa,
        reference: reference
    });
    
    if (taxa > 0) {
        await insertRecord(fromBankCode, 'transactions', {
            account_id: fromAccountId, type: TRANSACTION_TYPES.FEE,
            amount: taxa, balance_after: newFromBalance,
            description: 'Taxa transferência inter-bancária', fee: 0,
            reference: reference + '-FEE'
        });
    }
    
    const newToBalance = parseFloat(toAccount.balance) + amount;
    await updateRecord(toBankCode, 'accounts', { id: toAccount.id }, { balance: newToBalance });
    
    await insertRecord(toBankCode, 'transactions', {
        account_id: toAccount.id, type: TRANSACTION_TYPES.TRANSFER_IN,
        amount: amount, balance_after: newToBalance,
        counterparty: `${fromBankCode.toUpperCase()}:${fromAccount.account_number}`,
        description: description || `Transferência inter-bancária de ${fromBankCode.toUpperCase()}`, fee: 0,
        reference: reference + '-IN'
    });
    
    // Atualizar status
    await supabase.from('interbank_transfers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('reference', reference);
    
    // Comprovativo
    try {
        await insertRecord(fromBankCode, 'receipts', {
            account_id: fromAccountId, reference: reference, type: 'INTERBANK',
            from_name: fromAccount.holder_name, from_account: fromAccount.account_number,
            to_name: toAccount.holder_name, to_account: toAccount.nib,
            amount: amount, fee: taxa, total: totalDebit, status: 'SUCESSO'
        });
        
        const { generateReceiptPDF } = require('./receipt');
        await generateReceiptPDF(fromBankCode, {
            account_id: fromAccountId, reference: reference, type: 'INTERBANK',
            from_name: fromAccount.holder_name, from_account: fromAccount.account_number,
            to_name: toAccount.holder_name, to_account: toAccount.nib,
            amount: amount, fee: taxa, total: totalDebit, status: 'SUCESSO'
        });
    } catch(e) { console.log('⚠️ Comprovativo inter:', e.message); }
    
    // Notificações
    await insertRecord(fromBankCode, 'notifications', {
        account_id: fromAccountId, type: 'transfer',
        title: '📤 Transferência Enviada',
        message: `Enviou ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name} (${toBankCode.toUpperCase()}).`
    });
    await insertRecord(toBankCode, 'notifications', {
        account_id: toAccount.id, type: 'transfer',
        title: '📥 Transferência Recebida',
        message: `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name} (${fromBankCode.toUpperCase()}).`
    });
    
    // Emails
    try {
        const { sendNotificationEmail } = require('./email');
        await sendNotificationEmail(fromBankCode, fromAccount.holder_email, 'Transferência Enviada', '📤 Transferência Interbancária', `Enviou ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name}.`);
        await sendNotificationEmail(toBankCode, toAccount.holder_email, 'Transferência Recebida', '📥 Transferência Interbancária', `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name}.`);
    } catch(e) { console.log('⚠️ Email inter:', e.message); }
    
    return {
        success: true,
        message: `Transferência inter-bancária de ${amount} CVE realizada com sucesso`,
        fee: taxa, totalDebited: totalDebit, newBalance: newFromBalance, reference: reference
    };
}

// Versão interna para execução automática (sem chave de confirmação)
async function transferSameBankInternal(bankCode, fromAccountId, toAccountNumber, amount, description = '') {
    if (!isValidAmount(amount)) throw new Error('Valor inválido');
    
    const fromAccount = await querySingle(bankCode, 'accounts', { id: fromAccountId });
    if (!fromAccount) throw new Error('Conta de origem não encontrada');
    if (fromAccount.status !== STATUS.ACTIVE) throw new Error('Conta de origem está inativa ou bloqueada');
    
    if (fromAccount.account_number === toAccountNumber) throw new Error('Não é permitido transferir para a própria conta');
    
    const taxa = TAXAS.MESMO_BANCO;
    const totalDebit = amount + taxa;
    if (parseFloat(fromAccount.balance) < totalDebit) throw new Error(`Saldo insuficiente. Necessita: ${totalDebit} CVE`);
    
    const toAccount = await querySingle(bankCode, 'accounts', { account_number: toAccountNumber });
    if (!toAccount) throw new Error('Conta de destino não encontrada');
    if (toAccount.status !== STATUS.ACTIVE) throw new Error('Conta de destino está inativa ou bloqueada');
    
    const newFromBalance = parseFloat(fromAccount.balance) - totalDebit;
    await updateRecord(bankCode, 'accounts', { id: fromAccountId }, { balance: newFromBalance });
    
    const outRef = 'SCH-' + Date.now();
    await insertRecord(bankCode, 'transactions', {
        account_id: fromAccountId, type: TRANSACTION_TYPES.TRANSFER_OUT,
        amount, balance_after: newFromBalance, counterparty: toAccountNumber,
        description: description || 'Transferência agendada', fee: taxa, reference: outRef
    });
    
    const newToBalance = parseFloat(toAccount.balance) + amount;
    await updateRecord(bankCode, 'accounts', { id: toAccount.id }, { balance: newToBalance });
    
    await insertRecord(bankCode, 'transactions', {
        account_id: toAccount.id, type: TRANSACTION_TYPES.TRANSFER_IN,
        amount, balance_after: newToBalance, counterparty: fromAccount.account_number,
        description: `Transferência agendada de ${fromAccount.account_number}`, fee: 0, reference: outRef + '-IN'
    });
    
    if (taxa > 0) {
        await insertRecord(bankCode, 'transactions', {
            account_id: fromAccountId, type: TRANSACTION_TYPES.FEE,
            amount: taxa, balance_after: newFromBalance,
            description: 'Taxa de transferência agendada', fee: 0, reference: outRef + '-FEE'
        });
    }
    
    // Comprovativo
    const receiptRef = outRef;
    await insertRecord(bankCode, 'receipts', {
        account_id: fromAccountId, reference: receiptRef, type: 'SAME_BANK',
        from_name: fromAccount.holder_name, from_account: fromAccount.account_number,
        to_name: toAccount.holder_name, to_account: toAccountNumber,
        amount: amount, fee: taxa, total: amount + taxa, status: 'SUCESSO'
    });
    
    // Gerar PDF
    try {
        const { generateReceiptPDF } = require('./receipt');
        await generateReceiptPDF(bankCode, {
            account_id: fromAccountId, reference: receiptRef, type: 'SAME_BANK',
            from_name: fromAccount.holder_name, from_account: fromAccount.account_number,
            to_name: toAccount.holder_name, to_account: toAccountNumber,
            amount: amount, fee: taxa, total: amount + taxa, status: 'SUCESSO'
        });
    } catch(e) {}
    
    // Notificar
    await insertRecord(bankCode, 'notifications', {
        account_id: fromAccountId, type: 'transfer',
        title: '📤 Transferência Agendada Executada',
        message: `Transferência agendada de ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name} foi executada.`
    });
    await insertRecord(bankCode, 'notifications', {
        account_id: toAccount.id, type: 'transfer',
        title: '📥 Transferência Recebida',
        message: `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name} (transferência agendada).`
    });
    
    // Email
    try {
        const { sendNotificationEmail } = require('./email');
        await sendNotificationEmail(bankCode, fromAccount.holder_email, 'Transferência Agendada', '📤 Transferência Executada', `Transferência agendada de ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name} foi executada.`);
        await sendNotificationEmail(bankCode, toAccount.holder_email, 'Transferência Recebida', '📥 Transferência Recebida', `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name}.`);
    } catch(e) {}
    
    return { success: true, newBalance: newFromBalance };
}

// Versão interna interbancária (sem chave)
async function transferInterBankInternal(fromBankCode, fromAccountId, toBankCode, toAccountNumber, amount, description = '') {
    if (!isValidAmount(amount)) throw new Error('Valor inválido');
    
    const normalizedNIB = toAccountNumber.replace(/\s/g, '');
    
    let taxa;
    if (fromBankCode === 'kent' && toBankCode === 'jane') taxa = TAXAS.KENT_PARA_JANE;
    else if (fromBankCode === 'jane' && toBankCode === 'kent') taxa = TAXAS.JANE_PARA_KENT;
    else throw new Error('Bancos inválidos');
    
    const fromAccount = await querySingle(fromBankCode, 'accounts', { id: fromAccountId });
    if (!fromAccount) throw new Error('Conta de origem não encontrada');
    if (fromAccount.status !== STATUS.ACTIVE) throw new Error('Conta de origem está inativa ou bloqueada');
    
    const totalDebit = amount + taxa;
    if (parseFloat(fromAccount.balance) < totalDebit) throw new Error(`Saldo insuficiente. Necessita: ${totalDebit} CVE`);
    
    let toAccount = await querySingle(toBankCode, 'accounts', { nib: normalizedNIB });
    if (!toAccount) toAccount = await querySingle(toBankCode, 'accounts', { account_number: normalizedNIB });
    if (!toAccount) throw new Error('Conta de destino não encontrada');
    if (toAccount.status !== STATUS.ACTIVE) throw new Error('Conta de destino está inativa ou bloqueada');
    
    const reference = generateReference();
    
    await supabase.from('interbank_transfers').insert({
        reference, from_bank: fromBankCode, from_account: fromAccount.account_number,
        to_bank: toBankCode, to_account: toAccount.account_number,
        amount, fee: taxa, status: 'pending'
    });
    
    const newFromBalance = parseFloat(fromAccount.balance) - totalDebit;
    await updateRecord(fromBankCode, 'accounts', { id: fromAccountId }, { balance: newFromBalance });
    
    await insertRecord(fromBankCode, 'transactions', {
        account_id: fromAccountId, type: TRANSACTION_TYPES.TRANSFER_OUT,
        amount, balance_after: newFromBalance,
        counterparty: `${toBankCode.toUpperCase()}:${toAccount.account_number}`,
        description: description || 'Transferência agendada', fee: taxa, reference: reference
    });
    
    if (taxa > 0) {
        await insertRecord(fromBankCode, 'transactions', {
            account_id: fromAccountId, type: TRANSACTION_TYPES.FEE,
            amount: taxa, balance_after: newFromBalance,
            description: 'Taxa transferência agendada', fee: 0, reference: reference + '-FEE'
        });
    }
    
    const newToBalance = parseFloat(toAccount.balance) + amount;
    await updateRecord(toBankCode, 'accounts', { id: toAccount.id }, { balance: newToBalance });
    
    await insertRecord(toBankCode, 'transactions', {
        account_id: toAccount.id, type: TRANSACTION_TYPES.TRANSFER_IN,
        amount, balance_after: newToBalance,
        counterparty: `${fromBankCode.toUpperCase()}:${fromAccount.account_number}`,
        description: `Transferência agendada de ${fromBankCode.toUpperCase()}`, fee: 0, reference: reference + '-IN'
    });
    
    await supabase.from('interbank_transfers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('reference', reference);
    
    // Comprovativo
    const receiptRef = 'SCH-' + Date.now();
    await insertRecord(fromBankCode, 'receipts', {
        account_id: fromAccountId, reference: receiptRef, type: 'INTERBANK',
        from_name: fromAccount.holder_name, from_account: fromAccount.account_number,
        to_name: toAccount.holder_name, to_account: toAccountNumber,
        amount: amount, fee: taxa, total: amount + taxa, status: 'SUCESSO'
    });
    
    // Notificar
    const { sendNotificationEmail } = require('./email');
    await insertRecord(fromBankCode, 'notifications', { account_id: fromAccountId, type: 'transfer', title: '📤 Transferência Agendada Executada', message: `Transferência agendada de ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name} foi executada.` });
    await insertRecord(toBankCode, 'notifications', { account_id: toAccount.id, type: 'transfer', title: '📥 Transferência Recebida', message: `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name} (transferência agendada).` });
    
    try {
        await sendNotificationEmail(fromBankCode, fromAccount.holder_email, 'Transferência Agendada', '📤 Transferência Executada', `Transferência agendada de ${amount.toLocaleString('pt-CV')} CVE para ${toAccount.holder_name} foi executada.`);
        await sendNotificationEmail(toBankCode, toAccount.holder_email, 'Transferência Recebida', '📥 Transferência Recebida', `Recebeu ${amount.toLocaleString('pt-CV')} CVE de ${fromAccount.holder_name}.`);
    } catch(e) {}
    
    return { success: true, newBalance: newFromBalance };
}

module.exports = { transferSameBank, transferInterBank, transferSameBankInternal, transferInterBankInternal };