# Contagem Regressiva

Aplicação estática de lista de eventos com contagem regressiva, filtros, ordenação, temas e persistência no navegador.

**Acesse online:** https://lucasllimati.github.io/contagem-regressiva/

Publicado com GitHub Pages a partir da branch `main`. Cada push na `main` atualiza o site em alguns minutos.

## Estrutura

```text
index.html               Marcação da página
styles.css               Estilos e tokens de design (tipo, espaço, cor, raios)
app.js                   Lógica da aplicação
data/eventos-fixos.js    Períodos e eventos fixos (sempre visíveis)
exemplo-eventos.json     Exemplo de arquivo para importação
```

## Como executar

Abra o arquivo `index.html` em um navegador, ou sirva o diretório localmente:

```bash
python -m http.server 8000
```

Em seguida, acesse `http://localhost:8000`.

## Eventos fixos

O arquivo `data/eventos-fixos.js` define o que aparece sempre, independentemente do navegador ou do `localStorage`:

- **Períodos** que se renovam sozinhos: até o final do dia, do mês e do ano.
- **Eventos fixos**, como o lançamento de GTA VI. Eles não podem ser excluídos, desativados ou editados pelo app; para alterar, edite o arquivo.

O arquivo é `.js` (e não `.json`) para funcionar também ao abrir o `index.html` direto do disco.

## Importar eventos

1. Em **Backup > Baixar modelo para preencher**, baixe o `modelo-eventos.json`.
2. Preencha os eventos. Só `description` e `date` são obrigatórios; os valores aceitos estão no bloco `instrucoes` do próprio arquivo.
3. Em **Backup > Importar arquivo JSON**, selecione o arquivo.

O `exemplo-eventos.json` mostra o mesmo formato. **Exportar eventos** gera um backup dos seus eventos (os fixos ficam no arquivo de fixos).

## Funcionalidades

- Cadastro, edição, ativação/desativação e exclusão de eventos.
- Persistência dos eventos do usuário com `localStorage`.
- Ordenação por data, prioridade e nome; filtros por texto e status.
- Repetição diária, semanal, mensal ou anual e lembretes por notificação.
- Exportação, importação e modelo JSON para preencher.
- Temas de cor: azul, violeta, verde e monocromático.
