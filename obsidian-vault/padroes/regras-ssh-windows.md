# SSH no Windows (PowerShell Wrapper)

## ⚠️ Problema
No Git Bash do Windows, o `ssh` executa os comandos na VPS, mas a **saída (stdout) não é capturada**. O comando funciona, mas o resultado não aparece.

## ✅ Solução
Usar PowerShell como wrapper:

```bash
# ❌ ERRADO (saída não aparece)
ssh vps2-hostinger "docker logs prevencao-tradicao-backend --tail 30"

# ✅ CORRETO
powershell -Command "& { ssh vps2-hostinger 'docker logs prevencao-tradicao-backend --tail 30 2>&1' | Out-String }"
```

## 📐 Padrão Universal
```bash
powershell -Command "& { ssh vps2-hostinger 'COMANDO_AQUI 2>&1' | Out-String }"
```

- `2>&1` → redireciona stderr para stdout (captura tudo)
- `| Out-String` → converte saída pra texto no PowerShell
- `& { ... }` → executa como bloco de script

## 🪤 Pegadinha: PowerShell 5.1 **come as aspas duplas** do comando remoto

Ao passar um comando com `grep "duas palavras"` dentro de aspas simples do PowerShell,
as aspas duplas **NÃO chegam** ao shell remoto — o `sh` da VPS recebe `grep -c SEM VALIDADE arquivo`
e trata `VALIDADE` como um segundo arquivo:

```
grep: VALIDADE: No such file or directory
```

**Solução:** trocar o espaço literal por `.` (o grep é regex mesmo):

```powershell
# ❌ o remoto perde as aspas
ssh vps2-hostinger 'docker exec X grep -c "SEM VALIDADE" /caminho/bundle.js'

# ✅ regex sem espaço literal
ssh vps2-hostinger 'docker exec X grep -c -e SEM.VALIDADE /caminho/bundle.js'
```

⚠️ Vale também pro **glob**: `docker exec` roda **sem shell**, então `index-*.js` não expande.
Listar primeiro (`docker exec X ls .../assets/`) e usar o nome completo do arquivo.

## 🪤 Pegadinha 2: comando "trava pra sempre" = algo ficou lendo stdin
Como as aspas somem, `grep -E "a|b" arquivo` vira `grep -E a | b arquivo` → o grep **sem arquivo lê stdin** e pendura o ssh.
Mesma coisa com `||` dentro de SQL (`nome like $$%||%$$`). Regras:
- Nunca usar `|` / `||` dentro do comando remoto fora de um pipe intencional.
- SQL via `echo select ... | docker exec -i X psql ...` — sem aspas; parênteses escapados `\(\*\)`; strings com `\$\$texto\$\$`.
- Envolver psql em `timeout 15` quando estiver investigando.
- Pra coisa complexa: escrever script local, `scp` pra VPS, rodar `bash /root/script.sh` (e `sed -i 's/\r$//'` antes — CRLF do Windows).

## 🛡️ Classificador do auto mode bloqueia escrita em banco de produção
No auto mode, `ssh ... psql` com INSERT/UPDATE é negado ("Modify Shared Resources"). Saídas: usuário muda pro **modo manual** e aprova o comando, ou roda ele mesmo no terminal da VPS. Regra `PowerShell(ssh *)` liberaria tudo — evitar.

## 🔗 Relacionados
- [[../arquitetura/deploy|Deploy]]
- [[../arquitetura/estrutura-vps|Estrutura VPS]]

## 🏷️ Tags
#padrao #ssh #windows #devops
