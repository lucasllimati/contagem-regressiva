// Contagem Regressiva
// Separação de responsabilidades:
// 1) DOM hooks
// 2) Estado em memória: eventos fixos (data/eventos-fixos.js) e eventos do usuário
// 3) Persistência em localStorage (somente eventos do usuário e preferências)
// 4) Renderização da estrutura e atualização dos números a cada segundo

const periodList = document.getElementById('periodList');
const eventList = document.getElementById('eventList');
const eventSummary = document.getElementById('eventSummary');
const openFormBtn = document.getElementById('openFormBtn');
const eventDialog = document.getElementById('eventDialog');
const eventForm = document.getElementById('eventForm');
const cancelBtn = document.getElementById('cancelBtn');
const descriptionInput = document.getElementById('descriptionInput');
const dateInput = document.getElementById('dateInput');
const colorInput = document.getElementById('colorInput');
const priorityInput = document.getElementById('priorityInput');
const categoryInput = document.getElementById('categoryInput');
const recurrenceInput = document.getElementById('recurrenceInput');
const reminderInput = document.getElementById('reminderInput');
const notesInput = document.getElementById('notesInput');
const linkInput = document.getElementById('linkInput');
const saveBtn = document.getElementById('saveBtn');
const formTitle = document.getElementById('formTitle');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const sortOrder = document.getElementById('sortOrder');
const themeSelect = document.getElementById('themeSelect');
const dataMenu = document.getElementById('dataMenu');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const templateBtn = document.getElementById('templateBtn');
const importFileInput = document.getElementById('importFileInput');
const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
const appMessage = document.getElementById('appMessage');

const fixedConfig = window.FIXED_EVENTS || { periods: [], events: [] };
const events = [];
const fixedEvents = [];
const periods = [];
const cardRefs = new Map();
const storageKey = 'contagemRegressivaEventsV1';
const preferencesStorageKey = 'contagemRegressivaPreferencesV1';
const validRecurrences = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const validReminderIntervals = [0, 300, 3600, 86400];
const validPeriods = ['day', 'month', 'year'];
let editingEventId = null;
let messageTimeout = null;
let notificationsEnabled = false;

const colors = {
    blue: '#4fb3ff',
    purple: '#9b8cff',
    green: '#4ade9b',
    orange: '#f2b84b',
    red: '#ff7a7a'
};

const priorityMap = {
    low: { label: 'Baixa', order: 1 },
    medium: { label: 'Média', order: 2 },
    high: { label: 'Alta', order: 3 },
    critical: { label: 'Crítica', order: 4 }
};

const recurrenceLabels = {
    daily: 'Repete diariamente',
    weekly: 'Repete semanalmente',
    monthly: 'Repete mensalmente',
    yearly: 'Repete anualmente'
};

