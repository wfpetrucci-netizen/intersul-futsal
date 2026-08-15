// Configuração de URL base dinâmica para requisições à API
const API_BASE = window.location.origin.startsWith('file:') || window.location.origin === 'null'
    ? 'http://localhost:8000'
    : '';

// Estado da Aplicação
let players = [];
let payments = {};
let selectedPlayerId = null;
let activeTab = 'tab-players';
let currentSearchQuery = '';
let selectedPlayerPosFilter = 'todos';
let selectedMonthFilter = 'todos';
let selectedStatusFilter = 'todos';
let selectedPosFilter = 'todos';
let paymentSearchQuery = '';
let stagedPaymentChanges = {};

// Elementos do DOM
const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const loginDirectorSelect = document.getElementById('login-director');
const loginPasscodeInput = document.getElementById('login-passcode');
const loginErrorMsg = document.getElementById('login-error-msg');

const appContainer = document.getElementById('app-container');
const activeDirectorName = document.getElementById('active-director-name');
const btnLogout = document.getElementById('btn-logout');

const statTotalPlayers = document.getElementById('stat-total-players');
const statMonthlyOk = document.getElementById('stat-monthly-ok');
const statMonthlyPending = document.getElementById('stat-monthly-pending');

const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');

const searchInput = document.getElementById('search-input');
const playerPosFilterSelect = document.getElementById('player-pos-filter');
const playersCountText = document.getElementById('players-count-text');
const btnAddPlayer = document.getElementById('btn-add-player');
const playersGrid = document.getElementById('players-grid');

const paymentsTableBody = document.getElementById('payments-table-body');
const filterMonthSelect = document.getElementById('filter-month');
const filterStatusSelect = document.getElementById('filter-status');
const filterPosSelect = document.getElementById('filter-pos');
const paymentSearchInput = document.getElementById('payment-search-input');
const btnResetFilters = document.getElementById('btn-reset-filters');
const btnSavePayments = document.getElementById('btn-save-payments');
const paymentsCountText = document.getElementById('payments-count-text');
const activeFilterTags = document.getElementById('active-filter-tags');
const paymentToast = document.getElementById('payment-toast');
const toastMessage = document.getElementById('toast-message');

// Elementos do Modal de Jogador
const playerModal = document.getElementById('player-modal');
const closePlayerModalBtn = document.getElementById('close-player-modal');
const playerForm = document.getElementById('player-form');
const modalTitle = document.getElementById('modal-title');
const playerIdInput = document.getElementById('player-id');
const playerNameInput = document.getElementById('player-name');
const playerPosSelect = document.getElementById('player-pos');
const playerBirthInput = document.getElementById('player-birth');
const playerRgInput = document.getElementById('player-rg');
const playerCpfInput = document.getElementById('player-cpf');

const photoFileInput = document.getElementById('player-photo-file');
const photoPreviewBox = document.getElementById('photo-preview');
const playerPhotoImg = document.getElementById('player-photo-img');
const placeholderIcon = photoPreviewBox.querySelector('.placeholder-icon');

const btnCancelModal = document.getElementById('btn-cancel-modal');
const btnDeletePlayer = document.getElementById('btn-delete-player');

// Cabeçalhos de Autorização Padrão
function getHeaders() {
    const token = sessionStorage.getItem('intersul_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    setupEventListeners();
});

// 1. Controle de Autenticação
function checkAuthentication() {
    const token = sessionStorage.getItem('intersul_token');
    const directorName = sessionStorage.getItem('intersul_director');
    
    if (token && directorName) {
        // Diretor logado
        loginContainer.classList.add('hide');
        appContainer.classList.remove('hide');
        activeDirectorName.textContent = directorName;
        
        // Carrega dados iniciais do dashboard
        refreshData();
    } else {
        // Redireciona para o login
        loginContainer.classList.remove('hide');
        appContainer.classList.add('hide');
    }
}

