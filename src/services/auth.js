const bcrypt = require('bcrypt');
const { query, querySingle, insertRecord, updateRecord } = require('../database/supabase');
const { 
    generateToken, 
    generateAccountNumber, 
    generateUsername,
    generateRandomPassword,
    generateConfirmKey,
    generateNIB,
    generateIBAN
} = require('../utils/crypto');
const { STATUS, TAXAS } = require('../utils/constants');

// Validar email - APENAS GMAIL
function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return emailRegex.test(email);
}

function isValidName(name) {
    return name && name.trim().length >= 3;
}

function isValidPhone(phone) {
    if (!phone) return true;
    const phoneRegex = /^\+?[0-9]+$/;
    return phoneRegex.test(phone);
}

// Registar nova conta
async function registerAccount(bankCode, accountData) {
    if (!isValidName(accountData.holder_name)) throw new Error('Nome inválido (mínimo 3 caracteres)');
    if (!isValidEmail(accountData.holder_email)) throw new Error('Email inválido. Use apenas @gmail.com');
    if (!isValidPhone(accountData.holder_phone)) throw new Error('Número de telefone inválido');
    
    const existingAccount = await querySingle(bankCode, 'accounts', { holder_email: accountData.holder_email });
    if (existingAccount) throw new Error('Email já registado');
    
    const accountNumber = generateAccountNumber(bankCode);
    const username = generateUsername(accountData.holder_name);
    const randomPassword = generateRandomPassword();
    const confirmKey = generateConfirmKey();
    const nib = generateNIB(bankCode, accountNumber);
    const iban = generateIBAN(bankCode, accountNumber);
    
    const passwordToUse = accountData.password || randomPassword;
    const passwordHash = await bcrypt.hash(passwordToUse, 10);
    
    const answer1Hash = accountData.security_answer_1 ? await bcrypt.hash(accountData.security_answer_1, 10) : null;
    const answer2Hash = accountData.security_answer_2 ? await bcrypt.hash(accountData.security_answer_2, 10) : null;
    const answer3Hash = accountData.security_answer_3 ? await bcrypt.hash(accountData.security_answer_3, 10) : null;
    
    const newAccount = await insertRecord(bankCode, 'accounts', {
        account_number: accountNumber, username, holder_name: accountData.holder_name,
        holder_email: accountData.holder_email, holder_phone: accountData.holder_phone || null,
        mother_name: accountData.mother_name || null, father_name: accountData.father_name || null,
        age: accountData.age || null, birth_date: accountData.birth_date || null,
        marital_status: accountData.marital_status || null, passport_number: accountData.passport_number || null,
        nif: accountData.nif || null, address: accountData.address || null,
        password_hash: passwordHash, confirm_key: confirmKey, nib, iban,
        balance: 0, status: STATUS.ACTIVE,
        security_question_1: accountData.security_question_1 || null, security_answer_1: answer1Hash,
        security_question_2: accountData.security_question_2 || null, security_answer_2: answer2Hash,
        security_question_3: accountData.security_question_3 || null, security_answer_3: answer3Hash,
        security_updated_at: new Date().toISOString()
    });
    
    console.log(`✅ Conta criada: ${accountNumber}`);
    
    try {
        const { generateAccountPDF } = require('./pdf');
        const pdf = await generateAccountPDF(bankCode, { accountNumber, username, password: passwordToUse, confirmKey, nib, iban, balance: 0, email: accountData.holder_email });
        const fs = require('fs');
        const pdfBuffer = fs.readFileSync(pdf.filepath);
        const { sendAccountEmail } = require('./email');
        await sendAccountEmail(bankCode, accountData.holder_email, { holder_name: accountData.holder_name, accountNumber, username, confirmKey, nib, iban, balance: 0 }, pdfBuffer);
        console.log(`📧 Email enviado para ${accountData.holder_email}`);
    } catch (emailError) { console.error('⚠️ Email:', emailError.message); }
    
    return { success: true, accountId: newAccount.id, accountNumber, username, message: 'Conta criada com sucesso! Verifique o seu email.' };
}

