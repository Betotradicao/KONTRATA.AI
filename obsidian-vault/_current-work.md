# 🚧 Trabalho em Andamento

## 🔭 (04/08) — Currículo público: novos "Cargos de Interesse" (vagas futuras) — LOCAL, testando
Pedido: além de "Experiências como" (cargos que o candidato já trabalhou), criar uma
2ª seleção de cargos/setores em que ele NÃO tem experiência mas tem interesse pra
vaga futura — pra RH achar no Banco de Currículos quando abrir vaga nessas áreas.
- **Migration** `1786900000000-AddCargosInteresseCurriculos.ts`: coluna `cargos_interesse jsonb default '[]'` em `curriculos`. Rodou sozinha local (`migrationsRun: true`).
- **Entity** `Curriculo.ts`: campo `cargos_interesse: string[]`.
- **Backend** `enviarCurriculoPublico`: aceita `cargos_interesse` no payload (mesmo array de strings do catálogo de cargos da empresa).
- **Frontend público** `CurriculoPublico.jsx`: nova seção "🔭 Além das vagas disponíveis" logo depois de "Detalhes das experiências" e antes de "Pontos Fortes" — reusa o MESMO catálogo de cargos (`cargos.map`) só que com checkbox independente (`toggleItem('cargos_interesse', c)`), cor azul-céu pra diferenciar visualmente do rosa das experiências.
- **Frontend RH** `BancoCurriculos.jsx`: nova coluna "Cargos de Interesse" logo após "Cargos com Experiência" (mesmo estilo de badges, cor azul-céu), ordenável + novo filtro "Cargos de Interesse" no topo (mesmo catálogo, ao lado de "Cargos com Experiência"). Backend: `cargo_interesse` na query (`cv.cargos_interesse @> jsonb`).
- **Trava automática:** cargo da(s) vaga(s) que o candidato já marcou interesse (`vagasInteresse`) vem SEMPRE pré-marcado e travado (disabled + badge "JÁ CANDIDATADO") em "Cargos de Interesse" — não dá pra tirar, ele já demonstrou isso ao se candidatar. Diferente do `cargosObrigatorios` (que só trava em "Experiências como" quando a vaga tem `experiencia_obrigatoria`), esse trava **sempre**, pra QUALQUER vaga marcada. Candidato pode livremente marcar cargos extras (ex: candidatou-se pra Açougue, mas quer marcar Reposição também).
- **Modal de detalhe do candidato** (`DetalheCV`, componente compartilhado por Banco de Currículos E RhVagas): nova seção "Cargos de Interesse" com botão "✏️ Editar" que abre popup com checkboxes de TODOS os cargos cadastrados (busca `/curriculos/cargos` só quando abre) — RH pode marcar/desmarcar livremente e salvar. Backend `PUT /curriculos/:id` aceita `cargos_interesse` agora. Prop `onAtualizarCargosInteresse` wireada nos DOIS lugares que usam `DetalheCV` (BancoCurriculos.jsx reusa `salvarStatus` genérico; RhVagas.jsx tem sua própria implementação local, mesmo padrão dos outros campos).
- **Split visual "Cargo se Candidatado" (amarelo) x "Cargos de Interesse" (azul):** ambos vêm do MESMO array `cargos_interesse`, mas o front separa por origem — `cargos_vaga_aplicada` (novo, calculado em runtime no backend a partir de `vagas_interesse_ids` cruzado com `rh_vagas.cargo_nome`) marca quais entradas vieram de uma vaga que o candidato de fato se candidatou. Precisou mapear `vagas_interesse_ids` na entity `Curriculo.ts` (coluna já existia desde 1784770000000, só não estava mapeada no TypeORM) + enriquecer `listarCurriculos` E `obterCurriculo` com esse cálculo (senão o refresh depois de editar perderia a separação).
  - 🐛 **Bug achado+corrigido (mesma sessão):** `cargo_nome` NÃO é coluna de `rh_vagas` — é alias de JOIN (`ca.nome AS cargo_nome`, `LEFT JOIN rh_cargos ca ON ca.id = v.cargo_id`, ver `rh.controller.ts:1298/1302`). Minha 1ª versão fazia `SELECT id, cargo_nome FROM rh_vagas` direto → Postgres deu erro (coluna não existe) → `.catch(() => [])` engoliu silenciosamente → `cargos_vaga_aplicada` sempre vazio → nenhum cargo aparecia amarelo mesmo candidato vindo de vaga real. Corrigido com o JOIN certo nas duas queries (listarCurriculos + obterCurriculo).
- ✅ backend `tsc --noEmit` = 0, front `vite build` = 0. ⏳ Testando LOCAL → commit+push → deploy (pendente pedir cliente).

## 🔢 (04/08) — Banco de Currículos: card "Total" travava em 500 — ✅ DEPLOYADO Novacentral (fba8eaf), ⏳ aguardando validação visual
Cliente Novacentral já tem currículo #663, mas o card TOTAL do Banco de Currículos
mostrava 500 preso. Causa: `curriculos.controller.ts` `listarCurriculos` tinha
`.take(500)` na query — cortava a LISTA em 500 registros, e o `resumo` (cards
Total/Novo/Selecionado/etc) era calculado em cima dessa MESMA lista já cortada
(`total: lista.length`), então nem existia uma contagem real por trás — o card
sempre refletia o corte, não o banco. Fix: removido o `.take(500)` (sem paginação
no frontend hoje — tabela carrega tudo de uma vez, então sem cap client-side pra
compensar).
- ✅ backend `tsc --noEmit` = 0, commit+push `fba8eaf`, deploy Novacentral (build --no-cache backend, up --no-deps, container healthy, log limpo — verificação técnica só).
- ⏳ **Falta usuário confirmar visualmente** na tela Banco de Currículos do Novacentral que o card Total bate com o real.
- ⚠️ Esse bug vale pra **TODOS os clientes kontrata** com >500 currículos, não só Novacentral. Propagar pros outros 7 (tradicao, puma, damata, guibox, pontocerto, fratelli, cidade, mameva) só depois de confirmado — um de cada vez.

## 📞 (03/08) — Currículo público: WhatsApp virou obrigatório — ✅ DEPLOYADO Tradição + Ponto Certo (d685286)
`CurriculoPublico.jsx`: campo WhatsApp trocado de `Field` (opcional) pra `FieldReq`
(asterisco + `required` HTML) + checagem em `enviar()` (`!form.whatsapp.trim()`, mesmo
padrão de nome/data_nascimento — `scrollTo(0,0)`). Motivo: RH precisa de um jeito de
contato garantido pra chamar o candidato (e-mail/Instagram continuam opcionais).
- ✅ Testado LOCAL, commit+push `d685286`.
- ✅ **Deployado Tradição** (bundle `index-CgTdKkY1`) e **Ponto Certo** (bundle `index-DdpIpaP8`) — marcador "Informe seu WhatsApp" confirmado nos dois, sites 200.
- ⏳ **Falta propagar pros outros 6 clientes kontrata** (puma, damata, guibox, novacentral, fratelli, cidade, mameva) — um de cada vez, só quando o usuário pedir.

## 📱 (29/07) — Currículo público: fix "tela flutuando" no celular (zoom iOS) — ✅ DEPLOYADO E VALIDADO Tradição (e2d2fe7)
Candidato reportou (print via WhatsApp Business) que a tela de preenchimento do currículo
"flutuava" ao clicar em qualquer campo. Causa: inputs em `text-sm` (14px) disparam zoom
automático do iOS ao focar (só evita com fonte ≥16px). Fix: `useEffect` em
`CurriculoPublico.jsx` injeta `<style>` forçando `font-size:16px` em input/select/textarea
só em mobile (`max-width:767px`). Detalhes: [[bugs-resolvidos/2026-07-29-curriculo-publico-ios-zoom-flutuando]].
- ✅ Testado LOCAL, commit+push `e2d2fe7`, deploy Tradição (build --no-cache frontend, up --no-deps, bundle `index-Crr7kW5A` confirmado, marcador `16px !important` presente).
- ✅ **Usuário validou em produção no celular (29/07): funcionou.**
- ⏳ **PRÓXIMO:** propagar pros outros 8 clientes kontrata (puma, damata, guibox, novacentral, pontocerto, fratelli, cidade, mameva) — um de cada vez, só quando o usuário pedir.

## ✅ (28/07) — TODOS os 9 clientes kontrata nivelados em a852803 — CONCLUÍDO
Todos os 9 clientes kontrata vivem na **VPS 46** (a 31 não tem nenhum — confirmado). Ninguém grava "número de versão": todos buildam do mesmo `/root/kontrata-repo`, então **versão do cliente = data de build da IMAGEM dele**. Pra traduzir em "o que ele tem", grepar marcadores de feature no bundle servido (`docker exec <fe> cat /usr/share/nginx/html/assets/index-*.js`).
- ⚠️ **Achado grave do inventário:** nos 7 atrasados o **backend era ~3 semanas MAIS VELHO que o frontend** (19-20/06 vs 07/07) — front chamando endpoint que o back não tem. Não era só "falta feature nova".
- **5 migrations pendentes** nesses 7: `1786000000000` (mostra_horas), `1786500000000` (nao_bate_ponto), `1786600000000` (performance setor), `1786700000000` (geo coords), `1786800000000` (curriculo pdf). Rodam sozinhas no boot (`migrationsRun: true`).
- ✅✅ **OS 9 EM a852803 (28/07), verificados um a um:** tradicao, puma, damata, guibox, novacentral, pontocerto, fratelli, cidade, mameva. Todos com backend `healthy`, as 5 migrations aplicadas, colunas/tabelas criadas, bundle com os 5 marcadores, site 200 e `/curriculos/publico/upload-pdf` → 400. Nenhum erro real de log em nenhum. Postgres/MinIO intactos em todos (`up --no-deps`).
- 💡 **Domínio/portas de cada cliente:** ler `/root/clientes-kontrata/kontrata-clientes.json` (subdomain + frontend_port + backend_port + postgres_port). Muito mais confiável que grepar nginx — os vhosts se chamam `kontrata-<cliente>` e o `proxy_pass` usa a porta, então grepar pelo nome do cliente na porta não acha nada.
- 🔧 Script de verificação pós-deploy: `verifica-cliente.sh <cliente>` em `/root` da VPS 46 (containers + migrations + colunas + marcadores no bundle).
- ⚠️ **Pegadinha do check:** o frontend kontrata escuta **3004 DENTRO do container** (não 80) — `wget localhost/` dá "connection refused" e NÃO significa que caiu. Checar por `curl 127.0.0.1:<porta publicada>` ou pelo domínio. O `unhealthy`/`health: starting` do frontend também é falso-positivo conhecido (wget do BusyBox).

## 📎 (28/07) — Currículo público: Resumo obrigatório + anexo PDF + colunas Idade/Doc — ✅ DEPLOYADO Tradição (3a9cc27)
**Commits `3a9cc27` + `a852803`, push KONTRATAAI (a852803). DEPLOYADO VPS 46 kontrata-tradicao 28/07 + VERIFICADO:** repo→a852803, build `--no-cache` back+front, `up --no-deps`, backend `healthy`, migration `AddCurriculoPdfCurriculos1786800000000` = última aplicada, colunas `curriculo_pdf_url(text)`/`curriculo_pdf_nome(varchar)` existem, rota `/curriculos/publico/upload-pdf` → 400 (existe), site 200, bundle novo `index-6cWbd_-O` com "Resumo Pessoal e Profissional", "digital já basta", `curriculo_pdf_url`(2), "Ordenar por idade". ⏳ Falta deploy nos OUTROS clientes kontrata.
⚠️ Ao fazer push o GitHub avisou que o repo virou `KONTRATA.AI` (maiúsculo) — funciona por redirect, mas vale `git remote set-url`.

