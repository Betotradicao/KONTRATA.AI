# TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS — CURRÍCULO

**Versão:** 1.0
**Última atualização:** 04/05/2026

---

## EXIBIÇÃO NO FORMULÁRIO PÚBLICO DE CURRÍCULO

> Este texto deve ser exibido **logo acima do botão "Enviar"** no formulário público de cadastro de currículo da Plataforma Kontrata.ai.

---

### 📋 Aviso de Privacidade — Banco de Currículos

Antes de enviar seu currículo, leia atentamente como seus dados serão tratados:

**Quem coleta seus dados?**
A empresa **[NOME DA EMPRESA-CLIENTE]** (CNPJ: [CNPJ]), **Controladora** dos seus dados, em parceria com a **Kontrata.ai** (CNPJ: [a preencher]) que opera a plataforma **Kontrata.ai**.

**Quais dados coletamos?**
Os dados que você inserir voluntariamente neste formulário, que podem incluir:
- Identificação: nome, CPF, RG, data de nascimento, sexo, estado civil;
- Contato: telefone, WhatsApp, e-mail, redes sociais;
- Endereço residencial;
- Foto pessoal (opcional);
- Currículo profissional, experiências, formação, habilidades;
- Cargos de interesse;
- Avaliação de perfil comportamental DISC (se preenchida).

**Para que usamos seus dados?**
- Avaliar sua candidatura para vagas em aberto e futuras;
- Comunicar-nos com você sobre o processo seletivo;
- Compor o banco de talentos para oportunidades futuras;
- Realizar entrevistas, inclusive por meio de Inteligência Artificial (Recrutador IA).

**Por quanto tempo?**
- Se contratado: seus dados serão integrados ao seu cadastro como colaborador, conforme as obrigações legais aplicáveis.
- Se NÃO contratado: seus dados serão mantidos por **até 12 meses** no banco de currículos para futuras oportunidades, e depois serão **excluídos** ou anonimizados.

**Com quem compartilhamos?**
- Apenas com a equipe de RH da empresa-Controladora autorizada;
- Com a Kontrata.ai como Operadora da plataforma;
- Com sub-operadores autorizados (hospedagem, IA), conforme Política de Privacidade;
- Com autoridades, quando legalmente exigido.

**Decisões automatizadas (IA)?**
- A pré-triagem por IA (Recrutador) gera **uma sugestão**, não uma decisão final;
- A **decisão final é sempre humana**;
- Você tem direito a solicitar **revisão humana** de qualquer avaliação automatizada (Art. 20 LGPD).

**Seus direitos**
A qualquer momento você pode solicitar:
- Acesso aos seus dados;
- Correção de dados incompletos ou desatualizados;
- Exclusão dos seus dados;
- Portabilidade (exportar para outro sistema);
- Revogação deste consentimento.

**Como exercer seus direitos?**
- Através do link "Meus Dados" enviado por e-mail após cadastro;
- Por e-mail à empresa-Controladora: [E-MAIL DO RH DA EMPRESA-CLIENTE];
- Pelo Encarregado de Dados (DPO): kontrataai@gmail.com.

**Mais informações**
- Política de Privacidade completa: https://kontrata.ai/privacidade
- Política da empresa-Controladora: [link, se houver]
- ANPD: https://www.gov.br/anpd

---

### ✅ CHECKBOX OBRIGATÓRIO ANTES DO ENVIO

```
☐ Li e estou de acordo com o tratamento dos meus dados pessoais para
  participação em processos seletivos e composição do banco de talentos
  da empresa, pelo prazo de até 12 meses, conforme descrito acima.
```

```
☐ (Opcional) Autorizo o uso da minha imagem (foto cadastrada) para
  identificação no processo seletivo. Sei que posso revogar esta
  autorização a qualquer momento.
```

```
☐ (Opcional, somente se DISC for oferecido) Autorizo a realização do
  teste de perfil comportamental DISC, ciente de que se trata de
  avaliação psicológica complementar.
```

---

## DADOS REGISTRADOS NO CONSENTIMENTO

Quando o candidato clicar em "Enviar", o sistema deve registrar:

| Campo | Valor |
|-------|-------|
| **ID do consentimento** | UUID gerado |
| **CPF do candidato** | [hash + máscara] |
| **Data e hora do aceite** | timestamp ISO |
| **IP de origem** | IPv4/IPv6 |
| **User-Agent** | string do browser |
| **Versão do termo aceita** | "v1.0" |
| **Empresa-Controladora** | id |
| **Hash do conteúdo do termo** | SHA-256 |

Esses dados servem como **prova de consentimento** em caso de questionamento futuro.

---

## REVOGAÇÃO

O candidato deve poder revogar o consentimento a qualquer momento:

1. **Link único** enviado por e-mail após cadastro: `https://[empresa].kontrata.ai/meus-dados/[token]`
2. **Solicitação por e-mail** ao DPO ou RH;
3. **Solicitação dentro do sistema** se ele se autenticar.

A revogação implica:
- Remoção/anonimização dos dados em até **15 dias**;
- Manutenção apenas de registros legais mínimos (logs de operação, prova do próprio consentimento revogado);
- Notificação ao Controlador.

---

## TEXTO ALTERNATIVO RESUMIDO (FOOTER DO FORM)

Para uso compacto no rodapé do formulário, com link para o termo completo:

> Ao enviar este currículo, você confirma que leu e concorda com a [Política de Privacidade](link) e o [Termo de Consentimento](link). Seus dados serão usados exclusivamente para processo seletivo e mantidos por até 12 meses. Você pode revogar a qualquer momento entrando em contato com nosso DPO.

---

**Documento sujeito a revisão jurídica antes do uso comercial.**
