const { querySingle, insertRecord, updateRecord } = require('../database/supabase');
const { TRANSACTION_TYPES, LIMITES } = require('../utils/constants');
const { notifyLoanApproved, notifyInstallmentPaid } = require('./notification');

function getNextDueDate() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
}

async function requestLoan(bankCode, accountId, amount, months, confirmKey) {
    if (!confirmKey) throw new Error('Chave de confirmação é obrigatória');
    if (amount <= 0 || amount > LIMITES.EMPRESTIMO_MAX) throw new Error(`Valor inválido. Máx: ${LIMITES.EMPRESTIMO_MAX} CVE`);
    if (months < 1 || months > 24) throw new Error('Parcelas inválidas (1-24)');
    
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    if (account.status !== 'active') throw new Error('Conta inativa ou bloqueada');
    if (account.confirm_key !== confirmKey) throw new Error('Chave de confirmação inválida');
    
    // Verificar empréstimo ativo
    const activeLoan = await querySingle(bankCode, 'loans', { account_id: accountId, status: 'active' });
    if (activeLoan) throw new Error('Já existe um empréstimo ativo');
    
    const interestRate = bankCode === 'kent' ? 3.5 : 4.0;
    const monthlyRate = interestRate / 100;
    const factor = Math.pow(1 + monthlyRate, months);
    const monthlyPayment = amount * (monthlyRate * factor) / (factor - 1);
    const totalToPay = monthlyPayment * months;
    
    const loan = await insertRecord(bankCode, 'loans', {
        account_id: accountId, amount: amount,
        remaining_balance: totalToPay, interest_rate: interestRate,
        monthly_payment: monthlyPayment, total_parcels: months,
        remaining_parcels: months, next_due_date: getNextDueDate()
    });
    
    const newBalance = parseFloat(account.balance) + amount;
    await updateRecord(bankCode, 'accounts', { id: accountId }, { balance: newBalance });
    
    await insertRecord(bankCode, 'transactions', {
        account_id: accountId, type: TRANSACTION_TYPES.LOAN_RECEIVED,
        amount: amount, balance_after: newBalance,
        description: `Empréstimo de ${amount} CVE`, fee: 0
    });
    
    await notifyLoanApproved(bankCode, accountId, amount, monthlyPayment, months);
    
    return { success: true, message: `Empréstimo de ${amount} CVE aprovado!`, loan, newBalance };
}

async function payMonthlyInstallment(bankCode, accountId, confirmKey) {
    if (!confirmKey) throw new Error('Chave de confirmação é obrigatória');
    
    const account = await querySingle(bankCode, 'accounts', { id: accountId });
    if (!account) throw new Error('Conta não encontrada');
    if (account.status !== 'active') throw new Error('Conta inativa ou bloqueada');
    if (account.confirm_key !== confirmKey) throw new Error('Chave de confirmação inválida');
    
    const loan = await querySingle(bankCode, 'loans', { account_id: accountId, status: 'active' });
    if (!loan) throw new Error('Não há empréstimo ativo');
    
    const monthlyPayment = parseFloat(loan.monthly_payment);
    if (parseFloat(account.balance) < monthlyPayment) throw new Error('Saldo insuficiente');
    
    const newBalance = parseFloat(account.balance) - monthlyPayment;
    await updateRecord(bankCode, 'accounts', { id: accountId }, { balance: newBalance });
    
    const newRemainingBalance = parseFloat(loan.remaining_balance) - monthlyPayment;
    const newRemainingParcels = loan.remaining_parcels - 1;
    const status = newRemainingParcels <= 0 ? 'paid' : 'active';
    
    await updateRecord(bankCode, 'loans', { id: loan.id }, {
        remaining_balance: newRemainingBalance,
        remaining_parcels: newRemainingParcels,
        status: status,
        next_due_date: status === 'paid' ? null : getNextDueDate()
    });
    
    await insertRecord(bankCode, 'transactions', {
        account_id: accountId, type: TRANSACTION_TYPES.LOAN_PAYMENT,
        amount: monthlyPayment, balance_after: newBalance,
        description: 'Pagamento de parcela', fee: 0
    });
    
    await notifyInstallmentPaid(bankCode, accountId, monthlyPayment, newRemainingBalance);
    
    return { success: true, message: `Parcela de ${monthlyPayment.toFixed(2)} CVE paga!`, newBalance };
}

async function getLoanStatus(bankCode, accountId) {
    const loan = await querySingle(bankCode, 'loans', { account_id: accountId, status: 'active' });
    if (!loan) return { hasLoan: false, message: 'Não há empréstimo ativo' };
    
    return {
        hasLoan: true,
        loan: {
            id: loan.id, amount: loan.amount,
            remainingBalance: parseFloat(loan.remaining_balance).toFixed(2),
            monthlyPayment: parseFloat(loan.monthly_payment).toFixed(2),
            totalParcels: loan.total_parcels, remainingParcels: loan.remaining_parcels,
            paidParcels: loan.total_parcels - loan.remaining_parcels,
            interestRate: loan.interest_rate, nextDueDate: loan.next_due_date, status: loan.status
        }
    };
}

module.exports = { requestLoan, payMonthlyInstallment, getLoanStatus };