Três pedidos do usuário na mesma leva. Rodando LOCAL (front 10.6.1.171:3004 + back 3010).
1. **Resumo virou obrigatório** (`CurriculoPublico.jsx`): título "Resumo profissional" → **"Resumo Pessoal e Profissional"** + `*` vermelho, `required` no textarea e check no `enviar()`. ⚠️ Diferente das outras validações (que fazem `scrollTo(0,0)`), essa rola até o **próprio campo** via `resumoRef` — o campo fica no MEIO do form, mandar pro topo faria o candidato caçar o erro.
2. **Anexo do PDF do currículo (opcional, pós-envio):** componente `AnexarCurriculoPdf` com "Sim, quero anexar meu PDF" × "Não, digital já basta". Sim → `inputRef.click()` abre o seletor de arquivos. ⚠️ **SEM atributo `capture`** — com ele o Android abre a CÂMERA em vez de Documentos.
   - Estado (`pdfCurriculo`) mora no **componente pai**, não no filho: a pergunta aparece em 2 telas pós-envio (convite DISC + tela final); respondeu numa, não repergunta na outra.
   - Backend: migration `1786800000000` (`curriculo_pdf_url` + `curriculo_pdf_nome` em `curriculos`), colunas na entity `Curriculo`, `uploadCurriculoPdfPublico` + rota **pública** `POST /curriculos/publico/upload-pdf` (multipart campo `arquivo` + `curriculo_id`). Upload é um **2º request** (acontece depois do INSERT), por isso faz UPDATE e não vem no payload do envio. Aceita PDF/doc/docx — valida por mimetype **OU extensão** (celular manda mimetype genérico). Sobe no MinIO igual à foto.
   - RH vê o anexo no `BancoCurriculos.jsx` (seção "Currículo em PDF" no modal, acima do Resumo).
2b. **Formatos aceitos + teto de 8 MB:** PDF, Word (.doc/.docx), ODT, RTF e **FOTO** (JPG/PNG/HEIC/WEBP). ⚠️ Aceitar imagem é decisão consciente: no público de supermercado é comum **fotografar o currículo impresso** com o celular (HEIC = padrão iPhone) — recusar imagem perderia currículo real. Valida por mimetype **OU** extensão (celular manda `application/octet-stream`). **Teto 8 MB** (multer dedicado na rota + pré-check no browser antes de subir, pra não gastar o 4G do candidato e só falhar no fim). 8 MB cabe 4 páginas bem elaboradas em qualquer formato, inclusive PDF escaneado/foto 12MP, mas barra vídeo/zip. Erro `LIMIT_FILE_SIZE` tratado NA ROTA (multer estoura antes do controller — sem isso o candidato levava 500 seco).
3. **Coluna IDADE em `RhVagas.jsx`** (tabela "Candidatos desta vaga"), entre KM Residência e WhatsApp. ⚠️ Idade calculada no **Postgres** (`EXTRACT(YEAR FROM age(c.data_nascimento))`) e não no browser — evita o clássico "volta 1 dia" do `new Date('YYYY-MM-DD')` (ver bug 2026-07-02). Ordenável (entra em `cNumericos`, sem idade vai pro fim).
4. **Coluna DOC em `RhVagas.jsx`** (logo após Idade): 📄 clicável abre o anexo do candidato, `—` se não tem. Ordenável (quem tem anexo primeiro). Exigiu expor `curriculo_pdf_url/nome` no JSON dos `interessados` (rh.controller.ts). `colSpan` da linha expandida 17→**19** (2 colunas novas).
- ⚠️ **Dívida de nome:** as colunas se chamam `curriculo_pdf_*` mas guardam também Word/ODT/RTF/foto. Mantido pra não mexer em migration já aplicada — o campo é "arquivo do currículo", não só PDF.
- ✅ backend tsc=0, front build=0, migration aplicada no dev (log), rota nova responde 400 (= existe). ⏳ Usuário testar LOCAL → commit → push → deploy.

## 💵 (08/07) — Indicadores RH: aba Financeiro RH plugada — LOCAL, uncommitado
- **Backend:** `RhFolhaController.indicadores` + rota `GET /rh/folha/indicadores?ano=&company_id=`. Folha = `rh_colaboradores.salario` (base) + proventos − descontos. ⚠️ **R$ dos lançamentos vive em `rh_apontamentos.campos_extras->>'<chave>_valor'`** (as colunas numéricas são qtd/horas!). Chaves: 9 proventos + 8 descontos hardcoded (reusa PROVENTOS/DESCONTOS do controller) + extras de `rh_apontamento_campos`. **Encargos NÃO existem no banco → ESTIMADOS** (FGTS 8% + INSS patronal 20% + 13º 8,33% + férias+⅓ 11,11% ≈ 47% do bruto). Setor via `sector_id → sectors.name`. Benefícios via `rh_beneficios` + `beneficios_ids`. Queries com try/catch (campos_extras/beneficios_ids sem migration garantida).
- **Frontend:** `AbaFinanceiroRH` (RhIndicadores.jsx): 4 KPIs (Folha mês/ano/Custo médio/Encargos) + Line evolução (bruta×custo total) + Doughnut custo por setor + Doughnut composição (salário/encargos/benefícios) + Bar encargos detalhados + Bar stacked provisões (13º/férias). Rótulo deixa claro que encargos são estimativa.
- ⚠️ Limitação honesta: usa salário/quadro ATUAL pra todos os meses (sem histórico salarial). Documentado no rodapé.
- ✅ backend tsc=0, front build=0. ✅ **COMMITADO `c63d925`** (KONTRATAAI, NÃO pushado). ⏳ Testar LOCAL → push → deploy. Abas do topo voltaram pro tamanho ~original (px-5 py-3.5 text-[15px]).

## 📂 (08/07) — Indicadores RH: aba Departamento Pessoal plugada + abas maiores — LOCAL, uncommitado
- **Backend:** `RhDpController.indicadores` + rota `GET /rh/dp/indicadores?ano=&company_id=`. Consolida 3 fontes: **ASO** (`rh_asos`, ASO vigente = periódico>admissional mais recente, DISTINCT ON; vencido/a-vencer 30d), **obrigatórios por colaborador** (`rh_documento_subpastas.obrigatorio` sem arquivo em `rh_documentos.subpasta_id` = FALTANTE; conformidade %), **docs da empresa** (`dp_documentos.data_vencimento`). Loja via `rh_colaboradores.company_id → companies` (COALESCE apelido/nome_fantasia). ⚠️ dp_documentos usa eixo `rh_empresas` (diferente), por isso entram sem filtro de loja.
- **Frontend:** `AbaDepartamentoPessoal` (RhIndicadores.jsx): 4 KPIs (Vencidos/A vencer 30d/Faltantes/Conformidade) + Bar ASO mensal (emitidos×vencendo) + ranking Pastas + Bar horizontal Conformidade por loja + tabela Vencidos Detalhados (ASO+empresa). Reusa CardDoc/Painel/chart.js já no arquivo. `fmtVenc` evita -1 dia no DATE.
- **Abas do topo maiores** (pedido): `px-8 py-6 text-lg font-bold`, ícone `text-3xl`, border-b-4.
- ✅ backend tsc=0, front build=0. ✅ **COMMITADO `c63d925`** (KONTRATAAI, NÃO pushado). ⏳ Testar LOCAL (`/rh/indicadores` → aba Departamento Pessoal).

## 🧠 (08/07) — DISC amarrado ao COLABADOR já contratado — LOCAL, uncommitado
Objetivo: aplicar DISC em colaborador ativo (não candidato), resultado amarrado ao cadastro. ⚠️ Base legal: DISC em CANDIDATO é risco alto (ver [[LEGALIDADE JURIDICA/disc-em-candidatos]]); colaborador já contratado (desenvolvimento, não seleção) = risco menor. Por isso só fizemos p/ colaborador. Card diz "não é critério eliminatório".
- **Backend:** `salvarDiscResultadoPublico` agora aceita `colaborador_id` (antes forçava NULL). Novo endpoint `GET /rh/disc/por-colaborador` → mapa {colab_id: DISC mais recente} (`DISTINCT ON`). Tabela `rh_disc_resultados` JÁ tinha `colaborador_id` (sem migration).
- **RhMetodoDisc.jsx:** toggle **Candidato (link público)** × **Colaborador (já na empresa)**. Modo colaborador: `<select>` de ativos (`/rh/colaboradores?limit=1000` filtrado status=ativo) → gera link personalizado `/disc?nome=&colaborador_id=X` (ou aplica inline). handleSave manda colaborador_id.
- **DiscPublico.jsx:** lê `?colaborador_id=` e envia no submit.
- **RhCadastroGeral.jsx:** coluna **DISC** (chip colorido do perfil primário+secundário, clica → abre cadastro) + aba **🧠 Perfil DISC** no modal (perfil + barras D/I/S/C + data). `discMap` via `/rh/disc/por-colaborador`.
- ✅ backend tsc=0, front build=0. ✅ **COMMITADO `c63d925`** (KONTRATAAI, NÃO pushado). ⏳ Testar LOCAL → push → deploy (precisa BACKEND rebuildado). Também: removi item "ANÁLISE ABSENTEÍSMO" do menu (Sidebar) — no mesmo commit.

## 📄 (08/07) — Performance por Setor: botão PDF + 2 fixes nos Indicadores RH — ✅ DEPLOYADO Tradição (8cfa071)
`RhPerformanceSetor.jsx` + `RhIndicadores.jsx` + `geocode.service.ts`. Commit `8cfa071` (push KONTRATAAI). **DEPLOYADO VPS 46 kontrata-tradicao (08/07):** repo→8cfa071, build --no-cache back+front, up --no-deps, backend healthy, dist tem `ruaCol`×5, bundle novo `index-Mt7bIxjR` serve `Performance-Setor`, HTTP 200. ⏳ Falta deploy nos outros clientes kontrata. ⏳ Usuário testar: PDF sai OK? KM aparece após uns refreshes (self-heal, precisa CEP no colab+loja).
1. ✅ **Botão 📄 PDF** na tela Performance por Setor (`RhPerformanceSetor.jsx`): jsPDF+autoTable (padrão do RhIndicadores), A4 paisagem, cabeçalho roxo. **Só inclui os meses COM venda lançada** (senão 24 colunas ficam ilegíveis); se nenhum mês tiver dado, cai pro ano inteiro. Total no rodapé.
2. ✅ **Fix — desligado de 2025 aparecia no filtro 2026** (`RhIndicadores.jsx`, `DesligamentosRanking`): filtrava só `status==='desligado'` SEM ano. Agora recebe `ano` e exige `data_desligamento` no ano-base. Cadeia: AbaColaboradores→AbaGeral→DesligamentosRanking.
3. ✅ **Fix — KM da Loja vinha "—" pra todos:** causa-raiz em `geocode.service.ts` `warmInBackground` (SELECT hardcoded `rua`, mas `rh_colaboradores` usa `endereco` → query estourava, `catch{}` engolia, colaborador nunca geocodado). Aliasado `ruaCol` por tabela. Detalhes: [[bugs-resolvidos/2026-07-08-km-desligados-coluna-rua-vs-endereco]].
- ⏳ PRÓXIMO: usuário testa LOCAL (PDF sai OK? KM aparece após uns refreshes — é self-heal). Se aprovar → commit+push+deploy Tradição (build --no-cache --no-deps front+back; o KM precisa do BACKEND rebuildado, não só front).

## 🏖️ (07/07) — Férias: modo Via Relógio de Ponto — ✅ DEPLOYADO Tradição (cfe1db9)
Tela Controle de Férias com 2 modos (Manual + Via Relógio). Endpoint `/rh/ferias/deteccao-ponto` varre apuração RHiD da admissão→hoje, agrupa férias em períodos, compara com registros manuais (bate/só-ponto/só-sistema), só exibe (Confirmar grava). Cards KPI do topo trocados pro estilo "cor só na ponta". Detalhes: [[bugs-resolvidos/2026-07-07-feature-ferias-via-relogio-ponto]].
- ⏳ PRÓXIMO: usuário roda o Escanear no Tradição (1ª vez demora, cache 6h) e compara relógio × sistema; ajustar detecção se precisar (tolerância de gap, etc.).

