// Eventos fixos: sempre aparecem na tela e não podem ser excluídos, desativados ou editados pelo app.
// Para alterar, edite este arquivo. Ele é um .js (e não .json) para funcionar também ao abrir
// o index.html direto do disco, onde o navegador bloqueia leituras de arquivos via fetch.
//
// periods: contagens que se renovam sozinhas. Valores de "period": day, month, year.
// events: eventos com data definida.
//   date e createdAt usam ISO 8601 com fuso, ex.: 2026-11-19T00:00:00-03:00.
//   createdAt marca o início da barra de progresso.
//   color: blue | purple | green | orange | red
//   priority: low | medium | high | critical
window.FIXED_EVENTS = {
    periods: [
        { id: 'fim-do-dia', description: 'Até o final do dia', period: 'day' },
        { id: 'fim-do-mes', description: 'Até o final do mês', period: 'month' },
        { id: 'fim-do-ano', description: 'Até o final do ano', period: 'year' }
    ],
    events: [
        {
            id: 'gta-vi-release',
            description: 'GTA VI',
            date: '2026-11-19T00:00:00-03:00',
            createdAt: '2025-11-06T00:00:00-03:00',
            color: 'red',
            priority: 'critical',
            category: 'Games',
            notes: 'Lançamento de GTA VI.',
            link: '',
            recurrence: 'none',
            reminderSeconds: 0
        }
    ]
};
