const { getKentDb, getJaneDb, getSharedDb, runQuery } = require('./sqlite');
const bcrypt = require('bcrypt');

async function createTablesKentJane(db, bankName) {
    // Tabela de contas (APENAS CLIENTES)
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_number TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE,
            holder_name TEXT NOT NULL,
            holder_email TEXT UNIQUE NOT NULL,
            holder_phone TEXT,
            mother_name TEXT,
            father_name TEXT,
            age INTEGER,
            birth_date TEXT,
            marital_status TEXT,
            passport_number TEXT,
            nif TEXT,
            address TEXT,
            password_hash TEXT NOT NULL,
            confirm_key TEXT,
            nib TEXT,
            iban TEXT,
            security_question_1 TEXT,
            security_answer_1 TEXT,
            security_question_2 TEXT,
            security_answer_2 TEXT,
            security_question_3 TEXT,
            security_answer_3 TEXT,
            security_updated_at DATETIME,
            two_factor_enabled BOOLEAN DEFAULT 0,
            last_password_change DATETIME,
            login_attempts INTEGER DEFAULT 0,
            account_locked BOOLEAN DEFAULT 0,
            reserved_amount REAL DEFAULT 0,
            balance REAL DEFAULT 0.00,
            status TEXT DEFAULT 'active',
            failed_attempts INTEGER DEFAULT 0,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de administradores (SEPARADA)
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de transações
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_after REAL NOT NULL,
            counterparty TEXT,
            description TEXT,
            reference TEXT UNIQUE,
            fee REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    `);

    // Tabela de empréstimos
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            remaining_balance REAL NOT NULL,
            interest_rate REAL NOT NULL,
            monthly_payment REAL NOT NULL,
            total_parcels INTEGER NOT NULL,
            remaining_parcels INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            next_due_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    `);

    // Tabela de comprovativos
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            reference TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            from_name TEXT NOT NULL,
            from_account TEXT NOT NULL,
            to_name TEXT NOT NULL,
            to_account TEXT NOT NULL,
            amount REAL NOT NULL,
            fee REAL DEFAULT 0,
            total REAL NOT NULL,
            status TEXT DEFAULT 'SUCESSO',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    `);

    // Tabela de notificações
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    `);

    // Tabela de histórico de passwords (auditoria)
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS password_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    `);

    // Tabela de tentativas de login
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            success BOOLEAN DEFAULT 0,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    `);

    // ✅ Tabela de transferências agendadas (COMPLETA)
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS scheduled_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_account_id INTEGER NOT NULL,
            to_account_number TEXT NOT NULL,
            to_bank TEXT NOT NULL,
            to_nib TEXT,
            amount REAL NOT NULL,
            reserved_amount REAL NOT NULL,
            description TEXT,
            transfer_type TEXT DEFAULT 'same',
            mode TEXT DEFAULT 'single',
            frequency TEXT,
            interval_value INTEGER DEFAULT 1,
            max_occurrences INTEGER,
            current_occurrence INTEGER DEFAULT 0,
            scheduled_date TEXT NOT NULL,
            next_scheduled_date TEXT,
            status TEXT DEFAULT 'pending',
            executed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_account_id) REFERENCES accounts(id)
        )
    `);

    console.log(`✅ Tabelas criadas para ${bankName}`);
}

async function createSharedTables() {
    const db = getSharedDb();
    
    await runQuery(db, `
        CREATE TABLE IF NOT EXISTS interbank_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT UNIQUE NOT NULL,
            from_bank TEXT NOT NULL,
            from_account TEXT NOT NULL,
            to_bank TEXT NOT NULL,
            to_account TEXT NOT NULL,
            amount REAL NOT NULL,
            fee REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            from_transaction_id INTEGER,
            to_transaction_id INTEGER
        )
    `);

    console.log('✅ Tabelas criadas para Shared Database');
}

async function insertInitialData() {
    const kentDb = getKentDb();
    const janeDb = getJaneDb();
    
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const testPasswordHash = await bcrypt.hash('teste123', 10);
    const bankPasswordHash = await bcrypt.hash('banco123', 10);

    // ========== BANCO KENT ==========
    
    await runQuery(kentDb, `
        INSERT OR IGNORE INTO admins (email, password_hash, name, role)
        VALUES (?, ?, ?, ?)
    `, ['admin@kent.cv', adminPasswordHash, 'Administrador Kent', 'admin']);

    await runQuery(kentDb, `
        INSERT OR IGNORE INTO accounts 
        (account_number, username, holder_name, holder_email, password_hash, balance, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['KENT-10000000-0001', 'testekent', 'Cliente Teste Kent', 'teste@kent.cv', testPasswordHash, 10000, 'active']);

    await runQuery(kentDb, `
        INSERT OR IGNORE INTO accounts 
        (account_number, holder_name, holder_email, nib, iban, balance, status, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ['KENT-BANK-001', 'Banco Comercial de Kent', 'banco@kent.cv', '000400000BANK0010193', 'CV6400040000BANK0010193', 2000000000, 'active', bankPasswordHash]);

    // ========== BANCO JANE ==========
    
    await runQuery(janeDb, `
        INSERT OR IGNORE INTO admins (email, password_hash, name, role)
        VALUES (?, ?, ?, ?)
    `, ['admin@jane.cv', adminPasswordHash, 'Administrador Jane', 'admin']);

    await runQuery(janeDb, `
        INSERT OR IGNORE INTO accounts 
        (account_number, username, holder_name, holder_email, password_hash, balance, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['JANE-10000000-0001', 'testejane', 'Cliente Teste Jane', 'teste@jane.cv', testPasswordHash, 10000, 'active']);

    await runQuery(janeDb, `
        INSERT OR IGNORE INTO accounts 
        (account_number, holder_name, holder_email, nib, iban, balance, status, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ['JANE-BANK-001', 'Banco Popular de Jane', 'banco@jane.cv', '00030000BANK0010176', 'CV6400030000BANK0010176', 2000000000, 'active', bankPasswordHash]);

    console.log('✅ Dados iniciais inseridos');
    console.log('\n📋 CONTAS DE TESTE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏦 BANCO KENT:');
    console.log('   Admin: admin@kent.cv / admin123');
    console.log('   Cliente: teste@kent.cv / teste123');
    console.log('   Conta do Banco: KENT-BANK-001 / 2.000.000.000 CVE');
    console.log('\n🏦 BANCO JANE:');
    console.log('   Admin: admin@jane.cv / admin123');
    console.log('   Cliente: teste@jane.cv / teste123');
    console.log('   Conta do Banco: JANE-BANK-001 / 2.000.000.000 CVE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function initDatabase() {
    console.log('🚀 Inicializando bases de dados...\n');
    
    await createTablesKentJane(getKentDb(), 'Banco Comercial de Kent');
    await createTablesKentJane(getJaneDb(), 'Banco Popular de Jane');
    await createSharedTables();
    await insertInitialData();
    
    console.log('\n🎉 Bases de dados inicializadas com sucesso!');
}

async function migrateExistingDatabases() {
    console.log('🔧 Verificando migrações necessárias...\n');
    
    const kentDb = getKentDb();
    const janeDb = getJaneDb();
    
    const newAccountColumns = [
        'ALTER TABLE accounts ADD COLUMN security_updated_at DATETIME',
        'ALTER TABLE accounts ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0',
        'ALTER TABLE accounts ADD COLUMN last_password_change DATETIME',
        'ALTER TABLE accounts ADD COLUMN login_attempts INTEGER DEFAULT 0',
        'ALTER TABLE accounts ADD COLUMN account_locked BOOLEAN DEFAULT 0',
        'ALTER TABLE accounts ADD COLUMN reserved_amount REAL DEFAULT 0',
        'ALTER TABLE accounts ADD COLUMN last_login DATETIME'
    ];
    
    const newScheduleColumns = [
        'ALTER TABLE scheduled_transfers ADD COLUMN to_nib TEXT',
        'ALTER TABLE scheduled_transfers ADD COLUMN reserved_amount REAL NOT NULL DEFAULT 0',
        'ALTER TABLE scheduled_transfers ADD COLUMN transfer_type TEXT DEFAULT \'same\'',
        'ALTER TABLE scheduled_transfers ADD COLUMN mode TEXT DEFAULT \'single\'',
        'ALTER TABLE scheduled_transfers ADD COLUMN frequency TEXT',
        'ALTER TABLE scheduled_transfers ADD COLUMN interval_value INTEGER DEFAULT 1',
        'ALTER TABLE scheduled_transfers ADD COLUMN max_occurrences INTEGER',
        'ALTER TABLE scheduled_transfers ADD COLUMN current_occurrence INTEGER DEFAULT 0',
        'ALTER TABLE scheduled_transfers ADD COLUMN next_scheduled_date TEXT'
    ];
    
    for (const db of [kentDb, janeDb]) {
        // Adicionar colunas à tabela accounts
        for (const sql of newAccountColumns) {
            try {
                await runQuery(db, sql);
                console.log(`   ✅ accounts: coluna adicionada`);
            } catch (err) {
                if (!err.message.includes('duplicate column')) {
                    console.log(`   ⚠️ accounts: ${err.message}`);
                }
            }
        }
        
        // Adicionar colunas à tabela scheduled_transfers
        for (const sql of newScheduleColumns) {
            try {
                await runQuery(db, sql);
                console.log(`   ✅ scheduled_transfers: coluna adicionada`);
            } catch (err) {
                if (!err.message.includes('duplicate column')) {
                    console.log(`   ⚠️ scheduled_transfers: ${err.message}`);
                }
            }
        }
        
        // Criar tabelas novas
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS password_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id)
            )
        `);
        
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                success BOOLEAN DEFAULT 0,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id)
            )
        `);
        
        await runQuery(db, `
            CREATE TABLE IF NOT EXISTS scheduled_transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_account_id INTEGER NOT NULL,
                to_account_number TEXT NOT NULL,
                to_bank TEXT NOT NULL,
                to_nib TEXT,
                amount REAL NOT NULL,
                reserved_amount REAL NOT NULL,
                description TEXT,
                transfer_type TEXT DEFAULT 'same',
                mode TEXT DEFAULT 'single',
                frequency TEXT,
                interval_value INTEGER DEFAULT 1,
                max_occurrences INTEGER,
                current_occurrence INTEGER DEFAULT 0,
                scheduled_date TEXT NOT NULL,
                next_scheduled_date TEXT,
                status TEXT DEFAULT 'pending',
                executed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (from_account_id) REFERENCES accounts(id)
            )
        `);
    }
    
    console.log('\n✅ Migração concluída!');
}

if (require.main === module) {
    initDatabase().catch(console.error);
}

module.exports = { initDatabase, migrateExistingDatabases };