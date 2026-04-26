const { getKentDb, getJaneDb } = require('./src/database/sqlite');
const kentDb = getKentDb();
const janeDb = getJaneDb();

const newColumns = [
    'ALTER TABLE scheduled_transfers ADD COLUMN to_nib TEXT',
    'ALTER TABLE scheduled_transfers ADD COLUMN transfer_type TEXT DEFAULT \'same\'',
    'ALTER TABLE scheduled_transfers ADD COLUMN mode TEXT DEFAULT \'single\'',
    'ALTER TABLE scheduled_transfers ADD COLUMN frequency TEXT',
    'ALTER TABLE scheduled_transfers ADD COLUMN interval_value INTEGER DEFAULT 1',
    'ALTER TABLE scheduled_transfers ADD COLUMN max_occurrences INTEGER',
    'ALTER TABLE scheduled_transfers ADD COLUMN current_occurrence INTEGER DEFAULT 0',
    'ALTER TABLE scheduled_transfers ADD COLUMN reserved_amount REAL NOT NULL DEFAULT 0',
    'ALTER TABLE scheduled_transfers ADD COLUMN next_scheduled_date TEXT'
];

function addColumns(db, bankName) {
    let index = 0;
    
    function next() {
        if (index >= newColumns.length) {
            console.log(`✅ ${bankName}: todas as colunas adicionadas!`);
            return;
        }
        
        db.run(newColumns[index], (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.log(`${bankName}: ${err.message}`);
            } else {
                console.log(`✅ ${bankName}: coluna adicionada`);
            }
            index++;
            next();
        });
    }
    
    next();
}

addColumns(kentDb, 'Kent');
setTimeout(() => addColumns(janeDb, 'Jane'), 2000);
setTimeout(() => process.exit(0), 5000);