const themes = {
    blue: { '--accent': '#4fb3ff', '--accent-strong': '#8fd0ff' },
    violet: { '--accent': '#a78bfa', '--accent-strong': '#c9b8ff' },
    green: { '--accent': '#4ade80', '--accent-strong': '#94f0b4' },
    mono: { '--accent': '#d5dce6', '--accent-strong': '#ffffff' }
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Converte uma data para o formato aceito pelo input datetime-local.
 * @param {Date} date
 * @returns {string}
 */
function formatInputDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatEventDate(date) {
    return new Date(date).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function plural(count, singular, pluralForm) {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Retorna todos os eventos exibidos na lista: fixos primeiro, depois os do usuário.
 * @returns {Array<object>}
 */
function allEvents() {
    return [...fixedEvents, ...events];
}

/**
 * Carrega períodos e eventos fixos definidos em data/eventos-fixos.js.
 */
function loadFixedConfig() {
    for (const period of fixedConfig.periods || []) {
        if (!period || !validPeriods.includes(period.period) || typeof period.description !== 'string') continue;
        periods.push({ id: String(period.id || period.period), description: period.description, period: period.period });
    }

    for (const rawEvent of fixedConfig.events || []) {
        const event = normalizeEvent(rawEvent);
        if (!event) continue;
        event.fixed = true;
        event.active = true;
        fixedEvents.push(event);
    }
}

/**
 * Identifica eventos salvos por versões anteriores que agora vêm do arquivo de fixos
 * (eventos padrão de dia/ano e o GTA VI que ficava direto no código).
 * @param {object} event
 * @returns {boolean}
 */
function isLegacyOrFixed(event) {
    if (!event || typeof event !== 'object') return false;
    const description = typeof event.description === 'string' ? event.description.trim().toLocaleLowerCase('pt-BR') : '';
    return event.defaultEvent === true
        || fixedEvents.some(fixed => fixed.id === event.id || fixed.description.toLocaleLowerCase('pt-BR') === description);
}

/**
 * Recupera eventos do usuário do armazenamento local.
 * @returns {Array<object>}
 */
function loadEvents() {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(event => !isLegacyOrFixed(event)).map(normalizeEvent).filter(Boolean);
    } catch (error) {
        console.warn('Não foi possível carregar eventos salvos.', error);
        return [];
    }
}

/**
 * Salva os eventos do usuário no armazenamento local com captura segura de falhas.
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

        if (validFilters.includes(preferences.statusFilter)) {
            statusFilter.value = preferences.statusFilter;
        }
        if (validSortOrders.includes(preferences.sortOrder)) {
            sortOrder.value = preferences.sortOrder;
        }
        if (Object.hasOwn(themes, preferences.theme)) {
            themeSelect.value = preferences.theme;
        }
        if (typeof preferences.search === 'string') {
            searchInput.value = preferences.search;
        }
        notificationsEnabled = preferences.notificationsEnabled === true
            && 'Notification' in window
            && Notification.permission === 'granted';
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
            search: searchInput.value,
            notificationsEnabled
        }));
    } catch (error) {
        console.warn('Não foi possível salvar as preferências.', error);
    }
}

function normalizeEvent(event) {
    if (!event || typeof event !== 'object' || typeof event.description !== 'string' || !event.description.trim()) return null;
    const parsedDate = new Date(event.date);
    if (Number.isNaN(parsedDate.getTime())) return null;

    const parsedCreatedAt = new Date(event.createdAt);
    const recurrence = validRecurrences.includes(event.recurrence) ? event.recurrence : 'none';
    const reminderSeconds = Number(event.reminderSeconds);

    return {
        id: typeof event.id === 'string' && event.id ? event.id : makeId(),
        description: event.description.trim().slice(0, 120),
        date: parsedDate.toISOString(),
        active: event.active !== false,
        color: Object.hasOwn(colors, event.color) ? event.color : 'blue',
        priority: Object.hasOwn(priorityMap, event.priority) ? event.priority : 'medium',
        createdAt: Number.isNaN(parsedCreatedAt.getTime()) ? new Date().toISOString() : parsedCreatedAt.toISOString(),
        category: typeof event.category === 'string' ? event.category.trim().slice(0, 40) : '',
        notes: typeof event.notes === 'string' ? event.notes.slice(0, 1000) : '',
        link: normalizeLink(event.link || ''),
        recurrence,
        reminderSeconds: validReminderIntervals.includes(reminderSeconds) ? reminderSeconds : 0,
        reminderSentFor: typeof event.reminderSentFor === 'string' ? event.reminderSentFor : ''
    };
}

function normalizeLink(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value.trim());
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
        return '';
    }
}

function showMessage(message) {
    appMessage.textContent = message;
    appMessage.hidden = false;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        appMessage.hidden = true;
    }, 5000);
}

function updateNotificationsButton() {
    enableNotificationsBtn.textContent = notificationsEnabled ? 'Desativar lembretes' : 'Ativar lembretes';
    enableNotificationsBtn.setAttribute('aria-pressed', String(notificationsEnabled));
}

/**
 * Cria identificador de evento simples e único.
 * @returns {string}
 */
function makeId() {
    return Math.random().toString(36).slice(2, 10);
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

/* ---------- Períodos (dia, mês, ano) ---------- */

/**
 * Calcula início e fim do período atual. O fim é a meia-noite que encerra o período.
 * @param {'day'|'month'|'year'} period
 * @param {Date} now
 * @returns {{start: Date, end: Date}}
 */
function getPeriodRange(period, now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth();
    if (period === 'day') {
        const day = now.getDate();
        return { start: new Date(year, month, day), end: new Date(year, month, day + 1) };
    }
    if (period === 'month') {
        return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
    }
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

function getPeriodContext(period, now = new Date()) {
    if (period === 'day') {
        return now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (period === 'month') {
        return now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    return String(now.getFullYear());
}

const periodElapsedLabels = { day: 'do dia', month: 'do mês', year: 'do ano' };

function renderPeriods() {
    const now = new Date();
    periodList.innerHTML = '';

    for (const period of periods) {
        const { start, end } = getPeriodRange(period.period, now);
        const remaining = calculateTotalCountdown(end.getTime());
        const elapsedPercent = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
        const percent = Math.floor(elapsedPercent);

        const tile = createElement('article', `period-tile period-${period.period}`);
        tile.setAttribute('aria-label', period.description);

        const head = createElement('div', 'period-head');
        head.append(
            createElement('h3', 'period-title', period.description),
            createElement('p', 'period-context', getPeriodContext(period.period, now))
        );

        const clock = createElement('p', 'period-clock');
        if (remaining.days > 0) {
            const days = createElement('span', 'period-days', `${remaining.days}`);
            days.appendChild(createElement('small', '', remaining.days === 1 ? ' dia' : ' dias'));
            clock.appendChild(days);
        }
        clock.appendChild(createElement('span', 'period-time', `${pad2(remaining.hours)}:${pad2(remaining.minutes)}:${pad2(remaining.seconds)}`));

        const progressLine = createElement('div', 'progress-line');
        progressLine.setAttribute('role', 'progressbar');
        progressLine.setAttribute('aria-label', `Quanto já passou ${periodElapsedLabels[period.period]}`);
        progressLine.setAttribute('aria-valuemin', '0');
        progressLine.setAttribute('aria-valuemax', '100');
        progressLine.setAttribute('aria-valuenow', String(percent));
        const progressBar = createElement('div', 'progress-bar');
        progressBar.style.width = `${elapsedPercent}%`;
        progressLine.appendChild(progressBar);

        const caption = createElement('p', 'period-caption', `${percent}% ${periodElapsedLabels[period.period]} já passou`);

        tile.append(head, clock, progressLine, caption);
        periodList.appendChild(tile);
    }
}

/* ---------- Eventos ---------- */

function getVisibleUnits(count) {
    const units = [
        { key: 'weeks', value: count.weeks, label: ['semana', 'semanas'] },
        { key: 'days', value: count.days, label: ['dia', 'dias'] },
        { key: 'hours', value: count.hours, label: ['hora', 'horas'] },
        { key: 'minutes', value: count.minutes, label: ['minuto', 'minutos'] },
        { key: 'seconds', value: count.seconds, label: ['segundo', 'segundos'] }
    ];

    // Oculta unidades maiores zeradas, começando pela maior unidade com valor.
    const firstIndex = units.findIndex(unit => unit.value > 0);
    return units.slice(firstIndex === -1 ? units.length - 1 : firstIndex);
}

function formatUnitValue(unit, isLeading) {
    return isLeading || unit.key === 'weeks' || unit.key === 'days' ? String(unit.value) : pad2(unit.value);
}

function getEventProgress(event, done) {
    if (done) return 100;
    const start = new Date(event.createdAt).getTime();
    const target = new Date(event.date).getTime();
    const total = Math.max(1, target - start);
    return Math.min(99, Math.max(0, ((Date.now() - start) / total) * 100));
}

function formatTotalCountdown(targetTime) {
    const total = calculateTotalCountdown(targetTime);
    const clock = `${pad2(total.hours)}:${pad2(total.minutes)}:${pad2(total.seconds)}`;
    return total.days > 0 ? `${plural(total.days, 'dia', 'dias')} e ${clock} no total` : `${clock} no total`;
}

/**
 * Monta a assinatura visual de um cartão. Quando ela muda (ex.: a unidade "semanas" some
 * ou o evento encerra), a lista é reconstruída; caso contrário, só os números mudam.
 */
function getCardSignature(event) {
    const targetTime = new Date(event.date).getTime();
    const done = targetTime - Date.now() <= 0;
    const units = getVisibleUnits(calculateCountdown(targetTime)).map(unit => unit.key).join(',');
    return `${done}|${units}`;
}

/**
 * Renderiza a lista de eventos com filtros e ordenação aplicados.
 */
function renderEvents() {
    if (advanceRecurringEvents()) saveEvents();
    const filtered = getFilteredAndSortedEvents();
    eventList.innerHTML = '';
    cardRefs.clear();

    if (filtered.length === 0) {
        renderEmptyState();
        renderSummary();
        return;
    }

    for (const event of filtered) {
        eventList.appendChild(buildEventCard(event));
    }

    renderSummary();
}

function renderEmptyState() {
    const emptyState = createElement('div', 'empty-state');
    const hasEvents = allEvents().length > 0;
    emptyState.append(
        createElement('h3', 'empty-title', hasEvents ? 'Nenhum evento encontrado' : 'Sua lista está vazia'),
        createElement('p', 'empty-text', hasEvents
            ? 'Ajuste a busca ou os filtros para encontrar seus eventos.'
            : 'Crie um evento ou importe um arquivo JSON para começar.')
    );

    const action = createElement('button', 'btn btn-secondary', hasEvents ? 'Limpar filtros' : 'Novo evento');
    action.type = 'button';
    action.addEventListener('click', () => {
        if (!hasEvents) {
            openFormForCreate();
            return;
        }
        searchInput.value = '';
        statusFilter.value = 'all';
        savePreferences();
        renderEvents();
    });
    emptyState.appendChild(action);
    eventList.appendChild(emptyState);
}

function buildEventCard(event) {
    const targetTime = new Date(event.date).getTime();
    const done = targetTime - Date.now() <= 0;
    const inactive = event.active === false;

    const card = createElement('article', 'event-card');
    if (inactive) card.classList.add('inactive');
    if (event.fixed) card.classList.add('fixed');
    if (done) card.classList.add('done');
    card.dataset.id = event.id;
    card.setAttribute('aria-label', `Evento: ${event.description}`);
    card.style.setProperty('--event-color', colors[event.color] || colors.blue);

    // Cabeçalho: nome, etiquetas, data
    const head = createElement('div', 'event-head');
    const titleBlock = createElement('div', 'event-title-block');
    titleBlock.appendChild(createElement('h3', 'event-title', event.description));

    const tags = createElement('div', 'event-tags');
    if (event.fixed) tags.appendChild(createElement('span', 'tag tag-fixed', 'Fixo'));
    tags.appendChild(createElement('span', `tag tag-priority priority-${event.priority}`, `Prioridade ${priorityMap[event.priority].label.toLocaleLowerCase('pt-BR')}`));
    if (event.category) tags.appendChild(createElement('span', 'tag', event.category));
    if (event.recurrence !== 'none') tags.appendChild(createElement('span', 'tag', recurrenceLabels[event.recurrence]));
    if (event.reminderSeconds > 0) {
        tags.appendChild(createElement('span', 'tag', `Lembrete ${formatRemainingTime(event.reminderSeconds * 1000)} antes`));
    }
    titleBlock.appendChild(tags);

    const when = createElement('div', 'event-when');
    const time = createElement('time', 'event-date', formatEventDate(event.date));
    time.dateTime = event.date;
    const total = createElement('p', 'event-total', done ? 'Prazo encerrado' : formatTotalCountdown(targetTime));
    when.append(time, total);
    head.append(titleBlock, when);

    // Contagem
    const countdown = createElement('div', 'countdown');
    countdown.setAttribute('aria-label', 'Tempo restante');
    const unitRefs = new Map();
    const visibleUnits = getVisibleUnits(calculateCountdown(targetTime));
    visibleUnits.forEach((unit, index) => {
        const unitElement = createElement('div', 'countdown-unit');
        const value = createElement('span', 'countdown-value', formatUnitValue(unit, index === 0));
        const label = createElement('span', 'countdown-label', unit.label[unit.value === 1 ? 0 : 1]);
        unitElement.append(value, label);
        countdown.appendChild(unitElement);
        unitRefs.set(unit.key, { value, label, isLeading: index === 0 });
    });

    // Progresso
    const progressPercentValue = Math.round(getEventProgress(event, done));
    const progress = createElement('div', 'progress');
    const progressHead = createElement('div', 'progress-head');
    const progressPercent = createElement('span', 'progress-percent', `${progressPercentValue}%`);
    progressHead.append(createElement('span', '', done ? 'Concluído' : 'Progresso'), progressPercent);
    const progressLine = createElement('div', 'progress-line');
    progressLine.setAttribute('role', 'progressbar');
    progressLine.setAttribute('aria-label', `Progresso até ${event.description}`);
    progressLine.setAttribute('aria-valuemin', '0');
    progressLine.setAttribute('aria-valuemax', '100');
    progressLine.setAttribute('aria-valuenow', String(progressPercentValue));
    const progressBar = createElement('div', 'progress-bar');
    progressBar.style.width = `${progressPercentValue}%`;
    progressLine.appendChild(progressBar);
    progress.append(progressHead, progressLine);

    // Evento encerrado não mostra contagem zerada; o progresso já indica a conclusão.
    card.append(head);
    if (!done) card.appendChild(countdown);
    card.appendChild(progress);

    if (event.notes) card.appendChild(createElement('p', 'event-notes', event.notes));

    const safeLink = normalizeLink(event.link);
    if (safeLink) {
        const link = createElement('a', 'event-link', 'Abrir link relacionado');
        link.href = safeLink;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        card.appendChild(link);
    }

    card.appendChild(buildEventFooter(event, done, inactive));

    cardRefs.set(event.id, {
        event,
        signature: getCardSignature(event),
        unitRefs,
        total,
        progressBar,
        progressPercent,
        progressLine
    });

    return card;
}

function buildEventFooter(event, done, inactive) {
    const footer = createElement('div', 'event-footer');
    let statusText = 'Ativo';
    let statusClass = 'status-active';
    if (done) {
        statusText = 'Encerrado';
        statusClass = 'status-done';
    } else if (inactive) {
        statusText = 'Desativado';
        statusClass = 'status-inactive';
    }
    footer.appendChild(createElement('span', `event-status ${statusClass}`, statusText));

    const actions = createElement('div', 'event-actions');
    if (event.fixed) {
        const note = createElement('span', 'event-fixed-note', 'Evento fixo');
        note.title = 'Altere em data/eventos-fixos.js';
        actions.appendChild(note);
        footer.appendChild(actions);
        return footer;
    }

    const toggle = createElement('button', 'btn btn-ghost btn-sm', inactive ? 'Ativar' : 'Desativar');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', `${inactive ? 'Ativar' : 'Desativar'} evento ${event.description}`);
    toggle.addEventListener('click', () => {
        event.active = inactive;
        saveEvents();
        renderEvents();
    });

    const edit = createElement('button', 'btn btn-ghost btn-sm', 'Editar');
    edit.type = 'button';
    edit.setAttribute('aria-label', `Editar evento ${event.description}`);
    edit.addEventListener('click', () => openFormForEdit(event.id));

    const deleteBtn = createElement('button', 'btn btn-ghost btn-sm btn-danger', 'Excluir');
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', `Excluir evento ${event.description}`);
    deleteBtn.addEventListener('click', () => {
        if (!window.confirm(`Excluir o evento "${event.description}"?`)) return;
        const idx = events.findIndex(item => item.id === event.id);
        if (idx >= 0) {
            events.splice(idx, 1);
            saveEvents();
            renderEvents();
            showMessage(`Evento "${event.description}" excluído.`);
        }
    });

    actions.append(toggle, edit, deleteBtn);
    footer.appendChild(actions);
    return footer;
}

/**
 * Atualiza apenas os números dos cartões já renderizados, preservando o foco do teclado.
 * Reconstrói a lista quando a estrutura de algum cartão precisa mudar.
 */
function tick() {
    renderPeriods();
    checkReminders();

    if (advanceRecurringEvents()) {
        saveEvents();
        renderEvents();
        return;
    }

    for (const refs of cardRefs.values()) {
        if (getCardSignature(refs.event) !== refs.signature) {
            renderEvents();
            return;
        }
    }

    for (const refs of cardRefs.values()) {
        const targetTime = new Date(refs.event.date).getTime();
        const done = targetTime - Date.now() <= 0;
        for (const unit of getVisibleUnits(calculateCountdown(targetTime))) {
            const unitRef = refs.unitRefs.get(unit.key);
            if (!unitRef) continue;
            unitRef.value.textContent = formatUnitValue(unit, unitRef.isLeading);
            unitRef.label.textContent = unit.label[unit.value === 1 ? 0 : 1];
        }
        if (!done) refs.total.textContent = formatTotalCountdown(targetTime);

        const percent = Math.round(getEventProgress(refs.event, done));
        refs.progressBar.style.width = `${percent}%`;
        refs.progressPercent.textContent = `${percent}%`;
        refs.progressLine.setAttribute('aria-valuenow', String(percent));
    }

    renderSummary();
}

function nextOccurrence(date, recurrence) {
    const next = new Date(date);
    if (recurrence === 'daily') {
        next.setDate(next.getDate() + 1);
    } else if (recurrence === 'weekly') {
        next.setDate(next.getDate() + 7);
    } else if (recurrence === 'monthly') {
        const day = next.getDate();
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    } else if (recurrence === 'yearly') {
        const month = next.getMonth();
        const day = next.getDate();
        const year = next.getFullYear() + 1;
        next.setFullYear(year, month, 1);
        next.setDate(Math.min(day, new Date(year, month + 1, 0).getDate()));
    }
    return next;
}

function advanceRecurringEvents(now = Date.now()) {
    let changed = false;
    for (const event of allEvents()) {
        if (!validRecurrences.includes(event.recurrence) || event.recurrence === 'none') continue;
        let target = new Date(event.date);
        let safetyCount = 0;
        while (target.getTime() <= now && safetyCount < 10000) {
            const previousTarget = target.getTime();
            target = nextOccurrence(target, event.recurrence);
            event.createdAt = new Date(previousTarget).toISOString();
            event.date = target.toISOString();
            event.reminderSentFor = '';
            changed = true;
            safetyCount += 1;
        }
        if (target.getTime() <= now && ['daily', 'weekly'].includes(event.recurrence)) {
            const daysPerOccurrence = event.recurrence === 'daily' ? 1 : 7;
            const elapsedDays = Math.floor((now - target.getTime()) / 86400000) + 1;
            const jumps = Math.ceil(elapsedDays / daysPerOccurrence) * daysPerOccurrence;
            target.setDate(target.getDate() + jumps);
            while (target.getTime() <= now) {
                target = nextOccurrence(target, event.recurrence);
            }
            const previousTarget = new Date(target);
            previousTarget.setDate(previousTarget.getDate() - daysPerOccurrence);
            event.createdAt = previousTarget.toISOString();
            event.date = target.toISOString();
            event.reminderSentFor = '';
            changed = true;
        }
    }
    return changed;
}

function checkReminders() {
    if (!notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;

    const now = Date.now();
    let changed = false;
    for (const event of allEvents()) {
        const reminderSeconds = Number(event.reminderSeconds) || 0;
        if (!event.active || reminderSeconds <= 0) continue;

        const target = new Date(event.date).getTime();
        const remaining = target - now;
        if (remaining <= 0 || remaining > reminderSeconds * 1000 || event.reminderSentFor === event.date) continue;

        let notification;
        try {
            notification = new Notification('Lembrete de evento', {
                body: `${event.description} vence em ${formatRemainingTime(remaining)}.`,
                tag: `event-${event.id}`
            });
        } catch (error) {
            notificationsEnabled = false;
            savePreferences();
            updateNotificationsButton();
            showMessage('O navegador não conseguiu exibir notificações. Confira as permissões do site.');
            return;
        }
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        event.reminderSentFor = event.date;
        changed = true;
    }
    if (changed) saveEvents();
}

function formatRemainingTime(milliseconds) {
    const totalMinutes = Math.ceil(milliseconds / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.ceil(totalMinutes / 60);
    if (hours < 24) return `${hours} h`;
    return plural(Math.ceil(hours / 24), 'dia', 'dias');
}

/* ---------- Importação, exportação e modelo ---------- */

function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = fileName;
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportEvents() {
    downloadJson({
        app: 'contagem-regressiva',
        version: 1,
        exportedAt: new Date().toISOString(),
        events
    }, `contagem-regressiva-${new Date().toISOString().slice(0, 10)}.json`);
    showMessage(`${plural(events.length, 'evento exportado', 'eventos exportados')}. Eventos fixos ficam em data/eventos-fixos.js.`);
}

/**
 * Gera um arquivo modelo com exemplos de datas futuras e a lista de valores aceitos.
 * Apenas "description" e "date" são obrigatórios.
 */
function downloadTemplate() {
    const inDays = (days, hour) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        date.setHours(hour, 0, 0, 0);
        return date.toISOString();
    };

    downloadJson({
        app: 'contagem-regressiva',
        version: 1,
        instrucoes: {
            obrigatorios: 'description e date. Os demais campos são opcionais.',
            date: 'Data ISO 8601, ex.: 2026-12-24T20:00:00-03:00',
            color: 'blue | purple | green | orange | red',
            priority: 'low | medium | high | critical',
            recurrence: 'none | daily | weekly | monthly | yearly',
            reminderSeconds: '0 (sem lembrete) | 300 (5 min) | 3600 (1 h) | 86400 (1 dia)',
            link: 'Endereço começando com http:// ou https://'
        },
        events: [
            {
                description: 'Entrega do projeto',
                date: inDays(21, 18),
                category: 'Trabalho',
                priority: 'high',
                color: 'blue',
                recurrence: 'none',
                reminderSeconds: 3600,
                notes: 'Revisar o documento final e confirmar os anexos antes do envio.',
                link: 'https://example.com/projeto'
            },
            {
                description: 'Reunião de planejamento',
                date: inDays(5, 14),
                category: 'Equipe',
                priority: 'medium',
                color: 'green',
                recurrence: 'weekly',
                reminderSeconds: 300,
                notes: '',
                link: ''
            },
            {
                description: 'Pagamento mensal',
                date: inDays(11, 12),
                category: 'Pessoal',
                priority: 'critical',
                color: 'orange',
                recurrence: 'monthly',
                reminderSeconds: 86400,
                notes: 'Conferir o valor e guardar o comprovante.',
                link: ''
            }
        ]
    }, 'modelo-eventos.json');
    showMessage('Modelo baixado. Preencha os eventos e use Backup > Importar arquivo JSON.');
}

async function importEvents(file) {
    if (!file || file.size > 2 * 1024 * 1024) {
        showMessage('O arquivo é inválido ou passa do limite de 2 MB.');
        return;
    }

    try {
        const backup = JSON.parse(await file.text());
        const importedEvents = Array.isArray(backup) ? backup : backup.events;
        if (!Array.isArray(importedEvents)) throw new Error('Formato inválido');

        const knownIds = new Set(allEvents().map(event => event.id));
        let importedCount = 0;
        let skippedCount = 0;
        for (const rawEvent of importedEvents) {
            const event = isLegacyOrFixed(rawEvent) ? null : normalizeEvent(rawEvent);
            if (!event || knownIds.has(event.id)) {
                skippedCount += 1;
                continue;
            }
            knownIds.add(event.id);
            events.push(event);
            importedCount += 1;
        }

        saveEvents();
        renderEvents();
        const skippedText = skippedCount > 0 ? ` ${plural(skippedCount, 'ignorado', 'ignorados')} por estar repetido ou incompleto.` : '';
        showMessage(`${plural(importedCount, 'evento importado', 'eventos importados')}.${skippedText}`);
    } catch (error) {
        showMessage('Não foi possível importar. Use um arquivo JSON no formato do modelo.');
    } finally {
        importFileInput.value = '';
    }
}

/* ---------- Filtros e resumo ---------- */

/**
 * Aplica o filtro de texto, filtro de estado e ordenação do fluxo de exibição.
 * @returns {Array<object>}
 */
function getFilteredAndSortedEvents() {
    const query = (searchInput.value || '').trim().toLocaleLowerCase('pt-BR');
    const filter = statusFilter.value || 'all';
    const sort = sortOrder.value || 'soonest';

    const filtered = allEvents().filter(event => {
        const searchableText = `${event.description} ${event.category || ''} ${event.notes || ''}`.toLocaleLowerCase('pt-BR');
        if (query && !searchableText.includes(query)) return false;

        const isExpired = new Date(event.date).getTime() < Date.now();
        const active = event.active !== false;
        if (filter === 'active') return active && !isExpired;
        if (filter === 'inactive') return !active;
        if (filter === 'expired') return isExpired;
        return true;
    });

    const now = Date.now();
    const isDone = (event) => new Date(event.date).getTime() <= now;
    filtered.sort((a, b) => {
        if (Boolean(a.fixed) !== Boolean(b.fixed)) return a.fixed ? -1 : 1;
        // Encerrados vão para o fim da lista em qualquer ordenação.
        if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
        if (sort === 'latest') return new Date(b.date) - new Date(a.date);
        if (sort === 'priority') return priorityMap[b.priority].order - priorityMap[a.priority].order;
        if (sort === 'alphabetical') return a.description.localeCompare(b.description, 'pt-BR');
        return new Date(a.date) - new Date(b.date);
    });

    return filtered;
}

/**
 * Atualiza o resumo de contagem ao lado do título da lista.
 */
function renderSummary() {
    const list = allEvents();
    const now = Date.now();
    const expired = list.filter(event => new Date(event.date).getTime() < now).length;
    const active = list.filter(event => event.active && new Date(event.date).getTime() >= now).length;
    const text = `${plural(list.length, 'evento', 'eventos')}, ${plural(active, 'ativo', 'ativos')}, ${plural(expired, 'encerrado', 'encerrados')}`;
    if (eventSummary.textContent !== text) eventSummary.textContent = text;
}

/**
 * Calcula a contagem regressiva em semanas, dias, horas, minutos e segundos.
 * @param {number} targetTime
 * @returns {{weeks: number, days: number, hours: number, minutes: number, seconds: number}}
 */
function calculateCountdown(targetTime) {
    const total = calculateTotalCountdown(targetTime);
    return {
        weeks: Math.floor(total.days / 7),
        days: total.days % 7,
        hours: total.hours,
        minutes: total.minutes,
        seconds: total.seconds
    };
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

/* ---------- Formulário ---------- */

function openFormForCreate() {
    resetForm();
    eventDialog.showModal();
    descriptionInput.focus();
}

/**
 * Abre o formulário de edição para um evento do usuário.
 * @param {string} id
 */
function openFormForEdit(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;

    editingEventId = id;
    formTitle.textContent = 'Editar evento';
    saveBtn.textContent = 'Salvar alterações';
    descriptionInput.value = event.description;
    dateInput.value = formatInputDate(new Date(event.date));
    colorInput.value = event.color;
    priorityInput.value = event.priority;
    categoryInput.value = event.category;
    recurrenceInput.value = event.recurrence;
    reminderInput.value = String(event.reminderSeconds);
    notesInput.value = event.notes;
    linkInput.value = event.link;
    eventDialog.showModal();
    descriptionInput.focus();
}

/**
 * Limpa o formulário para um novo cadastro.
 */
function resetForm() {
    formTitle.textContent = 'Novo evento';
    saveBtn.textContent = 'Criar evento';
    eventForm.reset();
    dateInput.value = formatInputDate(new Date(Date.now() + 60 * 60 * 1000));
    editingEventId = null;
}

openFormBtn.addEventListener('click', openFormForCreate);
cancelBtn.addEventListener('click', () => eventDialog.close());
eventDialog.addEventListener('close', resetForm);
eventDialog.addEventListener('click', (clickEvent) => {
    // Clique no fundo escurecido fecha o diálogo.
    if (clickEvent.target === eventDialog) eventDialog.close();
});

eventForm.addEventListener('submit', (submission) => {
    submission.preventDefault();
    const description = descriptionInput.value.trim();
    const date = new Date(dateInput.value);
    const link = normalizeLink(linkInput.value);

    if (!description) {
        descriptionInput.focus();
        showMessage('Informe um nome para o evento.');
        return;
    }
    if (!dateInput.value || Number.isNaN(date.getTime())) {
        dateInput.focus();
        showMessage('Informe uma data e hora válidas.');
        return;
    }
    if (linkInput.value.trim() && !link) {
        linkInput.focus();
        showMessage('O link precisa começar com http:// ou https://.');
        return;
    }

    const fields = {
        description: description.slice(0, 120),
        color: colorInput.value || 'blue',
        priority: priorityInput.value || 'medium',
        category: categoryInput.value.trim().slice(0, 40),
        recurrence: recurrenceInput.value,
        reminderSeconds: Number(reminderInput.value) || 0,
        notes: notesInput.value.trim().slice(0, 1000),
        link
    };

    if (editingEventId) {
        const event = events.find(item => item.id === editingEventId);
        if (event) {
            const newDate = date.toISOString();
            if (event.date !== newDate) {
                event.createdAt = new Date().toISOString();
                event.reminderSentFor = '';
            }
            Object.assign(event, fields, { date: newDate });
        }
        showMessage(`Evento "${fields.description}" salvo.`);
    } else {
        events.unshift({
            id: makeId(),
            ...fields,
            date: date.toISOString(),
            active: true,
            createdAt: new Date().toISOString(),
            reminderSentFor: ''
        });
        showMessage(`Evento "${fields.description}" criado.`);
    }

    saveEvents();
    eventDialog.close();
    renderEvents();
});

/* ---------- Ferramentas ---------- */

exportBtn.addEventListener('click', () => {
    dataMenu.open = false;
    exportEvents();
});
importBtn.addEventListener('click', () => {
    dataMenu.open = false;
    importFileInput.click();
});
templateBtn.addEventListener('click', () => {
    dataMenu.open = false;
    downloadTemplate();
});
importFileInput.addEventListener('change', () => importEvents(importFileInput.files[0]));

document.addEventListener('click', (clickEvent) => {
    if (dataMenu.open && !dataMenu.contains(clickEvent.target)) dataMenu.open = false;
});
dataMenu.addEventListener('keydown', (keyboardEvent) => {
    if (keyboardEvent.key === 'Escape' && dataMenu.open) {
        dataMenu.open = false;
        dataMenu.querySelector('summary').focus();
    }
});

enableNotificationsBtn.addEventListener('click', async () => {
    if (notificationsEnabled) {
        notificationsEnabled = false;
        savePreferences();
        updateNotificationsButton();
        showMessage('Lembretes desativados.');
        return;
    }
    if (!('Notification' in window)) {
        showMessage('Este navegador não oferece suporte a notificações.');
        return;
    }
    try {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';
        showMessage(notificationsEnabled
            ? 'Lembretes ativados. Mantenha o app aberto para recebê-los.'
            : 'Permissão de notificações não concedida.');
        savePreferences();
        updateNotificationsButton();
    } catch (error) {
        showMessage('Não foi possível ativar as notificações neste navegador.');
    }
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
    const selectedTheme = themes[themeSelect.value] || themes.blue;
    const root = document.documentElement;
    Object.entries(selectedTheme).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

loadFixedConfig();
events.push(...loadEvents());
saveEvents();
loadPreferences();
resetForm();
applyTheme();
updateNotificationsButton();
renderPeriods();
renderEvents();
setInterval(tick, 1000);
