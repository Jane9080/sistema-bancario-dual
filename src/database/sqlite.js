const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Garantir que a pasta data existe
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Configuração das bases de dados
const dbConfigs = {
    kent: {
        path: path.join(dataDir, 'kent.db'),
        name: 'Kent Bank'
    },
    jane: {
        path: path.join(dataDir, 'jane.db'),
        name: 'Jane Bank'
    },
    shared: {
        path: path.join(dataDir, 'shared.db'),
        name: 'Shared Database'
    }
};

// Conexões
let kentDb = null;
let janeDb = null;
let sharedDb = null;

function getKentDb() {
    if (!kentDb) {
        kentDb = new sqlite3.Database(dbConfigs.kent.path);
    }
    return kentDb;
}

function getJaneDb() {
    if (!janeDb) {
        janeDb = new sqlite3.Database(dbConfigs.jane.path);
    }
    return janeDb;
}

function getSharedDb() {
    if (!sharedDb) {
        sharedDb = new sqlite3.Database(dbConfigs.shared.path);
    }
    return sharedDb;
}

function getDbByBank(bankCode) {
    switch (bankCode.toLowerCase()) {
        case 'kent':
            return getKentDb();
        case 'jane':
            return getJaneDb();
        default:
            throw new Error(`Banco desconhecido: ${bankCode}`);
    }
}

function runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function closeAllConnections() {
    if (kentDb) kentDb.close();
    if (janeDb) janeDb.close();
    if (sharedDb) sharedDb.close();
}

module.exports = {
    getKentDb,
    getJaneDb,
    getSharedDb,
    getDbByBank,
    closeAllConnections,
    dbConfigs,
    runQuery,
    getQuery,
    allQuery
};