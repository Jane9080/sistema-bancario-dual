require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============== MIDDLEWARE ==============
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('src/public'));

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'Muitas requisições. Tente novamente mais tarde.' } });
app.use('/api/', globalLimiter);

// ============== ROTAS ==============
console.log('📦 Carregando rotas...');
const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const adminRoutes = require('./src/routes/admin');
const adminAuthRoutes = require('./src/routes/adminAuth');
console.log('✅ Rotas carregadas: auth, api, admin, adminAuth');

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/temp', express.static('temp'));

// ============== ROTAS DE PÁGINAS ==============
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'index.html')));
app.get('/kent', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'kent.html')));
app.get('/jane', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'jane.html')));
app.get('/admin-kent', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'admin-kent.html')));
app.get('/admin-jane', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'admin-jane.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'admin-login.html')));
app.get('/admin-login-jane', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'admin-login-jane.html')));
app.get('/admin-kent-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'admin-kent-dashboard.html')));
app.get('/admin-jane-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'admin-jane-dashboard.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'src/public', 'reset-password.html')));

app.get('/health', (req, res) => {
    res.json({ status: 'online', timestamp: new Date().toISOString(), banks: { kent: 'Banco Comercial de Kent', jane: 'Banco Popular de Jane' } });
});

// ============== INICIAR SERVIDOR ==============
async function startServer() {
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🏦 SISTEMA BANCÁRIO DUAL - KENT & JANE (SUPABASE)       ║
║   📍 Servidor: http://localhost:${PORT}                        ║
╚══════════════════════════════════════════════════════════════╝
        `);
    });
}

// ========== CRON JOB - TRANSFERÊNCIAS AGENDADAS ==========
const { query, querySingle, updateRecord, insertRecord, supabase } = require('./src/database/supabase');
const { transferSameBankInternal, transferInterBankInternal } = require('./src/services/transfer');

async function executeScheduledTransfers() {
    console.log('⏰ Verificando transferências agendadas...');
    
    for (const bankCode of ['kent', 'jane']) {
        try {
            const { data: pending } = await supabase
                .from('scheduled_transfers')
                .select('*, accounts!inner(holder_name, account_number)')
                .eq('bank', bankCode)
                .eq('status', 'pending')
                .lte('scheduled_date', new Date().toISOString());
            
            if (!pending) continue;
            
            for (const transfer of pending) {
                console.log(`🔄 Executando #${transfer.id}: ${transfer.amount} CVE → ${transfer.to_account_number}`);
                
                try {
                    if (transfer.transfer_type === 'same') {
                        await transferSameBankInternal(bankCode, transfer.from_account_id, transfer.to_account_number, transfer.amount, transfer.description || 'Transferência agendada');
                    } else {
                        await transferInterBankInternal(bankCode, transfer.from_account_id, transfer.to_bank, transfer.to_account_number, transfer.amount, transfer.description || 'Transferência agendada');
                    }
                    
                    await updateRecord(bankCode, 'scheduled_transfers', { id: transfer.id }, { 
                        status: 'executed', 
                        executed_at: new Date().toISOString(),
                        current_occurrence: (transfer.current_occurrence || 0) + 1
                    });
                    
                    // Recorrente
                    if (transfer.mode === 'recurring' && (!transfer.max_occurrences || transfer.current_occurrence < transfer.max_occurrences)) {
                        if (transfer.next_scheduled_date) {
                            const { calculateNextDate } = require('./src/services/auth');
                            const futureDate = calculateNextDate(transfer.next_scheduled_date, transfer.frequency, transfer.interval_value || 1);
                            await updateRecord(bankCode, 'scheduled_transfers', { id: transfer.id }, {
                                scheduled_date: transfer.next_scheduled_date,
                                next_scheduled_date: futureDate,
                                status: 'pending'
                            });
                        }
                    }
                    
                    // Email com comprovativo
                    try {
                        const latestReceipt = await querySingle(bankCode, 'receipts', { account_id: transfer.from_account_id });
                        if (latestReceipt) {
                            const fs = require('fs');
                            const path = require('path');
                            const pdfPath = path.join(__dirname, 'receipts', `comprovativo_${latestReceipt.reference}.pdf`);
                            if (fs.existsSync(pdfPath)) {
                                const pdfBuffer = fs.readFileSync(pdfPath);
                                const nodemailer = require('nodemailer');
                                const config = bankCode === 'kent' 
                                    ? { email: process.env.KENT_EMAIL, pass: process.env.KENT_EMAIL_PASS, name: 'Banco Comercial de Kent', color: '#1e3a5f' }
                                    : { email: process.env.JANE_EMAIL, pass: process.env.JANE_EMAIL_PASS, name: 'Banco Popular de Jane', color: '#0f5b3a' };
                                const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: config.email, pass: config.pass } });
                                const acc = await querySingle(bankCode, 'accounts', { id: transfer.from_account_id });
                                if (acc?.holder_email) {
                                    await transporter.sendMail({
                                        from: `"${config.name}" <${config.email}>`,
                                        to: acc.holder_email,
                                        subject: `📄 Transferência Agendada Executada - ${config.name}`,
                                        html: `<div style="font-family:Arial;max-width:500px;padding:20px;"><h2>${config.name}</h2><p>Transferência de ${transfer.amount.toLocaleString('pt-CV')} CVE executada.</p></div>`,
                                        attachments: [{ filename: `comprovativo_${latestReceipt.reference}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
                                    });
                                }
                            }
                        }
                    } catch(e) { console.log('⚠️ Email:', e.message); }
                    
                    // Notificar
                    await insertRecord(bankCode, 'notifications', {
                        account_id: transfer.from_account_id, type: 'transfer',
                        title: 'Transferência Agendada Executada',
                        message: `Transferência de ${transfer.amount.toLocaleString('pt-CV')} CVE para ${transfer.to_account_number} foi executada.`
                    });
                    
                } catch (execError) {
                    console.error(`❌ Erro #${transfer.id}:`, execError.message);
                    await updateRecord(bankCode, 'scheduled_transfers', { id: transfer.id }, { status: 'failed' });
                    await insertRecord(bankCode, 'notifications', {
                        account_id: transfer.from_account_id, type: 'transfer',
                        title: 'Falha na Transferência Agendada', message: execError.message
                    });
                }
            }
        } catch (err) {
            console.error(`Erro no cron job do banco ${bankCode}:`, err.message);
        }
    }
}

setInterval(executeScheduledTransfers, 60000);
startServer();