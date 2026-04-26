const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function query(bank, table, select = '*', filters = {}) {
    let q = supabase.from(table).select(select).eq('bank', bank);
    for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, value);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data;
}

async function querySingle(bank, table, filters = {}) {
    let q = supabase.from(table).select('*').eq('bank', bank);
    for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, value);
    }
    const { data, error } = await q.single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
}

async function insertRecord(bank, table, record) {
    record.bank = bank;
    const { data, error } = await supabase.from(table).insert(record).select();
    if (error) throw error;
    return data[0];
}

async function updateRecord(bank, table, filters, updates) {
    let q = supabase.from(table).update(updates).eq('bank', bank);
    for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, value);
    }
    const { data, error } = await q.select();
    if (error) throw error;
    return data;
}

async function deleteRecord(bank, table, filters) {
    let q = supabase.from(table).delete().eq('bank', bank);
    for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, value);
    }
    const { error } = await q;
    if (error) throw error;
    return true;
}

module.exports = { supabase, query, querySingle, insertRecord, updateRecord, deleteRecord };