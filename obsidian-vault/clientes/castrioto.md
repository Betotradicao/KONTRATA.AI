---
tags: [cliente, kontrata, castrioto]
---

# Castrioto (Mercadinho Castrioto)

**Produto:** Kontrata.ai (RH) · **Instalado:** 11/10/2026 via `install-kontrata.sh`
**URL:** `castrioto.kontrataai.com.br` · **VPS 46** · pasta `/root/clientes-kontrata/castrioto/`
**Portas:** frontend 7101 · backend 8101 · postgres 6501 · containers `kontrata-castrioto-*`
**Banco:** `kontrata_castrioto` (user `postgres`)

## Lojas (rh_empresas — id é UUID)
| cod_loja | apelido | id |
|---|---|---|
| 1 | CASTRIOTO NOVA ESPERANÇA | `4ee5970e-0cda-4776-8c1b-d30fb6f495ef` |
| 2 | CASTRIOTO CAMPOS SÃO JOSÉ | `64c6c951-4d5f-43b8-8c63-278744acaafb` |

## Carga inicial (11/10/2026)
- Cargos: copiados da [[tradicao|Tradição]] por **nome** (EPIs mapeados por nome — ids de `rh_epis_epcs` diferem entre clientes) e depois sobrescritos com os salários da planilha `Listagem de funcionários - Atualizado.xlsx` (Mercado Castrioto II = loja 2).
- Convenção pedida pelo Beto: **mesma função com salários diferentes = cargo duplicado com sufixo `|| 2`, `|| 3`** (ex.: `ACOUGUEIRO`, `ACOUGUEIRO || 2`, `ACOUGUEIRO || 3`).
- 30 colaboradores com **dados pessoais fictícios** (nasc. 01/01/1990, endereço da loja 2, ensino médio, 6x1, domingo 2x1, jornada CLT 7:20) e **CPF gerado** (válido, seed 20261011). Marcados em Observações com "DADOS PESSOAIS FICTICIOS, AJUSTAR" + horário da planilha + setor original + status do Pix.
- Valores "sem registro" da planilha foram **somados** ao salário (decisão do Beto): Jair 4.370, Clayton 4.005.
- Backup pré-carga: `/root/clientes-kontrata/castrioto/backup-rh_cargos-epis-20261011.sql`.

## Padrão reutilizável: importar colaboradores por SQL
Inserir direto em `rh_colaboradores` **não cria** as pastas de Documentação Padronizada (o backend faz em `replicarTemplateNoColaborador`). Replicar em SQL: `rh_documento_pastas` a partir de `rh_documento_pastas_template` (obrigatoria=true, `ON CONFLICT (colaborador_id,nome)`) e `rh_documento_subpastas` com `NOT EXISTS` (não tem UNIQUE). Depois `docker restart` do backend (cache de indicadores). Scripts de referência no scratchpad da sessão: `gerar-import-castrioto.py` → `import-castrioto.sql`.

Campos obrigatórios do Cadastro Geral (`RhCadastroGeral.jsx` → `camposObrigatorios`): matricula, nome, cpf, data_nascimento, sexo, escolaridade_id, cep, company_id (uuid), cargo_id, jornada_id, escala_id, escala_domingo_id, regime_trabalho_id, departamento_id (= "Setor"), data_admissao, salario. CPF e CEP gravados **só dígitos**.

## Pendências
- Ajustar dados pessoais reais dos 30 colaboradores (CPF, nascimento, endereço, escolaridade).
- WhatsApp/Evolution, RHiD, IA: ainda não configurados.

## Empresas reais (descoberto nos registros, 24/10/2026)
| Loja | CNPJ | Razão | Endereço do registro |
|---|---|---|---|
| 1 | 57.563.853/0001-59 | MERCADINHO CASTRIOTO LTDA | R José Castrioto, 100 |
| 3 ADM | 68.639.728/0001-00 | CASTRIOTO COMERCIAL LTDA | R Maria Alves Bonfim, 68 — **onde está registrada a maioria** |
| — | 63.897.242/0001-40 | 63.897.242 MARIANA SILVA GUIMARAES (MEI) | R José Castrioto, 288 — só a Ana Paula; **não cadastrada** |
O CNPJ da loja 2 no sistema (68.568.844/0001-77) **não aparece em nenhum registro** — conferir com o Beto.

## Fichas atualizadas pelos "Registro de Empregados" (24/10/2026)
- 19 colaboradores com dados reais (CPF, RG, CTPS, PIS, título, nascimento, filiação, endereço, admissão, dependentes). Backup antes: `/root/clientes-kontrata/castrioto/backup-fichas-20261024.sql`.
- **Salário = registro oficial; `salario_final` = valor da planilha** (inclui "sem registro"). Campo novo no Cadastro Geral.
- 17 foram pra loja 3 ADM; Jair pra loja 1; Ana Paula ficou na loja 2 (empresa dela não cadastrada).
- **11 sem registro ainda (dados fictícios):** Wagner Lemes, Kevin Moliterno, Daniel Vieira, Adriana Rocha, Erick Vinicius, Pedro Henrique, Gabriel de Campos, Johny, Elton, Sabrina Yohana, Maria da Conceição.