// Login
async function login(bankCode, email, password, ipAddress, userAgent) {
    const account = await querySingle(bankCode, 'accounts', { holder_email: email });
    if (!account) throw new Error('Email não encontrado');
    if (account.status === 'blocked' || account.account_locked) throw new Error('BLOCKED: Conta bloqueada.');
    if (account.status === 'inactive') throw new Error('INACTIVE: Conta inativa.');
    
    const isValid = await bcrypt.compare(password, account.password_hash);
    
    if (!isValid) {
        await updateRecord(bankCode, 'accounts', { id: account.id }, { failed_attempts: (account.failed_attempts || 0) + 1 });
        const updated = await querySingle(bankCode, 'accounts', { id: account.id });
        const tentativas = updated.failed_attempts;
        
        if (tentativas >= 5) {
            await updateRecord(bankCode, 'accounts', { id: account.id }, { account_locked: true, status: STATUS.BLOCKED });
            await insertRecord(bankCode, 'notifications', { account_id: account.id, type: 'account', title: '🔒 Conta Bloqueada', message: 'Conta bloqueada por 5 tentativas falhadas.' });
            try { const { sendNotificationEmail } = require('./email'); await sendNotificationEmail(bankCode, account.holder_email, 'Conta Bloqueada', '🔒 Conta Bloqueada', 'Sua conta foi bloqueada após 5 tentativas falhadas.'); } catch(e) {}
            throw new Error('BLOCKED: Conta bloqueada após 5 tentativas falhadas.');
        }
        throw new Error(`INCORRECT: Password incorreta. Tentativa ${tentativas} de 5.`);
    }
    
    await updateRecord(bankCode, 'accounts', { id: account.id }, { failed_attempts: 0, account_locked: false, last_login: new Date().toISOString() });
    await insertRecord(bankCode, 'login_attempts', { account_id: account.id, success: true, ip_address: ipAddress, user_agent: userAgent });
    
    const token = generateToken(account.id, bankCode, account.holder_email);
    return { success: true, token, user: { id: account.id, name: account.holder_name, email: account.holder_email, accountNumber: account.account_number, balance: account.balance, bankCode } };
}

// Alterar password
async function changePassword(bankCode, accountId, currentPassword, newPassword) {
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    const isValid = await bcrypt.compare(currentPassword, account.password_hash);
    if (!isValid) throw new Error('Password atual incorreta');
    if (newPassword.length < 6) throw new Error('A nova password deve ter pelo menos 6 caracteres');
    
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await updateRecord(bankCode, 'accounts', { id: accountId }, { password_hash: newPasswordHash, last_password_change: new Date().toISOString(), security_updated_at: new Date().toISOString() });
    try { await insertRecord(bankCode, 'password_history', { account_id: accountId, password_hash: newPasswordHash }); } catch (err) {}
    return { success: true, message: 'Password alterada com sucesso' };
}

