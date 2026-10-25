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
const categoryInput = document.getElementById('categoryInput');
const recurrenceInput = document.getElementById('recurrenceInput');
const reminderInput = document.getElementById('reminderInput');
const notesInput = document.getElementById('notesInput');
const linkInput = document.getElementById('linkInput');
const saveBtn = document.getElementById('saveBtn');
const formTitle = document.getElementById('formTitle');
const totalEventsValue = document.getElementById('totalEvents');
const activeEventsValue = document.getElementById('activeEvents');
const expiredEventsValue = document.getElementById('expiredEvents');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const sortOrder = document.getElementById('sortOrder');
const themeSelect = document.getElementById('themeSelect');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFileInput');
const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
const appMessage = document.getElementById('appMessage');

const events = [];
const storageKey = 'contagemRegressivaEventsV1';
const preferencesStorageKey = 'contagemRegressivaPreferencesV1';
const validRecurrences = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const validReminderIntervals = [0, 300, 3600, 86400];
let editingEventId = null;
let messageTimeout = null;
let notificationsEnabled = false;

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
        ensurePinnedGtaEvent();
        saveEvents();
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

    ensurePinnedGtaEvent();
    saveEvents();
}

function ensurePinnedGtaEvent() {
    const existingGtaEvent = events.find(event =>
        event.id === 'gta-vi-release' || event.description.trim().toLocaleLowerCase('pt-BR') === 'gta vi'
    );

    if (existingGtaEvent) {
        existingGtaEvent.pinned = true;
        return;
    }

    events.unshift({
        id: 'gta-vi-release',
        description: 'GTA VI',
        date: new Date(2026, 10, 19, 0, 0, 0, 0).toISOString(),
        defaultEvent: true,
        active: true,
        color: 'red',
        priority: 'critical',
        createdAt: new Date().toISOString(),
        category: 'Games',
        notes: 'Evento fixado: lançamento de GTA VI.',
        link: '',
        recurrence: 'none',
        reminderSeconds: 0,
        reminderSentFor: '',
        pinned: true
    });
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
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeEvent).filter(Boolean);
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
    const link = normalizeLink(event.link || '');

    return {
        id: typeof event.id === 'string' && event.id ? event.id : makeId(),
        description: event.description.trim().slice(0, 120),
        date: parsedDate.toISOString(),
        defaultEvent: Boolean(event.defaultEvent),
        active: event.active !== false,
        color: Object.hasOwn(colors, event.color) ? event.color : 'blue',
        priority: Object.hasOwn(priorityMap, event.priority) ? event.priority : 'medium',
        createdAt: Number.isNaN(parsedCreatedAt.getTime()) ? new Date().toISOString() : parsedCreatedAt.toISOString(),
        category: typeof event.category === 'string' ? event.category.trim().slice(0, 40) : '',
        notes: typeof event.notes === 'string' ? event.notes.slice(0, 1000) : '',
        link,
        recurrence,
        reminderSeconds: validReminderIntervals.includes(reminderSeconds) ? reminderSeconds : 0,
        reminderSentFor: typeof event.reminderSentFor === 'string' ? event.reminderSentFor : '',
        pinned: Boolean(event.pinned)
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

function loadNotificationPreference() {
    return notificationsEnabled;
}

function updateNotificationsButton() {
    const enabled = loadNotificationPreference();
    enableNotificationsBtn.textContent = enabled ? 'Desativar lembretes' : 'Ativar lembretes';
    enableNotificationsBtn.setAttribute('aria-pressed', String(enabled));
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
    checkReminders();
    if (advanceRecurringEvents()) saveEvents();
    const filtered = getFilteredAndSortedEvents();
    eventList.innerHTML = '';

    if (filtered.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        const title = document.createElement('h2');
        const description = document.createElement('p');
        const hasEvents = events.length > 0;
        title.textContent = hasEvents ? 'Nenhum evento encontrado' : 'Sua lista está vazia';
        description.textContent = hasEvents
            ? 'Ajuste a busca ou os filtros para encontrar seus eventos.'
            : 'Crie um evento para começar a acompanhar seus prazos.';
        emptyState.append(title, description);

        if (hasEvents) {
            const clearFiltersBtn = document.createElement('button');
            clearFiltersBtn.type = 'button';
            clearFiltersBtn.className = 'secondary-btn';
            clearFiltersBtn.textContent = 'Limpar filtros';
            clearFiltersBtn.addEventListener('click', () => {
                searchInput.value = '';
                statusFilter.value = 'all';
                savePreferences();
                renderEvents();
            });
            emptyState.appendChild(clearFiltersBtn);
        }

        eventList.appendChild(emptyState);
        renderStats();
        return;
    }

    for (const event of filtered) {
        const card = document.createElement('article');
        card.className = `event-card${event.active === false ? ' inactive' : ''}${event.pinned ? ' pinned' : ''}`;
        card.dataset.id = event.id;
        card.setAttribute('aria-label', `Evento: ${event.description}`);
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
        desc.textContent = event.description;

        if (event.pinned) {
            const pinnedTag = document.createElement('span');
            pinnedTag.className = 'pinned-tag';
            pinnedTag.textContent = 'Fixado';
            descWrap.appendChild(desc);
            descWrap.appendChild(pinnedTag);
        } else {
            descWrap.appendChild(desc);
        }

        const priority = document.createElement('div');
        priority.className = `priority-tag priority-${event.priority || 'low'}`;
        priority.textContent = `Prioridade ${priorityMap[event.priority || 'medium'].label}`;

        if (event.category) {
            const category = document.createElement('span');
            category.className = 'category-tag';
            category.textContent = event.category;
            descWrap.appendChild(category);
        }
        if (event.recurrence && event.recurrence !== 'none') {
            const recurrenceLabels = {
                daily: 'Repete diariamente',
                weekly: 'Repete semanalmente',
                monthly: 'Repete mensalmente',
                yearly: 'Repete anualmente'
            };
            const recurrenceTag = document.createElement('span');
            recurrenceTag.className = 'category-tag';
            recurrenceTag.textContent = recurrenceLabels[event.recurrence];
            descWrap.appendChild(recurrenceTag);
        }
        if (event.reminderSeconds > 0) {
            const reminderTag = document.createElement('span');
            reminderTag.className = 'category-tag';
            reminderTag.textContent = `Lembrete: ${formatRemainingTime(event.reminderSeconds * 1000)} antes`;
            descWrap.appendChild(reminderTag);
        }
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

        if (event.notes) {
            const notes = document.createElement('p');
            notes.className = 'event-notes';
            notes.textContent = event.notes;
            card.appendChild(notes);
        }

        if (event.link) {
            const safeLink = normalizeLink(event.link);
            if (safeLink) {
                const link = document.createElement('a');
                link.className = 'event-link';
                link.href = safeLink;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = 'Abrir link relacionado';
                card.appendChild(link);
            }
        }

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
        progressLine.setAttribute('role', 'progressbar');
        progressLine.setAttribute('aria-label', `Progresso até ${event.description}`);
        progressLine.setAttribute('aria-valuemin', '0');
        progressLine.setAttribute('aria-valuemax', '100');
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
        progressLine.setAttribute('aria-valuenow', String(progressPercentValue));

        if (eventDone) {
            progressBar.style.width = '100%';
            progressBar.classList.add('finished');
            progressPercent.innerHTML = '100%';
            progressLine.setAttribute('aria-valuenow', '100');
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
        toggle.className = event.pinned || event.active === false ? 'toggle-btn disabled' : 'toggle-btn';
        toggle.innerHTML = event.pinned ? 'Fixado' : event.active === false ? 'Ativar' : 'Desativar';
        toggle.disabled = event.pinned;
        toggle.setAttribute('aria-label', event.pinned ? `${event.description} está fixado e não pode ser desativado` : `${event.active === false ? 'Ativar' : 'Desativar'} evento ${event.description}`);
        toggle.addEventListener('click', () => {
            event.active = event.active === false ? true : false;
            saveEvents();
            renderEvents();
        });

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'event-action-btn';
        edit.innerHTML = 'Editar';
        edit.setAttribute('aria-label', `Editar evento ${event.description}`);
        edit.addEventListener('click', () => {
            openFormForEdit(event.id);
        });

        let deleteBtn = null;
        if (!event.pinned) {
            deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'event-action-btn delete';
            deleteBtn.innerHTML = 'Excluir';
            deleteBtn.setAttribute('aria-label', `Excluir evento ${event.description}`);
            deleteBtn.addEventListener('click', () => {
                if (!window.confirm(`Excluir o evento "${event.description}"?`)) return;
                const idx = events.findIndex(item => item.id === event.id);
                if (idx >= 0) {
                    events.splice(idx, 1);
                    saveEvents();
                    renderEvents();
                }
            });
        }

        actionGroup.appendChild(toggle);
        actionGroup.appendChild(edit);
        if (deleteBtn) actionGroup.appendChild(deleteBtn);

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
    for (const event of events) {
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
    if (!loadNotificationPreference() || !('Notification' in window) || Notification.permission !== 'granted') return;

    const now = Date.now();
    let changed = false;
    for (const event of events) {
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
    return `${Math.ceil(hours / 24)} dia(s)`;
}

function exportEvents() {
    const backup = {
        app: 'contagem-regressiva',
        version: 1,
        exportedAt: new Date().toISOString(),
        events
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = `contagem-regressiva-${new Date().toISOString().slice(0, 10)}.json`;
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage(`${events.length} evento(s) exportado(s).`);
}

async function importEvents(file) {
    if (!file || file.size > 2 * 1024 * 1024) {
        showMessage('O arquivo é inválido ou excede o limite de 2 MB.');
        return;
    }

    try {
        const backup = JSON.parse(await file.text());
        const importedEvents = Array.isArray(backup) ? backup : backup.events;
        if (!Array.isArray(importedEvents)) throw new Error('Formato inválido');

        const knownIds = new Set(events.map(event => event.id));
        let importedCount = 0;
        for (const rawEvent of importedEvents) {
            const event = normalizeEvent(rawEvent);
            if (!event || knownIds.has(event.id)) continue;
            knownIds.add(event.id);
            events.push(event);
            importedCount += 1;
        }

        saveEvents();
        renderEvents();
        showMessage(`${importedCount} evento(s) importado(s); IDs duplicados ou inválidos foram ignorados.`);
    } catch (error) {
        showMessage('Não foi possível importar: selecione um backup JSON válido do app.');
    } finally {
        importFileInput.value = '';
    }
}

/**
 * Aplica o filtro de texto, filtro de estado e ordenação do fluxo de exibição.
 * @returns {Array<object>}
 */
function getFilteredAndSortedEvents() {
    const query = (searchInput.value || '').trim().toLocaleLowerCase('pt-BR');
    const filter = statusFilter.value || 'all';
    const sort = sortOrder.value || 'soonest';

    let filtered = events.filter(event => {
        const searchableText = `${event.description} ${event.category || ''} ${event.notes || ''}`.toLocaleLowerCase('pt-BR');
        const matchesQuery = !query || searchableText.includes(query);
        const isExpired = new Date(event.date).getTime() < Date.now();
        const active = event.active !== false;

        if (!matchesQuery) return false;

        if (filter === 'active') return active && !isExpired;
        if (filter === 'inactive') return !active;
        if (filter === 'expired') return isExpired;
        return true;
    });

    filtered.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (sort === 'latest') return new Date(b.date) - new Date(a.date);
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
    openFormBtn.setAttribute('aria-expanded', 'true');
    formTitle.innerHTML = 'Editar evento';
    saveBtn.innerHTML = 'Salvar';
    descriptionInput.value = event.description;
    dateInput.value = formatInputDate(new Date(event.date));
    colorInput.value = event.color || 'blue';
    priorityInput.value = event.priority || 'medium';
    categoryInput.value = event.category || '';
    recurrenceInput.value = event.recurrence || 'none';
    reminderInput.value = String(event.reminderSeconds || 0);
    notesInput.value = event.notes || '';
    linkInput.value = event.link || '';
    descriptionInput.focus();
}

/**
 * Limpa o formulário e fecha o painel.
 */
function resetForm() {
    eventFormWrapper.classList.remove('open');
    openFormBtn.setAttribute('aria-expanded', 'false');
    formTitle.innerHTML = 'Adicionar evento';
    saveBtn.innerHTML = 'Confirmar';
    descriptionInput.value = '';
    dateInput.value = formatInputDate(new Date());
    colorInput.value = 'blue';
    priorityInput.value = 'medium';
    categoryInput.value = '';
    recurrenceInput.value = 'none';
    reminderInput.value = '0';
    notesInput.value = '';
    linkInput.value = '';
    editingEventId = null;
}

openFormBtn.addEventListener('click', () => {
    eventFormWrapper.classList.toggle('open');
    openFormBtn.setAttribute('aria-expanded', String(eventFormWrapper.classList.contains('open')));
    if (!eventFormWrapper.classList.contains('open')) {
        resetForm();
    } else {
        descriptionInput.focus();
    }
});

cancelBtn.addEventListener('click', () => {
    resetForm();
    openFormBtn.focus();
});

eventFormWrapper.addEventListener('submit', (submission) => {
    submission.preventDefault();
    const description = descriptionInput.value.trim();
    const date = new Date(dateInput.value);
    const link = normalizeLink(linkInput.value);

    if (!description) {
        eventFormWrapper.classList.add('open');
        descriptionInput.focus();
        showMessage('Informe uma descrição para o evento.');
        return;
    }
    if (!dateInput.value || Number.isNaN(date.getTime())) {
        eventFormWrapper.classList.add('open');
        dateInput.focus();
        showMessage('Informe uma data e hora válidas.');
        return;
    }
    if (linkInput.value.trim() && !link) {
        linkInput.focus();
        showMessage('O link precisa começar com http:// ou https://.');
        return;
    }

    if (editingEventId) {
        const event = events.find(item => item.id === editingEventId);
        if (event) {
            const newDate = date.toISOString();
            if (event.date !== newDate) {
                event.createdAt = new Date().toISOString();
                event.reminderSentFor = '';
            }
            event.description = description.slice(0, 120);
            event.date = newDate;
            event.color = colorInput.value || 'blue';
            event.priority = priorityInput.value || 'medium';
            event.category = categoryInput.value.trim().slice(0, 40);
            event.recurrence = recurrenceInput.value;
            event.reminderSeconds = Number(reminderInput.value) || 0;
            event.notes = notesInput.value.trim().slice(0, 1000);
            event.link = link;
        }
    } else {
        events.unshift({
            id: makeId(),
            description: description.slice(0, 120),
            date: date.toISOString(),
            defaultEvent: false,
            active: true,
            color: colorInput.value || 'blue',
            priority: priorityInput.value || 'medium',
            createdAt: new Date().toISOString(),
            category: categoryInput.value.trim().slice(0, 40),
            recurrence: recurrenceInput.value,
            reminderSeconds: Number(reminderInput.value) || 0,
            reminderSentFor: '',
            notes: notesInput.value.trim().slice(0, 1000),
            link
        });
    }

    saveEvents();
    resetForm();
    openFormBtn.focus();
    renderEvents();
});

document.addEventListener('keydown', (keyboardEvent) => {
    if (keyboardEvent.key === 'Escape' && eventFormWrapper.classList.contains('open')) {
        resetForm();
        openFormBtn.focus();
    }
});

exportBtn.addEventListener('click', exportEvents);
importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', () => importEvents(importFileInput.files[0]));

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
        if (permission !== 'granted') {
            notificationsEnabled = false;
            showMessage('Permissão de notificações não concedida.');
        } else {
            notificationsEnabled = true;
            showMessage('Lembretes ativados. Mantenha o app aberto para recebê-los.');
        }
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
updateNotificationsButton();
renderEvents();
setInterval(renderEvents, 1000);
