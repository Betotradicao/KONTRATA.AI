# Relógio RHID — Dados extraídos do Control iD REP iDClass

**Data da extração:** 2026-05-05
**Cliente:** Tradição Supermercado
**Fonte:** Relógio Control iD REP iDClass (REP-C) em `10.6.1.209:443` (HTTPS)

---

## 1. Equipamento descoberto

| Campo | Valor |
|---|---|
| Modelo | REP iDClass (REP-C) |
| Fabricante | Control iD |
| Host/IP | 10.6.1.209 |
| Porta | 443 (HTTPS) |
| Usuário | admin |
| Senha | admin |
| Número de série | 00014003750276694 |
| Empresa vinculada | TRADIÇÃO SUPERMERCADO LTDA |
| CNPJ | 39.026.607/0001-83 (do AFD) |
| Endereço | R: ANTONIO JULIO CAVALCANTE N132, JARDIM SANTA INÊS |

**Outros relógios identificados (não testados / offline):**
- 10.6.1.208 — Relógio Apoio ADM (TRADIÇÃO ADM) — REP iDClass — NS 00014003750203558 — **inacessível desta rede no teste**
- Terceiro relógio — IP a confirmar

---

## 2. API REST do REP iDClass — endpoints validados

### 2.1 Autenticação

```http
POST https://10.6.1.209/login.fcgi
Content-Type: application/json

{ "login": "admin", "password": "admin" }
```

**Resposta:**
```json
{ "session": "yyQDYFUDaxR4oMFjWPPuNoFN" }
```

A sessão deve ser anexada como query string: `?session=<valor>`

### 2.2 Endpoints válidos (testados e funcionais)

| Endpoint | Método | Retorno |
|---|---|---|
| `/login.fcgi` | POST | Token de sessão |
| `/get_afd.fcgi` | POST | TXT cru (AFD Portaria 1510/2021) — todas as marcações |
| `/load_users.fcgi` | POST | JSON com lista de funcionários ativos no relógio |
| `/load_company.fcgi` | POST | JSON com dados da empresa |

### 2.3 Endpoints **NÃO** disponíveis no REP-C

Testados e retornam `Invalid command`:
- `/load_objects.fcgi` (existe no iDFace, não no REP-C)
- `/get_aej.fcgi`, `/get_afdt.fcgi`, `/get_acjef.fcgi` — formatos consolidados não implementados
- `/load_horarios`, `/load_jornadas`, `/load_departments`, `/load_centros_custo`
- `/get_records`, `/get_logs`, `/get_users`, `/get_employees`

> **Conclusão:** O relógio expõe apenas **dados brutos** (AFD + funcionários + empresa). Jornadas, horários, departamentos e cálculos não são armazenados no equipamento.

---

## 3. Dados extraídos do AFD (Tradição — relógio 10.6.1.209)

**Tamanho do arquivo:** 4,1 MB — 101.372 linhas — histórico de **dez/2022 até maio/2026**

### 3.1 Estatísticas por tipo de registro

| Tipo | Qtd | Conteúdo |
|---|---|---|
| 1 | 1 | Cabeçalho (CNPJ, razão, endereço, CEI) |
| 2 | 8 | Alterações de dados da empresa |
| 3 | **100.112** | **Marcações de ponto (Portaria 1510)** |
| 4 | 41 | Ajustes de hora do REP |
| 5 | 1.029 | Cadastros/alterações de funcionário |
| 6 | 179 | Eventos do relógio (conexões, exportações) |
| F | 1 | Trailer (assinatura) |

### 3.2 Funcionários cadastrados

| Métrica | Valor |
|---|---|
| Total de PIS únicos no histórico | **204** |
| **Funcionários ATIVOS hoje** (última operação = I/A) | **43** ✅ |
| Funcionários inativos (última operação = E) | 161 |

**Regra de status:** o tipo 5 do AFD tem na **posição 23** a operação:
- `I` = Inclusão (admissão / cadastro inicial)
- `A` = Alteração (mudança de dados)
- `E` = Exclusão (demissão / desligamento)

