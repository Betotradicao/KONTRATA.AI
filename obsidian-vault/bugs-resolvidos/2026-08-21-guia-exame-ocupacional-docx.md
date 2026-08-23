# Guia de Exame Ocupacional — gerando .docx a partir de template do cliente

**Data:** 2026-08-21
**Arquivos:** `backend/src/services/guia-exame.service.ts`,
`backend/src/templates/guia-exame-ocupacional.docx`,
`backend/scripts/gerar-template-guia.js`,
`frontend/src/pages/rh/FichasAdmissaoSection.jsx`,
`frontend/src/components/configuracoes/EmailsPadronizadosTab.jsx`

## O que faz
Botão 🩺 Guia em cada Ficha de Admissão (status `preenchida` ou
`colaborador_criado`) → modal com tipo de exame + agendamento + riscos →
**baixa .docx** ou **envia pra clínica por e-mail**. Só o topo do documento é
preenchido; a tabela de exames vai em branco pra clínica marcar.

## 🪤 A ARMADILHA: Word fragmenta texto em runs
Foi a descoberta que definiu toda a solução. No .docx original:
- `25/08/2026 09:30` estava quebrado em **12 elementos `<w:t>`**
- cada `( x )` em **3**

**Procurar a string inteira em `word/document.xml` NÃO ACHA NADA.** Qualquer
tentativa de "abrir o docx e dar replace" falha silenciosamente.

### Solução: normalizar UMA VEZ, no nível de parágrafo
`scripts/gerar-template-guia.js` lê o .docx original e, pra cada `<w:p>` alvo,
troca TODOS os runs por **um único run** com o `$PLACEHOLDER$`, preservando o
`<w:pPr>` do parágrafo e o `<w:rPr>` do primeiro run (mantém a formatação).

Depois disso o runtime é só `split().join()` — seguro, porque o placeholder
nasceu contíguo.

### Duas travas que valem ouro
1. **Casar por ÍNDICE de parágrafo, não por texto** — `OUTROS:` aparece 2x
   (riscos e tabela de exames) e `98` é genérico demais.
2. **Cada entrada declara o texto que ESPERA** encontrar; se não bater, o
   script **aborta**. Sem isso, um Word ligeiramente diferente geraria um
   documento corrompido em silêncio.

## ⚠️ NUNCA abrir o template no Word e salvar por cima
O Word re-fragmenta os runs e quebra os `$PLACEHOLDERS$`. Se o formulário da
clínica mudar, rode o script de novo a partir do .docx novo:
```bash
cd packages/backend
node scripts/gerar-template-guia.js "caminho/do/guia-novo.docx"
```

## Onde o template mora (não improvisar)
`src/templates/` → o Dockerfile.backend já copia pra `dist/templates/`:
```dockerfile
(cp -r src/templates/. dist/templates/ || true)
```
Colocar em `packages/backend/templates/` (fora de `src`) **não funciona** —
o Dockerfile só faz `COPY src ./src`. Já errei isso.

Resolução do caminho serve dev e prod: `path.join(__dirname, '..', 'templates')`
→ `src/templates` rodando de `src/`, `dist/templates` rodando de `dist/`.

## Dependência nova
`adm-zip` — `archiver` só ESCREVE zip, e .docx precisa ser lido antes.

## Decisões de produto
- **.docx e não PDF** (escolha do usuário): ele quer ajustar antes de enviar.
- **Config numa aba só** (`E-mails Padronizados → 🏥 Medicina do Trabalho`):
  e-mail da clínica + endereço/telefone/site + médico do PCMSO + responsável +
  assunto/corpo. Guardado em `guia_exame_config` (JSON em `configurations`) —
  **sem migration**, seguindo o padrão que essa tela já usava.
- **Matrícula sai em branco** de propósito: ela só nasce quando a ficha vira
  colaborador. Melhor vazio do que número inventado pra clínica.
- O **logotipo** do cabeçalho continua o do formulário original (é imagem em
  `word/media/`); só o texto do endereço virou variável.

## Reaproveitamento
`POST /rh/email-doc/enviar` já era genérico — só passar
`contentType: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
Não precisou de rota de e-mail nova.

## ⚠️ Duas listas que andam juntas
`TIPOS_EXAME` existe no backend (`guia-exame.service.ts`, valida a chave
recebida) e no frontend (`FichasAdmissaoSection.jsx`, monta o select). Mexeu
num, mexe no outro.

## Tags
#feature #rh #admissao #docx #template #medicina-trabalho

---

## Ajustes após o primeiro teste real do usuário (21/08/2026)

### 🐛 Data de nascimento saía crua (`2002-11-21`)
O regex de conversão ISO→BR estava `/^(d{4})-(d{2})-(d{2})$/` — **sem as
barras**. Procurava a LETRA `d`, nunca casava, e a data passava direto.

As barras foram comidas quando apliquei a alteração via script de patch
(template literal comendo `\d`). **Lição: em patch programático, usar `[0-9]`
em vez de `\d`** — não depende de escape e sobrevive a qualquer camada de
string. Corrigido pra `/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/`.

Vale varrer os outros regex quando aplicar patch assim: `grep -n "(d{"`.

### Campo de agendamento virou DOIS campos com máscara
Pedido do usuário. `agendado` (string única) virou `agendadoData` +
`agendadoHora`, com `mascaraData` (DD/MM/AAAA) e `mascaraHora` (HH:MM) que
formatam enquanto digita. `juntarAgendamento()` remonta pro documento.
Hora é opcional — dá pra mandar só a data.

### Botão liberado em QUALQUER status
Era travado em `preenchida`/`colaborador_criado`. O usuário agenda o exame
**junto com o envio do link**, antes do candidato preencher. Agora aparece
sempre, e o modal mostra aviso âmbar quando `candidato_dados.dados_pessoais.cpf`
está vazio — o guia sai sem nascimento/RG/CPF, pra completar à mão.

### ✅ Confirmado abrindo no Word
Layout, tabelas, cabeçalho e a marcação do tipo de exame saíram idênticos ao
original. O template normalizado funciona.
