/**
 * O texto que o site mostra quando o painel ainda não tem nada gravado.
 *
 * ⚠️ FONTE ÚNICA. O site lê daqui, e o painel (Configurar Site → Textos) também
 * — é daqui que vem o texto já preenchido nos campos. Se cada lado tivesse a
 * sua cópia, bastava uma edição pra o painel mostrar uma frase e o site outra.
 *
 * Pra expor um texto novo: acrescente a chave aqui, use `t('chave')` na seção,
 * e cite a chave na lista de campos de `admin/abas/SiteTextos.jsx`.
 */
export const PADRAO = {
  topo: {
    marca: 'Kontrataai',
    entrar: 'Entrar',
    treinamento: 'Treinamento',
    demo: 'Agendar demo',
  },

  hero: {
    titulo1: 'Acabe com o caos',
    titulo2: 'do RH do seu',
    destaque: 'supermercado',
    sub1: 'O Kontrataai foi pensado exclusivamente para supermercado.',
    sub2: 'Os candidatos se cadastram pelo seu link e você tem o banco de currículos organizado o ano inteiro.',
    cta1: 'Quero ver uma demonstração →',
    cta2: 'Ver os planos',
    recursos: [
      'Banco de currículos automático',
      'Escala de Trabalho',
      'Documentação digital',
      'White label completo',
      'Indicadores RH',
      'Multi-loja e multi-empresa',
      '100% LGPD',
      'Suporte via WhatsApp',
      'Implantação em 7 dias',
      'Sem fidelidade',
    ],
  },

  dor: {
    olho: 'O que todo dono de supermercado já viveu',
    titulo: 'Você reconhece alguma dessas situações?',
    situacoes: [
      'Vaga aberta há 30 dias e ninguém para começar segunda.',
      'Caixa de e-mail entupida de currículo que ninguém lê.',
      'Funcionário novo dura 60 dias e some.',
      'Encarregado virou RH na marra.',
    ],
    fecho: 'A rotatividade no varejo alimentar está entre as maiores do Brasil. Não é só seu problema. Mas é seu prejuízo — todo mês.',
  },

  solucao: {
    olho: 'A solução',
    titulo: 'Um RH inteiro, feito para a sua realidade.',
    sub: 'O Kontrataai nasceu dentro de um supermercado, com uma dor real.',
    card1_titulo: 'Banco de currículos automático',
    card1_texto: 'Você cria o link da vaga uma vez. Divulga onde quiser — fachada, Instagram, grupo de WhatsApp da cidade. Quem se interessa preenche o formulário no celular. Seu banco de currículos cresce todo dia, sem ninguém digitando nada.',
    card2_titulo: 'Simples de usar',
    card2_texto: 'Não exige integração com o sistema que você já tem. Não pede TI. Não tem servidor para configurar. Você usa pelo navegador, com a sua identidade visual. Implantação em 2 dias — sem dor de cabeça.',
  },

  comofunciona: {
    olho: 'Como funciona?',
    titulo: 'Do currículo ao contratado em 4 passos.',
    passo1_titulo: 'Você cria a vaga em 1 minuto',
    passo1_texto: 'Cargo, salário, jornada, requisitos. Formato direto, sem campos chatos. O sistema atualiza automaticamente.',
    passo2_titulo: 'A vaga fica ativa pelos seus canais',
    passo2_texto: 'Cola na bio do Instagram. Imprime QR Code na fachada. Manda no grupo de WhatsApp da cidade. O candidato clica ou escaneia o QR Code e vê as vagas em aberto.',
    passo3_titulo: 'Candidatos se inscrevem pelo celular',
    passo3_texto: 'Formulário simples, direto no celular. Sem criar conta, sem burocracia. O candidato preenche em 2 minutos e entra no seu banco.',
    passo4_titulo: 'Seu RH só fala com quem vale',
    passo4_texto: 'Os melhores candidatos sobem com tag verde. Os duvidosos com tag amarela. Os fora de perfil com tag vermelha. A decisão final é sempre sua — mas só com quem realmente importa.',
  },

  comparativo: {
    olho: 'Por que Kontrataai',
    titulo: 'Não somos genéricos. Somos do varejo alimentar.',
    texto: 'Existem dezenas de sistemas de RH no mercado. Quase todos foram feitos para empresas de qualquer setor — e adaptados na unha quando o cliente é um supermercado. O Kontrataai fez o caminho oposto: nasceu dentro de uma loja, e foi crescendo a partir de dores reais de operação. Faz diferença.',
    coluna1: 'Critério',
    coluna2: 'RH Genérico',
    coluna3: 'Kontrataai',
    // Nasce vazia — era assim no site original. Sem linha nenhuma a tabela
    // não aparece, só o título e o texto.
    criterios: [],
  },

  origem: {
    olho: 'De onde nasceu?',
    titulo: 'Não foi feito por programador. Foi feito por gente que vive supermercado todo dia.',
    texto: 'O Kontrataai começou com uma conversa há 6 meses. Uma cliente nossa, dona de mercado em São José dos Campos, falou que o RH dela perdia horas todo dia abrindo currículo, ligando candidato, marcando entrevista que não acontecia. E nada andava.',
    destaque: 'Hoje, o sistema está rodando em produção e estamos validando agora com mais alguns mercados antes de abrir comercialmente em larga escala.',
  },

  numeros: {
    // Um título grande em cima de cada metade da faixa roxa.
    titulo_numeros: 'Números reais dos supermercados que usam o Kontrataai',
    rotulo1: 'currículos captados',
    rotulo2: 'pessoas contratadas',
    titulo_clientes: 'Alguns clientes ativos',
  },

  faq: {
    titulo: 'As perguntas que todo dono de mercado faz.',
    p1: 'Preciso integrar com meu sistema de PDV (Linx, Consinco, RP, Bluesoft, Avanço)?',
    r1: 'Não. O Kontrataai é independente. Você usa pelo navegador, sem mexer em nada do que já roda hoje. Isso é proposital — implantação rápida e zero dor de cabeça com TI.',
    p2: 'Como funciona o white label?',
    r2: 'Você nos envia seu logo, suas cores e seu domínio. Em até 48 horas o sistema sobe com a sua identidade. Para o seu candidato, é a sua marca recrutando — não o Kontrataai. Esse é um dos maiores diferenciais do produto.',
    p3: 'Quem cuida do suporte? Vou ficar perdido se algo quebrar?',
    r3: 'WhatsApp Business com SLA de resposta em até 4 horas em horário comercial. Sem call center, sem ticket número 47823, sem URA. Você fala direto com quem entende do sistema.',
    p4: 'E se eu quiser cancelar?',
    r4: 'Cancela. Sem multa, sem letra miúda, sem fidelidade. Você continuou porque te servia, não porque estava preso. Esse é o teste que toda boa empresa de software deveria passar.',
    p5: 'Quem está usando o Kontrataai hoje?',
    r5: 'O sistema nasceu dentro do Supermercado Tradição. Estamos validando agora com mais alguns mercados selecionados antes de abrir comercialmente em larga escala. Por isso nossas vagas de implementação são limitadas.',
  },

  cta: {
    olho: 'Próximo passo',
    titulo: 'Quer ver o Kontrataai funcionando na prática?',
    texto: '30 minutos de demonstração. Mostramos o sistema na operação real e você decide se faz sentido. Sem cobrança, sem amarração.',
    botao: 'Agendar demonstração →',
  },

  rodape: {
    descricao: 'Recrutamento inteligente e gestão completa com a marca do seu supermercado.',
    copyright: '© 2026 Kontrataai. Todos os direitos reservados.',
  },
};

/** Quantos pares pergunta/resposta o painel oferece (a lista padrão tem 5). */
export const VAGAS_FAQ = 8;
