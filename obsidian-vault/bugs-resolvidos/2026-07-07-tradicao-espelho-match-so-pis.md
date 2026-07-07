---
tags: [bug-resolvido, rh, rhid, tradicao, matching]
data: 2026-07-07
cliente: Tradição
modulo: RH / Ponto
---

# Espelho de Ponto casava só por PIS (Jéssica "não encontrada")

## Sintoma
Cartão/Espelho de Ponto da colaboradora **Jéssica** mostrava:
> "JESSICA ... (PIS 16219396325) não foi encontrado na RHiD"

Mesmo tendo CPF válido no cadastro. O relógio RHiD estava conectado (4ms) e
sincronizando normalmente.

## Causa-raiz
O endpoint `espelho()` em [[rh-ponto-controller]] ainda usava
`RhidService.idPersonPorPis(colab.pis_pasep)` — **match só por PIS**.

O PIS na nuvem RHiD costuma vir zerado/divergente (ver [[RELOGIO RHID/01-DADOS-EXTRAIDOS]]),
por isso **Indicadores** e **Cadastro** já tinham migrado pra casar por **CPF OU PIS**.
Mas o **Espelho de Ponto ficou pra trás** — inconsistência entre telas.

## Correção
- `RhidService.idPersonPorCpfOuPis(cpf, pis)` — novo método: CPF (prioridade, `padStart(11)`, ignora `00000000000`) OU PIS normalizado.
- `espelho()` passou a usar esse método; só retorna "sem documento" quando falta **CPF E PIS**.
- Frontend `RhEspelhoPonto.jsx`: mensagem de não-encontrado mostra CPF **e** PIS tentados.

Commit `c82b58a`.

## 🎯 Lição reutilizável
**Toda tela que casa colaborador ↔ RHiD deve usar CPF-OU-PIS, nunca só PIS.**
O PIS da RHiD não é confiável. Ao criar um novo consumo da RHiD, use
`idPersonPorCpfOuPis` — não `idPersonPorPis`.

Telas que consomem RHiD (conferir todas em mudança de matching):
- Indicadores RH (Ponto e Ausências) ✅ CPF-ou-PIS
- Cadastro Geral (coluna "Relógio de Ponto") ✅ CPF-ou-PIS
- Espelho de Ponto ✅ CPF-ou-PIS (corrigido aqui)

## Observação relacionada (mesma sessão)
Adicionado no Indicadores um alerta que **expõe erros de apuração do RHiD** em vez
de engolir (`.catch(()=>[])`) e deixar o dashboard zerado sem explicação — ver
diagnóstico `apuracao_falhas`/`apuracao_erros` (commit `fc6f62f`).
