// Configuração
const API_BASE = '/api';
const BANK_CODE = 'kent';
let currentAccountId = null;
let currentToken = null;

// Elementos DOM
const authState = document.getElementById('authState');
const loggedInView = document.getElementById('loggedInView');
const notLoggedInView = document.getElementById('notLoggedInView');
const registerView = document.getElementById('registerView');
const recoverView = document.getElementById('recoverView');
const balanceAmount = document.getElementById('balanceAmount');
const userName = document.getElementById('userName');

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) { alert(message); return; }
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function apiRequest(endpoint, method, data = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    const options = { method, headers, credentials: 'include' };
    if (data) options.body = JSON.stringify(data);
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro na requisição');
        return result;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

async function checkAuth() {
    const token = localStorage.getItem(`${BANK_CODE}_token`);
    if (token) {
        currentToken = token;
        try {
            const result = await apiRequest('/auth/verify', 'GET');
            if (result.authenticated) {
                currentAccountId = result.user.accountId;
                await loadAccountData();
                await loadProfile();  // <--- ADICIONAR ESTA LINHA
                showLoggedIn();
                return;
            }
        } catch (error) { console.error(error); }
    }
    showLoggedOut();
}

async function loadAccountData() {
    try {
        const account = await apiRequest(`/accounts/${BANK_CODE}/${currentAccountId}`, 'GET');
        if (balanceAmount) balanceAmount.textContent = account.balance.toLocaleString('pt-CV', { minimumFractionDigits: 2 });
        if (userName) userName.textContent = account.holder_name;
        await loadTransactions();
        await loadLoanStatus();
        await loadProfile();  // <--- ADICIONAR ESTA LINHA
    } catch (error) {
        showToast('Erro ao carregar dados da conta', 'error');
    }
}

async function loadTransactions() {
    try {
        const transactions = await apiRequest(`/transactions/${BANK_CODE}/${currentAccountId}`, 'GET');
        const container = document.getElementById('transactionsList');
        if (!container) return;
        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center;">Nenhuma transação encontrada</p>';
            return;
        }
        container.innerHTML = transactions.map(t => `
            <div style="padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                <div>
                    <div style="font-weight: 500;">${t.type === 'transfer_in' ? 'Recebido' : t.type === 'transfer_out' ? 'Enviado' : t.type === 'deposit' ? 'Depósito' : t.type === 'withdraw' ? 'Levantamento' : t.type}</div>
                    <div style="font-size: 11px; color: #64748b;">${new Date(t.created_at).toLocaleString('pt-CV')}</div>
                    ${t.description ? `<div style="font-size: 11px;">${t.description}</div>` : ''}
                </div>
                <div style="font-weight: 600; color: ${t.type === 'transfer_in' || t.type === 'deposit' ? '#10b981' : '#ef4444'}">
                    ${t.type === 'transfer_in' || t.type === 'deposit' ? '+' : '-'} ${t.amount.toLocaleString('pt-CV')} CVE
                </div>
            </div>
        `).join('');
    } catch (error) { console.error(error); }
}

async function doLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) { 
        showToast('Preencha email e password', 'error'); 
        return; 
    }
    
    try {
        const result = await apiRequest(`/auth/login/${BANK_CODE}`, 'POST', { email, password });
        if (result.success) {
            currentToken = result.token;
            currentAccountId = result.user.id;
            localStorage.setItem(`${BANK_CODE}_token`, currentToken);
            showToast('Login efetuado com sucesso!', 'success');
            await checkAuth();
        }
    } catch (error) {
        // ✅ TRATAMENTO ESPECÍFICO DE ERROS
        const errorMsg = error.message || 'Erro no login';
        
        if (errorMsg.includes('BLOCKED')) {
            showToast('🔒 Conta bloqueada. Contacte o suporte.', 'error');
        } else if (errorMsg.includes('INACTIVE')) {
            showToast('⏸️ Conta inativa. Contacte o suporte.', 'error');
        } else if (errorMsg.includes('INCORRECT')) {
            // Extrair número da tentativa
            const match = errorMsg.match(/Tentativa (\d+) de 5/);
            const tentativa = match ? match[1] : '';
            showToast(`❌ Password incorreta. Tentativa ${tentativa} de 5.`, 'error');
        } else if (errorMsg.includes('não encontrado') || errorMsg.includes('Email')) {
            showToast('❌ Email não registado.', 'error');
        } else {
            showToast('❌ ' + errorMsg, 'error');
        }
    }
}