Pegando a **última** operação por PIS (maior NSR), determina-se se o funcionário está ativo ou desligado.

### 3.3 Layout do registro tipo 5 (cadastro de funcionário)

| Posição | Tamanho | Campo |
|---|---|---|
| 1–9 | 9 | NSR (sequencial inviolável) |
| 10 | 1 | Tipo (`5`) |
| 11–18 | 8 | Data (DDMMYYYY) |
| 19–22 | 4 | Hora (HHMM) |
| 23 | 1 | Operação (I / A / E) |
| 24–35 | 12 | PIS (12 dígitos) |
| 36–87 | 52 | Nome (preenchido com espaços à direita) |
| 88+ | — | Demais campos (ID, CPF, etc.) |

**Exemplo real:**
```
000000018|5|12122022|1718|I|016034458022|ANTONIO SILVA SOUZA MACIEL                          |...
```

### 3.4 Layout do registro tipo 3 (marcação de ponto — Portaria 1510)

| Posição | Tamanho | Campo |
|---|---|---|
| 1–9 | 9 | NSR |
| 10 | 1 | Tipo (`3`) |
| 11–18 | 8 | Data (DDMMYYYY) |
| 19–22 | 4 | Hora (HHMM) |
| 23–34 | 12 | PIS |

> Como o relógio está configurado em modo Portaria 1510, **as marcações são tipo 3** (formato curto). Em modo Portaria 671/2021 seriam tipo 7 (formato completo com mais campos).

---

## 4. O que dá pra montar com os dados extraídos

### 4.1 Reproduzir o "espelho de ponto" (Ent.1, Sai.1, Ent.2, Sai.2)

Agrupando marcações por colaborador × dia, ordenando por hora:

- **1ª marcação** → Ent.1
- **2ª marcação** → Sai.1
- **3ª marcação** → Ent.2
- **4ª marcação** → Sai.2

✅ **100% reproduzível direto do AFD.**

### 4.2 Calcular colunas derivadas (já que o relógio não traz prontas)

A partir das batidas + jornada cadastrada do nosso lado:

| Coluna do espelho | Fórmula |
|---|---|
| **Total Normais** | (Sai.1 − Ent.1) + (Sai.2 − Ent.2), limitado à carga horária da jornada |
| **Total Noturnas** | Porção das horas trabalhadas dentro de 22:00 – 05:00 (com adicional 14,29%) |
| **Falta** | Dia útil previsto sem nenhuma marcação |
| **Atraso** | 1ª batida posterior ao horário previsto de entrada |
| **Extra 60% D** | Excedente em dia útil, faixa diurna, até 2h |
| **Extra 100% D** | Trabalho em domingo / feriado |
| **Extra Diurna / Noturna** | Total de horas extras por janela horária |
| **Banco Total / Saldo** | Acúmulo das diferenças entre trabalhado e jornada |

✅ Todas calculáveis com regras CLT padrão.

### 4.3 Lançamentos manuais (não vêm no AFD, ficam no nosso CRUD)

- **Atestado / Médico** — substitui a obrigação de bater ponto naquele dia
- **Abono / Justificativa** — explica falta/atraso para não descontar
- **Folga programada** — definida pela escala
- **Exclusão de marcação** — descarta batida indevida (auditável)

---

## 5. Limitações do AFD (e como contornar)

| O que NÃO tem no AFD | Onde resolver |
|---|---|
| Jornada prevista (07:15–12:00, 13:00–15:35) | Tabela `rh_jornadas` (já existe) |
| Cargo / departamento / centro de custo | `rh_colaboradores` / `rh_departamentos` (já existem) |
| Salário / regime / escala / admissão | `rh_colaboradores` (já existe) |
| Atestados, justificativas, abonos | Novo CRUD `rh_lancamentos` |
| Folgas programadas | Módulo de escala (planejado em `obsidian-vault/modulos/rh-escala-planejamento.md`) |
| Identificação Entrada vs Saída | Inferido pela ordem cronológica do dia |
| Cálculos prontos (Extras, Banco, Atrasos) | Calculadora CLT do nosso lado |

