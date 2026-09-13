# Contagem Regressiva Profissional

Aplicação estática de lista de eventos com contagem regressiva, filtros, ordenação, tema visual e persistência no navegador.

## Estrutura

```text
index.html
styles.css
app.js
README.md
```

## Como executar

Abra o arquivo `index.html` em um navegador, ou sirva o diretório localmente:

```bash
python -m http.server 8000
```

Em seguida, acesse `http://localhost:8000`.

## Funcionalidades

- Cadastro, edição, ativação/desativação, exclusão e listagem de eventos.
- Persistência com `localStorage`.
- Ordenação por data, prioridade, texto e alfabética.
- Filtros por texto, status e tema visual.
- Visuais de status, prioridade e progresso.
