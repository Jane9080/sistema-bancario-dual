const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const kentDb = new sqlite3.Database(path.join(__dirname, 'data', 'kent.db'));
const janeDb = new sqlite3.Database(path.join(__dirname, 'data', 'jane.db'));

console.log('\n=== BANCO KENT ===');
kentDb.all('SELECT id, holder_name, balance FROM accounts', [], (err, rows) => {
    if (err) {
        console.error('Erro:', err.message);
    } else {
        console.table(rows);
    }
});

console.log('\n=== BANCO JANE ===');
janeDb.all('SELECT id, holder_name, balance FROM accounts', [], (err, rows) => {
    if (err) {
        console.error('Erro:', err.message);
    } else {
        console.table(rows);
    }
});

setTimeout(() => {
    kentDb.close();
    janeDb.close();
}, 1000);