---

## 6. Comparação rápida: AFD bruto vs TXT do software de gestão (YDD/Pontotec)

| | AFD do relógio | TXT layout do software |
|---|---|---|
| **Granularidade** | Cada marcação individual (4 batidas/dia) | Totais consolidados (mensal por evento) |
| **Espelho dia a dia** | ✅ Sim (com cálculo nosso) | ❌ Não — só somatórios |
| **Folha de pagamento** | ✅ Derivado | ✅ Direto (códigos 10/11/12/50) |
| **Dependência** | Só do relógio | Software gestão precisa estar funcionando |
| **Auditoria fiscal MTE** | ✅ Original assinado | ❌ Derivado |

Para reproduzir o espelho diário do print de referência, **o AFD é a fonte certa**.

---

## 7. Amostra real de funcionários ativos extraídos (1ª página)

| PIS | Nome |
|---|---|
| 021067086589 | AFONSO ENRIQUE UCHOAS MONTEIRO |
| 020935222795 | ALANA SANTANA OLIVEIRA |
| 000000636344 | ALEX VALDEZ ROSA |
| 000000575662 | ANA CLARA CARVALHO ALVES |
| 016004141829 | BRUNO HENRIQUE DA SILVA |
| 015452347597 | CAROLINE ROBERTA ESPOSITO DOS SANTOS |
| 020004166684 | CHARLENE APARECIDA DA ROCHA |
| 012975247240 | DIEGO DE SOUZA VIEIRA |
| 020080036354 | EDUARDA DE SOUZA SIFRONE |
| 021026128988 | ELISANGELA SANTOS DE SOUZA |
| 012784343253 | ERINALVA DE MEDEIROS ARAUJO |
| 016311635209 | GABRIEL MARTINS DA SILVA |
| 023733591328 | HELEN BEATRIZ DE SIQUEIRA |
| 014019770413 | HERMESON DA SILVA PROCEL |
| 016309664191 | HILARY KAUANE DE FRANCA DOS SANTOS |
| 012944825080 | IDALMIR DA CRUZ DE JESUS |
| 020019093785 | JULIANO DUARTE CRUZ |
| 023750278624 | MARIA EDUARDA MELO DOS SANTOS |
| 020635314880 | MARIA NACELMA MOREIRA DE QUEIROZ |
| 016450508230 | MELISSA DA ASSUNCAO OLIVEIRA |

… e mais 23 nomes.

---

## 7.1 ✅ VALIDAÇÃO AO VIVO (02/07/2026) — integração confirmada

Testado direto da rede local (máquina 10.6.1.171 → relógio 10.6.1.209):
- ✅ `POST /login.fcgi` {admin/admin} → `{"session":"..."}` (HTTP 200, ~1s).
- ✅ `POST /get_afd.fcgi?session=X` com body **`{"initial_nsr": N}`** retorna
  **só as linhas a partir do NSR N** → habilita **cron incremental** (puxar só o novo).
  (Ex: initial_nsr 106000 = 1630 linhas / 66KB, em vez de 4MB.)
- ⚠️ **Formato é LARGURA-FIXA, SEM pipes** (o exemplo com `|` na seção 3.3 é só
  didático). Offsets reais validados p/ tipo 3 (0-indexado em JS):
  `NSR = slice(0,9)`, `tipo = [9]`, `data DDMMAAAA = slice(10,18)`,
  `hora HHMM = slice(18,22)`, `PIS = slice(22,34)`, resto = CRC.
- ✅ Última marcação puxada: NSR 107628, 02/07/2026 21:16 (= "último NSR" do painel).
- ✅ Espelho reproduzido: agrupando por PIS×dia e ordenando por hora →
  Ent1/Saí1/Ent2/Saí2 + trabalhado + saldo vs jornada. Funciona.
