# Documentação Legal — Kontrata.ai

**Versão:** 1.0 (rascunho para revisão jurídica)
**Data:** 04/05/2026
**Empresa:** Kontrata.ai (a confirmar razão social/CNPJ)
**Sistema:** Kontrata.ai — Plataforma SaaS multi-tenant para gestão e prevenção de perdas em supermercados.

---

## ⚠️ Aviso Importante

Estes documentos são **rascunhos profissionais** elaborados por consultoria técnica especializada em LGPD/Privacy by Design. **NÃO substituem revisão por advogado especialista em LGPD.** Antes de uso comercial, devem ser validados, refinados e assinados por profissional habilitado pela OAB.

---

## Lista de Documentos

| Nº | Documento | Quem assina | Quando |
|----|-----------|-------------|--------|
| [01](01-TERMOS-DE-USO.md) | Termos de Uso do Kontrata.ai | Cliente (loja) | First-setup do sistema |
| [02](02-POLITICA-DE-PRIVACIDADE.md) | Política de Privacidade | (aceite passivo) | Apresentada ao cliente e titulares |
| [03](03-DPA-CONTRATO-OPERADOR.md) | DPA — Contrato de Operador | Você (operador) + Cliente (controlador) | Anexo ao contrato comercial |
| [04](04-CONSENTIMENTO-CURRICULO.md) | Consentimento — Currículo | Candidato | Formulário público de currículo |
| [05](05-CONSENTIMENTO-BIOMETRICO.md) | Consentimento — Biometria Facial | Funcionário | Antes do cadastro do rosto |
| [06](06-ROPA.md) | ROPA — Registro de Operações de Tratamento | (uso interno) | Mantido atualizado pelo DPO |
| [07](07-PLANO-RESPOSTA-INCIDENTE.md) | Plano de Resposta a Incidente | (uso interno) | Acionado em caso de vazamento |
| [08](08-AVISO-CAMERAS.md) | Aviso de Monitoramento por Câmeras | (afixado em loja) | Visível ao público no estabelecimento |
| [09](09-CHECKLIST-IMPLEMENTACAO.md) | Checklist de Implementação Técnica | (uso interno) | Guia de desenvolvimento |

---

## Fluxo de Aceite Pelo Cliente Final (Supermercado)

1. Cliente recebe link do Kontrata.ai
2. Acessa first-setup
3. Lê e aceita: **Termos de Uso (01)** + **Política de Privacidade (02)**
4. Antes de operar, assina o **DPA (03)** com você (PDF assinado digitalmente)
5. Recebe modelo de **Aviso de Câmeras (08)** pra afixar nas lojas

## Fluxo de Aceite Pelo Funcionário/Candidato

| Caso | Documento |
|------|-----------|
| Candidato envia currículo | (04) Consentimento Currículo via checkbox |
| Funcionário tem rosto cadastrado no Vision Facial | (05) Consentimento Biometria assinado em papel ou digital |
| Funcionário comum (cadastro CLT) | Não precisa consentimento — base legal é "execução de contrato" + "obrigação legal" |

---

## Próximos Passos

1. ✅ Leia todos os documentos
2. ✏️ Anote o que quer ajustar (preço, prazo, suporte, marca)
3. 👨‍⚖️ Leve para advogado especialista em LGPD revisar (orçamento sugerido R$ 3-8k)
4. 🔧 Após validação, atualize textos no sistema (mecânica de aceite já será implementada)
5. 🔁 Reveja a cada 12 meses ou quando ANPD publicar nova orientação

---

## Conceitos-Chave (Glossário Rápido)

| Termo | Significado |
|-------|-------------|
| **LGPD** | Lei Geral de Proteção de Dados (Lei 13.709/2018) |
| **ANPD** | Autoridade Nacional de Proteção de Dados |
| **Titular** | Pessoa cujos dados são tratados (funcionário, candidato) |
| **Controlador** | Quem decide o tratamento (cliente / supermercado) |
| **Operador** | Quem trata os dados em nome do controlador (você / Kontrata.ai) |
| **Encarregado/DPO** | Pessoa que canaliza relação com ANPD e titulares |
| **DPA** | Data Processing Agreement — contrato entre controlador e operador |
| **ROPA** | Registro de Operações de Tratamento (Art. 37 LGPD) |
| **Base legal** | Justificativa legal pra tratar o dado (Art. 7 e 11 LGPD) |
| **Dado sensível** | Origem racial, religião, saúde, biometria, etc (Art. 5, II) |
| **Incidente** | Evento de violação que afete dados pessoais |