## 💼 (07/07) — Recrutamento + Pesquisa de Clima — ✅ DEPLOYADO Tradição (740e306)
Dashboards reais plugados. Recrutamento (`/rh/vagas/indicadores`: funil, desfechos, motivos, tempo). Pesquisa de Clima (`/pesquisa-clima/indicadores`: eNPS/satisfação, distribuição, evolução, médias, comentários, resumo NR-1). Ranking de ponto ganhou filtro Todos/Ativos/Inativos (2a2044b). Tudo no ar no Tradição.

## 💼 (07/07) — [HISTÓRICO] Recrutamento aba (rh_vagas + curriculos)
Antes era placeholder. Plugado em dados reais da tela RH > Vagas.
- **Backend** `RhController.indicadoresRecrutamento` + rota `GET /rh/vagas/indicadores?ano=&cod_loja=` (sem cache). KPIs (vagas em aberto / preenchidas ano / tempo médio contratação dias / taxa recusa), funil (interessados→selecionados→entrevistados→contratados), desfechos (`selecionados[].resultado_entrevista`: passou/aguarda_decisao/nao_compareceu/reprovado/desistiu), motivos (`motivo_reprovacao`) ranqueados por tipo, motivos de não preenchimento (`motivo_fechamento` das Fechadas), por mês iniciados×encerrados, tempo pra finalizar (dias) por vaga, tabela vagas abertas detalhadas.
- **Decisão:** SEM meta/SLA — tempo é descritivo ("quantos dias está demorando"). Usuário descartou painel Dentro/Fora do Prazo.
- **Frontend** `AbaRecrutamento` em RhIndicadores.jsx (KpiRec, RankRec, Bar por mês, funil, tabela). Dispatch ligado (`aba==='recrutamento'`).
- ✅ backend tsc=0, vite build=0. ⏳ Aguardando usuário testar LOCAL → depois commit+push+deploy Tradição.
- Estrutura `selecionados[]`: entrevista(sem_agendamento/agendada/realizada), data_entrevista, resultado_entrevista, motivo_reprovacao, contratado, exames. `curriculos.vagas_interesse_ids @> [v.id]` = interessados.
- **PENDENTE DE DEPLOY Tradição** (commitado, não deployado): `2a2044b` filtro Todos/Ativos/Inativos no ranking de ponto.

## 📊 (06/07) — Indicadores RH: aba "Ponto e Ausências" com dados reais (apuração RHiD agregada)
Objetivo: transformar o esqueleto da aba Ponto e Ausências (`RhIndicadores.jsx`) em dashboards reais, agregando a apuração RHiD de TODOS os colaboradores ativos. Pedido: ver por colaborador (ranking) E por setor (barras), comparativo Jan→Dez mês a mês ("melhorou ou piorou").
- 📚 Pesquisado absenteísmo: Índice Absenteísmo (h ausência ÷ h contratada), Gravidade (h/func), Frequência (eventos/func), TEA (% empregados ausentes), **Bradford Factor** (episódios²×dias — destaca falta curta/frequente = o "funcionário-problema").
- ⚠️ **Limite RHiD:** `/apuracao_ponto` só aceita range ≤ ~2 meses (ano inteiro = 400). Solução: busca **mês a mês** (pool concorrência 8). ~8s p/ 41 colab × 7 meses. Cache 20min.
- 🔧 **Fix de lógica:** `atraso` (horasFaltaAtraso) só conta em dia **trabalhado** (senão duplica com falta e estoura >100%). Absenteísmo dev caiu 45%→22%.
- ✅ **Backend:** `rh-ponto.controller.ts` método `indicadores` + rota `/rh/ponto/indicadores?ano&company_id&refresh`. Agrega por colaborador/setor/mês. Retorna kpis, por_tipo, por_mes(12), por_setor(com por_mes), ranking_colaboradores(top100 Bradford). Helpers `_classificaDia`/`_bradford`/`_mapPool` + cache `_indCache`.
- ✅ **Frontend:** componente `AbaPontoAusencias` em `RhIndicadores.jsx` (chart.js/react-chartjs-2 registrados): 8 KPIs + Bar absenteísmo mês a mês (verde=melhorou/vermelho=piorou) + Bar por setor + Doughnut por tipo + Line por setor mês-a-mês (top6) + tabela ranking Bradford. Botão Recalcular (refresh).
- ✅ **Validado:** `tsc`=0, `vite build`=0, endpoint HTTP 200 (9.7s, shape completo). ⚠️ Números dev = garbage (PIS vinculado por nome no dev, casou com pessoas erradas) — na PROD do Tradição (PIS correto) serão reais.
- ✅ **Flag "não bate ponto"** (cargo de confiança): migration `1786500000000` (`nao_bate_ponto` em rh_colaboradores) + aba "Cartão de Ponto" no cadastro (`RhCadastroGeral.jsx`) + create/update. Indicadores EXCLUEM (`AND c.nao_bate_ponto IS NOT TRUE`).
- ✅ **Auto-atualização:** `limparCacheIndicadores()` chamada em create/update/delete colaborador → marcar "não bate ponto" reflete na hora (sem Recalcular).
- ✅ **Ranking mês a mês:** 12 colunas Jan-Dez (horas ausência não planejada/mês, mapa de calor), nome sticky à esquerda, foto (Avatar) antes do nome, ranking no topo, gráficos compactos (~180px).
- ✅✅ COMMITS `464ad11` + `75d4997`. ✅✅✅ **DEPLOYADO Tradição (VPS 46) 06/07** (build --no-cache, up --no-deps, backend healthy = migration aplicada, bundle `index-B0DijIsa`). Números REAIS em prod (PIS correto).
- ⏳ **AÇÃO DO USUÁRIO em prod:** marcar cargos de confiança (Giliard/Wanderson) como "não bate ponto" → somem do dashboard sozinhos.
- 💡 Workflow: polir no LOCAL, deploy só quando aprovado.

## 🕐 (06/07) — Espelho de Ponto: recriar o "Cartão de Ponto" oficial 100% fiel ao Control iD
Objetivo do usuário: a tela `/rh/espelho-ponto` deve reproduzir o **Cartão de Ponto** que sai do relógio (Control iD), incluindo colunas que hoje NÃO trazemos. Documento oficial de referência = print da Helen Beatriz (período 26/05→25/06).
- ✅ **Bati na API `/apuracao_ponto` ao vivo** (script `packages/backend/src/scripts/dump-apuracao-rhid.ts`, untracked) e inventariei TODOS os campos crus da RHiD (Helen, rhid_id 115). JSON completo tinha ~90 campos/dia.
- 🔥 **CAUSA-RAIZ do "Folga não aparece":** a RHiD retorna **`folga: false`** nos dias de descanso (sáb/dom)! O dia de folga vem com `strHorarioContratualSimples: ""` + `idHorarioContratual: 0` + **sem batidas** + `isHoliday:0` + `faltaDiaInteiro:false`. Ou seja: NÃO existe flag de folga confiável — tem que **DERIVAR** (sem jornada prevista + sem batidas + não-feriado + não-falta = Folga/DSR). Nosso código atual faz `d.folga ? 'folga'` → quase nunca dispara.
- 📊 **MAPEAMENTO papel → campo RHiD (validado):**
  - PREVISTO = `strHorarioContratualSimples` ("07:15-12:00\r\n13:00-17:03"); vazio+feriado="FERIADO"+`holiday.name`; vazio sem nada="Folga"
  - ENT/SAÍ 1-3 = `listAfdtManutencao[]` ordenadas (`_typeEntradaSaida` E/S; **"D"=justificativa** com `abreviationJustification` ex "Medico"/"Abono", `afdtLogs[].detalheDiferencaConsiderada` ex "Atestado Médico")
  - TOTAL NORMAIS = `horasTotalNaoExtra` · TOTAL TRABALHADO = `totalHorasTrabalhadas` (hoje só trazemos este)
  - DIA FALTA = `faltasDiasInteiro` · FALTA E ATRASO = `horasFaltaAtraso` (=`atrasoEntrada`+`saidaAntecipada`)
  - ABONO = `minutosAbono` (ex 05/06 = 64min = 1h04, "Abonar quantidade de horas" ✓)
  - EXTRA DIURNA = `extraDiurna` · EXTRA NOTURNA = `extraNoturna` · INTERJORNADA = `extraInterjornada`
  - BANCO (dia) = `saldoBancoCredDeb` · BANCO SALDO (acumulado) = `saldoBancoFinalDia`
  - Feriado: `isHoliday:1` + `holiday.name` (ex "CORPUS CRISTI") · Atestado dia todo: todas batidas tipo "D" Medico, `faltaDiaInteiro:false` (justificado não vira falta)
- 📋 Header do papel (empresa/CNPJ/IE/CPF/admissão/depto/matrícula + grade semanal HORÁRIO DE TRABALHO + "Alterações") = juntar `rh_colaboradores`+`rh_empresas` com a apuração.
- ✅ **IMPLEMENTADO (06/07) — os DOIS (tela rica + PDF fiel), LOCAL, uncommitado:**
  - **Backend** `rh-ponto.controller.ts` (espelho): expõe normais/trabalhado/falta_atraso/abono/extra_diurna/extra_noturna/interjornada/banco_dia/saldo + **deriva folga** (a RHiD manda folga:false!) + classifica feriado/atestado + batida tipo "D" (justificativa) + header (empresa razao/cnpj/cod_loja, cpf, admissão, departamento) + `horario_semanal` (grade) + `alteracoes` + totais completos. IE não existe em rh_empresas (fica null).
  - **Frontend** `RhEspelhoPonto.jsx`: tabela com todas as colunas novas (arrastáveis), célula de justificativa (Atestado/Abono laranja), linha Folga/Feriado/Atestado tingida, status novo 'atestado'. PDF trocado de rascunho p/ **`gerarCartao`** = cópia fiel do Cartão de Ponto Control iD (título, Control iD, período vermelho, bloco empresa+CNPJ+CPF+PIS+admissão+cargo+matrícula+depto, grade HORÁRIO DE TRABALHO SEG..DOM, colunas DIA/PREVISTO/ENT1..SAI3/NORMAIS/TRABALHADO/FALTA/ATRASO/ABONO/EXTRA D/N/INTERJOR/BANCO CRÉD/DÉB, TOTAIS, Alterações). A4 landscape.
  - ✅ Verificado com dados reais: NORMAIS 167h53 + TRABALHADO 170h03 = batem c/ papel. Folga sáb/dom OK (antes vinha "Trabalhou"). Abono 05/06=1h04, feriado 04/06 CORPUS CRISTI, atestado 18-19/06 detectados. `tsc --noEmit`=0, `vite build`=0.
  - ✅ **Usuário validou na tela** (folgas, colunas, cores). Ajuste fino: badge "Dia da Semana" trocado de `bg-yellow-200` (forte) p/ `bg-amber-100 text-amber-700` (pastel).
  - ✅✅ **COMMIT+PUSH `0d380c0`** (KONTRATAAI) — junto com o filtro de Setor `2a1b982`.
  - ✅✅✅ **DEPLOYADO no kontrata-Tradição (VPS 46) 06/07 + VERIFICADO:** `git pull` repo→0d380c0, build `--no-cache` backend+frontend, `up --no-deps` (postgres/minio intactos, Up 12d). Backend `healthy` (log limpo, server 3010, seeds OK). Bundle público novo `index-jsQ0hJ36`: confirmado `interjornada_min`(3), `feriado_nome`(1), `Todos os setores`(5), `HORÁRIO DE TRABALHO`(1), `Cartão de Ponto (PDF)`(1). Build context do compose = `/root/kontrata-repo/packages/{backend,frontend}`.
  - ⏳ **A FAZER (futuro):** deploy nos OUTROS clientes kontrata (só Tradição foi). Detalhe do mapeamento durável em `RELOGIO RHID/01-DADOS-EXTRAIDOS.md §7.4`.

