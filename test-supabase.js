require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function test() {
    console.log('🔵 Testando conexão...');
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('Key:', process.env.SUPABASE_ANON_KEY?.substring(0, 20) + '...');
    
    // Teste 1: Verificar se o Supabase está acessível
    try {
        const { data, error } = await supabase.from('accounts').select('count', { count: 'exact' }).limit(0);
        console.log('Teste 1:', data, error?.message || 'OK');
    } catch(e) {
        console.log('Teste 1 erro:', e.message);
    }
    
    // Teste 2: Verificar se a tabela existe
    try {
        const { data, error } = await supabase.from('accounts').select('id').limit(1);
        console.log('Teste 2:', data, error?.message || 'OK');
    } catch(e) {
        console.log('Teste 2 erro:', e.message);
    }
    
    process.exit(0);
}
test();