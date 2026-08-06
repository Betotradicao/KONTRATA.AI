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

## 🔗 Relacionados
- [[../arquitetura/deploy|Deploy]]
- [[../arquitetura/estrutura-vps|Estrutura VPS]]

## 🏷️ Tags
#padrao #ssh #windows #devops
