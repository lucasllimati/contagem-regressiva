// Contagem Regressiva Profissional
// Separação de responsabilidades:
// 1) DOM hooks
// 2) Estado em memória
// 3) Persistência em localStorage
// 4) Renderização com filtros, ordenação e contagem

const eventList = document.getElementById('eventList');
const openFormBtn = document.getElementById('openFormBtn');
const cancelBtn = document.getElementById('cancelBtn');
const eventFormWrapper = document.getElementById('eventFormWrapper');
const descriptionInput = document.getElementById('descriptionInput');
const dateInput = document.getElementById('dateInput');
const colorInput = document.getElementById('colorInput');
const priorityInput = document.getElementById('priorityInput');
const saveBtn = document.getElementById('saveBtn');
const formTitle = document.getElementById('formTitle');
const totalEventsValue = document.getElementById('totalEvents');
const activeEventsValue = document.getElementById('activeEvents');
const expiredEventsValue = document.getElementById('expiredEvents');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const sortOrder = document.getElementById('sortOrder');
const themeSelect = document.getElementById('themeSelect');

const events = [];
const storageKey = 'contagemRegressivaEventsV1';
const preferencesStorageKey = 'contagemRegressivaPreferencesV1';
let editingEventId = null;

const colors = {
    blue: '#38bdf8',
    purple: '#6366f1',
    green: '#34d399',
    orange: '#fbbf24',
    red: '#f87171'
};

const priorityMap = {
    low: { label: 'Baixa', order: 1 },
    medium: { label: 'Média', order: 2 },
    high: { label: 'Alta', order: 3 },
    critical: { label: 'Crítica', order: 4 }
};

/**
 * Converte uma data para o formato aceito pelo input datetime-local.
 * @param {Date} date
 * @returns {string}
 */
function formatInputDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Define o fim do dia atual como data-hora de referência para evento padrão.
 * @returns {Date}
 */
function endOfCurrentDayDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

/**
 * Define fim do ano atual como evento padrão.
 * @returns {Date}
 */
function endOfYearDate() {
    const now = new Date();
    return new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
}

/**
 * Inicializa eventos padrão quando nenhum dado estiver salvo.
 */
function initializeDefaults() {
    const savedEvents = loadEvents();

    if (savedEvents.length > 0) {
        events.push(...savedEvents);
        return;
    }

    events.push({
        id: makeId(),
        description: 'Até 23:59 do dia atual',
        date: endOfCurrentDayDate().toISOString(),
        defaultEvent: true,
        active: true,
        color: 'blue',
        priority: 'high',
        createdAt: new Date().toISOString()
    });

    events.push({
        id: makeId(),
        description: 'Até o final do ano',
        date: endOfYearDate().toISOString(),
        defaultEvent: true,
        active: true,
        color: 'purple',
        priority: 'medium',
        createdAt: new Date().toISOString()
    });

    saveEvents();
}

/**
 * Recupera eventos do armazenamento local.
 * @returns {Array<object>}
 */
function loadEvents() {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return parsed.map((event) => {
            if (!event.createdAt) {
                event.createdAt = new Date().toISOString();
            }
            return event;
        });
    } catch (error) {
        console.warn('Não foi possível carregar eventos salvos.', error);
        return [];
    }
}

/**
 * Salva eventos no armazenamento local com captura segura de falhas.
 */
function saveEvents() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(events));
    } catch (error) {
        console.warn('Não foi possível salvar eventos.', error);
    }
}

/**
 * Restaura preferências de apresentação e filtros salvas localmente.
 */
function loadPreferences() {
    try {
        const preferences = JSON.parse(localStorage.getItem(preferencesStorageKey) || '{}');
        const validFilters = ['all', 'active', 'inactive', 'expired'];
        const validSortOrders = ['soonest', 'latest', 'priority', 'alphabetical'];
        const validThemes = ['blue', 'violet', 'green', 'mono'];

        if (validFilters.includes(preferences.statusFilter)) {
            statusFilter.value = preferences.statusFilter;
        }
        if (validSortOrders.includes(preferences.sortOrder)) {
            sortOrder.value = preferences.sortOrder;
        }
        if (validThemes.includes(preferences.theme)) {
            themeSelect.value = preferences.theme;
        }
        if (typeof preferences.search === 'string') {
            searchInput.value = preferences.search;
        }
    } catch (error) {
        console.warn('Não foi possível carregar as preferências salvas.', error);
    }
}

/**
 * Persiste as preferências atuais de visualização.
 */
