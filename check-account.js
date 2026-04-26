const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'data', 'kent.db'));

db.get("SELECT id, holder_name, mother_name, father_name, birth_date, age, marital_status, nif, passport_number, address FROM accounts ORDER BY id DESC LIMIT 1", (err, row) => {
    if (err) {
        console.error('Erro:', err.message);
    } else if (row) {
        console.log('\n=== ÚLTIMA CONTA CRIADA ===');
        console.log(`ID: ${row.id}`);
        console.log(`Nome: ${row.holder_name}`);
        console.log(`Nome da Mãe: ${row.mother_name || '❌ NÃO GUARDADO'}`);
        console.log(`Nome do Pai: ${row.father_name || '❌ NÃO GUARDADO'}`);
        console.log(`Data Nascimento: ${row.birth_date || '❌ NÃO GUARDADO'}`);
        console.log(`Idade: ${row.age || '❌ NÃO GUARDADO'}`);
        console.log(`Estado Civil: ${row.marital_status || '❌ NÃO GUARDADO'}`);
        console.log(`NIF: ${row.nif || '❌ NÃO GUARDADO'}`);
        console.log(`Passaporte: ${row.passport_number || '❌ NÃO GUARDADO'}`);
        console.log(`Endereço: ${row.address || '❌ NÃO GUARDADO'}`);
    } else {
        console.log('Nenhuma conta encontrada');
    }
    db.close();
});