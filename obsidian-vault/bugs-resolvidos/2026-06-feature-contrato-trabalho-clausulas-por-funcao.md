---
tags: [rh, docs, contrato, clausulas, cargo]
data: 2026-06-21
---

# Contrato de Trabalho montado por função (cláusulas por cargo)

## Objetivo
Gerar contrato de trabalho **diferente por função** (não genérico): corpo fixo +
cláusulas configuradas por cargo. Ao gerar, escolhe o colaborador (puxa cargo/salário
do cadastro) e só digita a **data de início**.

## Como ficou (reusa o módulo Documentação Padronizada)
- **Doc "Contrato de Trabalho"** = registro em `rh_docs_padronizados` (fase 2, ordem 0 =
  primeiro card de DOCS 2ª FASE, protegido). Corpo fixo com variáveis + `$CLAUSULAS$` no
  meio + assinaturas no fim. Seedado na migration `1785700000000`.
- **Cláusulas por cargo**: tabela `rh_contrato_clausulas` (cargo_id, titulo, conteudo,
  ordem, ativo). As **14 cláusulas padrão** ficam numa BIBLIOTECA (constante no controller
  `contrato-clausulas.controller.ts`), que o RH "Acrescenta" ao cargo (copia o texto,
  fica editável). Endpoints `/rh/contrato/clausulas*` (listar?cargoId / biblioteca /
  criar / add-biblioteca / reordenar / atualizar / deletar).
- **Geração** (`DocsPadronizadosController.gerarParaColaborador`): se o doc tem
  `$CLAUSULAS$`, monta as cláusulas do `colab.cargo_id` (numeradas) e injeta. Novas
  variáveis: `$SALARIO$` (de `rh_colaboradores.salario`, formatado pt-BR), `$DATA_INICIO$`
  (query `data_inicio`), `$EXP_FIM_1$` (+45 dias), `$EXP_FIM_2$` (+90 dias).
  ⚠️ `$CLAUSULAS$` é a PRIMEIRA entrada do objeto `vars` — assim as variáveis DENTRO das
  cláusulas (ex.: $DATA_INICIO$) são substituídas pelas entradas seguintes do loop.

## Modelo final das cláusulas (POR CARGO, pré-semeadas)
- Cada cargo tem suas próprias cláusulas (editar/excluir/criar novas POR cargo).
- **Todos os cargos já nascem com as 14** (não precisa preencher cargo a cargo):
  - migration `1785710000000` semeia todos os cargos existentes (local + prod no boot);
  - cargo novo → auto-seed via `POST /rh/contrato/clausulas/ensure/:cargoId` (chamado ao
    selecionar o cargo no painel). Só semeia se o cargo NUNCA teve cláusula.
- DELETE é **soft** (ativo=false) → apagar tudo de um cargo NÃO re-semeia (respeita o RH).
- As 14 padrão ficam em `src/data/contrato-clausulas-padrao.ts` (compartilhado controller+migration).

## Frontend
- `components/configuracoes/ContratoClausulasPanel.jsx` (NOVO): seletor de cargo + lista
  de cláusulas do cargo (em cima, com contador, fonte 15px, botões Editar/Excluir/↑↓ sempre
  visíveis) + biblioteca das 14 embaixo (➕ Add). `carregar` chama o `ensure`.
- `RhConfiguracoes.jsx`: o Contrato (doc com `$CLAUSULAS$`) ganha **SUB-ABAS** dentro do editor:
  `📄 Contrato de Trabalho | 📑 Cláusulas por Função` (estado `contratoSubAba`, helper
  `ehContrato()`). NÃO é aba na fileira de docs. `precisaDataInicio()` → campo **data de início**
  no passo final do Gerar; +5 variáveis; `gerarPdf` manda `data_inicio`.
- **PDF**: modo COMPACTO pro contrato (`isContrato` por título: fonte 7.7pt, lh 1.15, margem 10mm)
  pra caber em 1 folha A4. Logo automático no topo (mesmo `resultado.logo_url` dos outros docs).

## Lição
Pra "documento + opções que o RH escolhe ao gerar", o padrão do sistema é:
doc em `rh_docs_padronizados` com uma variável-âncora ($MOTIVO_ADVERTENCIA$, $CLAUSULAS$)
+ tabela de opções + substituição no `gerarParaColaborador`. Reusar isso é muito mais
barato que criar um módulo novo.