- 📌 **Reachability produção (VPS):** relógio está em IP local (10.6.1.209). Do VPS
  precisa de: (A) **port-forward Mikrotik** do :443 restrito ao IP do VPS (igual Oracle,
  padrão da casa) — recomendado; (B) **iDCloud** (habilitado no aparelho, investigar API);
  (C) coletor local que empurra o AFD. Dev/local já alcança direto.

## 7.2 ✅ ESCRITA / CRUD de usuários — CONFIRMADO (02/07/2026)

Sondagem direta no aparelho + doc oficial (api_idclass_latest.html) confirmam que
o REP-C **aceita criar/editar/excluir funcionários pela API** (≠ do que a seção 2.3
sugeria — o que não existe é o `load_objects`, não o gerenciamento de usuários):

| Endpoint | Existe? | Uso |
|---|---|---|
| `add_users.fcgi` | ✅ (sondado: pede `users`) | **Criar** funcionário |
| `update_users.fcgi` | ✅ (doc) | Editar |
| `remove_users.fcgi` | ✅ (doc) | Excluir (por PIS/CPF) |
| `load_users.fcgi` | ✅ (precisa `limit` int) | Listar (filtra por PIS/CPF) |
| `count_users.fcgi` | ✅ (doc) | Contar |
| `create_objects/set_users/new_users/...` | ❌ Invalid command | (não é essa API no REP-C) |
| `remote_enroll/user_set_image/add_card` | ❌ Invalid command | biometria/cartão remoto NÃO no REP-C |

**Formato `add_users.fcgi?session=X` (modo 1510 = PIS):**
```json
{ "do_match": false, "users": [
  { "pis": 12345678900, "name": "NOME", "registration": 112233,
    "rfid": 1234, "code": 112233, "password": "123", "admin": false,
    "templates": ["<base64 digital>", ...] } ] }
```
- Modo Portaria 671: `?mode=671` e trocar `pis` por `cpf`. Nosso relógio está em **1510 → usa PIS**.
- **O que dá pra enviar do nosso sistema:** PIS + nome + matrícula (registration) + senha + cartão (rfid). ✅ Basta o candidato ter PIS.
- **Biometria (digital/face):** só via `templates` (base64) — que NÃO temos do candidato. Então o dedo/rosto o funcionário cadastra **presencialmente no aparelho** depois. (O REP-C nem tem enroll remoto.)
- ⚠️ **É equipamento FISCAL:** todo `add_users`/`remove_users` grava um **registro tipo 5 permanente no AFD** (NSR inviolável). Não é "teste sem rastro" — cada escrita fica no arquivo fiscal pra sempre. Escrever só com autorização explícita.

Doc oficial: https://www.controlid.com.br/suporte/api_idclass_latest.html

## 7.3 ✅ API da NUVEM RHiD — banco de horas REAL (02/07/2026)

**Decisão-chave:** o relógio local só dá batidas cruas. O **saldo REAL do banco**
(com queima de banco / pagamento de HE lançados no RH) só existe na **nuvem RHiD**.
Logo, pra mostrar o banco correto, integrar com a **API RHiD**, não recalcular.

- Base: `https://rhid.com.br/v2/` · auth **JWT**.
- Swagger: https://www.rhid.com.br/v2/swagger.svc/index.html?url=/v2/swagger.svc/swagger.json
- Guia (PDF): "API RHiD Básico" (scribd 863931374).

| Endpoint | Uso |
|---|---|
| `POST /login` (email, password, domain) | Token JWT |
| **`GET /apuracao_ponto` (dataIni, dataFinal, idPerson)** | ⭐ **Apuração oficial — banco de horas integrado (saldo real, HE, faltas, abonos)** |
| `GET /person` (start, length) | Funcionários (idPerson pra apuração) |
| `GET /report/afd/download` (idEquipamento, dataIni, dataFinal, nsrInicial) | AFD cru pela nuvem |
| `GET/POST /justifications`, `justificationstype` | Atestados/abonos/justificativas |
| `GET/POST/PUT /device`, `/company`, `/department`, `/costcenters` | Estrutura |

