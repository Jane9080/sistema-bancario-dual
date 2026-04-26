const { query, querySingle, insertRecord, deleteRecord } = require('../database/supabase');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const receiptsDir = path.join(__dirname, '../../receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
}

async function listReceipts(bankCode, accountId, startDate, endDate) {
    let receipts = await query(bankCode, 'receipts', '*', { account_id: accountId });
    
    if (startDate && endDate) {
        receipts = receipts.filter(r => {
            const date = new Date(r.created_at);
            return date >= new Date(startDate) && date <= new Date(endDate + 'T23:59:59');
        });
    }
    
    return receipts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function getReceipt(bankCode, id) {
    return await querySingle(bankCode, 'receipts', { id });
}

async function deleteReceipt(bankCode, id) {
    const receipt = await getReceipt(bankCode, id);
    if (receipt) {
        const filename = `comprovativo_${receipt.reference}.pdf`;
        const filepath = path.join(receiptsDir, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
    await deleteRecord(bankCode, 'receipts', { id });
}

async function generateReceiptPDF(bankCode, data) {
    return new Promise((resolve, reject) => {
        const filename = `comprovativo_${data.reference}.pdf`;
        const filepath = path.join(receiptsDir, filename);
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filepath);
        
        doc.pipe(stream);
        
        const bankName = bankCode === 'kent' ? 'Banco Comercial de Kent' : 'Banco Popular de Jane';
        const bankColor = bankCode === 'kent' ? '#1e3a5f' : '#0f5b3a';
        
        doc.fontSize(20).fillColor(bankColor).text(bankName, { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).fillColor('#333').text('COMPROVATIVO DE TRANSFERÊNCIA', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).fillColor('#000');
        doc.text(`Data: ${new Date().toLocaleString('pt-PT')}`);
        doc.text(`Referência: ${data.reference}`);
        doc.text(`Tipo: ${data.type === 'SAME_BANK' ? 'Mesmo Banco' : 'Interbancária'}`);
        doc.moveDown();
        doc.text(`De: ${data.from_name} (${data.from_account})`);
        doc.text(`Para: ${data.to_name} (${data.to_account})`);
        doc.moveDown();
        doc.text(`Valor: ${data.amount.toLocaleString('pt-CV')} CVE`);
        doc.text(`Taxa: ${data.fee.toLocaleString('pt-CV')} CVE`);
        doc.text(`Total: ${data.total.toLocaleString('pt-CV')} CVE`);
        doc.text(`Status: ${data.status}`);
        doc.end();
        
        stream.on('finish', () => resolve({ filepath, filename }));
        stream.on('error', reject);
    });
}

module.exports = { listReceipts, getReceipt, deleteReceipt, generateReceiptPDF };