// 2. Event Listeners
function setupEventListeners() {
    // Form de Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const director = loginDirectorSelect.value;
        const passcode = loginPasscodeInput.value;
        
        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ director, passcode })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Erro ao efetuar login');
            }
            
            const data = await response.json();
            
            // Salva a sessão do diretor
            sessionStorage.setItem('intersul_token', data.token);
            sessionStorage.setItem('intersul_director', data.director);
            loginErrorMsg.classList.add('hide');
            
            // Limpa form
            loginPasscodeInput.value = '';
            
            // Carrega painel
            checkAuthentication();
        } catch (error) {
            console.error('Erro de login:', error);
            loginErrorMsg.textContent = error.message;
            loginErrorMsg.classList.remove('hide');
        }
    });

    // Botão Sair
    btnLogout.addEventListener('click', () => {
        sessionStorage.clear();
        checkAuthentication();
    });

    // Navegação de Abas
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            activeTab = tab.getAttribute('data-tab');
            document.getElementById(activeTab).classList.add('active');
            
            // Recarrega dados dependendo da aba
            if (activeTab === 'tab-payments') {
                renderPaymentsTable();
            } else {
                renderPlayersGrid();
            }
        });
    });

    // Busca de Jogadores por Nome
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase().trim();
            renderPlayersGrid();
        });
    }

    // Filtro de Jogadores por Posição
    if (playerPosFilterSelect) {
        playerPosFilterSelect.addEventListener('change', (e) => {
            selectedPlayerPosFilter = e.target.value;
            renderPlayersGrid();
        });
    }

    // Filtro por Mês (Controle de Mensalidades)
    if (filterMonthSelect) {
        filterMonthSelect.addEventListener('change', (e) => {
            selectedMonthFilter = e.target.value;
            updateStats();
            renderPaymentsTable();
        });
    }

    // Filtro por Status / Pendências (Controle de Mensalidades)
    if (filterStatusSelect) {
        filterStatusSelect.addEventListener('change', (e) => {
            selectedStatusFilter = e.target.value;
            renderPaymentsTable();
        });
    }

    // Filtro por Posição (Controle de Mensalidades)
    if (filterPosSelect) {
        filterPosSelect.addEventListener('change', (e) => {
            selectedPosFilter = e.target.value;
            renderPaymentsTable();
        });
    }

    // Busca Rápida na Tabela de Mensalidades
    if (paymentSearchInput) {
        paymentSearchInput.addEventListener('input', (e) => {
            paymentSearchQuery = e.target.value.toLowerCase().trim();
            renderPaymentsTable();
        });
    }

    // Botão Limpar Filtros
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            selectedMonthFilter = 'todos';
            selectedStatusFilter = 'todos';
            selectedPosFilter = 'todos';
            paymentSearchQuery = '';

            if (filterMonthSelect) filterMonthSelect.value = 'todos';
            if (filterStatusSelect) filterStatusSelect.value = 'todos';
            if (filterPosSelect) filterPosSelect.value = 'todos';
            if (paymentSearchInput) paymentSearchInput.value = '';

            updateStats();
            renderPaymentsTable();
        });
    }

    // Botão Salvar Alterações das Mensalidades
    if (btnSavePayments) {
        btnSavePayments.addEventListener('click', async () => {
            await saveAllPaymentChanges();
        });
    }

    // Botão Cadastrar Jogador (abre modal)
    btnAddPlayer.addEventListener('click', () => {
        openPlayerModal();
    });

    // Fechar Modal
    closePlayerModalBtn.addEventListener('click', closePlayerModal);
    btnCancelModal.addEventListener('click', closePlayerModal);
    playerModal.addEventListener('click', (e) => {
        if (e.target === playerModal) closePlayerModal();
    });

    // Visualizar upload de foto antes de enviar
    photoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                playerPhotoImg.src = event.target.result;
                playerPhotoImg.classList.remove('hide');
                placeholderIcon.classList.add('hide');
            };
            reader.readAsDataURL(file);
        }
    });

    // Envio do formulário do Jogador (Salvar/Editar)
    playerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = playerIdInput.value;
        const nome_completo = playerNameInput.value;
        const posicao = playerPosSelect.value;
        const data_nascimento = playerBirthInput.value;
        const rg = playerRgInput.value;
        const cpf = playerCpfInput.value;
        
        const payload = { nome_completo, posicao, data_nascimento, rg, cpf };
        
        try {
            let res;
            let savedPlayer;
            
            if (id) {
                // Editar jogador
                res = await fetch(`${API_BASE}/api/jogadores/${id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Falha ao atualizar dados do jogador.');
                savedPlayer = await res.json();
            } else {
                // Criar jogador
                res = await fetch(`${API_BASE}/api/jogadores`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Falha ao criar novo jogador.');
                savedPlayer = await res.json();
            }
            
            // Verifica se há foto selecionada para enviar
            const fotoFile = photoFileInput.files[0];
            if (fotoFile && savedPlayer.id) {
                const formData = new FormData();
                formData.append('file', fotoFile);
                
                const token = sessionStorage.getItem('intersul_token');
                const uploadRes = await fetch(`${API_BASE}/api/jogadores/${savedPlayer.id}/foto`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }, // Sem Content-Type para permitir multipart/form-data
                    body: formData
                });
                
                if (!uploadRes.ok) {
                    throw new Error('Jogador cadastrado, mas falhou ao salvar a foto de perfil.');
                }
                // Atualiza imagem_url no objeto local com o Base64 retornado
                const uploadData = await uploadRes.json();
                savedPlayer.imagem_url = uploadData.imagem_url || savedPlayer.imagem_url;
            }
            
            closePlayerModal();
            refreshData();
        } catch (error) {
            alert(error.message);
        }
    });

    // Excluir Jogador
    btnDeletePlayer.addEventListener('click', async () => {
        const id = playerIdInput.value;
        if (!id) return;
        
        const confirmDelete = confirm('Tem certeza de que deseja remover permanentemente este jogador e seus registros financeiros?');
        if (confirmDelete) {
            try {
                const res = await fetch(`${API_BASE}/api/jogadores/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                });
                if (!res.ok) throw new Error('Erro ao excluir jogador.');
                
                closePlayerModal();
                refreshData();
            } catch (error) {
                alert(error.message);
            }
        }
    });
}

