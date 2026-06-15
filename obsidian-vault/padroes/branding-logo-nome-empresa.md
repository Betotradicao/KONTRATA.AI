---
tags: [padrao, branding, config, multi-tenant]
---

# Logo e nome da empresa (branding do tenant)

Onde fica o **logo** e o **nome/marca** que aparecem nos documentos, telas e modelos impressos do cliente:

- **`client_logo_url`** — URL do logo da empresa (config). Setado em **Configurações de REDE → Personalização → "Logo da Empresa"**.
- **`client_brand_name`** — nome/marca (ex: "TRADIÇÃO SUPERMERCADO"). Mesmo lugar, campo "Nome da Empresa / Marca".

Ler via `GET /configurations/client_logo_url` e `GET /configurations/client_brand_name` (ou bulk `GET /configurations`).

Quem já usa: `Logo.jsx` (sidebar), docs padronizados (`docs-padronizados.controller`), pesquisa de clima, e o modelo de **Aniversariantes do Mês** (`AniversariantesMesTab.jsx`).

**Regra:** qualquer feature nova que precise do logo/nome do cliente (PDF, cartaz, modelo, e-mail) deve puxar dessas duas configs — NÃO hardcode "Tradição" nem caminho de imagem.

## Relacionados
- [[../arquitetura/deploy|Deploy]]