async function doRegister() {

    const name = document.getElementById('regName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const phone = document.getElementById('regPhone')?.value;
    const motherName = document.getElementById('regMotherName')?.value;
    const fatherName = document.getElementById('regFatherName')?.value;
    const age = document.getElementById('regAge')?.value;
    const birthDate = document.getElementById('regBirthDate')?.value;
    const maritalStatus = document.getElementById('regMaritalStatus')?.value;
    const passport = document.getElementById('regPassport')?.value;
    const nif = document.getElementById('regNif')?.value;
    const address = document.getElementById('regAddress')?.value;
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    
    // ✅ NOVO - Perguntas de segurança
    const securityQuestion1 = document.getElementById('securityQuestion1')?.value;
    const securityAnswer1 = document.getElementById('securityAnswer1')?.value;
    const securityQuestion2 = document.getElementById('securityQuestion2')?.value;
    const securityAnswer2 = document.getElementById('securityAnswer2')?.value;
    const securityQuestion3 = document.getElementById('securityQuestion3')?.value;
    const securityAnswer3 = document.getElementById('securityAnswer3')?.value;
    
    if (!name || !email) { showToast('Preencha nome e email (obrigatórios)', 'error'); return; }
    if (!email.includes('@')) { showToast('Email inválido', 'error'); return; }
    if (password && password !== confirmPassword) { showToast('Passwords não coincidem', 'error'); return; }
    if (password && password.length < 6) { showToast('Password deve ter pelo menos 6 caracteres', 'error'); return; }
    
       try {
        const result = await apiRequest(`/auth/register/${BANK_CODE}`, 'POST', {
            holder_name: name,
            holder_email: email,
            holder_phone: phone,
            mother_name: motherName,
            father_name: fatherName,
            age: age ? parseInt(age) : null,
            birth_date: birthDate,
            marital_status: maritalStatus,
            passport_number: passport,
            nif: nif,
            address: address,
            password: password || null,
            security_question_1: securityQuestion1 || null,
            security_answer_1: securityAnswer1 || null,
            security_question_2: securityQuestion2 || null,
            security_answer_2: securityAnswer2 || null,
            security_question_3: securityQuestion3 || null,
            security_answer_3: securityAnswer3 || null
        });
     
        if (result.success) {
            // ✅ Mostrar mensagem de sucesso (sem download)
            showToast('✅ Conta criada! Verifique o seu email com o PDF.', 'success');
            
            // Mostrar dados importantes no ecrã
            const accountInfo = `
                📋 CONTA CRIADA COM SUCESSO!
                
                🏦 Banco: ${BANK_CODE.toUpperCase()}
                📌 Conta: ${result.accountNumber}
                👤 Username: ${result.username}
                
                📧 O PDF com todos os dados foi enviado para o seu email.
                ⚠️ Guarde-o em segurança!
            `;
            alert(accountInfo);
            
            showLoginForm();
        }
    } catch (error) { showToast(error.message, 'error'); }
}

async function doDeposit() {
    const inputValue = prompt('Digite o valor para depositar (CVE):');
    
    // Verificar se o input é vazio
    if (!inputValue) {
        showToast('Operação cancelada', 'info');
        return;
    }
    
    // Verificar se contém apenas números (sem letras)
    if (!/^\d+(\.\d+)?$/.test(inputValue)) {
        showToast('Valor inválido. Use apenas números!', 'error');
        return;
    }
    
    const amount = parseFloat(inputValue);
    if (amount <= 0) {
        showToast('Valor deve ser maior que zero', 'error');
        return;
    }
    
    try {
        const result = await apiRequest(`/deposit/${BANK_CODE}`, 'POST', { amount, description: 'Depósito via app' });
        if (result.success) { showToast(result.message); await loadAccountData(); }
    } catch (error) { showToast(error.message, 'error'); }
}

async function doWithdraw() {
    const inputValue = prompt('Digite o valor para levantar (CVE):');
    
    // Verificar se o input é vazio
    if (!inputValue) {
        showToast('Operação cancelada', 'info');
        return;
    }
    
    // Verificar se contém apenas números (sem letras)
    if (!/^\d+(\.\d+)?$/.test(inputValue)) {
        showToast('Valor inválido. Use apenas números!', 'error');
        return;
    }
    
    const amount = parseFloat(inputValue);
    if (amount <= 0) {
        showToast('Valor deve ser maior que zero', 'error');
        return;
    }
    
    try {
        const result = await apiRequest(`/withdraw/${BANK_CODE}`, 'POST', { amount, description: 'Levantamento via app' });
        if (result.success) { showToast(result.message); await loadAccountData(); }
    } catch (error) { showToast(error.message, 'error'); }
}

// ========== MODO DE TRANSFERÊNCIA (IMEDIATO OU AGENDADO) ==========

function setupTransferMode() {
    const modeSelect = document.getElementById('transferMode');
    const scheduleFields = document.getElementById('scheduleFields');
    const transferBtnText = document.getElementById('transferBtnText');
    const scheduleModeSelect = document.getElementById('scheduleMode');
    const singleFields = document.getElementById('singleDateFields');
    const recurringFields = document.getElementById('recurringFields');
    
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            if (modeSelect.value === 'scheduled') {
                scheduleFields.style.display = 'block';
                transferBtnText.textContent = '📅 Agendar';
            } else {
                scheduleFields.style.display = 'none';
                transferBtnText.textContent = '📤 Transferir';
            }
        });
    }
    
    if (scheduleModeSelect) {
        scheduleModeSelect.addEventListener('change', () => {
            if (scheduleModeSelect.value === 'recurring') {
                singleFields.style.display = 'none';
                recurringFields.style.display = 'block';
            } else {
                singleFields.style.display = 'block';
                recurringFields.style.display = 'none';
            }
        });
    }
}