// 3. Atualizar Dados do Servidor
async function refreshData() {
    try {
        // Carrega jogadores
        const playersRes = await fetch(`${API_BASE}/api/jogadores`, { headers: getHeaders() });
        if (playersRes.status === 401 || playersRes.status === 403) {
            sessionStorage.clear();
            checkAuthentication();
            return;
        }
        players = await playersRes.json();
        
        // Carrega mensalidades
        const paymentsRes = await fetch(`${API_BASE}/api/mensalidades`, { headers: getHeaders() });
        payments = await paymentsRes.json();
        
        // Atualiza interface
        updateStats();
        renderPlayersGrid();
        renderPaymentsTable();
    } catch (error) {
        console.error('Erro ao buscar dados do Inter Sul:', error);
    }
}

// 4. Calcular Estatísticas do Dashboard
function updateStats() {
    if (statTotalPlayers) statTotalPlayers.textContent = players.length;
    
    const meses = ['maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    
    const labelOk = document.getElementById('stat-monthly-ok-label');
    const labelPending = document.getElementById('stat-monthly-pending-label');
    const labelExempt = document.getElementById('stat-monthly-exempt-label');
    const statExempt = document.getElementById('stat-monthly-exempt');
    
    let okCount = 0;
    let pendingCount = 0;
    let exemptCount = 0;
    
    if (selectedMonthFilter === 'todos') {
        if (labelOk) labelOk.textContent = 'Mensalidades Confirmadas (Todos os Meses)';
        if (labelPending) labelPending.textContent = 'Mensalidades Pendentes (Todos os Meses)';
        if (labelExempt) labelExempt.textContent = 'Mensalidades Isentas (Todos os Meses)';
        
        Object.keys(payments).forEach(playerId => {
            const playerPay = payments[playerId];
            if (playerPay) {
                meses.forEach(m => {
                    const st = playerPay[m] || 'Pendente';
                    if (st === 'Confirmado') okCount++;
                    else if (st === 'Pendente') pendingCount++;
                    else if (st === 'Isento') exemptCount++;
                });
            }
        });
    } else {
        const refMonthName = selectedMonthFilter.charAt(0).toUpperCase() + selectedMonthFilter.slice(1);
        if (labelOk) labelOk.textContent = `Mensalidades Confirmadas (${refMonthName})`;
        if (labelPending) labelPending.textContent = `Mensalidades Pendentes (${refMonthName})`;
        if (labelExempt) labelExempt.textContent = `Mensalidades Isentas (${refMonthName})`;
        
        Object.keys(payments).forEach(playerId => {
            const playerPay = payments[playerId];
            if (playerPay) {
                const st = playerPay[selectedMonthFilter] || 'Pendente';
                if (st === 'Confirmado') okCount++;
                else if (st === 'Pendente') pendingCount++;
                else if (st === 'Isento') exemptCount++;
            }
        });
    }
    
    if (statMonthlyOk) statMonthlyOk.textContent = okCount;
    if (statMonthlyPending) statMonthlyPending.textContent = pendingCount;
    if (statExempt) statExempt.textContent = exemptCount;
}

// 5. Renderizar o Grid de Jogadores
function renderPlayersGrid() {
    playersGrid.innerHTML = '';
    
    const filteredPlayers = players.filter(p => {
        const nameMatch = p.nome_completo.toLowerCase().includes(currentSearchQuery);
        const posSearchMatch = p.posicao.toLowerCase().includes(currentSearchQuery);
        const posFilterMatch = selectedPlayerPosFilter === 'todos' || p.posicao.toUpperCase() === selectedPlayerPosFilter.toUpperCase();
        return (nameMatch || posSearchMatch) && posFilterMatch;
    });
    
    if (playersCountText) {
        playersCountText.textContent = `${filteredPlayers.length} de ${players.length} jogadores`;
    }
    
    if (filteredPlayers.length === 0) {
        playersGrid.innerHTML = `
            <div class="loading-state" style="grid-column: 1/-1;">
                <i class="fa-solid fa-face-frown-open" style="font-size: 2.5rem; color: var(--text-muted);"></i>
                <p>Nenhum jogador encontrado com os filtros atuais.</p>
            </div>
        `;
        return;
    }
    
    filteredPlayers.forEach(p => {
        const card = document.createElement('div');
        card.classList.add('player-card');
        
        // Se a URL já é Base64 (data:...) usa diretamente, caso contrário adiciona o API_BASE
        const photoUrl = p.imagem_url
            ? (p.imagem_url.startsWith('data:') ? p.imagem_url : `${API_BASE}${p.imagem_url}`)
            : '';
        const age = p.data_nascimento ? calculateAge(p.data_nascimento) : 'N/A';
        const formattedBirth = p.data_nascimento ? formatDate(p.data_nascimento) : 'Não informada';
        
        card.innerHTML = `
            <div class="player-photo-slot">
                <img src="${photoUrl}" alt="Foto de ${p.nome_completo}" class="${p.imagem_url ? '' : 'hide'}" onerror="this.classList.add('hide');">
                <span class="badge-position">${p.posicao}</span>
            </div>
            <div class="player-info-body">
                <h3 class="player-name-title">${p.nome_completo}</h3>
                <div class="player-meta-details">
                    <p><i class="fa-solid fa-cake-candles"></i> ${age} anos (${formattedBirth})</p>
                    <p><i class="fa-solid fa-id-card"></i> CPF: ${p.cpf || 'Não cadastrado'}</p>
                    <p><i class="fa-solid fa-passport"></i> RG: ${p.rg || 'Não cadastrado'}</p>
                </div>
                <button class="btn-card-edit">
                    <i class="fa-solid fa-user-pen"></i> Editar Ficha
                </button>
            </div>
        `;
        
        card.addEventListener('click', () => openPlayerModal(p));
        playersGrid.appendChild(card);
    });
}

// 6. Renderizar a Tabela de Mensalidades
function renderPaymentsTable() {
    paymentsTableBody.innerHTML = '';
    
    const meses = ['maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    
    // Destaca o cabeçalho da coluna do mês selecionado
    const thElements = document.querySelectorAll('.payments-table th');
    thElements.forEach((th, index) => {
        if (index >= 2) {
            const monthKey = meses[index - 2];
            if (selectedMonthFilter === monthKey) {
                th.classList.add('active-column-header');
            } else {
                th.classList.remove('active-column-header');
            }
        }
    });

    // Filtragem dos jogadores
    const filteredPlayers = players.filter(p => {
        // 1. Filtro por busca rápida (nome do jogador)
        const nameMatch = paymentSearchQuery === '' || p.nome_completo.toLowerCase().includes(paymentSearchQuery);
        if (!nameMatch) return false;

        // 2. Filtro por Posição
        if (selectedPosFilter !== 'todos') {
            if (p.posicao.toUpperCase() !== selectedPosFilter.toUpperCase()) return false;
        }

        // 3. Filtro por status / pendências
        if (selectedStatusFilter !== 'todos') {
            const playerPay = payments[p.id] || {};
            if (selectedMonthFilter !== 'todos') {
                const currentStatus = playerPay[selectedMonthFilter] || 'Em aberto';
                if (currentStatus !== selectedStatusFilter) return false;
            } else {
                const hasStatusInAnyMonth = meses.some(m => (playerPay[m] || 'Em aberto') === selectedStatusFilter);
                if (!hasStatusInAnyMonth) return false;
            }
        }
        
        return true;
    });

    // Atualiza estatística de contagem de registros visíveis
    if (paymentsCountText) {
        paymentsCountText.textContent = `Exibindo ${filteredPlayers.length} de ${players.length} registros`;
    }

    renderActiveFilterTags();

    if (filteredPlayers.length === 0) {
        paymentsTableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                    <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2.2rem; margin-bottom: 0.5rem; display: block; color: var(--intersul-blue);"></i>
                    Nenhum registro encontrado para os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }
    
    filteredPlayers.forEach(p => {
        const tr = document.createElement('tr');
        
        // Coluna Posição
        const tdPos = document.createElement('td');
        tdPos.className = 'position-cell';
        tdPos.textContent = p.posicao;
        tr.appendChild(tdPos);
        
        // Coluna Nome do Jogador
        const tdName = document.createElement('td');
        tdName.className = 'player-table-name';
        tdName.textContent = p.nome_completo;
        tr.appendChild(tdName);
        
        // Colunas de Meses de Pagamento
        meses.forEach(mes => {
            const tdMes = document.createElement('td');
            if (selectedMonthFilter === mes) {
                tdMes.classList.add('active-column-cell');
            }
            
            const playerPay = payments[p.id] || {};
            const status = playerPay[mes] || 'Em aberto';
            
            // Criando o seletor dropdown elegante
            const selectWrapper = document.createElement('div');
            selectWrapper.className = 'status-select-wrapper';
            
            const select = document.createElement('select');
            select.className = 'status-dropdown';
            select.setAttribute('data-status', status);
            
            const optionsData = [
                { value: 'Confirmado', label: 'Confirmado' },
                { value: 'Pendente', label: 'Pendente' },
                { value: 'Em aberto', label: 'Em aberto' },
                { value: 'Isento', label: 'Isento' }
            ];

            optionsData.forEach(optInfo => {
                const opt = document.createElement('option');
                opt.value = optInfo.value;
                opt.textContent = optInfo.label;
                opt.selected = status === optInfo.value || (optInfo.value === 'Em aberto' && status === '');
                select.appendChild(opt);
            });
            
            // Ao alterar o dropdown, estagia a alteração e habilita o botão Salvar
            select.addEventListener('change', (e) => {
                const newStatus = e.target.value;
                select.setAttribute('data-status', newStatus);
                
                const stagedKey = `${p.id}_${mes}`;
                stagedPaymentChanges[stagedKey] = {
                    jogador_id: p.id,
                    mes: mes,
                    status: newStatus
                };
                
                // Atualiza cache local para refletir imediatamente
                if (!payments[p.id]) payments[p.id] = {};
                payments[p.id][mes] = newStatus;
                
                updateSaveButtonState();
                updateStats();
            });
            
            selectWrapper.appendChild(select);
            tdMes.appendChild(selectWrapper);
            tr.appendChild(tdMes);
        });
        
        paymentsTableBody.appendChild(tr);
    });
}

// Renderizar pílulas de filtros ativos com botão remover rápido
function renderActiveFilterTags() {
    if (!activeFilterTags) return;
    activeFilterTags.innerHTML = '';

    const tags = [];
    if (selectedMonthFilter !== 'todos') {
        const monthLabel = selectedMonthFilter.charAt(0).toUpperCase() + selectedMonthFilter.slice(1);
        tags.push({ key: 'month', label: `Mês: ${monthLabel}` });
    }
    if (selectedStatusFilter !== 'todos') {
        tags.push({ key: 'status', label: `Status: ${selectedStatusFilter}` });
    }
    if (selectedPosFilter !== 'todos') {
        tags.push({ key: 'pos', label: `Posição: ${selectedPosFilter}` });
    }
    if (paymentSearchQuery !== '') {
        tags.push({ key: 'search', label: `Busca: "${paymentSearchQuery}"` });
    }

    tags.forEach(tag => {
        const pill = document.createElement('span');
        pill.className = 'filter-tag';
        pill.innerHTML = `${tag.label} <i class="fa-solid fa-xmark"></i>`;
        pill.addEventListener('click', () => {
            if (tag.key === 'month') {
                selectedMonthFilter = 'todos';
                if (filterMonthSelect) filterMonthSelect.value = 'todos';
                updateStats();
            } else if (tag.key === 'status') {
                selectedStatusFilter = 'todos';
                if (filterStatusSelect) filterStatusSelect.value = 'todos';
            } else if (tag.key === 'pos') {
                selectedPosFilter = 'todos';
                if (filterPosSelect) filterPosSelect.value = 'todos';
            } else if (tag.key === 'search') {
                paymentSearchQuery = '';
                if (paymentSearchInput) paymentSearchInput.value = '';
            }
            renderPaymentsTable();
        });
        activeFilterTags.appendChild(pill);
    });
}

// 6.1 Operações de Salvamento e Notificações
async function saveAllPaymentChanges() {
    const changesArray = Object.values(stagedPaymentChanges);
    if (changesArray.length === 0) {
        showToast('Nenhuma alteração pendente para salvar.');
        return;
    }
    
    try {
        if (btnSavePayments) {
            btnSavePayments.disabled = true;
            btnSavePayments.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        }
        
        const response = await fetch(`${API_BASE}/api/mensalidades/batch`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(changesArray)
        });
        
        if (!response.ok) throw new Error('Erro ao salvar mensalidades em lote.');
        
        stagedPaymentChanges = {};
        updateSaveButtonState();
        showToast('Alterações salvas com sucesso!');
        refreshData();
    } catch (error) {
        alert(error.message);
    } finally {
        if (btnSavePayments) {
            btnSavePayments.disabled = false;
        }
        updateSaveButtonState();
    }
}

function updateSaveButtonState() {
    const count = Object.keys(stagedPaymentChanges).length;
    if (!btnSavePayments) return;
    
    if (count > 0) {
        btnSavePayments.classList.add('has-changes');
        btnSavePayments.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações (${count})`;
    } else {
        btnSavePayments.classList.remove('has-changes');
        btnSavePayments.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações`;
    }
}

function showToast(message) {
    if (!paymentToast || !toastMessage) return;
    toastMessage.textContent = message;
    paymentToast.classList.remove('hide');
    setTimeout(() => {
        paymentToast.classList.add('hide');
    }, 4000);
}

// 7. Modals Operações
function openPlayerModal(player = null) {
    playerForm.reset();
    photoFileInput.value = '';
    
    if (player) {
        // Modo Edição
        modalTitle.textContent = 'Editar Dados do Jogador';
        playerIdInput.value = player.id;
        playerNameInput.value = player.nome_completo;
        playerPosSelect.value = player.posicao;
        playerBirthInput.value = player.data_nascimento || '';
        playerRgInput.value = player.rg || '';
        playerCpfInput.value = player.cpf || '';
        
        if (player.imagem_url) {
            // Suporte a Base64 (data:...) e URLs relativas
            playerPhotoImg.src = player.imagem_url.startsWith('data:')
                ? player.imagem_url
                : `${API_BASE}${player.imagem_url}`;
            playerPhotoImg.classList.remove('hide');
            placeholderIcon.classList.add('hide');
        } else {
            playerPhotoImg.classList.add('hide');
            placeholderIcon.classList.remove('hide');
        }
        
        btnDeletePlayer.classList.remove('hide');
    } else {
        // Modo Cadastro
        modalTitle.textContent = 'Cadastrar Novo Jogador';
        playerIdInput.value = '';
        playerPhotoImg.classList.add('hide');
        placeholderIcon.classList.remove('hide');
        btnDeletePlayer.classList.add('hide');
    }
    
    playerModal.classList.add('open');
}

function closePlayerModal() {
    playerModal.classList.remove('open');
    selectedPlayerId = null;
}

// 8. Funções Utilitárias
function calculateAge(birthDateString) {
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
