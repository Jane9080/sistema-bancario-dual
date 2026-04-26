const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Garantir que a pasta temp existe
const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Formatar NIB com espaços
function formatNIB(nib) {
    if (!nib) return '';
    if (nib.length === 23) {
        return `${nib.slice(0, 4)} ${nib.slice(4, 8)} ${nib.slice(8, 9)} ${nib.slice(9, 16)} ${nib.slice(16, 19)} ${nib.slice(19, 22)}`;
    } else if (nib.length === 22) {
        return `${nib.slice(0, 4)} ${nib.slice(4, 8)} ${nib.slice(8, 16)} ${nib.slice(16, 19)} ${nib.slice(19, 22)}`;
    }
    return nib;
}

// Gerar PDF com os dados da conta
async function generateAccountPDF(bankCode, accountData) {
    return new Promise((resolve, reject) => {
        const bankDisplayName = bankCode === 'kent' ? 'Banco Comercial de Kent' : 'Banco Popular de Jane';
        const bankColor = bankCode === 'kent' ? '#1e3a5f' : '#0f5b3a';
        
        const nibFormatado = formatNIB(accountData.nib);
        const dataCriacao = new Date().toLocaleDateString('pt-PT');
        
        const filename = `conta_${accountData.accountNumber}.pdf`;
        const filepath = path.join(tempDir, filename);
        
        const doc = new PDFDocument({ margin: 50, size: 'A4', font: 'Helvetica' });
        const stream = fs.createWriteStream(filepath);
        
        doc.pipe(stream);
        
        // Cabeçalho
        doc.fontSize(24)
           .fillColor(bankColor)
           .text(`${bankDisplayName}`, { align: 'center' });
        
        doc.moveDown();
        doc.fontSize(16)
           .fillColor('#333333')
           .text('COMPROVATIVO DE CRIAÇÃO DE CONTA', { align: 'center' });
        
        doc.moveDown();
        doc.strokeColor('#cccccc')
           .lineWidth(1)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();
        
        doc.moveDown();
        
        // Dados da conta
        doc.fontSize(12)
           .fillColor('#000000');
        
        doc.text(`Data de criação: ${dataCriacao}`, { align: 'right' });
        doc.moveDown();
        
        doc.fontSize(14)
           .fillColor(bankColor)
           .text('DADOS DA CONTA', { underline: true });
        
        doc.moveDown(0.5);
        
        doc.fontSize(12).fillColor('#333333');
        doc.text(`Banco: ${bankDisplayName}`);
        doc.text(`Numero de Conta: ${accountData.accountNumber}`);
        doc.text(`Username: ${accountData.username}`);
        doc.text(`Password: ${accountData.password}`);
        doc.text(`Chave de Confirmação: ${accountData.confirmKey}`);
        doc.text(`NIB: ${nibFormatado}`);
        doc.text(`IBAN: ${accountData.iban}`);  // IBAN sem espaços
        doc.text(`Saldo Inicial: ${accountData.balance} CVE`);
        
        doc.moveDown();
        
        // Email do cliente
        if (accountData.email) {
            doc.text(`Email: ${accountData.email}`);
        }
        
        doc.moveDown();
        doc.strokeColor('#cccccc')
           .lineWidth(1)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();
        
        doc.moveDown();
        
        // Instruções
        doc.fontSize(10)
           .fillColor('#666666')
           .text('IMPORTANTE: Guarde este documento em local seguro.', { align: 'center' });
        doc.text('Nunca partilhe a sua password ou chave de confirmação.', { align: 'center' });
        
        doc.end();
        
        stream.on('finish', () => {
    // ✅ Ler o ficheiro como buffer para enviar por email
    const pdfBuffer = fs.readFileSync(filepath);
    resolve({ filepath, filename, buffer: pdfBuffer });
});
        
        stream.on('error', reject);
    });
}

module.exports = { generateAccountPDF };