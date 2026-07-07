---
tags: [feature, recrutamento, curriculo, migracao, arquitetura]
data: 2026-06-11
---

# Cargos & Tipos de Vaga vêm do cadastro OFICIAL (fonte única)

## O que mudou (commit `3b318d2`, branch KONTRATAAI)

Antes, o currículo tinha **listas próprias** (`curriculo_cargos`, `curriculo_tipos_vaga`) separadas do cadastro oficial do RH. Isso gerava divergência (ex: candidato escolhia "AÇOUGUEIRO" mas o oficial era "ACOUGUEIRO").

Agora a fonte é **única**:
- **Cargos** → `rh_cargos` (Configurações de RH → Cargos)
- **Tipos de Vaga** → `rh_regimes_trabalho` (Configurações de RH → Regimes)

Os 3 endpoints que alimentam tela Modelo, Formulário Público e Filtro foram repointados em `curriculos.controller.ts`:
- `listarCargos` → `SELECT ... FROM rh_cargos WHERE ativo`
- `listarTiposVaga` → `rh_regimes_trabalho` (slug derivado do nome via `slugRegime()`)
- `obterFormularioPublico` → idem
- `enviarCurriculoPublico` (validação) → confere tipo contra regimes ativos

Tela **Modelo de Currículo** virou só-leitura: "+ Adicionar" navega pra `/rh/configuracoes?tab=cargos` (ou `?tab=regimes`); sem editar/excluir.

## ⚠️ Slug dos Regimes — compatibilidade crítica
`rh_regimes_trabalho` **não tem coluna slug**, mas as vagas guardam `tipo_vaga_slug`. O backend deriva o slug do nome (`slugRegime()`), com override fixo: **APRENDIZ / MENOR APRENDIZ → `aprendiz`** e CLT → `clt`. Isso mantém as vagas antigas funcionando. NUNCA mudar isso sem migrar `tipo_vaga_slug` das vagas.

## 🔑 LIÇÃO: virada exige migração de dados POR CLIENTE (régua)

Deployar só o código **quebra o filtro** do cliente: os currículos antigos guardam strings antigas ("REPOSITOR") que não casam com o dropdown novo ("REPOSITOR(A)"). Por isso, **cada cliente** precisa da régua de normalização ANTES/JUNTO do deploy.

**Ordem certa (sem janela quebrada): normaliza dados → deploy na mesma operação.**

Régua aplicada (Tradição): BALCONISTA→BALCONISTA DE PADARIA, REPOSITOR→REPOSITOR(A), OP DE CAIXA→OPERADOR(A) DE CAIXA, AÇOUGUEIRO→ACOUGUEIRO, AUXILIAR DE AÇOUGUEIRO→AUXILIAR DE ACOUGUE, LIDER HORTFRUTI→LIDER DE FLV, PADARIA→AUXILIAR DE PADARIA. Cargos digitados à mão que não existem no oficial (PRIMEIRO EMPREGO, ATENDENTE, etc.) → movidos pro `experiencia_texto` (saem do filtro). Regime APRENDIZ→MENOR APRENDIZ. Sempre com backup em `curriculos_backup_cargos`.

Raio-X (só leitura) pra montar a régua de cada cliente:
```sql
SELECT c, COUNT(*) FROM curriculos, jsonb_array_elements_text(cargos) c GROUP BY c ORDER BY 2 DESC;
SELECT DISTINCT c FROM curriculos, jsonb_array_elements_text(cargos) c WHERE c NOT IN (SELECT nome FROM rh_cargos);
```

## Status do rollout (11/06/2026)
- **Tradição**: ✅ migrado (régua 103 curr.) + deployado.
- **Guibox**: ✅ migrado (régua 54 curr.) + deployado.
- **NovaCentral**: ✅ migrado (régua 283 curr. — a maior) + deployado.
- **Damata, Puma**: ✅ deployado (0 currículos, só rename de regime).
- **Fratelli, Mameva**: ⚠️ regime já renomeado, mas **deploy do código PENDENTE** (adiados a pedido; vazios, sem risco). É só `build --no-cache + up --no-deps`.

### ⚠️ LIÇÃO CRÍTICA: cadastro varia POR CLIENTE — montar régua contra o cadastro ATIVO de CADA um
NovaCentral mostrou que **não dá pra assumir o mesmo cadastro entre clientes**:
- Tinha `AUXILIAR DE RH` → mapeei pra `AUXILIAR DE RECURSOS HUMANOS` (existe na Tradição) mas o ativo do NovaCentral era só `RECURSOS HUMANOS`. Corrigi.
- Açougue estava **invertido**: `AÇOUGUEIRO` (com ç) ATIVO e `ACOUGUEIRO` (sem ç) INATIVO — o oposto dos outros. Decisão do usuário: "deixa igual dos outros" → ativei sem-ç, desativei com-ç.
- **PADEIRO** não existia no cadastro → usuário pediu pra ADICIONAR (INSERT em rh_cargos, só `nome` é NOT NULL).

**Sempre antes da régua de um cliente**: `SELECT nome FROM rh_cargos WHERE ativo=true` e validar os nomes-alvo contra ESSA lista. O check de órfão tem que ser `NOT IN (SELECT nome FROM rh_cargos WHERE ativo=true)` (com filtro ativo!), senão nomes inativos passam batido e o filtro quebra.

Régua do Guibox (referência): OP DE CAIXA→OPERADOR(A) DE CAIXA, REPOSITOR→REPOSITOR(A), REPOSITOR DE FLV→REPOSITOR(A) DE FLV, AUX DE AÇOUGUE→AUXILIAR DE ACOUGUE, AUXILIAR DE RH→AUXILIAR DE RECURSOS HUMANOS; órfãos (AUXILIAR ADMINISTRATIVO, ATENDENTE, ATENDENTE E VENDEDOR, AUXILIAR LOGÍSTICO)→experiência.

## Bônus na mesma feature (Formulário Público)
- Ao marcar uma vaga que já define **tipo/turno**, esses campos vêm preenchidos e **travados**.
- Vaga que **exige experiência**: cargo vem pré-marcado (badge "EXIGIDO"), experiência obrigatória — bloqueia envio se vazio OU abaixo do **tempo mínimo** (`experiencia_meses_minimo`), com mensagem clara. Aviso visível no bloco.
- Nova Vaga: tempo mínimo agora em 2 campos (anos + meses); guarda total em meses internamente.