## 🕐 (02/07) — Relógio de Ponto RHID (Control iD REP iDClass) — PESQUISA COMPLETA, a construir
Objetivo: integrar o relógio de ponto no Kontrata pra puxar marcações (e futuramente criar cadastro).
- ✅ **Tudo validado AO VIVO** (esta máquina 10.6.1.171 alcança o relógio 10.6.1.209:443, admin/admin). Doc: `RELOGIO RHID/01-DADOS-EXTRAIDOS.md` (seções 7.1 e 7.2 novas).
- ✅ **LEITURA:** `login.fcgi` → `get_afd.fcgi` com `{"initial_nsr":N}` (incremental!). Formato **largura-fixa** (não pipes): tipo 3 = marcação (NSR+data+hora+PIS), tipo 5 = cadastro (op I/A/E na pos 23 = ativo/inativo). Provado: espelho da Maria Eduarda (Ent/Saí, banco de horas +/− acumulado, HE/excedente por dia, atrasos, ativo/inativo). 40 ativos / 169 inativos.
- ✅ **ESCRITA confirmada:** `add_users.fcgi` (criar), `update_users`/`remove_users`/`load_users`/`count_users`. Envia PIS+nome+matrícula+senha+cartão. Biometria = presencial (REP-C não tem enroll remoto). Modo 1510 = PIS. ⚠️ REP FISCAL: todo write grava tipo-5 permanente no AFD — só criar com OK explícito.
- 🔗 Casa com a folha: HE/Adic.Noturno/Atraso (Horas) da tela Lançamentos = preenchíveis pela apuração do ponto. PIS↔`rh_colaboradores.pis_pasep` (já existe). `rh_jornadas.carga_horaria` (já existe) dá o banco preciso.
- ✅✅ **CONSTRUÍDO (02/07) e FUNCIONANDO LOCAL — via API da NUVEM RHiD (não o device!):** decisão do usuário = usar o SALDO REAL do banco (com queima/pagamento), que só existe na RHiD. Endpoint `GET /apuracao_ponto` (base `https://www.rhid.com.br/v2/api.svc`, auth Bearer JWT, resposta **double-encoded JSON**) traz por dia: `strHorarioContratualSimples` (jornada), `listAfdtManutencao` (batidas E/S + justificativa), `totalHorasTrabalhadas`, `horasExtrasCalculadas`, `folga`/`faltaDiaInteiro`/`isHoliday`, e ⭐ **`saldoBancoFinalDia`** (saldo acumulado oficial). Login RHiD: tradicaosupermercado@yahoo.com / domínio `creusalbruivo` / customer 14884.
  - Arquivos novos: `packages/backend/src/services/rhid.service.ts` (login+token cache+person+apuracao), `rh-ponto.controller.ts` (espelho consumindo RHiD), `rh-ponto` routes (`/ponto/relogio/status`, `/ponto/espelho`), `packages/frontend/src/pages/RhEspelhoPonto.jsx` + rota `/rh/espelho-ponto` + item de menu "ESPELHO DE PONTO" em Ponto e Ausências.
  - Config local (kontrata_dev): `rhid_email/rhid_senha/rhid_dominio` (em prod: criptografado + tela de Configurações). Vínculo colaborador↔RHiD por **PIS** (`rh_colaboradores.pis_pasep` ↔ RHiD `pis`). Testado E2E: Maria Eduarda (rhid_id 170) saldo banco +5h26 real.
  - ⚠️ **Dev-only:** vinculei 27 colaboradores locais ao PIS por nome (dev DB não tinha PIS). `controlid-rep.service.ts` (device/AFD cru) ainda existe mas o espelho agora usa a RHiD.
- ✅ **CONFIG feita (Configurações → APIs → CARTÃO DE PONTO):** `PontoRhidTab.jsx` — credenciais RHiD (rhid_email/rhid_senha[cripto]/rhid_dominio/rhid_base) + Testar Conexão (`POST /rh/ponto/relogio/testar`) + associação Loja↔Empresa RHiD (`GET /rh/ponto/rhid/empresas` via `/company`, salvo em `rhid_loja_map`). `rhid_senha` add em `config.controller.ts` encryptedFields. **Zero hardcode** (dead code `controlid-rep.service.ts` deletado). Menu limpo: removidos "Jornadas de Trabalho" e "Lançar Ausências".
- ✅✅ **COMMIT+PUSH `5905fea` na KONTRATAAI** (9 arquivos). Doc de pesquisa (com login) NÃO versionada de propósito.
- ✅✅✅ **DEPLOYADO no kontrata-Tradição (VPS 46, commit 5905fea) + CONFIGURADO EM PRODUÇÃO** (03/07): usuário cadastrou o login RHiD na aba, conexão verde, empresas carregadas, lojas associadas, funcionando. Site bundle `index-3jtrygJt`.
- ⚠️ **Pegadinha UX (não crítica):** "Carregar empresas RHiD" lê a config JÁ SALVA → tem que clicar **Salvar** antes de Carregar (a dica na tela avisa). Melhoria opcional futura: fazer o Carregar usar as credenciais digitadas (POST com creds) pra ordem não importar.
- ⏳ **A FAZER (futuro):** (1) alimentar a folha (HE/Adic.Noturno/Atraso Horas de Lançamentos ← apuração RHiD); (2) garantir PIS/PASEP preenchido nos colaboradores em prod (senão espelho diz "sem PIS"); (3) cadastro-no-relógio via `add_users`. Login RHiD Tradição: tradicaosupermercado@yahoo.com / domínio creusalbruivo (customer 14884; empresas RHiD: Creusa id1, TRADIÇÃO SUPERMERCADOS id2, SUPERMERCADO TRADICAO id3).


## 🛠️ (02/07) — KONTRATA RH: Lançamentos Financeiros (tela `/rh/lancamentos`) — em construção LOCAL
Trabalhando na grade de apontamento de folha. Tudo em `d:\kontrata.ai`, branch KONTRATAAI, **rodando local** (front 10.6.1.171:3004 + back 3010, DB kontrata_dev). **UNCOMMITADO / não deployado.**
- **Arquivos:** front `packages/frontend/src/pages/rh/RhLancamentos.jsx` (só `RhLancamentos.jsx`, ⚠️ não confundir com FichasAdmissao). back `controllers/rh-apontamentos.controller.ts` + `routes/rh.routes.ts` + migration `1786000000000-AddMostraHorasRhApontamentoCampos.ts`.
- **Feito:**
  1. 🔀 **Drag-and-drop de colunas** (HTML5 nativo, alça ⠿ no header). Só troca dentro do mesmo tipo (verde=provento ↔ verde, vermelho=desconto ↔ vermelho). Ordem **salva pro cliente** em `configurations` (`lancamentos_ordem_proventos/descontos`) via `ConfigurationService`. Endpoints `GET/POST /rh/apontamentos/ordem`. Modelo de colunas unificado (fixas + extras) via `buildCols`+`applyOrder`.
  2. ⏰ **Campo HORAS** (2 dropdowns HH:MM, componente `HorasPicker`, HH 0-99 / MM 0-59). Fixas de hora = HE 60%/HE Interj/HE 100%/Adic.Noturno + Atraso (set `HORAS_FIXAS`). Guardado **decimal** no banco (backend `num()` já converte "01:30"→1.5), exibido 00:00 (`decToHHMM`). Extras podem ter Horas (flag `mostra_horas`, migration nova).
  3. 🔢 **QTD = número puro** (`isNumeroValido` rejeita ":"). Horas e QTD são exclusivos.
  4. ✎ **Editar coluna** (botão em TODA coluna): renomear (label override em `lancamentos_labels`) ou remover — extra=exclui de vez (`deletarColuna`), fixa=**oculta** (`lancamentos_ocultas`, restaurável via botão "🙈 Ocultas (N)").
  5. 🔠 Labels sempre **MAIÚSCULO** (header render `.toUpperCase()` + save uppercase). Bug corrigido: CSS text-transform enganava (parecia upper, salvava misto).
- **Modal Nova Coluna:** agora 3 opções (⏰ Horas / 📊 QTD / 💵 R$), Horas e QTD exclusivos.
- **Persistência:** config keys `lancamentos_ordem_proventos`, `_descontos`, `lancamentos_labels` ({chave:nome}), `lancamentos_ocultas` ([chave]). DB por-cliente = "salvo pro cliente".
- ✅ FE `vite build` e BE `tsc --noEmit` = exit 0. Drag testado (log mostrou POST /ordem 200).
- 🐛 **Bug achado+corrigido (WYSIWYG):** `totais()` somava Bruto/Líquido usando `PROVENTOS`/`DESCONTOS`+extras SEM filtrar ocultas → coluna oculta com R$ lançado continuava sendo subtraída (deu 110 em vez de 100). Reescrito pra somar só `colsProventos`/`colsDescontos` (visíveis). Valor da oculta é preservado (volta ao restaurar).
- ✅ **COMMITADO+PUSH** `4521875` na KONTRATAAI (4 arquivos).
- ✅✅ **DEPLOYADO no kontrata-Tradição (VPS 46) 02/07** — build --no-cache front+back, backend healthy, site HTTP 200, bundle novo `index-IKXJdzBs`. Migration `1786000000000` rodou (confirmado: coluna `mostra_horas boolean default false` existe na `rh_apontamento_campos`). ⏳ Falta deploy nos OUTROS clientes kontrata.
- ⚠️ PDF/Excel do apontamento ainda usam ordem/colunas padrão (não refletem reordenação/renome/horas/ocultas) — alinhar se precisa sincronizar depois.

## 🔧 (02/07) — KONTRATA RH: datas da Ficha de Admissão voltavam 1 dia no PDF/e-mail
- **Sintoma:** ficha certa no form, mas ao Imprimir/PDF/Enviar e-mail TODAS as datas voltavam 1 dia (nasc 10/06→09/06, casamento 14/07→13/07, título 11/12→10/12...).
- **Causa:** `fmtDate` em `FichasAdmissaoSection.jsx` fazia `new Date("YYYY-MM-DD").toLocaleDateString()` → data-only vira meia-noite UTC → no BR (UTC-3) cai no dia anterior.
- **Fix:** helper `fmtDateBR` (regex extrai YYYY-MM-DD e monta DD/MM/YYYY literal, sem passar pelo Date/fuso). Aplicado nos 2 pontos (ficha impressa/PDF/e-mail via `buildFichaHtml` + card da lista, linha ~581). Fallback pro Date só p/ não-ISO.
- ✅ Commit `7f1c3d7` (push KONTRATAAI). ✅ **DEPLOY no kontrata-tradição (VPS 46) feito+verificado**: git pull ok, `fmtDateBR` no fonte (grep=3), build --no-cache frontend, index.html público serve bundle novo `index-CbLwnV79`, HTTP 200. Só frontend (PDF é client-side html2canvas+jsPDF).
- ⏳ Falta usuário validar com hard refresh (Ctrl+Shift+R) que 10/06/1996 sai 10/06 no PDF. ⏳ Deploy nos outros kontrata pendente.
- Detalhes: `bugs-resolvidos/2026-07-02-kontrata-rh-data-volta-1-dia-pdf-fuso.md`.