function savePreferences() {
    try {
        localStorage.setItem(preferencesStorageKey, JSON.stringify({
            statusFilter: statusFilter.value,
            sortOrder: sortOrder.value,
            theme: themeSelect.value,
            search: searchInput.value
        }));
    } catch (error) {
        console.warn('Não foi possível salvar as preferências.', error);
    }
}

/**
 * Cria identificador de evento simples e único.
 * @returns {string}
 */
function makeId() {
    return Math.random().toString(36).slice(2, 10);
}

/**
 * Renderiza a lista de eventos com filtros e ordenação aplicados.
 */
function renderEvents() {
    const filtered = getFilteredAndSortedEvents();
    eventList.innerHTML = '';

    for (const event of filtered) {
        const card = document.createElement('article');
        card.className = event.active === false ? 'event-card inactive' : 'event-card';
        card.dataset.id = event.id;
        card.style.borderLeft = `4px solid ${colors[event.color] || colors.blue}`;

        const targetTime = new Date(event.date).getTime();
        const difference = targetTime - Date.now();
        const eventDone = difference <= 0;

        const info = document.createElement('div');
        info.className = 'event-info';

        const descWrap = document.createElement('div');
        descWrap.style.display = 'flex';
        descWrap.style.flexDirection = 'column';
        descWrap.style.gap = '8px';

        const desc = document.createElement('div');
        desc.className = 'event-description';
        desc.innerHTML = event.description;

        const priority = document.createElement('div');
        priority.className = `priority-tag priority-${event.priority || 'low'}`;
        priority.innerHTML = `Prioridade ${priorityMap[event.priority || 'low'].label}`;

        descWrap.appendChild(desc);
        descWrap.appendChild(priority);

        const eventMeta = document.createElement('div');
        eventMeta.className = 'event-meta';

        const totalCountdown = document.createElement('div');
        totalCountdown.className = 'event-total-countdown';
        totalCountdown.setAttribute('aria-label', 'Tempo restante total em dias, horas, minutos e segundos');

        const totalCountdownLabel = document.createElement('span');
        totalCountdownLabel.className = 'event-total-label';
        totalCountdownLabel.textContent = eventDone ? 'Prazo encerrado' : 'Total restante';
        totalCountdown.appendChild(totalCountdownLabel);

        const totalCountdownUnits = document.createElement('div');
        totalCountdownUnits.className = 'event-total-units';
        const totalCountdownValues = calculateTotalCountdown(targetTime);
        for (const unit of [
            { value: totalCountdownValues.days, label: 'd' },
            { value: totalCountdownValues.hours, label: 'h' },
            { value: totalCountdownValues.minutes, label: 'min' },
            { value: totalCountdownValues.seconds, label: 'seg' }
        ]) {
            const unitElement = document.createElement('span');
            const valueElement = document.createElement('strong');
            valueElement.textContent = String(unit.value).padStart(unit.label === 'd' ? 1 : 2, '0');
            const labelElement = document.createElement('small');
            labelElement.textContent = unit.label;
            unitElement.append(valueElement, labelElement);
            totalCountdownUnits.appendChild(unitElement);
        }
        totalCountdown.appendChild(totalCountdownUnits);

        const dateText = document.createElement('div');
        dateText.className = 'event-date';
        dateText.innerHTML = new Date(event.date).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        eventMeta.append(totalCountdown, dateText);
        info.appendChild(descWrap);
        info.appendChild(eventMeta);

        const grid = document.createElement('div');
        grid.className = 'countdown-grid';

        const count = calculateCountdown(targetTime);
        const units = [
            { key: 'weeks', value: count.weeks, label: 'Semanas' },
            { key: 'days', value: count.days, label: 'Dias' },
            { key: 'hours', value: count.hours, label: 'Horas' },
            { key: 'minutes', value: count.minutes, label: 'Minutos' },
            { key: 'seconds', value: count.seconds, label: 'Segundos' }
        ];

        const visibleUnits = [];
        for (const unit of units) {
            if (unit.key === 'weeks' && unit.value === 0) continue;
            if (unit.key === 'days' && unit.value === 0 && count.weeks === 0) continue;
            if (unit.key === 'hours' && unit.value === 0 && count.days === 0 && count.weeks === 0) continue;
            if (unit.key === 'minutes' && unit.value === 0 && count.hours === 0 && count.days === 0 && count.weeks === 0) continue;
            visibleUnits.push(unit);
        }

        for (const unit of visibleUnits) {
            const timeCard = document.createElement('div');
            timeCard.className = 'time-card';

            const value = document.createElement('div');
            value.className = 'time-value';
            value.innerHTML = unit.value;

            const label = document.createElement('div');
            label.className = 'time-label';
            label.innerHTML = unit.label;

            timeCard.appendChild(value);
            timeCard.appendChild(label);
            grid.appendChild(timeCard);
        }

        const progressWrap = document.createElement('div');
        progressWrap.className = 'progress-wrapper';

        const progressHead = document.createElement('div');
        progressHead.className = 'progress-head';
        const progressLabel = document.createElement('span');
        progressLabel.innerHTML = eventDone ? 'Conclusão' : 'Progresso';
        const progressPercent = document.createElement('span');
        progressPercent.className = 'progress-percent';
        progressHead.appendChild(progressLabel);
        progressHead.appendChild(progressPercent);

        const progressLine = document.createElement('div');
        progressLine.className = 'progress-line';
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        if (eventDone) {
            progressBar.classList.add('finished');
        }

        const eventCreatedAt = event.createdAt ? new Date(event.createdAt).getTime() : Date.now();
        const target = new Date(event.date).getTime();
        const totalDuration = Math.max(1, target - eventCreatedAt);
        const elapsed = Math.max(0, Date.now() - eventCreatedAt);
        const rawProgress = eventDone ? 100 : Math.min(99, Math.max(0, (elapsed / totalDuration) * 100));
        const progressPercentValue = Math.round(rawProgress);

        progressBar.style.width = `${Math.max(0, Math.min(100, progressPercentValue))}%`;
        progressPercent.innerHTML = `${progressPercentValue}%`;

        if (eventDone) {
            progressBar.style.width = '100%';
            progressBar.classList.add('finished');
            progressPercent.innerHTML = '100%';
        }

        progressLine.appendChild(progressBar);
        progressWrap.appendChild(progressHead);
        progressWrap.appendChild(progressLine);

        const actions = document.createElement('div');
        actions.className = 'event-actions';

        const status = document.createElement('div');
        status.className = eventDone ? 'event-status status-finished' : 'event-status';
        status.innerHTML = eventDone ? 'Expirado · Concluído' : 'Ativo';

        const actionGroup = document.createElement('div');
        actionGroup.className = 'event-action-group';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = event.active === false ? 'toggle-btn disabled' : 'toggle-btn';
        toggle.innerHTML = event.active === false ? 'Ativar' : 'Desativar';
        toggle.addEventListener('click', () => {
            event.active = event.active === false ? true : false;
            saveEvents();
            renderEvents();
        });

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'event-action-btn';
        edit.innerHTML = 'Editar';
        edit.addEventListener('click', () => {
            openFormForEdit(event.id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'event-action-btn delete';
        deleteBtn.innerHTML = 'Excluir';
        deleteBtn.addEventListener('click', () => {
            const idx = events.findIndex(item => item.id === event.id);
            if (idx >= 0) {
                events.splice(idx, 1);
                saveEvents();
                renderEvents();
            }
        });

        actionGroup.appendChild(toggle);
        actionGroup.appendChild(edit);
        actionGroup.appendChild(deleteBtn);

        actions.appendChild(status);
        actions.appendChild(actionGroup);

        card.appendChild(info);
        card.appendChild(grid);
        card.appendChild(progressWrap);
        card.appendChild(actions);
        eventList.appendChild(card);
    }

    renderStats();
}

/**
 * Aplica o filtro de texto, filtro de estado e ordenação do fluxo de exibição.
 * @returns {Array<object>}
 */
function getFilteredAndSortedEvents() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const filter = statusFilter.value || 'all';
    const sort = sortOrder.value || 'soonest';

    let filtered = events.filter(event => {
        const matchesQuery = !query || event.description.toLowerCase().includes(query);
        const isExpired = new Date(event.date).getTime() < Date.now();
        const active = event.active !== false;

        if (!matchesQuery) return false;

        if (filter === 'active') return active && !isExpired;
        if (filter === 'inactive') return !active;
        if (filter === 'expired') return isExpired;
        return true;
    });

    filtered.sort((a, b) => {
        if (sort === 'latest') return new Date(a.date) - new Date(b.date);
        if (sort === 'priority') return (priorityMap[b.priority || 'low'].order || 0) - (priorityMap[a.priority || 'low'].order || 0);
        if (sort === 'alphabetical') return a.description.localeCompare(b.description);
        return new Date(a.date) - new Date(b.date);
    });

    return filtered;
}

/**
 * Atualiza o painel de estatísticas.
 */
function renderStats() {
    const expired = events.filter(event => new Date(event.date).getTime() < Date.now()).length;
    const active = events.filter(event => event.active && new Date(event.date).getTime() >= Date.now()).length;

    totalEventsValue.innerHTML = String(events.length);
    activeEventsValue.innerHTML = String(active);
    expiredEventsValue.innerHTML = String(expired);
}

/**
 * Calcula a contagem regressiva em semanas, dias, horas, minutos e segundos.
 * @param {number} targetTime
 * @returns {{weeks: number, days: number, hours: number, minutes: number, seconds: number}}
 */
function calculateCountdown(targetTime) {
    const diff = Math.max(0, targetTime - Date.now());
    const second = 1000;
    const minute = second * 60;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;

    const weeks = Math.floor(diff / week);
    const days = Math.floor((diff % week) / day);
    const hours = Math.floor((diff % day) / hour);
    const minutes = Math.floor((diff % hour) / minute);
    const seconds = Math.floor((diff % minute) / second);

    return { weeks, days, hours, minutes, seconds };
}

/**
 * Calcula o tempo restante com dias totais, sem converter em semanas ou meses.
 * @param {number} targetTime
 * @returns {{days: number, hours: number, minutes: number, seconds: number}}
 */
function calculateTotalCountdown(targetTime) {
    const totalSeconds = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
    const secondsPerDay = 24 * 60 * 60;

    return {
        days: Math.floor(totalSeconds / secondsPerDay),
        hours: Math.floor((totalSeconds % secondsPerDay) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60
    };
}

/**
 * Abre o formulário de edição para um item já existente.
 * @param {string} id
 */
function openFormForEdit(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;

    editingEventId = id;
    eventFormWrapper.classList.add('open');
    formTitle.innerHTML = 'Editar evento';
    saveBtn.innerHTML = 'Salvar';
    descriptionInput.value = event.description;
    dateInput.value = formatInputDate(new Date(event.date));
    colorInput.value = event.color || 'blue';
    priorityInput.value = event.priority || 'medium';
}

/**
 * Limpa o formulário e fecha o painel.
 */
function resetForm() {
    eventFormWrapper.classList.remove('open');
    formTitle.innerHTML = 'Adicionar evento';
    saveBtn.innerHTML = 'Confirmar';
    descriptionInput.value = '';
    dateInput.value = formatInputDate(new Date());
    colorInput.value = 'blue';
    priorityInput.value = 'medium';
    editingEventId = null;
}

openFormBtn.addEventListener('click', () => {
    eventFormWrapper.classList.toggle('open');
    if (!eventFormWrapper.classList.contains('open')) {
        resetForm();
    }
});

cancelBtn.addEventListener('click', () => {
    resetForm();
});

saveBtn.addEventListener('click', () => {
    const description = descriptionInput.value.trim();
    const date = new Date(dateInput.value);

    if (!description || Number.isNaN(date.getTime())) {
        eventFormWrapper.classList.add('open');
        return;
    }

    if (editingEventId) {
        const event = events.find(item => item.id === editingEventId);
        if (event) {
            event.description = description;
            event.date = date.toISOString();
            event.color = colorInput.value || 'blue';
            event.priority = priorityInput.value || 'medium';
            if (!event.createdAt) {
                event.createdAt = new Date().toISOString();
            }
        }
    } else {
        events.unshift({
            id: makeId(),
            description,
            date: date.toISOString(),
            defaultEvent: false,
            active: true,
            color: colorInput.value || 'blue',
            priority: priorityInput.value || 'medium',
            createdAt: new Date().toISOString()
        });
    }

    saveEvents();
    resetForm();
    renderEvents();
});

searchInput.addEventListener('input', () => {
    savePreferences();
    renderEvents();
});
statusFilter.addEventListener('change', () => {
    savePreferences();
    renderEvents();
});
sortOrder.addEventListener('change', () => {
    savePreferences();
    renderEvents();
});
themeSelect.addEventListener('change', () => {
    savePreferences();
    applyTheme();
});

/**
 * Atualiza as variáveis de cor no documento conforme o tema escolhido.
 */
function applyTheme() {
    const selected = themeSelect.value || 'blue';
    const themes = {
        blue: { '--blue': '#38bdf8', '--purple': '#6366f1', '--green': '#34d399', '--danger': '#f87171' },
        violet: { '--blue': '#8b5cf6', '--purple': '#ec4899', '--green': '#34d399', '--danger': '#f87171' },
        green: { '--blue': '#22c55e', '--purple': '#14b8a6', '--green': '#bef264', '--danger': '#f87171' },
        mono: { '--blue': '#cbd5e1', '--purple': '#94a3b8', '--green': '#e2e8f0', '--danger': '#f87171' }
    };

    const selectedTheme = themes[selected] || themes.blue;
    const root = document.documentElement;
    Object.entries(selectedTheme).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

initializeDefaults();
loadPreferences();
dateInput.value = formatInputDate(new Date());
applyTheme();
renderEvents();
setInterval(renderEvents, 1000);
