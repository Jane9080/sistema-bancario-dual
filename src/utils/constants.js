require('dotenv').config();

module.exports = {
    // Informações dos bancos
    BANKS: {
        KENT: {
            code: 'KENT',
            name: process.env.KENT_BANK_NAME || 'Banco Comercial de Kent',
            color: process.env.KENT_BANK_COLOR || '#1e3a5f',
            accent: process.env.KENT_BANK_ACCENT || '#c9a03d'
        },
        JANE: {
            code: 'JANE',
            name: process.env.JANE_BANK_NAME || 'Banco Popular de Jane',
            color: process.env.JANE_BANK_COLOR || '#0f5b3a',
            accent: process.env.JANE_BANK_ACCENT || '#b0b0b0'
        }
    },
    
    // Taxas
    TAXAS: {
        MESMO_BANCO: 0,
        KENT_PARA_JANE: 100,
        JANE_PARA_KENT: 150,
        LEVANTAMENTO_KENT: 50,
        LEVANTAMENTO_JANE: 75,
        JUROS_KENT: 3.5,
        JUROS_JANE: 4.0
    },
    
    // Limites
    LIMITES: {
        EMPRESTIMO_MAX: 100000,
        TRANSFERENCIA_DIA: 100000,
        MAX_TENTATIVAS_LOGIN: 5,
        TEMPO_BLOQUEIO_MINUTOS: 15
    },
    
    // Moeda
    MOEDA: {
        simbolo: 'CVE',
        nome: 'Escudo Cabo-verdiano',
        decimal: 2
    },
    
    // Status
    STATUS: {
        ACTIVE: 'active',
        BLOCKED: 'blocked',
        INACTIVE: 'inactive',
        PENDING: 'pending',
        COMPLETED: 'completed',
        FAILED: 'failed',
        CANCELLED: 'cancelled'
    },
    
    // Tipos de transação
    TRANSACTION_TYPES: {
        DEPOSIT: 'deposit',
        WITHDRAW: 'withdraw',
        TRANSFER_IN: 'transfer_in',
        TRANSFER_OUT: 'transfer_out',
        LOAN_RECEIVED: 'loan_received',
        LOAN_PAYMENT: 'loan_payment',
        FEE: 'fee'
    }
};