## ✅ (02/07) — Tradição prevenção: hora do bip + init:true + susto do kontrata
- ✅ **Hora do bip corrigida:** relógio do PC da loja fica ~10h errado (perde hora ao desligar da tomada / bateria CMOS fraca) → bips com hora errada, quebrava cruzamento com PDV. **Fix:** `bip-webhook.service.ts` usa `new Date()` (hora do servidor VPS/NTP) em vez do `eventDate` do PC. Commit `dcef775`, deployado no Tradição, **VALIDADO** (bip novo saiu 14:51 certo). Raiz no cliente = trocar bateria CMOS + ligar NTP no Windows.
- ✅ **init:true no Tradição prevenção (finalmente):** o backend travou de novo (664 zumbis, `unhealthy` 7d, `docker stop` falhou "did not receive exit event" → `docker rm -f` + recriar). Adicionado `init: true` no compose. ⚠️ **O compose do Tradição JÁ tinha teto via `deploy.resources.limits.cpus: "0.6"`** → NÃO adicionar `cpus:` legado junto (conflita: "can't set distinct values on cpus and deploy.resources.limits.cpus"). Só `init: true`.
- 🔥 **ERRO MEU (lição):** no cleanup do deploy usei `docker ps -a | grep tradicao-backend | xargs docker rm -f` — o grep amplo pegou **kontrata-tradicao-backend** junto (outro cliente!) e removeu ele → RH do kontrata zerou. **SEMPRE ancorar o grep** (ex: `grep -x prevencao-tradicao-backend` ou `grep '^prevencao-tradicao-backend$'`), NUNCA `grep tradicao-backend` (casa prevencao+kontrata). Restaurado com `cd /root/clientes-kontrata/tradicao && docker compose up -d --no-deps backend` (imagem existia).
- ⚠️ **Deploy no Tradição:** build cacheado+`nice` (não `--no-cache`) porque VPS 46 estava com load alto (10-32) — só 1 arquivo mudado, COPY invalida a layer. Verificar depois se o código entrou.

## 🟢 MARCO (01/07) — VPS 31 ZERADA e virou host nginx limpo (igual à 46)
Objetivo do usuário: consolidar na 46, zerar a 31 e deixá-la igual à 46 pra hospedar **clientes novos**. FEITO.
- ✅ **Evolution NOVA na 46** (`/root/evolution`, evoapicloud/evolution-api:latest + postgres:16 + redis, nginx+SSL em `evolution.kontrataai.com.br`, API key em `/root/evolution/CREDENCIAIS.txt`). Os **3 clientes que o usuário usa** (instâncias KONTRATAI/TRADICAO/NUNES) já migrados e `open`. Chave global: serve todas as instâncias.
- ✅ **Confirmado que só a Evolution ligava 46↔31.** Teste à prova de falha: desliguei a Evolution da 31 (scale 0), os 3 clientes seguiram OK → nada depende da 31.
- ✅ **WIPE da 31:** removidos TODOS os stacks swarm (evolution/chatwoot/n8n/pgvector/portainer/postgres/redis/traefik) + legado standalone (nunes velho, prod velho). `docker swarm leave --force` → **Swarm OFF** (docker simples). Prune total. Liberou ~19GB (26G→7,3G).
- ✅ **Pós-wipe limpo:** iptables custom removido (REDIRECT→3000 morto + DNATs velhas), nginx sem vhosts velhos, YAMLs/logs/pastas velhas de `/root` removidos. **Mantido:** nginx, docker, `/root/prevencao-radar-repo` (HEAD 283c06b), `/root/prevencao-radar-install`.
- 🎯 **31 PRONTA pra clientes novos:** sem Traefik → nginx dono do 80/443 → **certbot/SSL funciona** (era o Traefik que quebrava); build ok (fix iptables MSS→na verdade era REDIRECT porta 80 sequestrando saída Docker→app 3000). Instalar com `sudo bash /root/prevencao-radar-repo/InstaladorVPS/install-multitenant.sh` (sem arg = pergunta o nome).
- ✅ **VALIDADO (01/07):** 1º cliente novo instalado na 31 zerada = **`docepreco`** (Supermercado Doce Preço) — subiu no ar (Vision 360/Bipagens), build ok, SSL ok, sem Traefik. **Prova que a consolidação funcionou** e a 31 virou host igual à 46.
- ✅ **2º cliente:** `supertradicao` instalado. **BUG resolvido:** First Setup dava "Erro ao configurar sistema" → backend não conectava no PRÓPRIO postgres (timeout). Causa: **estado travado do Docker/rede na 31** pós-swarm (DOCKER-FORWARD/veth emperrado) — recreate e `systemctl restart docker` NÃO resolveram; **REBOOT da VPS resolveu** (limpou tudo, backend conecta, schema criado). Lição: pós-`swarm leave`, se container novo não conecta no próprio postgres (host alcança mas container não) = reboot.
- ✅ **SEGURANÇA da 31 = igual à 46:** SSH agora **só-chave** (`PasswordAuthentication no`, `PermitRootLogin without-password`). Fechou o vetor dos mineradores ("garimpadores" = brute-force SSH). ⚠️ **Gotcha:** `/etc/ssh/sshd_config.d/50-cloud-init.conf` (Hostinger) força `PasswordAuthentication yes` e vence drop-in `99-` (1ª ocorrência vence) → editar o cloud-init OU nomear drop-in `00-`. fail2ban já ativo nas 2. Usuário acessa 31 via console web Hostinger + via Claude (chave `id_rsa_vps_producao`).
- 🔥 **CAUSA-RAIZ de TODO o caos de rede da 31 (achada 01/07):** após `docker swarm leave`, o **`/etc/iptables/rules.v4`** (carregado no boot pelo **`netfilter-persistent`**) guardava **regras MORTAS do Swarm** (`DOCKER-INGRESS` DNAT de 80/443 → rede ingress `172.18.0.2` que não existe mais) + UFW + DNATs antigos. Recarregava o lixo a cada boot → desviava 80/443 pro vazio (timeout) e quebrava rede de container. Explicou: build travado, supertradicao sem banco, sites caídos, REDIRECT→3000 voltando.
- ✅ **FIX DEFINITIVO (igual 46):** flush total iptables (`-F -X` nas 3 tabelas + policies ACCEPT) + `ufw --force reset && disable` + **`systemctl disable netfilter-persistent`** + esvaziar `/etc/iptables/rules.v4` + restart docker (rebuilda regras limpas) + restart nginx. Resultado: docepreco+supertradicao **HTTP 200**, super DB OPEN, loopback 80/443 OK. Docker gerencia sozinho, igual à 46. Durável (não recarrega lixo no boot).
- ⚠️ **UFW na 31 era um problema, não solução** — brigava com Docker (INPUT DROP sem `-i lo` = loopback dropado). VPS 46 não usa UFW. Segurança = SSH só-chave + fail2ban (não UFW).
- ⚠️ **PEGADINHA Oracle em cliente novo (achada 01/07):** o instalador seta **`TUNNEL_ORACLE_PORT=<porta>`** no `.env` (arquitetura antiga de túnel SSH). O código (`oracle.service.ts:74`) faz: se `isVps && TUNNEL_ORACLE_PORT` → usa essa porta em vez da configurada. Na arquitetura ATUAL (direta via Mikrotik), isso quebra: tenta `HOST:tunnel_port` (ex 187.90.96.96:**10669**) → ORA-12170 timeout. **FIX:** esvaziar `TUNNEL_ORACLE_PORT=` no `.env` do cliente (igual aos clientes que funcionam, ex Tradição 46) + recriar backend (`docker compose up -d --no-deps --force-recreate backend`). Aí usa a porta configurada (11251) direto. **Vale pra TODO cliente novo.**
- ✅ **supertradicao Oracle+Mapeamento OK** (4950 vendas, sync 2s). Config DVR = mesma do Tradição (direto 187.90.96.96:8123 HTTP/5554 RTSP, user admin, transcode H.265; valores NÃO criptografados = copiáveis).
- ⏳ **DVR pendente (01/07):** supertradicao deu timeout no DVR. Testado: **NENHUMA das VPS (31 nem 46) alcança 187.90.96.96:8123/5554 agora** (Oracle 11251 alcança). = DVR/rede da loja provavelmente OFFLINE no momento, NÃO filtro de IP. **Revisitar:** re-testar conectividade; se 46 voltar e 31 não → aí sim é firewall Mikrotik (liberar IP 31.97.82.235 nas portas DVR). Ver [[modulos/dvr-cameras]] + [[padroes/firewall-roteador-clientes]].
- ✅ **fratelli** (Intersolid, cliente novo 31): TUNNEL esvaziado + mapeamento copiado do Tradição → 1875 vendas OK.
- ✅ **INSTALADOR CORRIGIDO (commit 248e378, push TESTE):** `TUNNEL_ORACLE_PORT=` vazio por padrão → clientes novos já vêm com Oracle direto (sem ORA-12170). Auto-aplica via git pull do instalador.
- ✅ **Calendário de Atendimento replicado:** tabela `fornecedor_agendamentos` (731 registros: freq_visita/dia_semana/comprador/tipo_atendimento/romaneio/cod_loja) copiada Tradição(46)→supertradicao(31) via `\copy` CSV. Mesma loja = mesmos cod_fornecedor.
- ⚠️ **NUNES na 31 — BLOQUEADO pelo Mikrotik (02/07):** Nunes é **PostgreSQL RP INFO** (não Oracle). Mikrotik do Nunes **filtra por IP = só 46.202.150.64**. VPS 31 (31.97.82.235) → `hea08skfqwk.sn.mynetname.net:10835` = TIMEOUT (46 = OPEN). **FIX (no Mikrotik do cliente, precisa WinBox/acesso):** add 31.97.82.235 na whitelist (address-list) das portas 10835(PG)/38100/38101(DVR). Ver [[padroes/firewall-roteador-clientes]]. Mapeamento do Nunes vem do Nunes-46 (RP INFO, ≠ Intersolid).
- ✅✅ **vital (31) = SuperVital — COMPLETO E VALIDADO (02/07)** pelo usuário: dados do SuperVital, 2 lojas (Botujuru+Biritiba), "Todos" somando. Batalha resolvida (conexão INACTIVE era a raiz). Conexão `smvital.o3utm.com.br:1521` (NÃO Tradição 187.90.96.96!), mapeamento copiado do SuperVital (21463, ≠ Tradição 21438). As 2 lojas vêm do `TAB_LOJA` do Oracle. 31 alcança smvital:1521 (sem filtro IP).
- 🔥🔥 **CAUSA-RAIZ do "vital trazia dados do Tradição" (02/07) — CONEXÃO INACTIVE:** `OracleService.loadConfig` (oracle.service.ts) só usa a conexão do painel se `status=ACTIVE`; se inativa, cai no **fallback** (env → **DEFAULT hardcoded** `10.6.1.100:1521` senha `OdRz6J4LY6Y6` = Tradição, OU config legada). E tem `if(configLoaded)return` (carrega 1x, cacheia). A conexão do vital ficou **INACTIVE** (recriar/testar não marcou active) → app ignorava smvital e usava o fallback Tradição → dados+lojas do Tradição (Tradição=1 loja, por isso "1 loja"). **FIX:** `UPDATE database_connections SET status='active', is_default=true WHERE id=<X>` + restart backend (reseta configLoaded → recarrega). Confirma no log: "📦 Oracle config loaded from database_connections: <nome>". **SEMPRE garantir status ACTIVE** (o "Testar" ✅ no painel marca active). ⚠️ DEFAULT_ORACLE_CONFIG hardcoded no código = Tradição — é o fallback perigoso.
- 🔥 **PEGADINHA — cache poluído entre configs (02/07):** o app tem **cache em ARQUIVO** (`cache.service.ts`, `/app/cache/*.json` no container do backend, TTL). Se o cliente for configurado BREVEMENTE com o Oracle ERRADO (ex: vital apontou pro Tradição por engano), o cache guarda os dados do store errado. Trocar a conexão de volta **NÃO limpa o cache** → views agregadas ("Todos"/all lojas) devolvem dados do store errado (parece vazamento, mas é cache local do próprio cliente). **FIX:** `docker exec <cliente>-backend rm -f /app/cache/*.json` + hard refresh. Restart do backend NÃO resolve (cache é arquivo, não memória). NÃO é vazamento entre clientes (cache é isolado por container).
- ⚠️ Recriar a conexão no painel **apaga o mapeamento** (fica na linha do database_connections) → recopiar após recriar.
- 🏬 **MULTI-LOJA (SuperVital/vital) — como funciona:** o seletor de lojas vem da tabela local **`companies`** (uma linha por loja, campo `cod_loja` + `apelido`). O First Setup cria 1 loja PROVISÓRIA (cod_loja=1). `getLojas` (gestao-inteligente.service) deveria auto-criar as demais do Oracle (`autoCreateMissingCompanies`), MAS o log mostrou **"Lojas Oracle encontradas: 1"** (o TAB_LOJA mapeado retorna 1, mesmo tendo 2 no Oracle direto) → auto-migração incompleta. **FIX (igual SuperVital-46, que tem 2 companies manuais):** inserir a 2ª company na tabela `companies` (cod_loja=2, apelido = nome da loja). Ex vital: `UPDATE companies SET apelido='VITAL BOTUJURU' WHERE cod_loja=1` + `INSERT ... cod_loja=2, apelido='VITAL BIRITIBA'`. Depois: limpar `/app/cache/*.json` + restart backend. As 2 lojas do SuperVital: Botujuru (cod_loja 1) + Biritiba (cod_loja 2).
- ⏳ **PRÓXIMO:** (a) liberar IP 31 no Mikrotik do Nunes → copiar mapeamento RP INFO do Nunes-46; (b) plugar WhatsApp na Evolution 46 (instância nome ÚNICO); (c) revisitar DVR.
- ⚠️ Regra de nomes (Evolution compartilhada + DNS): domínio e **nome da instância Evolution** têm que ser ÚNICOS por cliente. Containers/banco podem repetir entre VPS (isoladas) mas confunde — usar nome único.
- Detalhes: [[arquitetura/estrutura-vps3-producao]].

