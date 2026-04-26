const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const receiptsDir = path.join(__dirname, '../../receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
}

// Função para gerar TXT exatamente como no seu C
function gerarTXTComprovativo(bankCode, receipt) {
    const bankDisplayName = bankCode === 'kent' ? 'Banco Comercial de Kent' : 'Banco Popular de Jane';
    
    let data;
    if (receipt.created_at) {
        data = new Date(receipt.created_at);
        if (isNaN(data.getTime())) data = new Date();
    } else {
        data = new Date();
    }
    
    const dataStr = data.toLocaleDateString('pt-PT');
    const horaStr = data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const toAccountFormatted = receipt.type === 'INTERBANK' ? receipt.to_account : receipt.to_account;
    
    let content = '';
    content += '=======================================================\n';
    content += `                    ${bankDisplayName}\n\n`;
    content += '                COMPROVATIVO DE TRANSFERÊNCIA\n';
    content += '=======================================================\n';
    /*content += `DATA: ${dataStr}      	       HORA: ${horaStr}\n`;
    content += `REF: ${receipt.reference}      ESTADO: ${receipt.status}\n`;*/
// Definir larguras fixas
const dataRefWidth = 35;  // Largura para a parte esquerda
const horaEstadoWidth = 25; // Largura para a parte direita

// DATA e HORA
const dataPart = `DATA: ${dataStr}`;
const horaPart = `HORA: ${horaStr}`;
content += `${dataPart.padEnd(dataRefWidth)}${horaPart.padStart(horaEstadoWidth)}\n`;

// REF e ESTADO
const refPart = `REF: ${receipt.reference}`;
const estadoPart = `ESTADO: ${receipt.status}`;
content += `${refPart.padEnd(dataRefWidth)}${estadoPart.padStart(horaEstadoWidth)}\n`;
    content += '----------------------------------------------------------------------------\n\n';
    content += 'ORIGEM\n';
    content += `Nome: ${receipt.from_name}\n`;
    content += `Conta: ${receipt.from_account}\n\n`;
    content += 'DESTINO\n';
    content += `Nome: ${receipt.to_name}\n`;
    if (receipt.type === 'INTERBANK') {
        content += `NIB: ${toAccountFormatted}\n\n`;
    } else {
        content += `Conta: ${toAccountFormatted}\n\n`;
    }
    content += '----------------------------------------------------------------------------\n';
    content += `VALOR TRANSFERIDO: ${receipt.amount.toFixed(2).padStart(10)} CVE\n`;
    content += `TAXA DE OPERAÇÃO: ${receipt.fee.toFixed(2).padStart(11)} CVE\n`;
    content += `VALOR TOTAL: ${receipt.total.toFixed(2).padStart(16)} CVE\n`;
    content += '----------------------------------------------------------------------------\n';
    content += `            Obrigado por utilizar o ${bankDisplayName}\n`;
    content += '=======================================================\n';
    
    const filename = `comprovativo_${receipt.reference}.txt`;
    const filepath = path.join(receiptsDir, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    
    return filepath;
}

// Função para converter TXT para PDF
async function converterTxtParaPdf(txtPath, pdfPath) {
    return new Promise((resolve, reject) => {
        const content = fs.readFileSync(txtPath, 'utf8');
        const lines = content.split('\n');
        
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(pdfPath);
        
        doc.pipe(stream);
        
        // Usar fonte monoespaçada para manter alinhamento
        doc.font('Courier').fontSize(10);
        
        let y = 50;
        for (const line of lines) {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }
            doc.text(line, 50, y);
            y += 14;
        }
        
        doc.end();
        
        stream.on('finish', () => resolve(pdfPath));
        stream.on('error', reject);
    });
}

// Função principal
async function generateReceiptPDF(bankCode, receipt) {
    // 1. Gerar TXT
    const txtPath = gerarTXTComprovativo(bankCode, receipt);
    
    // 2. Converter para PDF
    const pdfFilename = `comprovativo_${receipt.reference}.pdf`;
    const pdfPath = path.join(receiptsDir, pdfFilename);
    await converterTxtParaPdf(txtPath, pdfPath);
    
    // 3. Apagar o TXT (opcional - comentar se quiser manter)
    // fs.unlinkSync(txtPath);
    
    return { filepath: pdfPath, filename: pdfFilename };
}

module.exports = { generateReceiptPDF };