**Arquitetura nova do módulo:** batidas (device OU /report/afd) + **banco/apuração oficial via `/apuracao_ponto`**. O saldo NUNCA é recalculado por nós — vem da RHiD (reflete queima/pagamento). Precisa: **login RHiD do cliente** (email/senha/domínio) guardado em config (criptografado). idPerson (RHiD) ↔ nosso colaborador (por PIS/nome).

## 7.4 ⭐ MAPEAMENTO Cartão de Ponto (Control iD) ← campos `/apuracao_ponto` (06/07/2026)

Inventário ao vivo dos ~90 campos que a RHiD devolve por dia (validado c/ Helen Beatriz, rhid_id 115, período 26/05→25/06). Cada coluna do **Cartão de Ponto oficial** mapeia direto num campo — **nada é recalculado por nós**:

| Coluna do papel | Campo RHiD |
|---|---|
| PREVISTO | `strHorarioContratualSimples` ("07:15-12:00\r\n13:00-17:03") |
| ENT.1..SAÍ.3 | `listAfdtManutencao[]` ordenadas (`_typeEntradaSaida`: E/S; **"D"=justificativa**) |
| TOTAL NORMAIS | `horasTotalNaoExtra` |
| TOTAL TRABALHADO | `totalHorasTrabalhadas` |
| DIA FALTA | `faltasDiasInteiro` / `faltaDiaInteiro` |
| FALTA E ATRASO | `horasFaltaAtraso` (= `atrasoEntrada` + `saidaAntecipada`) |
| ABONO | `minutosAbono` |
| EXTRA DIURNA / NOTURNA | `extraDiurna` / `extraNoturna` |
| INTERJORNADA | `extraInterjornada` |
| BANCO (dia) | `saldoBancoCredDeb` · BANCO SALDO acumulado = `saldoBancoFinalDia` |
| FERIADO | `isHoliday:1` + `holiday.name` (ex "CORPUS CRISTI") |

### 🔥 LIÇÃO 4 — casar colaborador↔RHiD é por **CPF**, NÃO por PIS!
Investigado no Tradição (06/07): a nuvem RHiD tem 207 pessoas, **100% com CPF válido** (11 dígitos), mas o campo **`pis` da RHiD é LIXO** — valores curtos tipo `123`, `636344`, `481500` (parecem matrícula, não PIS real de 11 dígitos). Ou seja, **matching por PIS está fadado a falhar** nesse cliente. **CPF é a chave confiável.**
- Regra correta (cadastro + indicadores): casar por **CPF** (normalizado: só dígitos, padStart 11) OU PIS, com CPF primeiro.
- 🐛 Bug clássico: adicionar match por CPF mas **esquecer de dar `SELECT c.cpf`** na query → `c.cpf` vira undefined → match por CPF vira no-op e cai no PIS (que não casa). Sempre conferir que o CPF é buscado.
- Sintoma do bug: cadastro mostra "🟢 OK" (casou por CPF via endpoint `/vinculos`) mas dashboard mostra o mesmo colaborador "fora/não vinculado" (casava só por PIS).
- Implicação: pra dar match dos colaboradores, o **CPF tem que estar preenchido no cadastro** (não o PIS). "Sincronizar PIS" ajuda, mas o essencial é o CPF bater com a RHiD.

### 🔥 LIÇÃO 2 — dia ABERTO: batida real vem como tipo "D" (não "E")!
No dia em andamento, a volta do almoço já registrada vem na apuração com `_typeEntradaSaida:"D"` `_typeClassification:"X"` — MAS com **`idAfd` preenchido** (batida real, ex 13:32 idAfd=177382). A saída ainda-não-batida vem como placeholder tipo "D" `class:"F"` com **`idAfd:null`**. Regra pra distinguir (a apuração JÁ é tempo-real — não há endpoint cru; `/marcacoes`,`/afdt`,`/registros`,`/ponto` = 404):
- `idAfd != null` → **batida REAL** (mostra o horário, mesmo se tipo "D" = pendente de fechamento)
- `abreviationJustification` preenchida → **justificativa** (Médico/Abono → badge laranja)
- tipo "D" sem idAfd e sem justificativa → **placeholder** (saída esperada) → esconder
Exposto como `real` na batida (`rh-ponto.controller.ts`); frontend mostra "D real" como horário âmbar e esconde placeholder. Sintoma do bug: "funcionária já voltou mas o sistema mostra Just./Just." (06/07 Helen).

