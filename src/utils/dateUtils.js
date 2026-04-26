/**
 * Utilitários para manipulação de datas com fuso horário de Cabo Verde (UTC-1)
 */

/**
 * Retorna a data/hora atual no formato SQLite (YYYY-MM-DD HH:MM:SS)
 * ajustada para o fuso horário de Cabo Verde (UTC-1)
 */
function getCapeVerdeDateTime() {
    const now = new Date();
    
    // Cabo Verde está UTC-1 (sem horário de verão)
    const capeVerdeOffset = -60; // minutos
    
    // Ajustar para o fuso de Cabo Verde
    const localTime = new Date(now.getTime() + (capeVerdeOffset * 60000));
    
    // Formatar para SQLite: YYYY-MM-DD HH:MM:SS
    const year = localTime.getUTCFullYear();
    const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localTime.getUTCDate()).padStart(2, '0');
    const hours = String(localTime.getUTCHours()).padStart(2, '0');
    const minutes = String(localTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Converte uma data UTC do SQLite para objeto Date no fuso de Cabo Verde
 */
function parseCapeVerdeDateTime(dateTimeStr) {
    if (!dateTimeStr) return null;
    
    // Criar data a partir da string UTC
    const utcDate = new Date(dateTimeStr.replace(' ', 'T') + 'Z');
    
    // Cabo Verde está UTC-1
    const capeVerdeOffset = -60;
    const localTime = new Date(utcDate.getTime() + (capeVerdeOffset * 60000));
    
    return localTime;
}

/**
 * Formata uma data para exibição no padrão de Cabo Verde
 */
function formatCapeVerdeDateTime(dateTimeStr) {
    if (!dateTimeStr) return '-';
    
    const date = parseCapeVerdeDateTime(dateTimeStr);
    return date.toLocaleString('pt-CV', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

module.exports = {
    getCapeVerdeDateTime,
    parseCapeVerdeDateTime,
    formatCapeVerdeDateTime
};