## 🟢 ATIVO (01/07) — Evolution NOVA na VPS 46 (paralela, teste antes de migrar)
Decisão: NÃO tocar na Evolution da VPS 31 (segue servindo todos). Subir uma Evolution **nova e isolada** na VPS 46 pra testar e **migrar clientes aos poucos**.
- ✅ **Stack no ar:** `/root/evolution/` na VPS 46 — `evolution-api` (evoapicloud/evolution-api:latest v2.3.7) + `evolution-postgres` + `evolution-redis`. Rede própria `evolution_evolution_net`, volumes próprios, API presa em `127.0.0.1:8090`. Config replicada da 31 (mesmo env), com API key NOVA, `SERVER_URL=https://evolution.kontrataai.com.br`, **chatwoot OFF** (não existe na 46).
- ✅ **nginx + SSL:** vhost `/etc/nginx/sites-available/evolution` → proxy `127.0.0.1:8090` (com WebSocket/timeouts). Certbot OK. **https://evolution.kontrataai.com.br responde status 200.**
- 🔑 **API key** em `/root/evolution/CREDENCIAIS.txt` (na 46). Manager: `https://evolution.kontrataai.com.br/manager`.
- ⚠️ **GOTCHA:** `postgres:latest` agora = **PG 18**, que quebra o mount antigo `/var/lib/postgresql/data` ("unused mount/volume"). **Fixado `postgres:16`** no compose. (Vale pra qualquer stack novo com postgres:latest.)
- ✅ **Clientes da 46 INTOCADOS** (todos "Up 6-7 days", uptime não zerou = ninguém reiniciado). Isolamento total provado.
- ⏳ **PRÓXIMO:** criar 1 instância de teste (escanear QR num número de teste) → validar envio/recebimento → depois migrar clientes 1 a 1 (trocar `evolution_api_url` + re-registrar webhook/instância).

## ⏸️ PAUSADO (25/06) — VPS 31: habilitar novos clientes prevenção (falta 1 comando)
Objetivo: fazer a VPS 31 (`vps-prevencao`/31.97.82.235) aceitar instalação de **novos clientes** prevenção (migração de existentes foi DESCARTADA). Teste com cliente `teste` revelou 2 bloqueios:
1. **Build falha** (`apt-get` recebe HTML em vez do pacote → "NOSPLIT"). **CAUSA-RAIZ ACHADA:** regra iptables `-A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000` (sem `-i eth0`) sequestra a saída porta-80 dos containers Docker pro `prevencao-frontend-prod` (legado, porta 3000). Bridge quebra, host funciona (host usa chain OUTPUT, sem a regra).
   - ⏭️ **PRÓXIMO PASSO (aguardando OK do usuário):** trocar a regra por versão com `-i eth0` (só entrada externa). Entrada legítima já é do Traefik (DOCKER-INGRESS roda antes), então é seguro. Comando: `iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000` depois `iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-ports 3000`. Reverter = inverso. NÃO reinicia Docker. Alternativa sem firewall: build com `network: host` (por cliente).
2. **SSL falha** (Certbot 404): Traefik já ocupa a **443** na 31 → esquema nginx+certbot do instalador não encaixa. Pendente decidir (integrar Traefik ou outro caminho).
- **Estado SEGURO:** nada foi alterado de forma persistente na 31 (a regra MSS de teste foi REMOVIDA; a correção da REDIRECT NÃO foi aplicada — só investigada). Cliente `teste` ficou meio-instalado (`/root/clientes/teste` + vhost nginx + build falho, containers NÃO subiram) — sobra inofensiva. **VPS 46 intocada.**
- ⚠️ Evolution API roda na 31 → qualquer fix lá NÃO pode reiniciar Docker. Ver [[arquitetura/estrutura-vps3-producao]].

## Tarefa ATUAL (25/06) — Garimpador do Tradição (prevenção) parou: 2 causas
"Sistema parou de funcionar com o garimpador". Investigado: NÃO era billing (tinha $30,82). **Duas causas independentes:**
1. **Chave OpenAI inválida** (`Incorrect API key ...YUMA` revogada) → quebrava a IA. ✅ Usuário gerou nova no painel (Config→ChatGPT/OpenAI), "Conexão OK, 120 modelos".
2. **Webhook da Evolution sequestrado** (causa do "não recebe desde 01/06): a instância "DVR FACIAL" apontava pro **Agente WhatsApp** (`/api/whatsapp-agente/webhook`, `updatedAt 01/06`) em vez do garimpador. Evolution = 1 webhook/instância → o agente roubou. ✅ **Re-apontei pro `/api/garimpador/webhook`** via `webhook/set` (token descriptografado AES-256-CBC com `CONFIG_ENCRYPTION_KEY`). Confirmado.
- ✅ **Pipeline PROVADO:** POST sintético no webhook → salvou (`garimpador_mensagens` 15023→15024, "TESTE CLAUDE/Coca-Cola"). nginx→backend→save OK.
- ⏳ **Falta confirmar entrega real:** usuário precisa mandar oferta NOVA no WhatsApp (pós-repoint 20:44) e ver chegar. 2 watches anteriores vazios = envios eram antes do repoint.
- ⚠️ Trade-off: re-apontar quebrou o Agente WhatsApp (que estava 0 atividade 48h). Se quiser os 2 juntos = webhook unificado (código+deploy).
- ⚠️ Limpar depois: contato/msg de teste "TESTE CLAUDE" (5512999990001) no garimpador.
- Detalhes: [[modulos/garimpador]] (seção Troubleshooting caso 1 e 4).

---

## Tarefa ATUAL (25/06) — KONTRATA: Envio de documentos do RH por e-mail (piloto: Ficha Cadastral)
Botão **📧 Enviar por e-mail** na Ficha de Admissão → gera PDF (html2canvas+jspdf no front,
mesmo HTML da impressão via `buildFichaHtml`) e anexa, enviando **pelo E-MAIL DA EMPRESA**
(cliente), não pelo remetente de recuperação de senha. Cliente usa **Yahoo** (já suportado:
`makeTransporter` detecta @yahoo.com/@yahoo.com.br).
- Nova aba **✉️ Emails Padronizados** em Configurações RH com sub-abas: 🏢 Email Empresa
  (remetente + testar conexão) / 📇 Destinatários (lista editável) / 📋 Ficha Cadastral
  (assunto+corpo padrão, vars {NOME}/{CARGO}/{EMPRESA}).
- Config keys novas (por cliente): `email_empresa_user/pass/nome`, `email_destinatarios`, `email_textos_padrao`.
- Variáveis CLICÁVEIS no editor (inserem no cursor) incl. **{RESPONSAVEL}** (vem de /employees,
  dropdown no modal de envio). Fix do prefixo data-uri do jsPDF (anexo vinha corrompido).
- ✅ Testado end-to-end LOCAL (chegou na inbox c/ PDF íntegro). ✅ COMMIT+PUSH `3231b76`.
- ✅ **DEPLOY TRADIÇÃO (25/06) feito+verificado** (backend healthy, rota 401, bundle público OK).
- ⏳ Falta deploy nos outros 7 kontrata. ⚠️ Cada cliente precisa cadastrar o e-mail remetente +
  destinatários em produção (config é por banco, não migra).
- ⏳ **PENDENTE VALIDAR:** usuário ia conferir o PDF (hard refresh + e-mail novo) p/ ver se o
  espaçamento (commit `c807078`) resolveu o "encavalado". Se ainda enroscar → trocar gerador de
  PDF por TEXTO REAL via jsPDF (em vez de html2canvas, que come espaços no wrap).
- Detalhes: `bugs-resolvidos/2026-06-feature-envio-documentos-email.md`.

### 🔜 PRÓXIMA SESSÃO (26/06) — trabalhar na tela de LANÇAMENTOS (Financeiro RH)
`tradicao.kontrataai.com.br/rh/lancamentos` — "Lançamentos Financeiros / Apontamento de folha por
período". Grade colaborador × colunas de verbas (HE 60%, HE 60% interj., HE 100%, Adic. Noturno,
Quebra Caixa, Aj. Dom., Aj. Feriado, Insalub., Prêmio, Bolsa Gás, Reflexo HE, Salário Família,
Falta dias, Atraso...) com QTD/R$ por coluna. Filtros: Empresa, DE/ATÉ, Mês Competência, Mês Caixa.
Botões: Gravar, PDF, Excel, + Coluna. Abas: Apontamento / Lançamentos Salvos. (Usuário definirá o
que ajustar/criar amanhã.)

### 📌 IDEIAS FUTURAS registradas (não fazer agora)
- Portal do COLABORADOR (cartão de ponto + holerite) — legalidade OK (Portaria 671).
- Plataforma compartilhada com CONTABILIDADE externa + eSocial (ver memória `project_kontrata_contabilidade_plataforma`).
- Assinatura eletrônica não-ICP nos docs de contratação — pesquisa salva em `LEGALIDADE JURIDICA/`.

---