### 🔥 LIÇÃO 3 — o "atraso" NÃO é nosso sistema, é o SYNC relógio→nuvem
Nosso backend lê a apuração RHiD em tempo real (sem cache de apuração). O atraso real = **intervalo em que o relógio físico envia as batidas pra nuvem RHiD**. Ex (06/07 Charlene): bateu 16:30, mas `GET /device` mostrou `lastSyncDate` do relógio "SUPERMERCADO LTDA" = 16:29:29 (1min ANTES) → a batida 16:30 ainda estava só no relógio, na nuvem só o placeholder (idAfd null). Aparece no próximo envio do relógio.
- **Como saber a validade do dado:** `GET /device` → `lastSyncDate` (formato `/Date(ms-0300)/`). Exposto em `/rh/ponto/relogio/status` (`ultimo_sync_ms`) e mostrado na tela ("🕐 Relógio sinc. HH:MM (há Nmin)") + botão Auto (recarrega 60s).
- **Como deixar mais tempo-real:** (1) diminuir o intervalo de comunicação do relógio no painel Control iD/RHiD (equipamento, não código); (2) ler o relógio LOCAL 10.6.1.209 direto (`get_afd`, instantâneo) — só da rede local (VPS não alcança sem port-forward Mikrotik). Relógio ativo do Tradição: serial 00014003750276694, status OK. Os outros (Apoio ADM ...203558, Creusa ...167903) = status ERRO (não sincronizam).

### 🔥 LIÇÃO CRÍTICA — a RHiD **NÃO marca `folga: true`** nos dias de descanso!
Sáb/Dom voltam com `folga:false`, `strHorarioContratualSimples:""`, `idHorarioContratual:0`, **sem batidas**, `isHoliday:0`, `faltaDiaInteiro:false`. Ou seja, NÃO existe flag confiável de folga → tem que **DERIVAR**:
```
if (isHoliday===1) → feriado
else if (faltaDiaInteiro || faltasDiasInteiro>0) → falta
else if (batidas todas tipo "D" e nenhuma E/S) → atestado (dia justificado)
else if (sem jornada prevista && sem batida real) → FOLGA  ← derivada (DSR)
else → trabalhou
```
- **Batida tipo "D"** = justificativa/ausência: `abreviationJustification` ("Medico"/"Abono") + `afdtLogs[].detalheDiferencaConsiderada` ("Atestado Médico"). Atestado dia-inteiro tem 4 batidas "D" e **não** vira falta (justificado).
- Validado: NORMAIS total 167h53 + TRABALHADO 170h03 = idênticos ao papel (o papel sai dessa mesma apuração).
- Implementado em `rh-ponto.controller.ts` (espelho expõe tudo + deriva folga + header empresa/CNPJ/depto/admissão + grade semanal + alterações) e `RhEspelhoPonto.jsx` (tabela com todas as colunas + PDF "Cartão de Ponto" fiel ao Control iD). Header IE não existe em `rh_empresas` (fica em branco).

## 8. Próximos passos sugeridos

1. **Cadastro de relógios** (`rh_relogios`) — multi-equipamento por empresa
2. **Service de sync** — `controlid-rep.service.ts` (login + get_afd + parser)
3. **Tabela `rh_marcacoes`** — uma linha por batida (deduplicada por `relogio_id + nsr`)
4. **Cron incremental** — baixa AFD a cada 15 min e ingere apenas NSRs novos
5. **Vínculo PIS → `rh_colaboradores`** — mapear cadastros do relógio com colaboradores do sistema
6. **Calculadora de apuração diária** — popula `rh_apuracao_diaria` com extras, banco, atrasos
7. **Tela "Espelho de Ponto"** — replica o layout de referência (paginado por colaborador, grid mensal)