// Atualizar doTransfer() para suportar agendamento
async function doTransfer() {
    const transferType = document.getElementById('transferType')?.value;
    const destinationAccount = document.getElementById('destinationAccount')?.value;
    const amount = parseFloat(document.getElementById('transferAmount')?.value);
    const description = document.getElementById('transferDescription')?.value;
    const transferMode = document.getElementById('transferMode')?.value || 'immediate';
    
    if (!destinationAccount || !amount || amount <= 0) {
        showToast('Preencha todos os campos', 'error');
        return;
    }
    
    const confirmKey = await promptConfirmKey();
    if (!confirmKey) { showToast('Operação cancelada', 'info'); return; }
    
    // ✅ MODO AGENDADO
    if (transferMode === 'scheduled') {
        const scheduleMode = document.getElementById('scheduleMode')?.value;
        let scheduledDate, scheduledTime;
        
        if (scheduleMode === 'single') {
            scheduledDate = document.getElementById('transferScheduleDate')?.value;
            scheduledTime = document.getElementById('transferScheduleTime')?.value;
        } else {
            scheduledDate = document.getElementById('transferFirstDate')?.value;
            scheduledTime = document.getElementById('transferRecurringTime')?.value;
        }
        
        if (!scheduledDate) {
            showToast('Selecione uma data', 'error');
            return;
        }
        
        const data = {
            transferType: transferType,
            toAccount: destinationAccount,
            toBank: transferType === 'inter' ? (BANK_CODE === 'kent' ? 'jane' : 'kent') : BANK_CODE,
            toNib: transferType === 'inter' ? destinationAccount : null,
            amount: amount,
            mode: scheduleMode,
            scheduledDate: scheduledDate,
            scheduledTime: scheduledTime || '00:00',
            description: description,
            confirmKey: confirmKey
        };
        
        if (scheduleMode === 'recurring') {
            data.frequency = document.getElementById('transferFrequency')?.value;
            data.maxOccurrences = parseInt(document.getElementById('transferOccurrences')?.value) || 12;
        }
        
        try {
            const result = await apiRequest(`/schedule-transfer/${BANK_CODE}`, 'POST', data);
            if (result.success) {
                showToast(result.message, 'success');
                document.getElementById('destinationAccount').value = '';
                document.getElementById('transferAmount').value = '';
                document.getElementById('transferDescription').value = '';
                await loadScheduledTransfers();
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
        return;
    }
    
    // ✅ MODO IMEDIATO (original)
    try {
        let result;
        if (transferType === 'same') {
            result = await apiRequest(`/transfer/same/${BANK_CODE}`, 'POST', {
                to_account: destinationAccount, amount, description, confirm_key: confirmKey
            });
        } else {
            result = await apiRequest(`/transfer/inter/${BANK_CODE}`, 'POST', {
                to_bank: 'jane', to_account: destinationAccount, amount, description, confirm_key: confirmKey
            });
        }
        if (result.success) {
            showToast(result.message);
            await loadAccountData();
            document.getElementById('destinationAccount').value = '';
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferDescription').value = '';
        }
    } catch (error) { showToast(error.message, 'error'); }
}

// ========== CANCELAR TODOS OS AGENDAMENTOS ==========
async function cancelAllSchedules() {
    if (!confirm('Tem certeza que deseja CANCELAR todos os agendamentos pendentes? As reservas serão libertadas.')) return;
    
    try {
        const transfers = await apiRequest(`/scheduled-transfers/${BANK_CODE}`, 'GET');
        const pending = transfers.filter(t => t.status === 'pending');
        
        if (pending.length === 0) {
            showToast('Nenhum agendamento pendente', 'info');
            return;
        }
        
        for (const t of pending) {
            try {
                await apiRequest(`/scheduled-transfer/${BANK_CODE}/${t.id}`, 'DELETE');
            } catch (e) {
                console.error('Erro ao cancelar:', t.id, e);
            }
        }
        
        showToast(`${pending.length} agendamentos cancelados!`, 'success');
        await loadScheduledTransfers();
        await loadAccountData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ========== LIMPAR LISTA (remover histórico) ==========
async function clearSchedulesList() {
    if (!confirm('Limpar agendamentos já executados/cancelados da lista?')) return;
    
    try {
        const transfers = await apiRequest(`/scheduled-transfers/${BANK_CODE}`, 'GET');
        const toDelete = transfers.filter(t => t.status !== 'pending');
        
        if (toDelete.length === 0) {
            showToast('Nada para limpar', 'info');
            return;
        }
        
        for (const t of toDelete) {
            try {
                await apiRequest(`/scheduled-transfer/${BANK_CODE}/${t.id}`, 'DELETE');
            } catch (e) {
                console.error('Erro ao remover:', t.id, e);
            }
        }
        
        showToast('Lista limpa!', 'success');
        await loadScheduledTransfers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function promptConfirmKey() {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        modalTitle.innerHTML = '<i class="fas fa-shield-alt"></i> Confirmação de Segurança';
        modalBody.innerHTML = `
            <div class="input-group"><label>Digite a sua Chave de Confirmação</label><input type="password" id="confirmKeyInput" placeholder="•••••••" maxlength="7" autocomplete="off" style="text-align: center; letter-spacing: 4px; font-size: 18px;"><small>A chave de confirmação tem 7 dígitos</small></div>
            <div class="modal-buttons"><button class="btn btn-primary" id="confirmKeyOk">Confirmar</button><button class="btn btn-outline" id="confirmKeyCancel">Cancelar</button></div>
        `;
        modal.style.display = 'flex';
        const input = document.getElementById('confirmKeyInput');
        if (input) input.focus();
        document.getElementById('confirmKeyOk').onclick = () => { modal.style.display = 'none'; resolve(input ? input.value : ''); };
        document.getElementById('confirmKeyCancel').onclick = () => { modal.style.display = 'none'; resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { modal.style.display = 'none'; resolve(null); } };
    });
}

async function doStatement() {
    try {
        await loadTransactions();
        document.querySelectorAll('.tab-btn').forEach(btn => { if (btn.dataset.tab === 'history') btn.click(); });
        showToast('Extrato atualizado', 'success');
    } catch (error) { showToast(error.message, 'error'); }
}

async function doChangePassword() {
    const currentPassword = prompt('Digite a sua password atual:');
    if (!currentPassword) return;
    const newPassword = prompt('Digite a nova password:');
    if (!newPassword || newPassword.length < 6) { showToast('Password deve ter pelo menos 6 caracteres', 'error'); return; }
    const confirmNew = prompt('Confirme a nova password:');
    if (newPassword !== confirmNew) { showToast('Passwords não coincidem', 'error'); return; }
    try {
        const result = await apiRequest(`/auth/change-password/${BANK_CODE}`, 'POST', { currentPassword, newPassword });
        if (result.success) showToast('Password alterada com sucesso!');
    } catch (error) { showToast(error.message, 'error'); }
}

// ========== FUNÇÕES DE EMPRÉSTIMO ==========
const loanInterestRate = BANK_CODE === 'kent' ? 3.5 : 4.0;

function calculateLoan() {
    const amount = parseFloat(document.getElementById('loanAmount')?.value) || 0;
    const parcels = parseInt(document.getElementById('loanParcels')?.value) || 1;
    const rate = loanInterestRate;
    
    const interestSpan = document.getElementById('interestRate');
    if (interestSpan) interestSpan.textContent = rate;
    
    if (amount <= 0) {
        document.getElementById('monthlyPayment').textContent = '0';
        document.getElementById('totalPayment').textContent = '0';
        return;
    }
    
    const monthlyRate = rate / 100;
    let monthlyPayment;
    if (monthlyRate === 0) {
        monthlyPayment = amount / parcels;
    } else {
        const factor = Math.pow(1 + monthlyRate, parcels);
        monthlyPayment = amount * (monthlyRate * factor) / (factor - 1);
    }
    const totalPayment = monthlyPayment * parcels;
    
    document.getElementById('monthlyPayment').textContent = monthlyPayment.toFixed(2);
    document.getElementById('totalPayment').textContent = totalPayment.toFixed(2);
}

async function doRequestLoan() {
    const amount = parseFloat(document.getElementById('loanAmount')?.value);
    const months = parseInt(document.getElementById('loanParcels')?.value);
    
    if (!amount || amount <= 0 || amount > 100000) {
        showToast('Valor inválido. Máximo 100.000 CVE', 'error');
        return;
    }
    
    const confirmKey = await promptConfirmKey();
    if (!confirmKey) {
        showToast('Operação cancelada', 'info');
        return;
    }
    
    try {
        const result = await apiRequest(`/loan/request/${BANK_CODE}`, 'POST', {
            amount: amount,
            months: months,
            confirm_key: confirmKey
        });
        
        if (result.success) {
            showToast(result.message);
            await loadAccountData();
            document.getElementById('loanAmount').value = '';
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function doPayLoan() {
    const confirmKey = await promptConfirmKey();
    if (!confirmKey) {
        showToast('Operação cancelada', 'info');
        return;
    }
    
    try {
        const result = await apiRequest(`/loan/pay/${BANK_CODE}`, 'POST', {
            confirm_key: confirmKey
        });
        
        if (result.success) {
            showToast(result.message);
            await loadAccountData();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}
// Carregar dados do perfil (Informações Pessoais e Bancárias)
async function loadProfile() {
    try {
        const profile = await apiRequest(`/profile/${BANK_CODE}`, 'GET');
        const container = document.getElementById('profileInfo');
        
        if (!container) return;
        
        container.innerHTML = `
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px;">
                <h3 style="margin-bottom: 10px;">📋 INFORMAÇÕES PESSOAIS</h3>
                <p><strong>👤 Nome Completo:</strong> ${profile.holder_name}</p>
                <p><strong>📧 Email:</strong> ${profile.holder_email}</p>
                <p><strong>📞 Telefone:</strong> ${profile.holder_phone || 'Não informado'}</p>
                <p><strong>📅 Data de Nascimento:</strong> ${profile.birth_date || 'Não informado'}</p>
                <p><strong>🎂 Idade:</strong> ${profile.age || 'Não informado'}</p>
                <p><strong>💍 Estado Civil:</strong> ${profile.marital_status || 'Não informado'}</p>
                <p><strong>🆔 NIF:</strong> ${profile.nif || 'Não informado'}</p>
                <p><strong>🛂 Passaporte:</strong> ${profile.passport_number || 'Não informado'}</p>
                <p><strong>📍 Endereço:</strong> ${profile.address || 'Não informado'}</p>
                <p><strong>👩 Nome da Mãe:</strong> ${profile.mother_name || 'Não informado'}</p>
                <p><strong>👨 Nome do Pai:</strong> ${profile.father_name || 'Não informado'}</p>
                
                <hr style="margin: 15px 0;">
                
                <h3 style="margin-bottom: 10px;">🏦 DADOS BANCÁRIOS</h3>
                <p><strong>🏦 Número de Conta:</strong> ${profile.account_number}</p>
                <p><strong>👤 Username:</strong> ${profile.username}</p>
                <p><strong>🔐 Chave de Confirmação:</strong> ${profile.confirm_key}</p>
                <p><strong>💳 NIB:</strong> ${profile.nib || 'Não informado'}</p>
                <p><strong>🌍 IBAN:</strong> ${profile.iban || 'Não informado'}</p>
                <p><strong>💰 Saldo:</strong> ${profile.balance.toLocaleString('pt-CV')} CVE</p>
                <p><strong>📅 Data de Criação:</strong> ${new Date(profile.created_at).toLocaleDateString('pt-CV')}</p>
                <p><strong>📌 Status da Conta:</strong> ${profile.status === 'active' ? '✅ Ativo' : '❌ Inativo'}</p>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        const container = document.getElementById('profileInfo');
        if (container) {
            container.innerHTML = '<p style="color: #ef4444;">Erro ao carregar dados do perfil</p>';
        }
    }
}

async function loadLoanStatus() {
    try {
        const result = await apiRequest(`/loan/status/${BANK_CODE}`, 'GET');
        const container = document.getElementById('loanStatus');
        const payBtn = document.getElementById('payLoanBtn');
        
        if (!result.hasLoan) {
            container.innerHTML = '<p style="color: #64748b; text-align: center;">Nenhum empréstimo ativo</p>';
            if (payBtn) payBtn.style.display = 'none';
            return;
        }
        
        const loan = result.loan;
        container.innerHTML = `
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px;">
                <p><strong>💰 Valor Emprestado:</strong> ${loan.amount} CVE</p>
                <p><strong>📉 Saldo Devedor:</strong> ${loan.remainingBalance} CVE</p>
                <p><strong>📅 Parcela Mensal:</strong> ${loan.monthlyPayment} CVE</p>
                <p><strong>📊 Parcelas Pagas:</strong> ${loan.paidParcels} / ${loan.totalParcels}</p>
                <p><strong>📈 Taxa de Juros:</strong> ${loan.interestRate}% ao mês</p>
                <p><strong>📆 Próximo Vencimento:</strong> ${loan.nextDueDate || 'Empréstimo quitado'}</p>
                <p><strong>📌 Status:</strong> ${loan.status === 'active' ? '✅ Ativo' : '✅ Quitado'}</p>
            </div>
        `;
        
        if (payBtn) {
            payBtn.style.display = loan.status === 'active' ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Erro ao carregar estado do empréstimo:', error);
    }
}

// ========== UI VIEWS ==========
async function showLoggedIn() {
    await loadProfile();
    await loadReceipts();
    await loadSecurityQuestions();  // ✅ ADICIONAR ESTA LINHA
    await loadScheduledTransfers();  // ✅ NOVO


    if (authState) authState.style.display = 'block';
    if (loggedInView) loggedInView.style.display = 'block';
    if (notLoggedInView) notLoggedInView.style.display = 'none';
    if (registerView) registerView.style.display = 'none';
    if (recoverView) recoverView.style.display = 'none';
}

function showLoggedOut() {
    if (authState) authState.style.display = 'block';
    if (loggedInView) loggedInView.style.display = 'none';
    if (notLoggedInView) notLoggedInView.style.display = 'block';
    if (registerView) registerView.style.display = 'none';
    if (recoverView) recoverView.style.display = 'none';
    currentToken = null;
    currentAccountId = null;
    localStorage.removeItem(`${BANK_CODE}_token`);
}

function showRegisterForm() {
    if (notLoggedInView) notLoggedInView.style.display = 'none';
    if (registerView) registerView.style.display = 'block';
    if (recoverView) recoverView.style.display = 'none';
}

function showLoginForm() {
    if (notLoggedInView) notLoggedInView.style.display = 'block';
    if (registerView) registerView.style.display = 'none';
    if (recoverView) recoverView.style.display = 'none';
}


function showRecoverForm() {
    if (notLoggedInView) notLoggedInView.style.display = 'none';
    if (registerView) registerView.style.display = 'none';
    if (recoverView) recoverView.style.display = 'block';
}


function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            const targetTab = document.getElementById(`${tabId}Tab`);
            if (targetTab) targetTab.classList.add('active');
        });
    });
}

async function doLogout() {
    try { await apiRequest('/auth/logout', 'POST'); } catch (error) { console.error(error); }
    showLoggedOut();
    window.location.reload();
}
// Carregar lista de comprovativos
async function loadReceipts(startDate = '', endDate = '') {
    try {
        let url = `/receipts/${BANK_CODE}`;
        if (startDate && endDate) {
            url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        
        const receipts = await apiRequest(url, 'GET');
        const container = document.getElementById('receiptsList');
        
        if (!container) return;
        
        if (!receipts || receipts.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center;">Nenhum comprovativo encontrado</p>';
            return;
        }
        
        container.innerHTML = receipts.map(r => `
            <div style="background: #f8fafc; padding: 12px; border-radius: 10px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <p><strong>📄 REF:</strong> ${r.reference}</p>
                        <p><strong>📅 Data:</strong> ${new Date(r.created_at).toLocaleString('pt-CV')}</p>
                        <p><strong>💰 Valor:</strong> ${r.amount.toFixed(2)} CVE</p>
                        <p><strong>🏦 Destino:</strong> ${r.to_name}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" onclick="downloadReceipt(${r.id})" style="padding: 8px 12px; width: auto;">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-outline" onclick="viewReceipt(${r.id})" style="padding: 8px 12px; width: auto;">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-danger" onclick="deleteReceipt(${r.id})" style="padding: 8px 12px; width: auto;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar comprovativos:', error);
    }
}

// Visualizar comprovativo (abre no navegador)
async function viewReceipt(receiptId) {
    try {
        // Abrir numa nova aba para visualização
        window.open(`/api/receipts/${BANK_CODE}/view/${receiptId}`, '_blank');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Download do comprovativo (baixa o ficheiro)
async function downloadReceipt(receiptId) {
    try {
        // Forçar download
        const link = document.createElement('a');
        link.href = `/api/receipts/${BANK_CODE}/download/${receiptId}`;
        link.download = `comprovativo_${receiptId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        showToast(error.message, 'error');
    }
}
// Eliminar comprovativo
async function deleteReceipt(receiptId) {
    if (!confirm('Tem certeza que deseja eliminar este comprovativo?')) return;
    
    try {
        const result = await apiRequest(`/receipts/${BANK_CODE}/${receiptId}`, 'DELETE');
        if (result.success) {
            showToast('Comprovativo eliminado com sucesso');
            await loadReceipts();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}
// Filtrar comprovativos por data
document.getElementById('filterReceiptsBtn')?.addEventListener('click', () => {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    loadReceipts(startDate, endDate);
});


// ========== NOTIFICAÇÕES ==========

// Carregar notificações não lidas
async function loadNotifications() {
    try {
        const result = await apiRequest(`/notifications/unread/${BANK_CODE}`, 'GET');
        const badge = document.getElementById('notificationsBadge');
        
        if (badge) {
            if (result.unreadCount > 0) {
                badge.textContent = result.unreadCount > 9 ? '9+' : result.unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar notificações:', error);
    }
}

// Mostrar lista de notificações (dropdown)
async function showNotificationsList() {
    try {
        const result = await apiRequest(`/notifications/all/${BANK_CODE}`, 'GET');
        const notifications = result.notifications;
        
        if (notifications.length === 0) {
            alert('📭 Nenhuma notificação');
            return;
        }
        
        let message = '📋 NOTIFICAÇÕES\n\n';
        for (const n of notifications) {
            const status = n.read === 0 ? '🔴 NOVA' : '📖 LIDA';
            message += `${status}\n`;
            message += `📌 ${n.title}\n`;
            message += `📝 ${n.message}\n`;
            message += `📅 ${new Date(n.created_at + 'Z').toLocaleString()}\n`;
            message += `${'─'.repeat(30)}\n`;
        }
        
        message += '\n🔴 = Não lida | 📖 = Lida';
        alert(message);
        
        // Marcar todas como lidas após visualizar
        await apiRequest(`/notifications/read-all/${BANK_CODE}`, 'PUT');
        await loadNotifications();
    } catch (error) {
        console.error('Erro ao mostrar notificações:', error);
        alert('Erro ao carregar notificações');
    }
}
//XXXXXXXXXXXXXXXXXXXXXx


// ========== PERGUNTAS DE SEGURANÇA ==========

// Carregar perguntas de segurança
async function loadSecurityQuestions() {
    try {
        const result = await apiRequest(`/security-questions/${BANK_CODE}`, 'GET');
        const container = document.getElementById('securityQuestionsDisplay');
        
        if (!result.isComplete) {
            container.innerHTML = `
                <div style="background: #fef3c7; padding: 15px; border-radius: 12px; text-align: center;">
                    <p style="color: #92400e;">⚠️ Nenhuma pergunta de segurança configurada.</p>
                    <p style="color: #92400e; font-size: 13px; margin-top: 10px;">Configure agora para proteger a sua conta.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div style="background: #f8fafc; padding: 15px; border-radius: 12px;">';
        html += '<h4 style="margin-bottom: 15px;">📋 Perguntas de Segurança Configuradas</h4>';
        
        if (result.questions[0]) {
            html += `<p><strong>Pergunta 1:</strong> ${result.questions[0]}</p>`;
            html += `<p><strong>Resposta:</strong> ******** (oculta)</p><br>`;
        }
        if (result.questions[1]) {
            html += `<p><strong>Pergunta 2:</strong> ${result.questions[1]}</p>`;
            html += `<p><strong>Resposta:</strong> ******** (oculta)</p><br>`;
        }
        if (result.questions[2]) {
            html += `<p><strong>Pergunta 3:</strong> ${result.questions[2]}</p>`;
            html += `<p><strong>Resposta:</strong> ******** (oculta)</p>`;
        }
        
        if (result.updatedAt) {
            html += `<p style="margin-top: 15px; font-size: 12px; color: #64748b;">Última atualização: ${new Date(result.updatedAt + ' UTC').toLocaleString('pt-PT')}</p>`;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar perguntas:', error);
        document.getElementById('securityQuestionsDisplay').innerHTML = '<p style="color: #ef4444;">Erro ao carregar</p>';
    }
}

// Mostrar modal para alterar perguntas
function showChangeSecurityModal() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.innerHTML = '<i class="fas fa-shield-alt"></i> Alterar Perguntas de Segurança';
    modalBody.innerHTML = `
        <div class="input-group">
            <label>🔐 Password Atual *</label>
            <input type="password" id="modalCurrentPassword" placeholder="••••••••">
        </div>
        
        <hr style="margin: 20px 0;">
        
        <div class="input-group">
            <label>Pergunta 1 *</label>
            <select id="modalQuestion1">
                <option value="">Escolha uma pergunta...</option>
                <option value="Qual o nome da sua mãe?">Qual o nome da sua mãe?</option>
                <option value="Qual o nome do seu pai?">Qual o nome do seu pai?</option>
                <option value="Qual o nome da sua primeira escola?">Qual o nome da sua primeira escola?</option>
                <option value="Qual o nome do seu animal de estimação?">Qual o nome do seu animal de estimação?</option>
                <option value="Qual a sua comida favorita?">Qual a sua comida favorita?</option>
                <option value="Qual o nome da sua cidade natal?">Qual o nome da sua cidade natal?</option>
            </select>
            <input type="text" id="modalAnswer1" placeholder="Resposta" style="margin-top: 8px;">
        </div>
        
        <div class="input-group">
            <label>Pergunta 2 *</label>
            <select id="modalQuestion2">
                <option value="">Escolha uma pergunta...</option>
                <option value="Qual o nome da sua mãe?">Qual o nome da sua mãe?</option>
                <option value="Qual o nome do seu pai?">Qual o nome do seu pai?</option>
                <option value="Qual o nome da sua primeira escola?">Qual o nome da sua primeira escola?</option>
                <option value="Qual o nome do seu animal de estimação?">Qual o nome do seu animal de estimação?</option>
                <option value="Qual a sua comida favorita?">Qual a sua comida favorita?</option>
                <option value="Qual o nome da sua cidade natal?">Qual o nome da sua cidade natal?</option>
            </select>
            <input type="text" id="modalAnswer2" placeholder="Resposta" style="margin-top: 8px;">
        </div>
        
        <div class="input-group">
            <label>Pergunta 3 *</label>
            <select id="modalQuestion3">
                <option value="">Escolha uma pergunta...</option>
                <option value="Qual o nome da sua mãe?">Qual o nome da sua mãe?</option>
                <option value="Qual o nome do seu pai?">Qual o nome do seu pai?</option>
                <option value="Qual o nome da sua primeira escola?">Qual o nome da sua primeira escola?</option>
                <option value="Qual o nome do seu animal de estimação?">Qual o nome do seu animal de estimação?</option>
                <option value="Qual a sua comida favorita?">Qual a sua comida favorita?</option>
                <option value="Qual o nome da sua cidade natal?">Qual o nome da sua cidade natal?</option>
            </select>
            <input type="text" id="modalAnswer3" placeholder="Resposta" style="margin-top: 8px;">
        </div>
        
        <hr style="margin: 20px 0;">
        
        <div class="input-group">
            <label>🔑 Chave de Confirmação *</label>
            <input type="password" id="modalConfirmKey" placeholder="7 dígitos" maxlength="7">
            <small>A chave de confirmação encontra-se no PDF da sua conta</small>
        </div>
        
        <div class="modal-buttons">
            <button class="btn btn-primary" id="confirmSecurityChange">Confirmar</button>
            <button class="btn btn-outline" id="cancelSecurityChange">Cancelar</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    document.getElementById('confirmSecurityChange').onclick = async () => {
        await updateSecurityQuestions();
    };
    
    document.getElementById('cancelSecurityChange').onclick = () => {
        modal.style.display = 'none';
    };
}

// Atualizar perguntas de segurança
async function updateSecurityQuestions() {
    const currentPassword = document.getElementById('modalCurrentPassword')?.value;
    const question1 = document.getElementById('modalQuestion1')?.value;
    const answer1 = document.getElementById('modalAnswer1')?.value;
    const question2 = document.getElementById('modalQuestion2')?.value;
    const answer2 = document.getElementById('modalAnswer2')?.value;
    const question3 = document.getElementById('modalQuestion3')?.value;
    const answer3 = document.getElementById('modalAnswer3')?.value;
    const confirmKey = document.getElementById('modalConfirmKey')?.value;
    
    if (!currentPassword || !question1 || !answer1 || !question2 || !answer2 || !question3 || !answer3 || !confirmKey) {
        showToast('Preencha todos os campos', 'error');
        return;
    }
    
    if (question1 === question2 || question1 === question3 || question2 === question3) {
        showToast('As perguntas devem ser diferentes', 'error');
        return;
    }
    
    try {
        const result = await apiRequest(`/security-questions/${BANK_CODE}`, 'PUT', {
            currentPassword,
            questions: [question1, question2, question3],
            answers: [answer1, answer2, answer3],
            confirmKey
        });
        
        if (result.success) {
            showToast('Perguntas de segurança atualizadas!', 'success');
            document.getElementById('modal').style.display = 'none';
            await loadSecurityQuestions();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}



// ========== AGENDAMENTO DE TRANSFERÊNCIAS ==========

// Atualizar campos conforme tipo e modo
function setupScheduleForm() {
    const typeSelect = document.getElementById('scheduleType');
    const modeSelect = document.getElementById('scheduleMode');
    const singleFields = document.getElementById('scheduleSingleFields');
    const recurringFields = document.getElementById('scheduleRecurringFields');
    const destinationLabel = document.getElementById('scheduleDestinationLabel');
    const destinationInput = document.getElementById('scheduleDestination');
    const feeInfo = document.getElementById('scheduleFeeInfo');
    
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'same') {
                destinationLabel.textContent = 'Conta de Destino';
                destinationInput.placeholder = 'Número da conta (ex: KENT-xxxxxxxx-xxxx)';
                feeInfo.innerHTML = '<i class="fas fa-info-circle"></i> Taxa: 0 CVE';
            } else {
                destinationLabel.textContent = 'NIB do Destino';
                destinationInput.placeholder = 'NIB (ex: 000400000XXXXX0193)';
                feeInfo.innerHTML = '<i class="fas fa-info-circle"></i> Taxa: 150 CVE';
            }
        });
    }
    
    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            if (modeSelect.value === 'single') {
                singleFields.style.display = 'block';
                recurringFields.style.display = 'none';
            } else {
                singleFields.style.display = 'none';
                recurringFields.style.display = 'block';
            }
        });
    }
}

// Agendar transferência
async function doScheduleTransfer() {
    const type = document.getElementById('scheduleType')?.value;
    const destination = document.getElementById('scheduleDestination')?.value;
    const amount = parseFloat(document.getElementById('scheduleAmount')?.value);
    const mode = document.getElementById('scheduleMode')?.value;
    const description = document.getElementById('scheduleDescription')?.value;
    
    if (!destination || !amount || amount <= 0) {
        showToast('Preencha todos os campos', 'error');
        return;
    }
    
    let scheduledDate, scheduledTime;
    
    if (mode === 'single') {
        scheduledDate = document.getElementById('scheduleDate')?.value;
        scheduledTime = document.getElementById('scheduleTime')?.value;
    } else {
        scheduledDate = document.getElementById('scheduleFirstDate')?.value;
        scheduledTime = document.getElementById('scheduleRecurringTime')?.value;
    }
    
    if (!scheduledDate) {
        showToast('Selecione uma data', 'error');
        return;
    }
    
    const data = {
        transferType: type,
        toAccount: destination,
        toBank: type === 'inter' ? (BANK_CODE === 'kent' ? 'jane' : 'kent') : BANK_CODE,
        toNib: type === 'inter' ? destination : null,
        amount: amount,
        mode: mode,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime || '00:00',
        description: description,
        confirmKey: await promptConfirmKey()
    };
    
    if (!data.confirmKey) {
        showToast('Operação cancelada', 'info');
        return;
    }
    
    if (mode === 'recurring') {
        data.frequency = document.getElementById('scheduleFrequency')?.value;
        data.maxOccurrences = parseInt(document.getElementById('scheduleOccurrences')?.value) || 12;
    }
    
    try {
        const result = await apiRequest(`/schedule-transfer/${BANK_CODE}`, 'POST', data);
        if (result.success) {
            showToast(result.message, 'success');
            // Limpar campos
            document.getElementById('scheduleDestination').value = '';
            document.getElementById('scheduleAmount').value = '';
            document.getElementById('scheduleDescription').value = '';
            await loadScheduledTransfers();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Carregar lista de agendamentos
async function loadScheduledTransfers() {
    try {
        const transfers = await apiRequest(`/scheduled-transfers/${BANK_CODE}`, 'GET');
        const container = document.getElementById('scheduledTransfersList');
        
        if (!container) return;
        
        if (!transfers || transfers.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center;">Nenhuma transferência agendada</p>';
            return;
        }
        
        container.innerHTML = transfers.map(t => {
            const statusIcon = t.status === 'executed' ? '✅' : t.status === 'cancelled' ? '❌' : t.status === 'failed' ? '⚠️' : '⏳';
            const statusText = t.status === 'pending' ? 'Pendente' : t.status === 'executed' ? 'Executada' : t.status === 'cancelled' ? 'Cancelada' : 'Falhou';
            const statusColor = t.status === 'executed' ? '#10b981' : t.status === 'cancelled' ? '#ef4444' : t.status === 'failed' ? '#f59e0b' : '#3b82f6';
            
            return `
                <div style="background: #f8fafc; padding: 12px; border-radius: 10px; margin-bottom: 10px; border-left: 4px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <p><strong>${statusIcon} ${statusText}</strong> ${t.mode === 'recurring' ? '🔄 Recorrente' : '📌 Pontual'}</p>
                            <p>📅 ${new Date(t.scheduled_date + ' UTC').toLocaleString('pt-PT')}</p>
                            <p>💰 ${t.amount.toLocaleString('pt-CV')} CVE</p>
                            <p>🏦 ${t.to_account_number}</p>
                            ${t.description ? `<p>📝 ${t.description}</p>` : ''}
                        </div>
                        ${t.status === 'pending' ? `
                            <button class="btn btn-danger" onclick="cancelSchedule(${t.id})" style="padding: 8px 12px; width: auto; font-size: 12px;">
                                Cancelar
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
    }
}

// Cancelar agendamento
async function cancelSchedule(id) {
    if (!confirm('Tem certeza que deseja cancelar este agendamento? A reserva será libertada.')) return;
    
    try {
        const result = await apiRequest(`/scheduled-transfer/${BANK_CODE}/${id}`, 'DELETE');
        if (result.success) {
            showToast(result.message, 'success');
            await loadScheduledTransfers();
            await loadAccountData();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}



//XXXXXXXXXXXXXXXXXXXX

// Adicionar evento de clique no ícone
document.getElementById('notificationsIcon')?.addEventListener('click', showNotificationsList);

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    checkAuth();
    
    document.getElementById('loginBtn')?.addEventListener('click', doLogin);
    document.getElementById('showRegisterBtn')?.addEventListener('click', showRegisterForm);
    document.getElementById('showRecoverBtn')?.addEventListener('click', showRecoverForm);
    document.getElementById('backToLoginBtn')?.addEventListener('click', showLoginForm);
    document.getElementById('doRegisterBtn')?.addEventListener('click', doRegister);
    document.getElementById('doTransferBtn')?.addEventListener('click', doTransfer);
    document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
    document.getElementById('changePasswordBtn')?.addEventListener('click', doChangePassword);
    document.getElementById('depositBtn')?.addEventListener('click', doDeposit);
    document.getElementById('withdrawBtn')?.addEventListener('click', doWithdraw);
    document.getElementById('transferBtn')?.addEventListener('click', () => document.querySelector('.tab-btn[data-tab="transfer"]')?.click());
    document.getElementById('statementBtn')?.addEventListener('click', doStatement);
    
    // Empréstimos
    document.getElementById('requestLoanBtn')?.addEventListener('click', doRequestLoan);
    document.getElementById('payLoanBtn')?.addEventListener('click', doPayLoan);
    document.getElementById('loanAmount')?.addEventListener('input', calculateLoan);
    document.getElementById('loanParcels')?.addEventListener('change', calculateLoan);

// Event listener para abrir modal de alterar perguntas
document.getElementById('showChangeSecurityBtn')?.addEventListener('click', showChangeSecurityModal);


// Agendamento
document.getElementById('scheduleTransferBtn')?.addEventListener('click', doScheduleTransfer);
setupScheduleForm();
    
// Agendamento
setupTransferMode();
document.getElementById('cancelAllSchedulesBtn')?.addEventListener('click', cancelAllSchedules);
document.getElementById('clearSchedulesBtn')?.addEventListener('click', clearSchedulesList);

    const transferTypeSelect = document.getElementById('transferType');
    const feeInfo = document.getElementById('feeInfo');
    const destinationLabel = document.querySelector('#transferTab .input-group:first-child label');
    const destinationInput = document.getElementById('destinationAccount');
    if (transferTypeSelect && feeInfo) {
        transferTypeSelect.addEventListener('change', () => {
            if (transferTypeSelect.value === 'same') {
                feeInfo.innerHTML = '<i class="fas fa-info-circle"></i> Taxa: 0 CVE';
                if (destinationLabel && destinationInput) { destinationLabel.innerHTML = 'Conta de Destino'; destinationInput.placeholder = 'Número da conta (ex: KENT-xxxxxxxx-xxxx)'; }
            } else {
                feeInfo.innerHTML = '<i class="fas fa-info-circle"></i> Taxa: 100 CVE (Kent → Jane)';
                if (destinationLabel && destinationInput) { destinationLabel.innerHTML = 'NIB do Destino'; destinationInput.placeholder = 'NIB (ex: 0004 0000 0XXXXXXXX 101 93)'; }
            }
        });
        if (transferTypeSelect.value === 'inter') {
            feeInfo.innerHTML = '<i class="fas fa-info-circle"></i> Taxa: 100 CVE (Kent → Jane)';
            if (destinationLabel && destinationInput) { destinationLabel.innerHTML = 'NIB do Destino'; destinationInput.placeholder = 'NIB (ex: 0004 0000 0XXXXXXXX 101 93)'; }
        } else {
            feeInfo.innerHTML = '<i class="fas fa-info-circle"></i> Taxa: 0 CVE';
            if (destinationLabel && destinationInput) { destinationLabel.innerHTML = 'Conta de Destino'; destinationInput.placeholder = 'Número da conta (ex: KENT-xxxxxxxx-xxxx)'; }
        }
    }



//Recuperação da conta
// Passo 1: Verificar email e carregar perguntas
document.getElementById('recoverStep1Btn')?.addEventListener('click', async () => {
    const email = document.getElementById('recoverEmail')?.value;
    
    if (!email) {
        showToast('Insira o email', 'error');
        return;
    }
    
    try {
        const result = await apiRequest(`/auth/recover/${BANK_CODE}`, 'POST', { email });
        
        if (result.questions) {
            // Mostrar perguntas de segurança
            const container = document.getElementById('recoverQuestions');
            container.innerHTML = `
                <h4>🔐 Responda às Perguntas de Segurança</h4>
                <p style="font-size:12px;color:#64748b;margin-bottom:15px;">Precisa acertar pelo menos 2 de 3</p>
                <div class="input-group">
                    <label>${result.questions[0]}</label>
                    <input type="text" id="recoverAnswer1" placeholder="Sua resposta">
                </div>
                <div class="input-group">
                    <label>${result.questions[1]}</label>
                    <input type="text" id="recoverAnswer2" placeholder="Sua resposta">
                </div>
                <div class="input-group">
                    <label>${result.questions[2]}</label>
                    <input type="text" id="recoverAnswer3" placeholder="Sua resposta">
                </div>
                <button class="btn btn-kent" id="recoverStep2Btn"><i class="fas fa-check-circle"></i> Verificar Respostas</button>
            `;
            container.style.display = 'block';
            
            // Event listener para verificar respostas
            document.getElementById('recoverStep2Btn')?.addEventListener('click', async () => {
                const answer1 = document.getElementById('recoverAnswer1')?.value;
                const answer2 = document.getElementById('recoverAnswer2')?.value;
                const answer3 = document.getElementById('recoverAnswer3')?.value;
                
                if (!answer1 || !answer2 || !answer3) {
                    showToast('Responda todas as perguntas', 'error');
                    return;
                }
                
                try {
                    const verifyResult = await apiRequest(`/auth/recover-verify/${BANK_CODE}`, 'POST', {
                        email,
                        answers: [answer1, answer2, answer3]
                    });
                    
                    if (verifyResult.success) {
                        showToast(verifyResult.message, 'success');
                        setTimeout(() => showLoginForm(), 3000);
                    }
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
});


    
    document.getElementById('loginPassword')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });

    
// Notificações
    loadNotifications();
    setInterval(() => {
        if (currentAccountId) {
            loadNotifications();
        }
    }, 30000);


});





window.addEventListener('online', () => { const s = document.getElementById('connectionStatus'); if (s) s.textContent = 'Online'; });
window.addEventListener('offline', () => { const s = document.getElementById('connectionStatus'); if (s) s.textContent = 'Offline'; });
// Tornar funções globais
window.cancelSchedule = cancelSchedule;



