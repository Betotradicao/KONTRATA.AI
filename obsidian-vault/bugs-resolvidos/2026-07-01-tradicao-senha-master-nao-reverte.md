---
data: 2026-07-01
cliente: Tradição (prevenção-radar, VPS 46)
projeto: prevencao-radar
tags: [auth, senha, master, bcrypt, double-hash, login, seed]
---

# Senha master do Tradição "Invalid credentials" (3ª vez) — diagnóstico definitivo

## Sintoma
Login `Roberto` / `Beto3107@@##` no sistema Tradição (prevenção) dá **"Invalid credentials"**. Recorrente ("toda vez arruma e volta").

## Diagnóstico (ground truth no banco)
`prevencao-tradicao-postgres`, tabela `users`: 2 usuários — `Roberto` (is_master=true, email admin@prevencao.com.br) e `BETO` (admin, email betotradicao76@gmail.com). O hash do Roberto era **bcrypt válido ($2a$10$, 60 chars) MAS de OUTRA senha** — `Beto3107@@##` NÃO batia (nem `Beto2025`). Ou seja: a senha tinha sido trocada pra um valor desconhecido.

## Causa-raiz do "reverte toda vez"
1. **`create-master-user.ts` (linha 45-56) tem BUG de DOUBLE HASH:** no caminho de criar usuário novo, faz `bcrypt.hash('Beto3107@@##')` E o `@BeforeInsert` do `User` hasheia **de novo** → senha fica `bcrypt(bcrypt(...))` → login com a senha real falha. (É um SCRIPT manual `npm run create-master-user`, NÃO roda no startup.)
2. `masterUser.seed.ts` (o que RODA no startup, `index.ts:562`) está **correto** (passa plaintext, `@BeforeInsert` hasheia 1x) E **PULA se já existe master** (não sobrescreve). Então restart/deploy **não reverte**.

## Fix aplicado (definitivo)
UPDATE direto no banco com hash correto (bypassa hooks):
```bash
HASH=$(docker exec prevencao-tradicao-backend node -e 'require("bcrypt").hash("Beto3107@@##",10).then(h=>process.stdout.write(h))')
docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c "UPDATE users SET password='$HASH', reset_password_token=NULL, reset_password_expires=NULL WHERE username='Roberto';"
# verificar: bcrypt.compare('Beto3107@@##', hash) -> true
```
Como o `seedMasterUser` pula master existente, **a senha fica estável** (restart/deploy não muda).

## Lição
- `User` só tem `@BeforeInsert` (hasheia na criação), **SEM `@BeforeUpdate`**. Então: `.save()` de update NÃO re-hasheia (bom p/ update com hash pronto; ruim se salvar plaintext num update → fica sem hash).
- **NUNCA** pré-hashear + `userRepository.create()/save()` (INSERT) → dupla hash. Passar **plaintext** no create (deixa o `@BeforeInsert` hashear 1x).
- Pra corrigir senha travada: UPDATE SQL com hash gerado por `bcrypt.hash` no container. Verificar com `bcrypt.compare`.
- ⚠️ Bug do `create-master-user.ts` (double hash no path de criar) segue no código — corrigir passando plaintext se for usar em novos clientes.