// Recuperar conta
async function recoverAccount(bankCode, email, answers) {
    const account = await querySingle(bankCode, 'accounts', { holder_email: email });
    if (!account) throw new Error('Email não encontrado');
    
    let correctCount = 0;
    if (account.security_answer_1 && await bcrypt.compare(answers[0] || '', account.security_answer_1)) correctCount++;
    if (account.security_answer_2 && await bcrypt.compare(answers[1] || '', account.security_answer_2)) correctCount++;
    if (account.security_answer_3 && await bcrypt.compare(answers[2] || '', account.security_answer_3)) correctCount++;
    if (correctCount < 2) throw new Error(`Respostas incorretas. Acertou ${correctCount} de 3.`);
    
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    await insertRecord(bankCode, 'reset_tokens', { account_id: account.id, token: resetToken, expires_at: expiresAt });
    
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}&bank=${bankCode}`;
    const { sendResetEmail } = require('./email');
    await sendResetEmail(bankCode, email, resetLink);
    
    return { success: true, message: 'Email de recuperação enviado!' };
}

// Obter perguntas de segurança
async function getSecurityQuestions(bankCode, accountId) {
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    return {
        questions: [account.security_question_1 || null, account.security_question_2 || null, account.security_question_3 || null],
        isComplete: !!(account.security_question_1 && account.security_question_2 && account.security_question_3),
        updatedAt: account.security_updated_at
    };
}

// Atualizar perguntas de segurança
async function updateSecurityQuestions(bankCode, accountId, currentPassword, questions, answers, confirmKey) {
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    const isValidPassword = await bcrypt.compare(currentPassword, account.password_hash);
    if (!isValidPassword) throw new Error('Password atual incorreta');
    if (account.confirm_key !== confirmKey) throw new Error('Chave de confirmação incorreta');
    if (!questions || !answers || questions.length !== 3 || answers.length !== 3) throw new Error('São necessárias 3 perguntas e respostas');
    
    const answer1Hash = await bcrypt.hash(answers[0], 10);
    const answer2Hash = await bcrypt.hash(answers[1], 10);
    const answer3Hash = await bcrypt.hash(answers[2], 10);
    
    await updateRecord(bankCode, 'accounts', { id: accountId }, {
        security_question_1: questions[0], security_answer_1: answer1Hash,
        security_question_2: questions[1], security_answer_2: answer2Hash,
        security_question_3: questions[2], security_answer_3: answer3Hash,
        security_updated_at: new Date().toISOString()
    });
    return { success: true, message: 'Perguntas de segurança atualizadas com sucesso' };
}

// Agendar transferência
async function scheduleTransfer(bankCode, accountId, data) {
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    if (data.confirmKey !== account.confirm_key) throw new Error('Chave de confirmação incorreta');
    
    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) throw new Error('Valor inválido');
    
    // Detetar NIB
    const isNIB = data.toAccount.startsWith('0004') || data.toAccount.startsWith('0003');
    if (isNIB && data.transferType === 'same') {
        data.transferType = 'inter';
        data.toNib = data.toAccount;
        data.toBank = data.toAccount.startsWith('0004') ? 'kent' : 'jane';
    }
    
    let taxa = 0;
    if (data.transferType === 'same') taxa = TAXAS.MESMO_BANCO || 0;
    else if (data.transferType === 'inter') taxa = bankCode === 'kent' ? (TAXAS.KENT_PARA_JANE || 150) : (TAXAS.JANE_PARA_KENT || 150);
    
    const totalDebit = amount + taxa;
    const availableBalance = parseFloat(account.balance) - parseFloat(account.reserved_amount || 0);
    if (totalDebit > availableBalance) throw new Error(`Saldo insuficiente. Disponível: ${availableBalance.toLocaleString('pt-CV')} CVE. Necessita: ${totalDebit.toLocaleString('pt-CV')} CVE`);
    
    const localDate = new Date(data.scheduledDate + 'T' + (data.scheduledTime || '00:00') + ':00');
    const scheduledDate = localDate.toISOString();
    if (localDate <= new Date()) throw new Error('Data deve ser futura');
    
    if (data.mode === 'recurring') {
        if (!data.frequency) throw new Error('Frequência é obrigatória');
        if (!data.maxOccurrences || data.maxOccurrences > 60) throw new Error('Número de ocorrências inválido (máx 60)');
    }
    
    let nextScheduledDate = null;
    if (data.mode === 'recurring') nextScheduledDate = calculateNextDate(scheduledDate, data.frequency, data.intervalValue || 1);
    
    await updateRecord(bankCode, 'accounts', { id: accountId }, { reserved_amount: parseFloat(account.reserved_amount || 0) + totalDebit });
    
    const result = await insertRecord(bankCode, 'scheduled_transfers', {
        from_account_id: accountId, to_account_number: data.toAccount, to_bank: data.toBank,
        to_nib: data.toNib || null, amount, reserved_amount: totalDebit,
        description: data.description || null, transfer_type: data.transferType || 'same',
        mode: data.mode || 'single', frequency: data.frequency || null,
        interval_value: data.intervalValue || 1, max_occurrences: data.maxOccurrences || null,
        scheduled_date: scheduledDate, next_scheduled_date: nextScheduledDate
    });
    
    return { success: true, message: 'Transferência agendada!', scheduleId: result.id, scheduledDate, reservedAmount: totalDebit, taxa };
}

// Calcular próxima data
function calculateNextDate(currentDate, frequency, interval) {
    const date = new Date(currentDate);
    switch (frequency) {
        case 'daily': date.setDate(date.getDate() + interval); break;
        case 'weekly': date.setDate(date.getDate() + (7 * interval)); break;
        case 'monthly': date.setMonth(date.getMonth() + interval); break;
        case 'yearly': date.setFullYear(date.getFullYear() + interval); break;
    }
    return date.toISOString();
}

// Listar agendamentos do cliente
async function listScheduledTransfers(bankCode, accountId) {
    return await query(bankCode, 'scheduled_transfers', '*', { from_account_id: accountId });
}

// Cancelar agendamento
async function cancelScheduledTransfer(bankCode, accountId, scheduleId) {
    const transfer = await querySingle(bankCode, 'scheduled_transfers', { id: scheduleId, from_account_id: accountId });
    if (!transfer) throw new Error('Agendamento não encontrado');
    if (transfer.status !== 'pending') throw new Error('Este agendamento já foi processado');
    
    await updateRecord(bankCode, 'accounts', { id: accountId }, { reserved_amount: parseFloat(transfer.reserved_amount || 0) - parseFloat(transfer.reserved_amount || 0) });
    await updateRecord(bankCode, 'scheduled_transfers', { id: scheduleId }, { status: 'cancelled' });
    return { success: true, message: 'Agendamento cancelado. Reserva libertada.' };
}

module.exports = {
    registerAccount,
    login,
    changePassword,
    recoverAccount,
    getSecurityQuestions,
    updateSecurityQuestions,
    scheduleTransfer,
    listScheduledTransfers,
    cancelScheduledTransfer,
    calculateNextDate
};