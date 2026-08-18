# RH (Recursos Humanos)

Módulo de gestão de pessoas — cadastro, documentação, saúde ocupacional, recrutamento, lançamentos financeiros de folha.

## 🗂️ Estrutura do Menu

```
RH NO RADAR
├── INDICADORES RH (Dashboard, Rotatividade, Perfil Demográfico)
├── COLABORADORES
│   ├── CADASTRO GERAL        → /rh/cadastro
│   ├── DOCUMENTAÇÃO           → /rh/documentacao
│   ├── SAÚDE OCUPACIONAL      → /rh/aso
│   └── FÉRIAS                 → /rh/ferias  (placeholder)
├── PONTO E AUSÊNCIAS
│   ├── ESPELHO DE PONTO       → /rh/espelho-ponto
│   ├── SALDO DE BANCO         → /rh/saldo-banco
│   └── CONTROLE DE FÉRIAS     → /rh/ferias
├── RECRUTAMENTO
│   ├── VAGAS ABERTAS          → /rh/vagas
│   ├── PROCESSO SELETIVO
│   ├── MÉTODO DISC
│   ├── MODELO DE CURRÍCULO    → /rh/curriculos/modelo
│   └── BANCO DE CURRÍCULOS    → /rh/curriculos/banco
├── PESQUISA DE CLIMA
│   ├── ANÁLISE PESQUISAS
│   └── CRIAR PESQUISAS
├── TREINAMENTOS
├── FINANCEIRO RH
│   ├── LANÇAMENTOS            → /rh/lancamentos (apontamento de folha)
│   └── FOLHA DE PAGAMENTO
├── DEPARTAMENTO PESSOAL       → /rh/departamento-pessoal (docs da empresa)
└── CONFIGURAÇÕES RH
```

## 📂 Arquivos principais

- `RhCadastroGeral.jsx` — cadastro de colaboradores com tabela, filtros e 16 colunas
- `RhDocumentacao.jsx` — documentos POR colaborador com pastas/subpastas
- `RhControleASO.jsx` — ASO com dashboard, status de vencimento, upload
- `RhDepartamentoPessoal.jsx` — docs DA EMPRESA (não por colaborador) com seletor de loja
- `RhLancamentos.jsx` — apontamento de folha por período, estilo planilha
- `RhConfiguracoes.jsx` — abas: Cargos, Empresas, Jornadas, Setores, Benefícios, Feriados, etc
- `RhVagas.jsx` — vagas abertas (título auto-gerado do cargo)

## 🗄️ Tabelas principais

| Tabela | Finalidade |
|---|---|
| `rh_colaboradores` | Cadastro base + foto + company_id + departamento_id + escala_id + beneficios_ids |
| `rh_cargos` | Catálogo de cargos |
| `rh_departamentos` | Setores (sincronizado com tabela `sectors`) |
| `rh_escalas` / `rh_regimes_trabalho` / `rh_jornadas` | Configurações auxiliares |
| `rh_beneficios` | Benefícios disponíveis (VT, VR, Plano Saúde...) |
| `rh_documento_pastas` / `rh_documento_subpastas` / `rh_documentos` | Documentação POR COLABORADOR |
| `dp_pastas` / `dp_subpastas` / `dp_documentos` | Documentação DA EMPRESA (por company_id) |
| `rh_asos` | ASOs com data_vencimento calculada (data_exame + validade_meses) |
| `rh_apontamentos` | Lançamentos de folha por período |
| `rh_apontamento_campos` | Colunas customizadas de proventos/descontos |
| `holidays` | Feriados nacionais + regionais por loja |

## 🧠 Convenções importantes

### Documentação de Colaboradores — **propagação automática**
Criar/renomear/excluir pasta ou sub-pasta em **qualquer colaborador** propaga pra **TODOS os colaboradores ativos**. Template global — só os arquivos dentro é que são específicos.

### Empresa/Loja do colaborador
- `rh_colaboradores.company_id` (UUID → companies.id) é o link oficial
- `empresa_id` (INT, legado) mantido por compatibilidade
- JOIN usa COALESCE: `comp.apelido, comp.nome_fantasia, e.nome`

### Auto-numeração de lojas
Campo "Nº da Loja" em Cadastrar Nova Loja é `max(codLoja existentes) + 1`. Automático.

### Seletor de lojas (`/gestao-inteligente/lojas`)
**UNIÃO** de lojas do ERP (Oracle/PostgreSQL) + companies locais. Auto-cria companies faltantes quando encontra loja nova no ERP.

### ASO — lógica de vencimento
- `data_vencimento = data_exame + validade_meses` (SQL com `::int` no cast — Postgres confunde tipo senão)
- Status classificado por dias restantes: <0 vermelho, ≤30 amarelo, >30 verde
- Upload obrigatório no modal (bloqueia Salvar sem arquivo)

