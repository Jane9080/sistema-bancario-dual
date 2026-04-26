// Validar email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@([^\s@]+\.(cv|com|org|net))$/;
    return emailRegex.test(email);
}

// Validar número de telefone (Cabo Verde)
function isValidPhone(phone) {
    const phoneRegex = /^(\+238)?[2-9][0-9]{6}$/;
    return phoneRegex.test(phone);
}

// Validar valor (positivo)
function isValidAmount(amount) {
    return typeof amount === 'number' && amount > 0 && !isNaN(amount);
}

// Validar conta bancária
function isValidAccountNumber(accountNumber) {
    const accountRegex = /^(KENT|JANE)-[0-9]{8}-[0-9]{4}$/;
    return accountRegex.test(accountNumber);
}

// Validar data (formato DD/MM/YYYY)
function isValidDate(dateStr) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regex.test(dateStr)) return false;
    
    const [, day, month, year] = dateStr.match(regex);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() == year && 
           date.getMonth() == month - 1 && 
           date.getDate() == day;
}

// Validar nome (não vazio, sem caracteres especiais)
function isValidName(name) {
    return name && name.trim().length >= 3 && /^[a-zA-ZÀ-ÿ\s]+$/.test(name);
}

module.exports = {
    isValidEmail,
    isValidPhone,
    isValidAmount,
    isValidAccountNumber,
    isValidDate,
    isValidName
};