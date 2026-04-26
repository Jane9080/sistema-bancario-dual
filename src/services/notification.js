const { insertRecord } = require('../database/supabase');

async function notifyLoanApproved(bankCode, accountId, amount, monthlyPayment, months) {
    await insertRecord(bankCode, 'notifications', {
        account_id: accountId,
        type: 'loan',
        title: '💰 Empréstimo Aprovado',
        message: `Empréstimo de ${amount.toLocaleString('pt-CV')} CVE aprovado! ${months}x de ${monthlyPayment.toFixed(2)} CVE.`
    });
    
    // Email
    try {
        const { querySingle } = require('../database/supabase');
        const account = await querySingle(bankCode, 'accounts', { id: accountId });
        if (account?.holder_email) {
            const { sendNotificationEmail } = require('./email');
            await sendNotificationEmail(bankCode, account.holder_email,
                'Empréstimo Aprovado', '💰 Empréstimo Aprovado',
                `Seu empréstimo de ${amount.toLocaleString('pt-CV')} CVE foi aprovado! Parcela mensal: ${monthlyPayment.toFixed(2)} CVE (${months}x).`
            );
        }
    } catch(e) {}
}

async function notifyInstallmentPaid(bankCode, accountId, monthlyPayment, remainingBalance) {
    await insertRecord(bankCode, 'notifications', {
        account_id: accountId,
        type: 'loan',
        title: '✅ Parcela Paga',
        message: `Parcela de ${monthlyPayment.toFixed(2)} CVE paga. Saldo devedor: ${remainingBalance.toFixed(2)} CVE.`
    });
    
    // Email
    try {
        const { querySingle } = require('../database/supabase');
        const account = await querySingle(bankCode, 'accounts', { id: accountId });
        if (account?.holder_email) {
            const { sendNotificationEmail } = require('./email');
            await sendNotificationEmail(bankCode, account.holder_email,
                'Parcela Paga', '✅ Parcela Paga',
                `Parcela de ${monthlyPayment.toFixed(2)} CVE paga com sucesso! Saldo devedor: ${remainingBalance.toFixed(2)} CVE.`
            );
        }
    } catch(e) {}
}

async function getUnreadNotifications(bankCode, accountId) {
    const { query } = require('../database/supabase');
    return await query(bankCode, 'notifications', '*', { account_id: accountId, read: 0 });
}

async function getAllNotifications(bankCode, accountId, limit = 20) {
    const { supabase } = require('../database/supabase');
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('bank', bankCode)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
}

async function markAsRead(bankCode, id) {
    const { updateRecord } = require('../database/supabase');
    await updateRecord(bankCode, 'notifications', { id }, { read: 1 });
}

async function markAllAsRead(bankCode, accountId) {
    const { supabase } = require('../database/supabase');
    await supabase
        .from('notifications')
        .update({ read: 1 })
        .eq('bank', bankCode)
        .eq('account_id', accountId)
        .eq('read', 0);
}

async function deleteNotification(bankCode, id) {
    const { deleteRecord } = require('../database/supabase');
    await deleteRecord(bankCode, 'notifications', { id });
}

async function countUnread(bankCode, accountId) {
    const { supabase } = require('../database/supabase');
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('bank', bankCode)
        .eq('account_id', accountId)
        .eq('read', 0);
    if (error) return 0;
    return count;
}

module.exports = {
    notifyLoanApproved,
    notifyInstallmentPaid,
    getUnreadNotifications,
    getAllNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    countUnread
};