## Tarefa atual (25/06) — SuperVital caindo: reerguido + blindado (init+teto), falta callTimeout
SuperVital (prevenção-radar, `/root/clientes/supervital`) estava "sem sistema": backend `Up 25h (unhealthy)`, **1311 zumbis** na VPS inteira (todos filhos do node PID do backend). `docker restart` FALHOU ("PID is zombie"). Causa: Mikrotik/NAT da loja derruba conexão Oracle → backend pendura → Node PID 1 sem init não colhe zumbis → trava de vez.
- ✅ **Reerguido:** `docker compose up -d --no-deps --force-recreate backend` → healthy, **zumbis 1311→0**, steal 26%→2%.
- ✅ **BLINDADO no compose (persistido):** `init: true` + `cpus: 1.0` + `mem_limit: 1500m` no backend. Backup `.bak-initcpu-*`. Confirmado `INIT=true CPUS=1.0 MEM=1500m`. Resolve zumbi-wedge + impede meltdown. **= a CURA real.**
- ✅ **DESCOBERTA:** resiliência Oracle (`poolPing`/`callTimeout`/`expireTime`) JÁ estava deployada no backend — o travamento foi APESAR dela → confirma que a raiz era event loop morto + zumbis (que o `init` resolve). Backend NÃO precisou rebuild.
- ✅ **SetupCheck timeout DEPLOYADO** (commit `283c06b`, push TESTE): `timeout:8000` no `SetupCheck.jsx`. Build cacheado+`nice` no frontend SuperVital, bundle verificado. Rede de UX (se pendurar → login em 8s). ⏳ Falta deployar nos outros clientes.
- ✅ **MONITOR criado:** `/root/monitor-saude.sh` no cron a cada 15min → `/root/saude.log` (zumbis + backend unhealthy + steal; só detecta, não remedia). Ver [[arquitetura/estrutura-vps]].
- ⚠️ Mikrotik é rede do CLIENTE (não conserta do nosso lado) — nosso backend já está resiliente. Opcional futuro: pedir ao cliente afrouxar NAT idle-drop / keepalive.
- ⚠️ Frontend `unhealthy` = falso-positivo (wget BusyBox), ignorar.
- ⚠️ Steal da Hostinger ainda pula (27–53%) por throttle/vizinhança — não é nosso footprint (zumbis 0, backend capado). Monitor vigia.
- Detalhes: [[clientes/supervital]] + [[bugs-resolvidos/2026-06-17-supervital-backend-unhealthy-autoheal]] + [[bugs-resolvidos/2026-06-22-tradicao-backend-zombie-pid-init]].

---

## Tarefa (24/06) — UX vagas no celular: rolar pro "Continuar cadastro" ao marcar vaga (kontrata.ai)
Problema: candidato marca a vaga (público `CurriculoPublico.jsx`, tradicao.kontrataai.com.br) e fica parado achando que algo acontece sozinho — não percebe que precisa rolar até o fim e clicar em "Continuar cadastro".
- **Fix** em `CurriculoPublico.jsx`: ao MARCAR uma vaga (não ao desmarcar), `scrollIntoView` suave até o card "Continuar cadastro" (`continuarVagasRef`) + destaque pulsante (`destaqueContinuar` → `ring-4 ring-rose-400 shadow-2xl scale-[1.03]` por 2,6s). Handler `marcarVagaComFoco(vagaId, jaMarcado)`.
- Decisão do usuário: rola/destaca a CADA vaga marcada (não só na 1ª).
- ✅ Local OK. ✅ COMMITADO+PUSHADO (`d992a12`). ✅ **DEPLOY no TRADIÇÃO feito+validado** (junto com os demissionais). ⏳ Falta deploy nos outros 7 kontrata.

---


## Tarefa atual (24/06) — Doc demissional "Aviso Prévio do Empregador" (kontrata.ai)
Novo doc padronizado na **fase 3 (DOCS DEMISSIONAIS)**, montado por escolhas no momento de gerar.
- **Backend** `docs-padronizados.controller.ts` (`gerarParaColaborador`): lê query `data_aviso`, `tipo_aviso` (indenizado|trabalhado), `reducao_aviso` (2h|7d). Monta `$DATA_AVISO$` (data por extenso) e `$AVISO_PREVIO$` (frase dinâmica: indenizado = cessa na data; trabalhado = cessa +30 dias, com redução 2h/dia ou 7 dias corridos — art. 488 CLT). Helper `formatExtenso`.
- **Frontend** `RhConfiguracoes.jsx`: estados `dataAvisoGerar`/`tipoAviso`/`reducaoAviso`, `precisaAviso()` (detecta `$AVISO_PREVIO$`), bloco no modal Gerar (data + radios indenizado/trabalhado + redução condicional), params no `gerarPdf`, e tags `$DATA_AVISO$`/`$AVISO_PREVIO$` na lista.
- **Migration** `1785800000000-SeedDocAvisoPrevio.ts` (fase 3, **NÃO protegido** = editável). Roda sozinha (`migrationsRun: true`).
- ✅ Local: migration rodou, backend compilou, frontend HMR OK. Servidores dev locais SUBIDOS: backend 3010 + front **http://10.6.1.171:3004** (caem ao fechar a sessão).
- ⏳ Testar geração completa precisa de empresa+colaborador no banco local. UNCOMMITADO. Depois commit/push + deploy.

**2º doc demissional — "Carta de Próprio Punho"** (pedido de demissão do colaborador):
- Diferente: **NADA automatizado** — só o **logo** (injetado pelo motor) + **espaços em branco** (`____`) pro colaborador escrever à mão. Conteúdo SEM variáveis.
- Migration `1785810000000-SeedDocCartaProprioPunho.ts` (fase 3, ordem 2, não protegido). Rodou local OK.
- Aba DEMISSIONAIS agora tem 2 docs: Aviso Prévio do Empregador (ordem 1) + Carta de Próprio Punho (ordem 2).
- **Carta evoluiu pra 2 FOLHAS** (migration `1785820000000-CartaProprioPunhoEspelho.ts`, UPDATE do conteudo): folha 1 em branco (próprio punho) + folha 2 ESPELHO preenchido ($CIDADE$/$DATA_AVISO$/$EMPRESA_NOME$/$NOME$/$CTPS$/$SERIE_CTPS$/$CARGO$/$ADMISSAO$/$DATA_AVISO_BR$) com cabeçalho amarelo "MODELO DE PREENCHIMENTO". 
- **Padrões novos reutilizáveis:** token `$QUEBRA_PAGINA$` (page-break em `buildConteudoHtml`), `$DATA_AVISO_BR$` (dd/mm/aaaa), e split `precisaDataAviso()` (pede só data — Carta) vs `precisaTipoAviso()` (pede data+indenizado/trabalhado — Aviso Prévio). `print-color-adjust:exact` p/ imprimir fundo amarelo. HTML inline no conteudo do doc é renderizado (buildConteudoHtml NÃO escapa).
- ✅ **COMMITADO+PUSHADO** (commit `78366a8`): 3 migrations (1785800000000/810/820) + controller + RhConfiguracoes.
- ✅ **DEPLOY no TRADIÇÃO feito+VALIDADO (24/06):** containers recriados healthy, 3 migrations aplicadas, docs "Aviso Prévio do Empregador" + "Carta de Próprio Punho" no banco (fase 3), frontend rebuildado (strings Indenizado/Trabalhado presentes). ⏳ Falta deploy nos outros 7 clientes.

