const { getKentDb, getJaneDb } = require('./src/database/sqlite');
const kentDb = getKentDb();
const janeDb = getJaneDb();

kentDb.run('UPDATE accounts SET reserved_amount = 0 WHERE reserved_amount > balance OR reserved_amount IS NULL');
janeDb.run('UPDATE accounts SET reserved_amount = 0 WHERE reserved_amount > balance OR reserved_amount IS NULL');

console.log('✅ Dados corrigidos!');
setTimeout(() => process.exit(0), 500);