### Upload de arquivos — 3 métodos no mesmo modal
1. **Paste (Ctrl+V)** com preview de imagem colada
2. **📷 Tirar Foto** — `capture="environment"` abre câmera traseira no mobile
3. **📁 Escolher Arquivo** — file picker tradicional

### Lançamentos Financeiros — estilo planilha
Replica "APONTAMENTOS 2026.xlsx":
- 9 proventos fixos + 8 descontos fixos + colunas extras (JSONB em `campos_extras`)
- Exports PDF (paisagem) e Excel via lib `xlsx`
- Upsert por `(colaborador_id, data_inicio, data_fim)`
- Inputs `type=text inputMode=decimal` (sem spinner arrows)

### Feriados
- `date` é `VARCHAR(5)` formato `MM-DD` (sem ano)
- Botão "Preencher Nacionais" seeda 10 fixos + Sexta-feira Santa (algoritmo de Meeus)
- Nacionais protegidos de delete

### Benefícios dinâmicos
Aba "Benefícios" do modal de colaborador lista de `/rh/configuracoes/beneficios`. Novos benefícios viram checkbox automático. Salvo em `beneficios_ids INT[]`.

### Saldo de Banco de Horas — fonte ÚNICA (`services/saldo-banco.service.ts`)

O cálculo NÃO mora no controller. **Por quê:** dois caminhos precisam do mesmo número —
a tela `/rh/saldo-banco` e o **cron** que manda o PDF no WhatsApp (roda sem navegador).
Se cada um calculasse do seu jeito, o PDF que o gerente recebe divergiria da tela que o
RH abre, e ninguém confiaria em nenhum dos dois.

- Saldo = **último `saldoBancoFinalDia`** da apuração RHiD — **acumulado all-time**, já com
  queima/pagamento aplicados. É o MESMO campo do card "Saldo Banco Atual" do Espelho de Ponto.
- Casamento colaborador↔RHiD por **CPF OU PIS** (mesma regra do espelho e dos indicadores).
- 💡 **Janela de 45 dias** (o espelho usa 25). Como o valor é acumulado, alargar a janela
  **nunca muda o número** — só evita vir vazio pra quem estava de férias/afastado.
- ⚠️ É **1 consulta RHiD por colaborador** → pool de 6 + cache de 15 min. Essa tela nunca
  vai ser instantânea como as outras.
- Positivo e negativo são o MESMO saldo em duas colunas: negativo não marca nada no
  positivo e vice-versa; zero não marca nenhuma das duas.

### Disparo do Banco de Horas no WhatsApp — PDF gerado no SERVIDOR

`services/banco-horas-whats.service.ts` + `crons/banco-horas.cron.ts`, aba
Config. de Rede → Grupos WhatsApp → 🏦 Banco de Horas (`whatsapp_banco_horas_*`).

- ⚠️ **PDF com `pdfkit` no backend, não com jsPDF no navegador.** O disparo é agendado e roda
  sem ninguém com o sistema aberto. `pdfkit` já era dependência do backend.
- Vai como **base64** no `media` do `sendMedia` da Evolution (o disparo-vagas usa URL porque
  a arte dele é upload; aqui o arquivo nasce em memória).
- **1 PDF por loja**, setores como seções dentro, subtotal por setor + total da loja.
- Agendamento clonado do `disparo-vagas.cron`: modo `semana` (dias getDay) ou `mes` + horário.

### 🪤 jspdf-autotable: `columnStyles` NÃO alinha o `foot`

`columnStyles: { 3: { halign: 'right' } }` alinha o corpo mas **deixa o rodapé fora de prumo**
com a coluna. Forçar dentro do `didParseCell` (vale pra head/body/foot).

### `/rh/colaboradores` não filtra por setor

O endpoint não aceita `departamento_id`, mas **devolve o campo**. Telas que precisam filtrar
por setor fazem isso no front — mexer no endpoint afetaria várias outras telas.

## 🎨 Padrões de UX

- **Stats cards**: 2x2 mobile, 4-5 cols desktop; faixa lateral + ícone neutro
- **Drill-down mobile**: 3 painéis (lista → pastas → arquivos) viram stack com seta `← Voltar`
- **Configurações RH**: UPPERCASE automático em todos inputs de texto
- **Empresas RH**: CRUD **inline** (independente da tela Configurações principal) — usa `/companies` diretamente, foto via `/checklist/upload-imagem`, matriz não excluível e com codLoja bloqueado. **Por quê:** se o ERP cair, o RH precisa continuar funcionando; aba antes redirecionava pra Configurações, o que travava o RH quando o túnel do ERP derrubava a tela principal.
- **Setores RH**: lê de `rh_departamentos` sincronizado com `sectors` (migration 1784701600000)

## 🔗 Relacionado

- [[lgpd-compliance]] — plano de adequação LGPD pendente
- [[../padroes/deploy-multi-tenant]] — como fazer deploy

## 🏷️ Tags
#modulo #rh #pessoas #documentacao #aso #folha-pagamento
