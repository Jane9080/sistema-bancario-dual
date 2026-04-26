const { getKentDb, getJaneDb } = require('./src/database/sqlite');
const kentDb = getKentDb();
const janeDb = getJaneDb();

console.log('=== BANCO KENT ===');
kentDb.all('SELECT id, holder_name, balance, reserved_amount FROM accounts', [], (err, rows) => {
    if (err) console.log('Erro Kent:', err);
    else rows.forEach(r => console.log(`ID:${r.id} | ${r.holder_name} | Saldo:${r.balance} | Reservado:${r.reserved_amount}`));
    
    console.log('\n=== BANCO JANE ===');
    janeDb.all('SELECT id, holder_name, balance, reserved_amount FROM accounts', [], (err, rows) => {
        if (err) console.log('Erro Jane:', err);
        else rows.forEach(r => console.log(`ID:${r.id} | ${r.holder_name} | Saldo:${r.balance} | Reservado:${r.reserved_amount}`));
        
        // Corrigir NULLs
        kentDb.run('UPDATE accounts SET reserved_amount = 0 WHERE reserved_amount IS NULL');
        janeDb.run('UPDATE accounts SET reserved_amount = 0 WHERE reserved_amount IS NULL');
        console.log('\n✅ NULLs corrigidos!');
        
        setTimeout(() => process.exit(0), 500);
    });
});