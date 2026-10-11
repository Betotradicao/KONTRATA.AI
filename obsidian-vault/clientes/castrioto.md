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
