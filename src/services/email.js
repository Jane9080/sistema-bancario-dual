const nodemailer = require('nodemailer');

// Configurações dos bancos
const emailConfigs = {
    kent: {
        email: process.env.KENT_EMAIL,
        pass: process.env.KENT_EMAIL_PASS,
        name: 'Banco Comercial de Kent',
        color: '#1e3a5f'
    },
    jane: {
        email: process.env.JANE_EMAIL,
        pass: process.env.JANE_EMAIL_PASS,
        name: 'Banco Popular de Jane',
        color: '#0f5b3a'
    }
};

async function sendResetEmail(bankCode, toEmail, resetLink) {
    const config = emailConfigs[bankCode];
    if (!config) throw new Error('Banco inválido');
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.email,
            pass: config.pass
        }
    });
    
    const mailOptions = {
        from: `"${config.name}" <${config.email}>`,
        to: toEmail,
        subject: '🔐 Recuperação de Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <div style="background: ${config.color}; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h2>${config.name}</h2>
                    <p>Recuperação de Acesso</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px;">
                    <p>Olá,</p>
                    <p>Recebemos um pedido para recuperar a sua password.</p>
                    <p>Clique no botão abaixo para criar uma nova password:</p>
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${resetLink}" style="background: ${config.color}; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            🔐 Redefinir Password
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px;">Este link expira em <strong>15 minutos</strong>.</p>
                    <p style="color: #64748b; font-size: 12px;">Se não pediste este reset, ignora este email.</p>
                    <hr style="margin: 20px 0; border-color: #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; text-align: center;">${config.name} - Todos os direitos reservados</p>
                </div>
            </div>
        `
    };
    
    return transporter.sendMail(mailOptions);
}



// Enviar email com PDF da conta
async function sendAccountEmail(bankCode, toEmail, accountData, pdfBuffer) {
    const config = emailConfigs[bankCode];
    if (!config) throw new Error('Banco inválido');
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.email,
            pass: config.pass
        }
    });
    
    const mailOptions = {
        from: `"${config.name}" <${config.email}>`,
        to: toEmail,
        subject: `🏦 Conta Criada - ${config.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <div style="background: ${config.color}; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h2>${config.name}</h2>
                    <p>Conta Criada com Sucesso</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px;">
                    <p>Olá <strong>${accountData.holder_name}</strong>,</p>
                    <p>A sua conta foi criada com sucesso!</p>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p><strong>📌 Nº Conta:</strong> ${accountData.accountNumber}</p>
                        <p><strong>👤 Username:</strong> ${accountData.username}</p>
                        <p><strong>🔐 Chave de Confirmação:</strong> ${accountData.confirmKey}</p>
                        <p><strong>💳 NIB:</strong> ${accountData.nib}</p>
                        <p><strong>🌍 IBAN:</strong> ${accountData.iban}</p>
                        <p><strong>💰 Saldo:</strong> ${accountData.balance.toLocaleString('pt-CV')} CVE</p>
                    </div>
                    
                    <p style="color: #ef4444;"><strong>⚠️ GUARDE ESTES DADOS EM SEGURANÇA!</strong></p>
                    <p style="color: #64748b;">O PDF com os seus dados bancários está em anexo.</p>
                    
                    <hr style="margin: 20px 0; border-color: #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; text-align: center;">${config.name} - Todos os direitos reservados</p>
                </div>
            </div>
        `,
        attachments: [
            {
                filename: `conta_${accountData.accountNumber}.pdf`,
                content: pdfBuffer
            }
        ]
    };
    
    return transporter.sendMail(mailOptions);
}


// Enviar notificação por email
async function sendNotificationEmail(bankCode, toEmail, subject, title, message) {
    const config = emailConfigs[bankCode];
    if (!config) throw new Error('Banco inválido');
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.email, pass: config.pass }
    });
    
    const mailOptions = {
        from: `"${config.name}" <${config.email}>`,
        to: toEmail,
        subject: `🔔 ${subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <div style="background: ${config.color}; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h2>${config.name}</h2>
                    <p>Notificação</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px;">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <hr style="margin: 20px 0; border-color: #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; text-align: center;">${config.name}</p>
                </div>
            </div>
        `
    };
    
    return transporter.sendMail(mailOptions);
}

module.exports = { sendResetEmail, sendAccountEmail, sendNotificationEmail };
// Adicionar ao module.exports


