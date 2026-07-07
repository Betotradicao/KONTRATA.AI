---
tags: [cliente, kontrata, puma, seguranca]
cliente: Puma Zeladoria
plataforma: kontrata.ai
---

# Puma Zeladoria

Cliente **kontrata.ai** (RH/Recrutamento). Empresa de **segurança / zeladoria** —
serviço de risco (isso importa: erros de texto em página pública são graves aqui).

## Infra (VPS 46)
- Diretório: `/root/clientes-kontrata/puma`
- Containers: `kontrata-puma-frontend` / `kontrata-puma-backend` / `kontrata-puma-postgres` / `kontrata-puma-minio`
- Domínio público: `puma.kontrataai.com.br`
- Deploy: mesmo padrão dos demais kontrata (repo `/root/kontrata-repo` branch KONTRATAAI → `cd /root/clientes-kontrata/puma && docker compose build --no-cache frontend backend && up -d --no-deps ...`).

## Uso
- Usa a **página pública de vagas** (Recrutamento) — candidatos se inscrevem online.
- Cargos vistos nas vagas públicas: Controlador de Acesso, Operador de Monitoramento, Técnico de Instalação (CLT, validade 6 meses).

## Ocorrências
- **07/07/2026** — candidato viu "Quero me candidatar" virar "Quero me machucar" (tradutor do navegador dele). Corrigido no index.html (lang pt-BR + notranslate). Ver [[bugs-resolvidos/2026-07-07-traducao-automatica-corrompe-pagina-publica]].
