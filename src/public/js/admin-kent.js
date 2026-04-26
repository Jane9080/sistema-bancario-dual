const API_BASE = 'http://localhost:3000/api';
const BANK_CODE = 'kent';

let currentToken = localStorage.getItem('kent_admin_token');
let currentFilter = null;

if (!currentToken) {
    window.location.href = '/admin-login';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

/*
async function apiRequest(endpoint, method, data = null) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('kent_admin_token')
        },
        body: data ? JSON.stringify(data) : undefined
    });
    
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('kent_admin_token');
        window.location.href = '/admin-login';
        throw new Error('Sessão expirada');
    }
    
    return res.json();
}
*/
async function apiRequest(endpoint, method, data = null) {
    const token = localStorage.getItem('kent_admin_token');  // ← CORRIGIDO
    
    console.log('🔵 API Request:', endpoint, 'Token existe?', !!token);
    
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token  // ← USA kent_admin_token
        },
        body: data ? JSON.stringify(data) : undefined
    });
    
    console.log('📡 Resposta status:', res.status);
    
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('kent_admin_token');
        window.location.href = '/admin-login';
        throw new Error('Sessão expirada');
    }
    
    const responseText = await res.text();
    console.log('📄 Resposta (primeiros 100 chars):', responseText.substring(0, 100));
    
    try {
        return JSON.parse(responseText);
    } catch (e) {
        console.error('❌ Erro ao fazer parse do JSON:', e);
        console.error('Resposta completa:', responseText);
        throw new Error('Resposta do servidor inválida');
    }
}



async function checkToken() {
    try {
        const res = await fetch(`${API_BASE}/admin/verify`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await res.json();
        if (!data.authenticated) {
            localStorage.removeItem('kent_admin_token');
            window.location.href = '/admin-login';
            return false;
        }
        return true;
    } catch (err) {
        localStorage.removeItem('kent_admin_token');
        window.location.href = '/admin-login';
        return false;
    }
}

async function loadStats() {
    try {
        const stats = await apiRequest(`/admin/stats/${BANK_CODE}`, 'GET');
        document.getElementById('totalAccounts').textContent = stats.total;
        document.getElementById('activeAccounts').textContent = stats.active;
        document.getElementById('inactiveAccounts').textContent = stats.inactive;
        document.getElementById('blockedAccounts').textContent = stats.blocked;
        document.getElementById('totalBankBalance').textContent = stats.totalBalance.toLocaleString('pt-CV');
    } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
    }
}

