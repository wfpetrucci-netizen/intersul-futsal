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
const btnAddPlayer = document.getElementById('btn-add-player');
const playersGrid = document.getElementById('players-grid');

const paymentsTableBody = document.getElementById('payments-table-body');

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

    // Busca de Jogadores
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        renderPlayersGrid();
    });

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
    statTotalPlayers.textContent = players.length;
    
    // Calcula mensalidades de Julho (mês base de referência na imagem)
    let okCount = 0;
    let pendingCount = 0;
    
    Object.keys(payments).forEach(playerId => {
        const playerPay = payments[playerId];
        if (playerPay && playerPay.julho) {
            if (playerPay.julho === 'Confirmado') {
                okCount++;
            } else if (playerPay.julho === 'Pendente') {
                pendingCount++;
            }
        }
    });
    
    statMonthlyOk.textContent = okCount;
    statMonthlyPending.textContent = pendingCount;
}

// 5. Renderizar o Grid de Jogadores
function renderPlayersGrid() {
    playersGrid.innerHTML = '';
    
    const filteredPlayers = players.filter(p => {
        const nameMatch = p.nome_completo.toLowerCase().includes(currentSearchQuery);
        const posMatch = p.posicao.toLowerCase().includes(currentSearchQuery);
        return nameMatch || posMatch;
    });
    
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
        
        const photoUrl = p.imagem_url ? `${API_BASE}${p.imagem_url}` : '';
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
    
    players.forEach(p => {
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
            const playerPay = payments[p.id] || {};
            const status = playerPay[mes] || 'Em aberto';
            
            // Criando o seletor dropdown elegante
            const selectWrapper = document.createElement('div');
            selectWrapper.className = 'status-select-wrapper';
            
            const select = document.createElement('select');
            select.className = 'status-dropdown';
            select.setAttribute('data-status', status);
            
            const optConfirm = document.createElement('option');
            optConfirm.value = 'Confirmado';
            optConfirm.textContent = 'Confirmado';
            optConfirm.selected = status === 'Confirmado';
            
            const optPending = document.createElement('option');
            optPending.value = 'Pendente';
            optPending.textContent = 'Pendente';
            optPending.selected = status === 'Pendente';
            
            const optOpen = document.createElement('option');
            optOpen.value = 'Em aberto';
            optOpen.textContent = 'Em aberto';
            optOpen.selected = status === 'Em aberto' || status === '';
            
            select.appendChild(optConfirm);
            select.appendChild(optPending);
            select.appendChild(optOpen);
            
            // Salvar no servidor em tempo real ao alterar
            select.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                select.setAttribute('data-status', newStatus);
                
                try {
                    const res = await fetch(`${API_BASE}/api/mensalidades/${p.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({ mes, status: newStatus })
                    });
                    
                    if (!res.ok) throw new Error('Erro ao salvar status de pagamento');
                    
                    // Atualiza dados locais
                    if (!payments[p.id]) payments[p.id] = {};
                    payments[p.id][mes] = newStatus;
                    updateStats();
                } catch (error) {
                    alert(error.message);
                }
            });
            
            selectWrapper.appendChild(select);
            tdMes.appendChild(selectWrapper);
            tr.appendChild(tdMes);
        });
        
        paymentsTableBody.appendChild(tr);
    });
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
            playerPhotoImg.src = `${API_BASE}${player.imagem_url}`;
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
