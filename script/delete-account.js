const { getKentDb, getJaneDb, runQuery } = require('../src/database/sqlite');

async function deleteAccountByEmail(bankCode, email) {
    const db = bankCode === 'kent' ? getKentDb() : getJaneDb();
    
    // Buscar a conta
    const account = await getQuery(db, 'SELECT id FROM accounts WHERE holder_email = ?', [email]);
    if (!account) {
        console.log(`Conta com email ${email} não encontrada no banco ${bankCode}`);
        return;
    }
    
    // Apagar transações primeiro (por causa da chave estrangeira)
    await runQuery(db, 'DELETE FROM transactions WHERE account_id = ?', [account.id]);
    
    // Apagar a conta
    await runQuery(db, 'DELETE FROM accounts WHERE id = ?', [account.id]);
    
    console.log(`✅ Conta ${email} apagada do banco ${bankCode}`);
}

// Exemplo: apagar teste@kent.cv
deleteAccountByEmail('kent', 'teste@kent.cv');
deleteAccountByEmail('jane', 'teste@jane.cv');