async function loadAccounts() {
    try {
        let url = `/admin/accounts/${BANK_CODE}`;
        if (currentFilter) {
            url = `/admin/accounts/${BANK_CODE}/status/${currentFilter}`;
        }
        
        const accounts = await apiRequest(url, 'GET');
        const tbody = document.getElementById('accountsList');
        
        if (!tbody) return;
        
        if (accounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma conta encontrada</td></tr>';
            return;
        }
        
        tbody.innerHTML = accounts.map(acc => `
            <tr>
                <td>${acc.id}</td>
                <td>${acc.holder_name}</td>
                <td>${acc.holder_email}</td>
                <td>${acc.account_number}</td>
                <td>${acc.balance.toLocaleString('pt-CV')}</td>
                <td class="status-${acc.status}">${acc.status}</td>
                <td>
                    <button class="action-btn activate" onclick="changeStatus(${acc.id}, 'active')">Ativar</button>
                    <button class="action-btn deactivate" onclick="changeStatus(${acc.id}, 'inactive')">Desativar</button>
                    <button class="action-btn block" onclick="changeStatus(${acc.id}, 'blocked')">Bloquear</button>
                    <button class="action-btn details" onclick="viewAccountDetails(${acc.id})">Detalhes</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Erro ao carregar contas:', err);
        showToast('Erro ao carregar contas', 'error');
    }
}

async function changeStatus(id, status) {
    try {
        await apiRequest(`/admin/accounts/${BANK_CODE}/${id}/status`, 'PUT', { status });
        showToast(`Conta ${status === 'active' ? 'ativada' : status === 'inactive' ? 'desativada' : 'bloqueada'} com sucesso!`);
        await loadStats();
        await loadAccounts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function searchAccounts(term) {
    if (!term.trim()) {
        await loadAccounts();
        return;
    }
    try {
        const accounts = await apiRequest(`/admin/accounts/${BANK_CODE}/search/${encodeURIComponent(term)}`, 'GET');
        const tbody = document.getElementById('accountsList');
        
        if (accounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma conta encontrada</td></tr>';
            return;
        }
        
        tbody.innerHTML = accounts.map(acc => `
            <tr>
                <td>${acc.id}</td>
                <td>${acc.holder_name}</td>
                <td>${acc.holder_email}</td>
                <td>${acc.account_number}</td>
                <td>${acc.balance.toLocaleString('pt-CV')}</td>
                <td class="status-${acc.status}">${acc.status}</td>
                <td>
                    <button class="action-btn activate" onclick="changeStatus(${acc.id}, 'active')">Ativar</button>
                    <button class="action-btn deactivate" onclick="changeStatus(${acc.id}, 'inactive')">Desativar</button>
                    <button class="action-btn block" onclick="changeStatus(${acc.id}, 'blocked')">Bloquear</button>
                    <button class="action-btn details" onclick="viewAccountDetails(${acc.id})">Detalhes</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}



async function viewAccountDetails(accountId) {
    try {
        const account = await apiRequest(`/admin/accounts/${BANK_CODE}/${accountId}/profile`, 'GET');
        
        const modal = document.getElementById('accountModal');
        const modalBody = document.getElementById('modalBody');
        
        let html = `
            <div style="margin-bottom: 20px;">
                <div class="detail-tabs">
                    <button class="tab-detail-btn active" data-tab="profile">Perfil</button>
                    <button class="tab-detail-btn" data-tab="receipts">Comprovativos</button>
                    <button class="tab-detail-btn" data-tab="transactions">Transações</button>
                    <button class="tab-detail-btn" data-tab="loans">Empréstimos</button>
                    <button class="tab-detail-btn" data-tab="security">🔐 Segurança</button>
                </div>
                
                <!-- TAB PERFIL -->
                <div id="detailProfile" class="detail-tab-content active">
                    <h4>INFORMACOES PESSOAIS</h4>
                    <table style="width:100%; font-size:13px; border-collapse:collapse;">
                        <tr><td style="padding:8px;"><strong>Nome Completo:</strong></td><td>${account.holder_name || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Telefone:</strong></td><td>${account.holder_phone || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Data Nascimento:</strong></td><td>${account.birth_date || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Idade:</strong></td><td>${account.age || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Estado Civil:</strong></td><td>${account.marital_status || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>NIF:</strong></td><td>${account.nif || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Passaporte:</strong></td><td>${account.passport_number || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Endereco:</strong></td><td>${account.address || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Nome da Mae:</strong></td><td>${account.mother_name || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Nome do Pai:</strong></td><td>${account.father_name || '-'}</td></tr>
                    </table>
                    
                    <h4 style="margin-top:20px;">DADOS BANCARIOS</h4>
                    <table style="width:100%; font-size:13px; border-collapse:collapse;">
                        <tr><td style="padding:8px;"><strong>Numero de Conta:</strong></td><td>${account.account_number || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>NIB:</strong></td><td>${account.nib || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>IBAN:</strong></td><td>${account.iban || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Saldo:</strong></td><td style="font-weight:bold;">${account.balance.toLocaleString('pt-CV')} CVE</td></tr>
                        <tr><td style="padding:8px;"><strong>Status:</strong></td><td class="status-${account.status}">${account.status}</td></tr>
                        <tr><td style="padding:8px;"><strong>Data de Criacao:</strong></td><td>${new Date(account.created_at).toLocaleDateString('pt-CV')}</td></tr>
                    </table>
                    
                    <h4 style="margin-top:20px;">INFORMACOES DE SEGURANCA</h4>
                    <table style="width:100%; font-size:13px; border-collapse:collapse;">
                        <tr><td style="padding:8px;"><strong>Email:</strong></td><td>${account.holder_email || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Username:</strong></td><td>${account.username || '-'}</td></tr>
                        <tr><td style="padding:8px;"><strong>Password:</strong></td><td>******** (oculta por seguranca)</td></tr>
                        <tr><td style="padding:8px;"><strong>Chave de Confirmacao:</strong></td><td>${account.confirm_key || '-'}</td></tr>
                    </table>
                </div>
                
                <!-- TAB COMPROVATIVOS -->
                <div id="detailReceipts" class="detail-tab-content" style="display:none;">
                    <div class="filters" style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <input type="date" id="receiptStartDate_${accountId}" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
                        <span>ate</span>
                        <input type="date" id="receiptEndDate_${accountId}" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
                        <button class="filter-btn active-btn" onclick="filterReceipts(${accountId})">Filtrar</button>
                        <button class="filter-btn all" onclick="clearReceiptFilter(${accountId})">Limpar</button>
                    </div>
                    <div id="receiptsList_${accountId}">
                        <h4>COMPROVATIVOS DE TRANSFERENCIA</h4>
                        <p style="color: #64748b;">Carregando...</p>
                    </div>
                </div>
                
                <!-- TAB TRANSAÇÕES -->
                <div id="detailTransactions" class="detail-tab-content" style="display:none;">
                    <div class="filters" style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <input type="date" id="transStartDate_${accountId}" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
                        <span>ate</span>
                        <input type="date" id="transEndDate_${accountId}" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
                        <button class="filter-btn active-btn" onclick="filterTransactions(${accountId})">Filtrar</button>
                        <button class="filter-btn all" onclick="clearTransactionsFilter(${accountId})">Limpar</button>
                    </div>
                    <div id="transactionsList_${accountId}">
                        <h4>HISTORICO DE TRANSACOES</h4>
                        <p style="color: #64748b;">Carregando...</p>
                    </div>
                </div>
                
                <!-- TAB EMPRÉSTIMOS -->
                <div id="detailLoans" class="detail-tab-content" style="display:none;">
                    <div class="filters" style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <input type="date" id="loanStartDate_${accountId}" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
                        <span>ate</span>
                        <input type="date" id="loanEndDate_${accountId}" style="padding: 8px; border-radius: 8px; border: 1px solid #ccc;">
                        <button class="filter-btn active-btn" onclick="filterLoans(${accountId})">Filtrar</button>
                        <button class="filter-btn all" onclick="clearLoansFilter(${accountId})">Limpar</button>
                    </div>
                    <div id="loansList_${accountId}">
                        <h4>EMPRESTIMOS</h4>
                        <p style="color: #64748b;">Carregando...</p>
                    </div>
                </div>
                
                <!-- TAB SEGURANÇA -->
                <div id="detailSecurity" class="detail-tab-content" style="display:none;">
                    <div id="securityContent_${accountId}">
                        <p style="color: #64748b; text-align: center; padding: 20px;">
                            🔍 Carregando informações de segurança...
                        </p>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
                <button class="action-btn deactivate" onclick="closeModal()">Fechar</button>
            </div>
        `;
        
        modalBody.innerHTML = html;
        modal.style.display = 'block';
        
        await loadReceiptsData(accountId);
        await loadTransactionsData(accountId);
        await loadLoansData(accountId);
        
        let securityLoaded = false;
        
        document.querySelectorAll('.tab-detail-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tab = btn.dataset.tab;
                
                document.querySelectorAll('.tab-detail-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.querySelectorAll('.detail-tab-content').forEach(content => content.style.display = 'none');
                document.getElementById(`detail${tab.charAt(0).toUpperCase() + tab.slice(1)}`).style.display = 'block';
                
                if (tab === 'security' && !securityLoaded) {
                    await loadSecurityData(accountId);
                    securityLoaded = true;
                }
            });
        });
        
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadReceiptsData(accountId, startDate = '', endDate = '') {



 console.log('🔵 loadReceiptsData INICIO');
    console.log('   accountId:', accountId);
    console.log('   startDate:', startDate);
    console.log('   endDate:', endDate);

    try {
        let url = `/admin/accounts/${BANK_CODE}/${accountId}/receipts`;
        if (startDate && endDate) {
            url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        const receipts = await apiRequest(url, 'GET');
        const container = document.getElementById(`receiptsList_${accountId}`);
        
        if (!receipts || receipts.length === 0) {
            container.innerHTML = '<h4>COMPROVATIVOS DE TRANSFERENCIA</h4><p>Nenhum comprovativo encontrado</p>';
            return;
        }
        
        let html = '<h4>COMPROVATIVOS DE TRANSFERENCIA</h4>';
        html += '<table style="width:100%; font-size:13px; border-collapse:collapse;">';
        html += '<thead><tr style="background:#f8fafc;"><th>Data</th><th>Referencia</th><th>Valor</th><th>Destino</th><th>Acoes</th></tr></thead><tbody>';
        receipts.forEach(r => {
            html += `
                <tr>
                    <td>${new Date(r.created_at).toLocaleDateString('pt-CV')}<br><small>${new Date(r.created_at).toLocaleTimeString('pt-CV')}</small></td>
                    <td>${r.reference.substring(0, 15)}...</td>
                    <td>${r.amount.toLocaleString('pt-CV')} CVE</td>
                    <td>${r.to_name}</td>
                    <td style="display: flex; gap: 5px; flex-wrap: wrap;">
                        <button class="action-btn details" onclick="viewReceipt('${r.reference}')">Ver</button>
                        <button class="action-btn activate" onclick="downloadReceipt('${r.reference}')">Download</button>
                        <button class="action-btn block" onclick="deleteReceipt(${r.id}, '${r.reference}')">Eliminar</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Erro ao carregar comprovativos:', err);
    }
}

async function loadTransactionsData(accountId, startDate = '', endDate = '') {
    try {
        let url = `/admin/accounts/${BANK_CODE}/${accountId}/transactions-filter`;
        if (startDate && endDate) {
            url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        const transactions = await apiRequest(url, 'GET');
        const container = document.getElementById(`transactionsList_${accountId}`);
        
        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<h4>HISTORICO DE TRANSACOES</h4><p>Nenhuma transacao encontrada</p>';
            return;
        }
        
        let html = '<h4>HISTORICO DE TRANSACOES</h4>';
        html += '<table style="width:100%; font-size:13px; border-collapse:collapse;">';
        html += '<thead><tr style="background:#f8fafc;"><th>Data</th><th>Tipo</th><th>Descricao</th><th>Valor</th><th>Saldo Apos</th></tr></thead><tbody>';
        transactions.slice(0, 50).forEach(t => {
            const valorClass = t.type === 'deposit' || t.type === 'transfer_in' ? 'color: #10b981;' : 'color: #ef4444;';
            const sinal = t.type === 'deposit' || t.type === 'transfer_in' ? '+' : '-';
            let tipoDisplay = '';
            if (t.type === 'deposit') tipoDisplay = 'Deposito';
            else if (t.type === 'withdraw') tipoDisplay = 'Levantamento';
            else if (t.type === 'transfer_in') tipoDisplay = 'Recebido';
            else if (t.type === 'transfer_out') tipoDisplay = 'Enviado';
            else if (t.type === 'loan_received') tipoDisplay = 'Emprestimo';
            else if (t.type === 'loan_payment') tipoDisplay = 'Pagamento Emprestimo';
            else if (t.type === 'fee') tipoDisplay = 'Taxa';
            else tipoDisplay = t.type;
            
            html += `
                <tr>
                    <td>${new Date(t.created_at).toLocaleDateString('pt-CV')}<br><small>${new Date(t.created_at).toLocaleTimeString('pt-CV')}</small></td>
                    <td>${tipoDisplay}</td>
                    <td>${t.description || '-'}</td>
                    <td style="${valorClass}">${sinal} ${t.amount.toLocaleString('pt-CV')} CVE</td>
                    <td>${t.balance_after.toLocaleString('pt-CV')} CVE</td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Erro ao carregar transacoes:', err);
    }
}

async function loadLoansData(accountId, startDate = '', endDate = '') {
    try {
        let url = `/admin/accounts/${BANK_CODE}/${accountId}/loans-filter`;
        if (startDate && endDate) {
            url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        const loans = await apiRequest(url, 'GET');
        const container = document.getElementById(`loansList_${accountId}`);
        
        if (!loans || loans.length === 0) {
            container.innerHTML = '<h4>EMPRESTIMOS</h4><p>Nenhum emprestimo encontrado</p>';
            return;
        }
        
        let html = '<h4>EMPRESTIMOS</h4>';
        loans.forEach(l => {
            html += `
                <div style="background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                    <p><strong>Data de Criacao:</strong> ${new Date(l.created_at).toLocaleDateString('pt-CV')}</p>
                    <p><strong>Valor Emprestado:</strong> ${l.amount.toLocaleString('pt-CV')} CVE</p>
                    <p><strong>Saldo Devedor:</strong> ${l.remaining_balance.toLocaleString('pt-CV')} CVE</p>
                    <p><strong>Parcela Mensal:</strong> ${l.monthly_payment.toLocaleString('pt-CV')} CVE</p>
                    <p><strong>Parcelas:</strong> ${l.total_parcels} meses</p>
                    <p><strong>Taxa de Juros:</strong> ${l.interest_rate}% ao mes</p>
                    <p><strong>Proximo Vencimento:</strong> ${l.next_due_date || 'Emprestimo quitado'}</p>
                    <p><strong>Status:</strong> ${l.status === 'active' ? 'Ativo' : 'Quitado'}</p>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error('Erro ao carregar emprestimos:', err);
    }
}

async function filterReceipts(accountId) {
    const startDate = document.getElementById(`receiptStartDate_${accountId}`).value;
    const endDate = document.getElementById(`receiptEndDate_${accountId}`).value;
    
    // LINHAS DE DEBUG ADICIONADAS
    console.log('=== FILTRAR COMPROVATIVOS ===');
    console.log('Account ID:', accountId);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('Input start:', document.getElementById(`receiptStartDate_${accountId}`));
    console.log('Input end:', document.getElementById(`receiptEndDate_${accountId}`));
    
    await loadReceiptsData(accountId, startDate, endDate);
}

async function clearReceiptFilter(accountId) {
    document.getElementById(`receiptStartDate_${accountId}`).value = '';
    document.getElementById(`receiptEndDate_${accountId}`).value = '';
    await loadReceiptsData(accountId, '', '');
}

async function filterTransactions(accountId) {
    const startDate = document.getElementById(`transStartDate_${accountId}`).value;
    const endDate = document.getElementById(`transEndDate_${accountId}`).value;
    await loadTransactionsData(accountId, startDate, endDate);
}

async function clearTransactionsFilter(accountId) {
    document.getElementById(`transStartDate_${accountId}`).value = '';
    document.getElementById(`transEndDate_${accountId}`).value = '';
    await loadTransactionsData(accountId, '', '');
}

async function filterLoans(accountId) {
    const startDate = document.getElementById(`loanStartDate_${accountId}`).value;
    const endDate = document.getElementById(`loanEndDate_${accountId}`).value;
    await loadLoansData(accountId, startDate, endDate);
}

async function clearLoansFilter(accountId) {
    document.getElementById(`loanStartDate_${accountId}`).value = '';
    document.getElementById(`loanEndDate_${accountId}`).value = '';
    await loadLoansData(accountId, '', '');
}


// Ver comprovativo (abre no navegador)
async function viewReceipt(reference) {
    try {
        const token = localStorage.getItem(`${BANK_CODE}_admin_token`);
        window.open(`/api/receipts/${BANK_CODE}/view-by-ref/${reference}?token=${token}`, '_blank');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Download comprovativo
async function downloadReceipt(reference) {
    try {
        const token = localStorage.getItem(`${BANK_CODE}_admin_token`);
        window.open(`/api/receipts/${BANK_CODE}/download-by-ref/${reference}?token=${token}`, '_blank');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Eliminar comprovativo
async function deleteReceipt(id, reference) {
    if (!confirm(`Tem certeza que deseja eliminar o comprovativo ${reference}?`)) return;
    
    try {
        await apiRequest(`/admin/receipts/${BANK_CODE}/${id}`, 'DELETE');
        showToast('Comprovativo eliminado com sucesso!');
        // Recarregar os detalhes da conta
        const accountId = document.querySelector('.tab-detail-btn.active')?.parentElement?.parentElement?.parentElement?.dataset?.accountId;
        if (accountId) viewAccountDetails(accountId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}



//XXXXXXXXXXXXXXXXXXXXXXXXX
// ========== CARREGAR DADOS DE SEGURANÇA ==========
// ========== CARREGAR DADOS DE SEGURANÇA ==========
async function loadSecurityData(accountId) {
    const container = document.getElementById(`securityContent_${accountId}`);
    
    try {
        const security = await apiRequest(`/admin/accounts/${BANK_CODE}/${accountId}/security-status`, 'GET');
        
        // ✅ CONVERSÃO CORRETA: Adicionar ' UTC' para forçar interpretação como UTC
        const lastAccess = security.lastAccess 
            ? new Date(security.lastAccess + ' UTC').toLocaleString('pt-PT')
            : 'Nunca';
            
        const securityUpdated = security.securityUpdatedAt 
            ? new Date(security.securityUpdatedAt + ' UTC').toLocaleString('pt-PT')
            : 'Não configurado';
            
        const lastPasswordChange = security.lastPasswordChange 
            ? new Date(security.lastPasswordChange + ' UTC').toLocaleString('pt-PT')
            : 'Nunca';
        
    const securityStatusColor = security.isComplete ? '#10b981' : '#ef4444';
        const securityStatusIcon = security.isComplete ? '✅' : '⚠️';
        const securityStatusText = security.isComplete ? 'Completo' : 'Incompleto';
        
        const twoFactorColor = security.twoFactorEnabled ? '#10b981' : '#ef4444';
        const twoFactorIcon = security.twoFactorEnabled ? '✅' : '❌';
        const twoFactorText = security.twoFactorEnabled ? 'Ativado' : 'Não ativado';
        
        // ✅ CORREÇÃO: Determinar status correto baseado no status da conta
        let lockStatusColor, lockStatusIcon, lockStatusText;
        
        if (security.status === 'blocked' || security.accountLocked) {
            lockStatusColor = '#ef4444';
            lockStatusIcon = '🔒';
            lockStatusText = 'Bloqueada';
        } else if (security.status === 'inactive') {
            lockStatusColor = '#f59e0b';  // Amarelo/laranja
            lockStatusIcon = '⏸️';
            lockStatusText = 'Inativa';
        } else {
            lockStatusColor = '#10b981';
            lockStatusIcon = '🔓';
            lockStatusText = 'Normal';
        }
        
        let html = `
            <div style="padding: 20px;">
                
                <!-- AVISO DE SEGURANÇA -->
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                    <p style="color: #92400e; margin: 0; font-size: 14px;">
                        <strong>🔐 POLÍTICA DE SEGURANÇA:</strong> Por compliance bancário, as respostas de segurança 
                        são criptografadas e não podem ser visualizadas. Apenas indicadores de status estão disponíveis.
                    </p>
                </div>
                
                <!-- STATUS PRINCIPAL -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    
                    <!-- Perguntas de Segurança -->
                    <div style="background: #f8fafc; padding: 15px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 32px; margin-bottom: 10px;">${securityStatusIcon}</div>
                        <h4 style="margin: 0 0 10px 0; color: #1e293b;">Perguntas de Segurança</h4>
                        <div style="font-size: 24px; font-weight: bold; color: ${securityStatusColor};">
                            ${security.securityQuestionsConfigured}/${security.totalQuestionsRequired}
                        </div>
                        <p style="color: #64748b; margin: 5px 0; font-size: 13px;">${securityStatusText}</p>
                        <p style="color: #94a3b8; font-size: 11px; margin-top: 10px;">
                            Atualizado: ${securityUpdated}
                        </p>
                    </div>
                    
                    <!-- 2FA -->
                    <div style="background: #f8fafc; padding: 15px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 32px; margin-bottom: 10px;">${twoFactorIcon}</div>
                        <h4 style="margin: 0 0 10px 0; color: #1e293b;">Autenticação 2 Fatores</h4>
                        <div style="font-size: 18px; font-weight: bold; color: ${twoFactorColor};">
                            ${twoFactorText}
                        </div>
                        <p style="color: #94a3b8; font-size: 11px; margin-top: 10px;">
                            Camada extra de segurança
                        </p>
                    </div>
                    
                    <!-- Status da Conta -->
                    <div style="background: #f8fafc; padding: 15px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 32px; margin-bottom: 10px;">${lockStatusIcon}</div>
                        <h4 style="margin: 0 0 10px 0; color: #1e293b;">Status da Conta</h4>
                        <div style="font-size: 18px; font-weight: bold; color: ${lockStatusColor};">
                            ${lockStatusText}
                        </div>
                        <p style="color: #94a3b8; font-size: 11px; margin-top: 10px;">
                            Tentativas falhas: ${security.loginAttempts}
                        </p>
                    </div>
                    
                </div>
                
                <!-- INFORMAÇÕES DETALHADAS -->
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #1e293b;">📊 Informações Detalhadas</h4>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Último acesso:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${lastAccess}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Última alteração de password:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${lastPasswordChange}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;"><strong>Tentativas de login falhas:</strong></td>
                            <td style="padding: 10px;">${security.loginAttempts}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- AÇÕES ADMINISTRATIVAS -->
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="action-btn" onclick="resetSecurityQuestions(${accountId})" 
                            style="background: #f59e0b; color: white; border: none;">
                        🔄 Resetar Perguntas de Segurança
                    </button>
                    <button class="action-btn" onclick="viewSecurityLog(${accountId})"
                            style="background: #64748b; color: white; border: none;">
                        📋 Ver Log de Segurança
                    </button>
                </div>
                
                <p style="color: #94a3b8; font-size: 12px; margin-top: 15px; text-align: center;">
                    * Resetar perguntas forçará o cliente a reconfigurá-las no próximo login
                </p>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (err) {
        console.error('Erro ao carregar dados de segurança:', err);
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                <p>❌ Erro ao carregar informações de segurança</p>
                <p style="font-size: 13px;">${err.message}</p>
            </div>
        `;
    }
}



// ========== RESETAR PERGUNTAS DE SEGURANÇA ==========
async function resetSecurityQuestions(accountId) {
    if (!confirm('Tem certeza que deseja resetar as perguntas de segurança?\n\nO cliente será forçado a reconfigurá-las no próximo login.')) {
        return;
    }
    
    try {
        await apiRequest(`/admin/accounts/${BANK_CODE}/${accountId}/reset-security`, 'POST');
        showToast('Perguntas de segurança resetadas com sucesso!', 'success');
        
        // Recarregar dados de segurança
        await loadSecurityData(accountId);
        
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ========== VER LOG DE SEGURANÇA ==========
async function viewSecurityLog(accountId) {
    try {
        const events = await apiRequest(`/admin/accounts/${BANK_CODE}/${accountId}/security-log`, 'GET');
        
        if (!events || events.length === 0) {
            alert('Nenhum evento de segurança encontrado para esta conta.');
            return;
        }
        
        let logHtml = '<h3>📋 Log de Segurança</h3><div style="max-height: 400px; overflow-y: auto;">';
        events.forEach(event => {
            logHtml += `
                <div style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
		<strong>${new Date(event.created_at + 'Z').toLocaleString()}</strong>

                    ${event.description}
                </div>
            `;
        });
        logHtml += '</div>';
        
        // Mostrar em modal simples
        const logModal = document.createElement('div');
        logModal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10001;
            max-width: 500px;
            width: 90%;
        `;
        logModal.innerHTML = logHtml + `
            <button onclick="this.parentElement.remove()" 
                    style="margin-top: 15px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Fechar
            </button>
        `;
        document.body.appendChild(logModal);
        
    } catch (err) {
        showToast(err.message, 'error');
    }
}

//XXXXXXXXX







function closeModal() {
    document.getElementById('accountModal').style.display = 'none';
}

function setFilter(filter) {
    currentFilter = filter;
    
    // Atualizar estilo dos botões
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (filter === null) document.getElementById('filterAll').classList.add('active');
    if (filter === 'active') document.getElementById('filterActive').classList.add('active');
    if (filter === 'inactive') document.getElementById('filterInactive').classList.add('active');
    if (filter === 'blocked') document.getElementById('filterBlocked').classList.add('active');
    
    loadAccounts();
}

function logout() {
    localStorage.removeItem('kent_admin_token');
    window.location.href = '/admin-login';
}

// Event Listeners
document.getElementById('filterAll')?.addEventListener('click', () => setFilter(null));
document.getElementById('filterActive')?.addEventListener('click', () => setFilter('active'));
document.getElementById('filterInactive')?.addEventListener('click', () => setFilter('inactive'));
document.getElementById('filterBlocked')?.addEventListener('click', () => setFilter('blocked'));
document.getElementById('logoutBtn')?.addEventListener('click', logout);
document.getElementById('searchBtn')?.addEventListener('click', () => {
    const term = document.getElementById('searchInput')?.value || '';
    searchAccounts(term);
});
document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    setFilter(currentFilter);
});

// ========== AÇÕES EM MASSA ==========

// Ativar todas as contas
document.getElementById('activateAllBtn')?.addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja ATIVAR TODAS as contas?')) return;
    try {
        const result = await apiRequest(`/admin/activate-all/${BANK_CODE}`, 'PUT');
        showToast(result.message);
        await loadStats();
        await loadAccounts();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Desativar todas as contas
document.getElementById('deactivateAllBtn')?.addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja DESATIVAR TODAS as contas?')) return;
    try {
        const result = await apiRequest(`/admin/deactivate-all/${BANK_CODE}`, 'PUT');
        showToast(result.message);
        await loadStats();
        await loadAccounts();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Bloquear todas as contas
document.getElementById('blockAllBtn')?.addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja BLOQUEAR TODAS as contas?')) return;
    try {
        const result = await apiRequest(`/admin/block-all/${BANK_CODE}`, 'PUT');
        showToast(result.message);
        await loadStats();
        await loadAccounts();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Formatar sistema
document.getElementById('formatSystemBtn')?.addEventListener('click', async () => {
    if (!confirm('⚠️ ATENÇÃO! Esta ação irá APAGAR TODOS OS DADOS do sistema. Tem certeza?')) return;
    if (!confirm('ÚLTIMA CHANCE! Digite "SIM" para confirmar:')) return;
    try {
        const result = await apiRequest(`/admin/format/${BANK_CODE}`, 'DELETE');
        showToast(result.message);
        setTimeout(() => { window.location.reload(); }, 2000);
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Ver todos os extratos
document.getElementById('viewAllTransactionsBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('allTransactionsList');
    const btn = document.getElementById('viewAllTransactionsBtn');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = 'Ocultar Extratos';
        
        try {
            const transactions = await apiRequest(`/admin/all-transactions/${BANK_CODE}`, 'GET');
            if (!transactions || transactions.length === 0) {
                container.innerHTML = '<p>Nenhuma transação encontrada</p>';
                return;
            }
            
            let html = '<table style="width:100%; font-size:12px; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;"><th>Data</th><th>Cliente</th><th>Tipo</th><th>Valor</th><th>Saldo</th></td></thead><tbody>';
            transactions.forEach(t => {
                const valorClass = t.type === 'deposit' || t.type === 'transfer_in' ? 'color:#10b981' : 'color:#ef4444';
                html += `
                    <tr>
                        <td>${new Date(t.created_at).toLocaleString('pt-CV')}
                        <td>${t.holder_name}
                        <td>${t.type}
                        <td style="${valorClass}">${t.amount.toLocaleString('pt-CV')} CVE
                        <td>${t.balance_after.toLocaleString('pt-CV')} CVE
                    </tr>
                `;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p>Erro ao carregar transações</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'Ver Todos Extratos';
        container.innerHTML = '';
    }
});

/* Ver todos os comprovativos
document.getElementById('viewAllReceiptsBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('allReceiptsList');
    const btn = document.getElementById('viewAllReceiptsBtn');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = 'Ocultar Comprovativos';
        
        try {
            const receipts = await apiRequest(`/admin/all-receipts/${BANK_CODE}`, 'GET');
            if (!receipts || receipts.length === 0) {
                container.innerHTML = '<p>Nenhum comprovativo encontrado</p>';
                return;
            }
            
            let html = '<table style="width:100%; font-size:12px; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;"><th>Data</th><th>Cliente</th><th>Referência</th><th>Valor</th><th>Destino</th></td></thead><tbody>';
            receipts.forEach(r => {
                html += `
                    <tr>
                        <td>${new Date(r.created_at).toLocaleString('pt-CV')}
                        <td>${r.holder_name}
                        <td>${r.reference.substring(0, 15)}
                        <td>${r.amount.toLocaleString('pt-CV')} CVE
                        <td>${r.to_name}
                    </tr>
                `;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p>Erro ao carregar comprovativos</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'Ver Todos Comprovativos';
        container.innerHTML = '';
    }
});
*/
// Ver todos os comprovativos
document.getElementById('viewAllReceiptsBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('allReceiptsList');
    const btn = document.getElementById('viewAllReceiptsBtn');
    
    if (container.style.display === 'none' || !container.style.display) {
        container.style.display = 'block';
        btn.textContent = 'Ocultar Comprovativos';
        
        try {
            const receipts = await apiRequest(`/admin/all-receipts/${BANK_CODE}`, 'GET');
            if (!receipts || receipts.length === 0) {
                container.innerHTML = '<p style="text-align:center;color:#64748b;">Nenhum comprovativo encontrado</p>';
                return;
            }
            
            let html = '<button class="action-btn block" onclick="deleteAllReceipts()" style="font-size:11px; margin-bottom:10px;">🗑️ Remover Todos</button>';
            html += '<table style="width:100%; font-size:12px; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;"><th>Data</th><th>Cliente</th><th>Referência</th><th>Valor</th><th>Destino</th><th style="width:140px;">Ações</th></tr></thead><tbody>';
            
            receipts.forEach(r => {
                html += '<tr>';
                html += `<td>${new Date(r.created_at + 'Z').toLocaleString()}</td>`;
                html += `<td>${r.holder_name}</td>`;
                html += `<td style="font-size:11px;">${r.reference ? r.reference.substring(0, 12) + '...' : '-'}</td>`;
                html += `<td>${r.amount ? r.amount.toLocaleString('pt-CV') : '0'} CVE</td>`;
                html += `<td>${r.to_name || '-'}</td>`;
                html += '<td style="display:flex; gap:4px; flex-wrap:wrap;">';
                html += `<button class="action-btn details" onclick="viewReceipt('${r.reference}')" style="font-size:10px; padding:4px 8px;">👁️ Ver</button>`;
                html += `<button class="action-btn activate" onclick="downloadReceipt('${r.reference}')" style="font-size:10px; padding:4px 8px;">📥 Download</button>`;
                html += `<button class="action-btn block" onclick="adminDeleteReceipt(${r.id}, '${r.reference}')" style="font-size:10px; padding:4px 8px;">🗑️</button>`;
                html += '</td></tr>';
            });
            
            html += '</tbody></table>';
            container.innerHTML = html;
            
        } catch (err) {
            container.innerHTML = '<p style="color:#ef4444;">Erro ao carregar comprovativos</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'Ver Todos Comprovativos';
        container.innerHTML = '';
    }
});

// Remover um comprovativo (admin)
async function adminDeleteReceipt(id, reference) {
    if (!confirm(`Eliminar comprovativo ${reference.substring(0,15)}...?`)) return;
    try {
        await apiRequest(`/admin/receipts/${BANK_CODE}/${id}`, 'DELETE');
        showToast('Comprovativo eliminado!', 'success');
        document.getElementById('viewAllReceiptsBtn')?.click();
        document.getElementById('viewAllReceiptsBtn')?.click();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Remover TODOS os comprovativos
async function deleteAllReceipts() {
    if (!confirm('⚠️ Remover TODOS os comprovativos? Esta ação é irreversível!')) return;
    
    try {
        const receipts = await apiRequest(`/admin/all-receipts/${BANK_CODE}`, 'GET');
        if (!receipts || receipts.length === 0) {
            showToast('Nenhum comprovativo para remover', 'info');
            return;
        }
        
        for (const r of receipts) {
            try {
                await apiRequest(`/admin/receipts/${BANK_CODE}/${r.id}`, 'DELETE');
            } catch(e) {}
        }
        
        showToast(`${receipts.length} comprovativos removidos!`, 'success');
        document.getElementById('viewAllReceiptsBtn')?.click();
        document.getElementById('viewAllReceiptsBtn')?.click();
    } catch (err) {
        showToast(err.message, 'error');
    }
}




// ========== TODOS EMPRÉSTIMOS ==========
document.getElementById('viewAllLoansBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('allLoansList');
    const btn = document.getElementById('viewAllLoansBtn');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = 'Ocultar Empréstimos';
        
        try {
            const loans = await apiRequest(`/admin/all-loans/${BANK_CODE}`, 'GET');
            if (!loans || loans.length === 0) {
                container.innerHTML = '<p>Nenhum empréstimo encontrado</p>';
                return;
            }
            
            let html = '<table style="width:100%; font-size:12px; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;"><th>Data</th><th>Cliente</th><th>Valor</th><th>Saldo Devedor</th><th>Parcelas</th><th>Status</th></tr></thead><tbody>';
            loans.forEach(l => {
                let saldo = l.remaining_balance < 0 ? 0 : l.remaining_balance;
                html += '<tr>';
                html += '<td>' + new Date(l.created_at).toLocaleDateString('pt-CV') + '</td>';
                html += '<td>' + l.holder_name + '</td>';
                html += '<td>' + l.amount.toLocaleString('pt-CV') + ' CVE</td>';
                html += '<td>' + saldo.toLocaleString('pt-CV') + ' CVE</td>';
                html += '<td>' + l.total_parcels + ' / ' + l.remaining_parcels + '</td>';
                html += '<td>' + (l.status === 'active' ? 'Ativo' : 'Quitado') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p>Erro ao carregar empréstimos</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'Ver Todos Empréstimos';
        container.innerHTML = '';
    }
});




// ========== DADOS DO BANCO ==========
document.getElementById('viewBankInfoBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('bankInfoList');
    const btn = document.getElementById('viewBankInfoBtn');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = 'Ocultar Dados';
        
        try {
            const info = await apiRequest(`/admin/bank-info/${BANK_CODE}`, 'GET');
            
            let html = '<div style="background: #f8fafc; padding: 15px; border-radius: 12px;">';
            html += '<p><strong> Nome do Banco:</strong> ' + (info.bankName || '-') + '</p>';
            html += '<p><strong> Código:</strong> ' + (info.bankCode ? info.bankCode.toUpperCase() : '-') + '</p>';
            html += '<p><strong> Conta do Banco:</strong> ' + (info.accountNumber || '-') + '</p>';
            html += '<p><strong> NIB:</strong> ' + (info.nib || '-') + '</p>';
            html += '<p><strong> IBAN:</strong> ' + (info.iban || '-') + '</p>';
            html += '<p><strong> Saldo do Banco:</strong> ' + (info.balance ? info.balance.toLocaleString('pt-CV') : '0') + ' CVE</p>';
            html += '<hr>';
            html += '<p><strong> Total de Taxas Recebidas:</strong> ' + (info.totalFees ? info.totalFees.toLocaleString('pt-CV') : '0') + ' CVE</p>';
            html += '<p><strong> Total Emprestado (Ativo):</strong> ' + (info.totalLoansOut ? info.totalLoansOut.toLocaleString('pt-CV') : '0') + ' CVE</p>';
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p>Erro ao carregar dados do banco: ' + err.message + '</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'Ver Dados do Banco';
        container.innerHTML = '';
    }
});

// ========== RESPOSTAS DE SEGURANÇA ==========
document.getElementById('viewSecurityAnswersBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('securityAnswersList');
    const btn = document.getElementById('viewSecurityAnswersBtn');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = 'Ocultar Respostas';
        
        try {
            const answers = await apiRequest(`/admin/security-answers/${BANK_CODE}`, 'GET');
            if (!answers || answers.length === 0) {
                container.innerHTML = '<p>Nenhuma resposta de segurança encontrada</p>';
                return;
            }
            
            let html = '<table style="width:100%; font-size:11px; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;">';
            html += '<th>ID</th><th>Cliente</th><th>Email</th>';
            html += '<th>Pergunta 1</th><th>Resposta 1</th>';
            html += '<th>Pergunta 2</th><th>Resposta 2</th>';
            html += '<th>Pergunta 3</th><th>Resposta 3</th>';
            html += '</tr></thead><tbody>';
            
            answers.forEach(a => {
                html += '<tr>';
                html += '<td>' + a.id + '</td>';
                html += '<td>' + a.holder_name + '</td>';
                html += '<td>' + a.holder_email + '</td>';
                html += '<td>' + (a.security_question_1 || '-') + '</td>';
                html += '<td style="font-size:9px;">' + (a.security_answer_1 ? a.security_answer_1.substring(0, 15) + '...' : '-') + '</td>';
                html += '<td>' + (a.security_question_2 || '-') + '</td>';
                html += '<td style="font-size:9px;">' + (a.security_answer_2 ? a.security_answer_2.substring(0, 15) + '...' : '-') + '</td>';
                html += '<td>' + (a.security_question_3 || '-') + '</td>';
                html += '<td style="font-size:9px;">' + (a.security_answer_3 ? a.security_answer_3.substring(0, 15) + '...' : '-') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p>Erro ao carregar respostas</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'Ver Respostas de Segurança';
        container.innerHTML = '';
    }
});


// Cancelar agendamento (admin)
async function adminCancelSchedule(id) {
    if (!confirm('Cancelar este agendamento? A reserva será libertada para o cliente.')) return;
    
    try {
        const result = await apiRequest(`/admin/scheduled-transfer/${BANK_CODE}/${id}`, 'DELETE');
        showToast(result.message, 'success');
        // Recarregar a lista
        document.getElementById('viewScheduledBtn')?.click();
        document.getElementById('viewScheduledBtn')?.click();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ========== SENHAS (AUDITORIA) ==========
document.getElementById('viewPasswordsBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('passwordsList');
    const btn = document.getElementById('viewPasswordsBtn');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = 'Ocultar Senhas';
        
        try {
            const passwords = await apiRequest(`/admin/passwords-audit/${BANK_CODE}`, 'GET');
            if (!passwords || passwords.length === 0) {
                container.innerHTML = '<p>Nenhuma conta encontrada</p>';
                return;
            }
            
            let html = '<table style="width:100%; font-size:11px; border-collapse:collapse;">';
            html += '<thead><tr style="background:#f8fafc;"><th>ID</th><th>Nome</th><th>Email</th><th>Username</th><th>Password Hash</th><th>Chave Confirmação</th></tr></thead><tbody>';
            passwords.forEach(p => {
                let hashShort = p.password_hash ? p.password_hash.substring(0, 20) + '...' : '-';
                html += '<tr>';
                html += '<td>' + p.id + '</td>';
                html += '<td>' + p.holder_name + '</td>';
                html += '<td>' + p.holder_email + '</td>';
                html += '<td>' + p.username + '</td>';
                html += '<td>' + hashShort + '</td>';
                html += '<td>' + (p.confirm_key || '-') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p>Erro ao carregar senhas</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'Ver Senhas (Auditoria)';
        container.innerHTML = '';
    }
});


// ========== MENU ADMIN ==========
document.getElementById('adminMenuBtn')?.addEventListener('click', () => {
    const dropdown = document.getElementById('adminDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

// Fechar dropdown ao clicar fora
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('adminDropdown');
    const btn = document.getElementById('adminMenuBtn');
    if (dropdown && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// ========== MODAL DE REAUTENTICAÇÃO (COM BOTÃO OK) ==========
function showReauthModal(title, message) {
    // Remover modal existente se houver
    const existingModal = document.querySelector('.reauth-modal-overlay');
    if (existingModal) existingModal.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'reauth-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 30px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        animation: slideUp 0.3s ease;
        text-align: center;
    `;
    
    modal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">🔐</div>
        <h3 style="color: #1e293b; font-size: 20px; margin-bottom: 15px; font-weight: 600;">${title}</h3>
        <p style="color: #64748b; margin-bottom: 25px; line-height: 1.5;">${message}</p>
        <button onclick="logout()" style="
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
            width: 100%;
            transition: transform 0.2s;
            box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            OK - Fazer Login Novamente
        </button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Adicionar animações CSS se não existirem
    if (!document.querySelector('#modal-animations')) {
        const style = document.createElement('style');
        style.id = 'modal-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ========== ALTERAR EMAIL ==========
document.getElementById('changeEmailBtn')?.addEventListener('click', () => {
    document.getElementById('emailModal').style.display = 'block';
    document.getElementById('adminDropdown').style.display = 'none';
});

document.getElementById('confirmEmailBtn')?.addEventListener('click', async () => {
    const newEmail = document.getElementById('newEmail').value;
    
    if (!newEmail || !newEmail.includes('@')) {
        showToast('Email inválido', 'error');
        return;
    }
    
    try {
        await apiRequest('/admin/change-email', 'PUT', { newEmail });
        showToast('Email alterado com sucesso!');
        closeEmailModal();
        
        // Mostrar modal com botão OK (sem temporizador)
        showReauthModal(
            '✅ Email Atualizado',
            'O seu email foi alterado com sucesso. Para sua segurança, faça login novamente.'
        );
        
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ========== ALTERAR PASSWORD ==========
document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
    document.getElementById('passwordModal').style.display = 'block';
    document.getElementById('adminDropdown').style.display = 'none';
});

document.getElementById('confirmPasswordBtn')?.addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword) {
        showToast('Preencha todos os campos', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('A nova password deve ter pelo menos 6 caracteres', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('As passwords não coincidem', 'error');
        return;
    }
    
    try {
        await apiRequest('/admin/change-password', 'PUT', { currentPassword, newPassword });
        showToast('Password alterada com sucesso!');
        closePasswordModal();
        
        // Limpar campos
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        // Mostrar modal com botão OK (sem temporizador)
        showReauthModal(
            '✅ Password Atualizada',
            'A sua password foi alterada com sucesso. Para sua segurança, faça login novamente.'
        );
        
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ========== AGENDA DE TRANSFERÊNCIAS (ATUALIZADA) ==========
// ========== AGENDA DE TRANSFERÊNCIAS ==========
document.getElementById('viewScheduledBtn')?.addEventListener('click', async () => {
    const container = document.getElementById('scheduledList');
    const btn = document.getElementById('viewScheduledBtn');
    
    if (container.style.display === 'block') {
        container.style.display = 'none';
        btn.textContent = 'Ver Agenda de Transferências';
        return;
    }
    
    container.style.display = 'block';
    btn.textContent = 'Ocultar Agenda';
    container.innerHTML = '<p style="text-align:center; color:#64748b;">Carregando...</p>';
    
    try {
        const schedules = await apiRequest(`/admin/scheduled-transfers/${BANK_CODE}`, 'GET');
        
        if (!schedules || schedules.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b;">Nenhuma transferência agendada</p>';
            return;
        }
        
        // ✅ Botão ANTES da tabela (UMA VEZ SÓ)
        let html = '<button class="action-btn block" onclick="adminCancelAllSchedules()" style="font-size:11px; margin-bottom:10px;">🗑️ Cancelar Todos Pendentes</button>';
        
        html += '<table style="width:100%; font-size:12px; border-collapse:collapse;">';
        html += '<thead><tr style="background:#f8fafc;"><th>Status</th><th>Cliente</th><th>Data</th><th>Valor</th><th>Destino</th><th>Modo</th><th>Ação</th></tr></thead><tbody>';
        
        schedules.forEach(s => {
            const statusIcon = s.status === 'pending' ? '⏳' : s.status === 'executed' ? '✅' : s.status === 'cancelled' ? '❌' : '⚠️';
            html += '<tr>';
            html += `<td>${statusIcon} ${s.status}</td>`;
            html += `<td>${s.from_name}</td>`;
            html += `<td>${new Date(s.scheduled_date + 'Z').toLocaleString()}</td>`;
            html += `<td>${s.amount.toLocaleString('pt-CV')} CVE</td>`;
            html += `<td>${s.to_bank.toUpperCase()}: ${s.to_account_number}</td>`;
            html += `<td>${s.mode === 'recurring' ? '🔄' : '📌'} ${s.mode === 'recurring' ? s.frequency || '' : 'Pontual'}</td>`;
            html += s.status === 'pending' ? `<td><button class="action-btn block" onclick="adminCancelSchedule(${s.id})" style="font-size:11px;">Cancelar</button></td>` : '<td>-</td>';
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444;">Erro ao carregar agenda</p>';
    }
});


// Cancelar TODOS os agendamentos pendentes (admin)
async function adminCancelAllSchedules() {
    if (!confirm('⚠️ Cancelar TODOS os agendamentos pendentes? As reservas serão libertadas para os clientes.')) return;
    
    try {
        const result = await apiRequest(`/admin/scheduled-transfer-all/${BANK_CODE}`, 'DELETE');
        showToast(result.message, 'success');
        // Recarregar
        document.getElementById('viewScheduledBtn')?.click();
        document.getElementById('viewScheduledBtn')?.click();
    } catch (err) {
        showToast(err.message, 'error');
    }
}




function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
    document.getElementById('newEmail').value = '';
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

// Inicialização
async function init() {
    const isValid = await checkToken();
    if (!isValid) return;
    await loadStats();
    await loadAccounts();
}

init();



// Garantir que as funções estão no escopo global
window.filterReceipts = filterReceipts;
window.clearReceiptFilter = clearReceiptFilter;
window.filterTransactions = filterTransactions;
window.clearTransactionsFilter = clearTransactionsFilter;
window.filterLoans = filterLoans;
window.clearLoansFilter = clearLoansFilter;
window.viewReceipt = viewReceipt;
window.downloadReceipt = downloadReceipt;
window.deleteReceipt = deleteReceipt;
window.closeModal = closeModal;
// Tornar funções globais
window.resetSecurityQuestions = resetSecurityQuestions;
window.viewSecurityLog = viewSecurityLog;
// Tornar global
window.adminCancelSchedule = adminCancelSchedule;
window.adminCancelAllSchedules = adminCancelAllSchedules;


// Tornar globais
window.adminDeleteReceipt = adminDeleteReceipt;
window.deleteAllReceipts = deleteAllReceipts;