## ⚠️ FIM DA SESSÃO 24/06 — onde paramos
- **Tradição (kontrata) atualizado e validado** com as 2 features (docs demissionais + UX vagas). Outros 7 kontrata NÃO deployados ainda.
- **Throttle de CPU:** o build `--no-cache` do deploy RE-DISPAROU o throttle (steal subiu a ~80%, build levou ~20min em vez de ~4). Upgrade pra 4 núcleos resolveu o USO NORMAL mas não isenta de picos extremos (build). Kodee NÃO reseta manual (semanal esgotado) — cai sozinho com uso baixo. Load já caindo pós-build.
- **🎯 LIÇÃO p/ próximos deploys:** buildar com **teto de CPU** (`docker build`/compose com `--cpus 2` ou nice) pra o build não se afogar nem pesar nos outros clientes. Evitar `--no-cache` quando não precisar.
- ⚠️ Kodee sugeriu "matar processos" (npm/ffmpeg/node) — CUIDADO: `node dist/index.js` é backend de cliente (NÃO matar). ffmpeg = DVR prevenção.
- Servidores dev locais (backend 3010 + front http://10.6.1.171:3004) sobem nesta sessão e caem ao fechar.

---


## 🔥 INCIDENTE (23/06) — VPS46 throttle de CPU Hostinger (crédito de burst ESGOTADO)
Meltdown inicial resolvido (prevenção off), MAS a VPS segue **CAPADA pela Hostinger no teto de ~10% de CPU** (steal 90%, run queue 38, us/sy ~10%). Mensagem: **"Limite máximo de reinicializações da CPU atingido — todas já usadas. Faça upgrade."** = crédito de burst esgotou. Gráfico mostra 100% até ~3h → 10% reto (é o TETO, não uso baixo). ~9h+ grudado, não levantou sozinho.
- ✅ Achei e matei o **flapper** `prevencao-novacentral-frontend` (187 restarts, nginx `host not found in upstream backend`) → `--restart=no` + stop. Derrubou run queue 42→0 na hora, mas o teto da Hostinger voltou a clampar (crédito esgotado).
- Rodando agora: kontrata (8 clientes, frontends `unhealthy` mas servindo) + `prevencao-backend/frontend-prod`. Resto do prevenção `exited`.
- ❌ **NÃO subir prevenção tradição agora** (502 em tradicao.prevencaonoradar.com.br) — com teto de 10% re-dispara o meltdown.
- ❌ **Reboot NÃO resolve** — não devolve crédito de burst; gruda nos 10% de novo.
- 🎯 **RECOMENDAÇÃO: upgrade do plano** (única saída durável + tira o teto na hora). Usuário tinha escolhido "reboot grátis 1º" ANTES de ver o print do gráfico; com o print (crédito esgotado) a recomendação mudou p/ upgrade. **Aguardando decisão final do usuário.**
- Detalhes completos: `bugs-resolvidos/2026-06-23-vps46-cpu-throttle-meltdown-prevencao.md`.

### ✅ DECOMMISSION (23/06) — prevenção reduzido de 9 → 4 clientes
Pra aliviar a VPS, o usuário mandou **excluir do prevenção-no-radar**: mameva, guibox, idealmix, novacentral, central (containers + volumes/dados + pastas `/root/clientes/` + nginx + cadastro `clientes.json`). Feito via script `del_prevencao.sh` (scp + bash). ~2GB liberados (63G→61G).
- **Prevenção AGORA = só 4 clientes:** tradicao, nunes, supervital, maxvale (todos `Exited`/parados aguardando religar com teto de CPU).
- **kontrata 100% intacto** (32 containers antes e depois; guibox/mameva/novacentral/tradicao do kontrata seguem). Separação confirmada: prevenção=`prevencao-*`+`/root/clientes/`+nginx nome puro; kontrata=`kontrata-*`+`/root/clientes-kontrata/`+nginx `kontrata-*`.
- ⚠️ Pegadinha: a chave do central no JSON era `central-garimpafacil` (campo nome="central"). DNS dos 5 excluídos fica no registrador (usuário tira depois).
- ✅ **CASTIGO DE CPU LEVANTOU SOZINHO (~14:10 de 23/06)** — steal 90%→7%, CPU 91% ociosa, load 9 e caindo, sites kontrata HTTP 200. Auto-recovery da Hostinger (reset manual semanal estava esgotado; só saiu no relógio deles, ~11h depois do meltdown). Confirmado: NÃO tinha loop/malware/hog — o vilão (ffmpeg/DVR prevenção) já estava off; era só a pena cumprindo prazo.
- ⚠️ **CUIDADO ao religar prevenção:** o reset manual da semana JÁ FOI USADO — se estourar de novo, NÃO dá pra resetar (preso até virar a semana ou upgrade). Religar SÓ com teto de CPU (`limits.cpus`), 1 cliente por vez, vigiando steal. Os 4 mantidos (tradicao/nunes/supervital/maxvale) seguem `Exited`.
- ✅ **`init: true` REMOVIDO do compose do Tradição prevenção (23/06)** a pedido do usuário (ele identificou como gatilho do meltdown — curava o backend → ffmpeg voltava → estourava). Linha 59, backup `.bak-init-*`, compose validado. Backend parado, muda quando religar (sobe sem init). Pro "página caindo" usar a Camada 2 (timeout SetupCheck, frontend). Ver nota `2026-06-22-tradicao-backend-zombie-pid-init.md`.

### ✅ 24/06 — Throttle saiu de vez + teste de carga do prevenção religado
- **Teto da Hostinger LEVANTOU** durante a noite (load ~1, idle ~70%, steal baixo). 12% no painel = uso REAL agora. Mensagem vermelha é resíduo grudado.
- **Investigação cliente-a-cliente:** NENHUM cliente kontrata é hog (todos ~0% em repouso; picos são manutenção transitória de postgres/minio). Confirmado de vez: o vilão era o ffmpeg/DVR do prevenção (off/excluído).
- **TESTE DE CARGA (religar prevenção com teto de CPU `docker update --cpus`):** 8 kontrata + **2 prevenção (Tradição+Nunes) = ESTÁVEL** (load ~1.7). 8 kontrata + **4 prevenção = SATUROU** (load 13, idle 0%, steal 65%, ffmpeg+crons daily-verification juntos). **CONCLUSÃO DEFINITIVA: VPS de 2 núcleos só aguenta ~2 prevenção + kontrata. Pros 4 → precisa UPGRADE.**
- **Estado atual:** rodando 8 kontrata + Tradição + Nunes (backend healthy, **crons parados** no freio, teto 0.4-0.5 CPU). Supervital + Maxvale **parados**. ⚠️ Reset semanal do throttle ESGOTADO — não deixar saturar.
- ⏳ **DECISÃO PENDENTE:** manter 2 prevenção aqui (quais 2?) OU upgrade pros 4. + religar crons do Tradição/Nunes se mantiver.
- 📦 **Instalador de cliente novo kontrata BAIXADO e validado** em `/root/install-kontrata.sh` (801 linhas). Rodar com `sudo bash /root/install-kontrata.sh` (interativo). Comando `<(curl ...)` NÃO funciona no terminal Hostinger (`/dev/fd/63` falha) — baixar com `curl -o` e rodar `sudo bash arquivo`.

### ✅✅ 24/06 — UPGRADE DE PLANO RESOLVEU (2→4 núcleos)
- Usuário fez **upgrade do plano Hostinger → VPS agora tem 4 núcleos** (era 2) + ~16GB RAM. Aplicado via reboot da VM (SSH cai uns min). O teto saiu (idle ~70-86%, steal baixo).
- **TODOS os 4 clientes prevenção religados** (tradicao, nunes, supervital, maxvale) + crons, **com teto `docker update --cpus 0.6` nos backends**. Rodando junto com os 8 kontrata: **load ~1.8 em 4 núcleos = saudável** (em 2 núcleos isso saturava).
- ⚠️ Ainda assim, religar os 4 + crons de uma vez deu pico (cron storm → daily-verification) que re-tripou o throttle BREVEMENTE (steal subiu, depois assentou sozinho: 81%→15%). Reset semanal segue esgotado → não dar grandes picos.
- 🎯 **VILÃO IDENTIFICADO = DVR do TRADIÇÃO (não nunes!):** o cron daily-verification dispara **ffmpeg de PLAYBACK** (baixa+transcoda clipes gravados do DVR 187.90.96.96, ex: channel 15, clipes de ~132s, 4 ao mesmo tempo). É bounded (termina), mas dá pico. Tradição tem MAIS câmeras (channel 15+) que os outros → é o mais pesado. nunes também picou (190%) mas em outro momento.
- **Estado: tudo no ar e estável em 4 núcleos.** Watchdog `/root/watchdog.sh` rodando (alerta se steal sustentar >65%). Tetos de CPU mantidos nos 4 backends prevenção.

---


## Tarefa (22/06) — Banco de Currículos: UX da tabela (kontrata.ai) ✅ NO AR
Tela `packages/frontend/src/pages/rh/BancoCurriculos.jsx`:
- ✅ Cabeçalho de colunas FIXO (sticky) + barra de rolagem horizontal sempre no rodapé.
- ✅ Topo (cards resumo + filtros) COLAPSA ao rolar a tabela pra baixo (histerese 40/8px) → ~2x mais linhas; reaparece ao voltar ao topo.
- ✅ Ordenação por coluna clicando no cabeçalho (A→Z / Z→A, setinha ▲▼/↕, vazios por último, pt-BR). Colunas: Nº, Candidato, Idade, Status, Vaga, WhatsApp, Instagram, Email, Localização, Cargos, Disponibilidade, Data.
- Commits: `5deb8d9` (sticky+colapsável) + `9923e50` (ordenação) na KONTRATAAI.
- ✅ DEPLOY (frontend --no-cache --no-deps) + VERIFICADO pelo bundle servido em: **tradicao** (7903) e **guibox** (7116).
- ⏳ NÃO deployado nos outros 6 (cidade, damata, fratelli, mameva, novacentral, puma) — usuário pediu pra deixar assim por enquanto.
- ⏳ Mesmo padrão NÃO aplicado na tela de Vagas Abertas (ideia futura).
- Servidores de dev locais SUBIDOS nesta sessão: backend 3010 + front http://10.6.1.171:3004 (caem ao fechar a sessão).

---

## Tarefa (22/06) — Tradição (PREVENÇÃO RADAR legado) trava "Verificando configuração do sistema..."
⚠️ Projeto LEGADO prevencao-radar (`/root/clientes/tradicao`, `prevencao-tradicao-*`), NÃO kontrata.ai.
- ✅ DIAGNÓSTICO: backend `Up 4 days (unhealthy)`, healthcheck estourando (streak 3074), zero logs 60min. `docker restart` FALHOU: **PID zombie** ("use --init"). Causa-raiz: **Node PID 1 sem init não colhe zumbis** (ffmpeg/IMAP) → acumula em dias → trava.
- ✅ REERGUIDO: `docker compose up -d --no-deps --force-recreate backend` → healthy, Oracle OK.
- ⚠️ Autoheal está FORA (desinstalado por estourar CPU). NÃO reinstalar sem escopo.
- ✅ CAMADA 1 APLICADA E VALIDADA: `init: true` no backend (PID 1 = docker-init/tini). Usuário confirmou "tudo funcionando" no Tradição (22/06). Falta observar nos próximos dias se NÃO volta a `unhealthy`.
- ⏳ CAMADA 2 (PENDENTE — aguardando OK pra push+deploy): timeout no `SetupCheck.jsx` (`api.get('/api/setup/status', {timeout:8000})`). JÁ EDITADO local em `d:\roberto-prevencao-no-radar-main` (branch TESTE, origin `Betotradicao/TESTES-` = mesma fonte da VPS), UNCOMMITADO. Deploy: commit → push origin TESTE → pull em `/root/prevencao-radar-repo` → rebuild frontend Tradição.
- Detalhes: `bugs-resolvidos/2026-06-22-tradicao-backend-zombie-pid-init.md`.

---

## Tarefa anterior (kontrata.ai) — Contrato de Trabalho por função (cláusulas por cargo)
Novo doc "Contrato de Trabalho" (1º card de DOCS 2ª FASE) montado por função.
- ✅ Backend: migration `1785700000000` (tabela `rh_contrato_clausulas` + seed do doc),
  `contrato-clausulas.controller.ts` (CRUD + biblioteca 14 padrão), geração estendida
  ($CLAUSULAS$, $SALARIO$, $DATA_INICIO$, $EXP_FIM_1/2$). Rotas `/rh/contrato/clausulas*`.
- ✅ Frontend: `ContratoClausulasPanel.jsx` (NOVO) + plugado no `RhConfiguracoes.jsx`
  (painel quando doc tem $CLAUSULAS$ + campo data de início no Gerar + 5 variáveis).
- ✅ Logo no PDF: automático (mesmo motor). Local OK (migration aplicada, rotas 401, front compila).
- ⏳ UNCOMMITADO. Testar local, depois commit/push.
- Detalhes: `bugs-resolvidos/2026-06-feature-contrato-trabalho-clausulas-por-funcao.md`.

---


## Tarefa atual — Agente Compliance (4º agente de IA)
Agente de norma interna/feedback que vai responder num grupo de WhatsApp por gatilho ("Helen, isso é permitido?").
- ✅ Aba 🛡️ Agente Compliance criada (AITab) + `AgenteComplianceConfig.jsx` com sub-abas Atendimento/Persona/Base de Conhecimento.
- ✅ Config em `configurations` (grupo via /whatsapp/fetch-groups + gatilho + persona/tom/modelo).
- ✅ Vault próprio `rh_compliance_memoria` (migration 1785600000000) + endpoints `/rh/compliance/memoria` (CRUD + upload-doc que guarda texto integral do PDF). Categorias: sindicato/acordo_coletivo/regimento_interno/aprendizado_feedback/outro.
- ✅ `RhEscalaMemoria.jsx` generalizado via props (apiBase/tipos/tiposUpload/titulo) — reusado pro compliance sem quebrar a Escala.
- ✅ Local: backend healthy (migration aplicada, tabela criada), front compila. UNCOMMITADO.
- ⏳ FALTA: (1) cérebro/chat (RAG no vault + dados vivos do banco); (2) escuta real no WhatsApp (webhook entrada Evolution + trava de números autorizados).
- Detalhes: `bugs-resolvidos/2026-06-feature-agente-compliance.md`.

---


## Tarefa atual — Sync de status Vaga ↔ Banco de Currículos (carimbo no fechamento)
Candidato triado dentro da vaga não refletia no Banco de Currículos (status local-por-vaga vs global desacoplados). Decisão: **carimbar `curriculos.status` SÓ no fechamento/exclusão da vaga** (não em tempo real → evita ambiguidade de candidato em N processos e o bug de status vazando entre vagas). Detalhes/regra completa em `bugs-resolvidos/2026-06-feature-sync-status-vaga-banco-curriculos.md`.

- Backend `rh.controller.ts`: helpers `carimbarStatusGlobalVaga` + `reverterContratadoGlobalVaga`, ligados em `setCandidatoStatusVaga`, `atualizarVaga`, `deletarVaga`. Carimba só `curriculos.status` (NUNCA JSONB de outra vaga). Trava: só rebaixa p/ `recusado` se não estiver ativo em outra vaga aberta. Valor é `recusado` (não `reprovado` — alias antigo).
- ✅ Typecheck OK; backend recarregado e de pé (3010), front (3004). SEM migration.
- ⏳ Aguardando teste do usuário no Tradição local.

## Batch UNCOMMITADO acumulado (commitar junto quando aprovar)
1. Sidebar colapsável (hambúrguer |||) — `Sidebar.jsx`
2. `data_nascimento` obrigatória front+back — `CurriculoPublico.jsx` + `curriculos.controller.ts`
3. Termo LGPD atualizado (geolocalização, nascimento obrigatório, dados sensíveis na admissão, data 18/06/2026) — `CurriculoPublico.jsx`
4. Fonte do badge de setor em Férias maior — `RhFerias.jsx`
5. **Sync status vaga↔banco** (este) — `rh.controller.ts`

## Status deploy
- ✅ Commits `a695f3f` + `ad4929b` na KONTRATAAI.
- ✅ **DEPLOY feito em TODOS os 8 clientes** (tradicao, guibox, cidade, damata,
  fratelli, mameva, novacentral, puma) — build --no-cache + up --force-recreate,
  backend healthy, postgres/minio intactos, SEM migration. Um de cada vez (não estourou CPU, load 2.66).
- ⚠️ Uptime mostrou valores enganosos (salto NTP da VPS Jun19→Jun20). Deploy VERIFICADO
  pelo bundle servido (`curl localhost:<porta>/assets/index-*.js | grep triar` = 1).
  Ver `bugs-resolvidos/2026-06-20-deploy-uptime-enganoso-force-recreate.md`.

## Próximo passo
Nada pendente. Tudo no ar e verificado. Aguardando feedback de produção.

## Pendência separada
Reativar (escalonado) os 8 crons radar pausados no meltdown de CPU.
