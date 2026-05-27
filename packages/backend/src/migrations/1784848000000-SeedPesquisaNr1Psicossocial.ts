import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Template "Avaliação de Riscos Psicossociais - NR-1".
 *
 * Cumpre a obrigacao da NR-1 (item 1.5) que entra em fiscalizacao
 * punitiva em 26/05/2026 e exige que toda empresa CLT identifique,
 * avalie e gerencie riscos psicossociais no PGR.
 *
 * Estrutura baseada no COPSOQ III BR (versao curta validada),
 * adaptada ao publico de supermercado/varejo:
 *
 *   Bloco 1 - Exigencias do trabalho      (5 perguntas)
 *   Bloco 2 - Organizacao e conteudo      (4)
 *   Bloco 3 - Relacoes e lideranca        (9)
 *   Bloco 4 - Interface trabalho-vida     (3)
 *   Bloco 5 - Valores no trabalho         (3)
 *   Bloco 6 - Saude e bem-estar           (4)
 *   Bloco 7 - Comportamentos ofensivos    (5)
 *   Bloco 8 - Sugestoes (texto livre)     (2)
 *                                          = 35 perguntas
 *
 * Cada pergunta carrega em `configuracao` o mapeamento:
 *   - bloco_nr1:    grupo do FRPRT (exigencias, organizacao, etc)
 *   - dimensao_nr1: dimensao especifica (demandas_quantitativas,
 *                   apoio_gestor, assedio_moral, etc) — usado pelo
 *                   futuro Farol pra agrupar e pontuar
 *   - inverter_escala: true quando "Sempre" representa o PIOR cenario
 *                   (perguntas sobre estresse, assedio, sobrecarga).
 *                   Default false: "Sempre" = melhor cenario (apoio,
 *                   reconhecimento). O Farol usa essa flag pra
 *                   calcular o score 0-100 consistente.
 *
 * Anonimato e obrigatorio (anonima=true) — agregacao deve ser por
 * GHE (setor/funcao) com minimo 5 respostas pra evitar identificacao.
 */
export class SeedPesquisaNr1Psicossocial1784848000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const NOME = 'Avaliação de Riscos Psicossociais - NR-1';

    // Garante coluna `protegida` (templates do sistema nao podem ser deletados).
    await queryRunner.query(
      `ALTER TABLE pesquisa_modelos ADD COLUMN IF NOT EXISTS protegida BOOLEAN NOT NULL DEFAULT false`
    );

    await queryRunner.query(
      `INSERT INTO pesquisa_modelos (nome, descricao, cor, icone, ativa, anonima, protegida)
       SELECT $1::text, $2::text, 'red', '🧠', true, true, true
       WHERE NOT EXISTS (SELECT 1 FROM pesquisa_modelos WHERE nome = $1::text)`,
      [
        NOME,
        'Avaliação obrigatória pela NR-1 dos fatores psicossociais no trabalho. Suas respostas são 100% anônimas e agrupadas por setor — nunca identificam você individualmente. O objetivo é identificar pontos de melhoria no ambiente de trabalho para proteger sua saúde mental e bem-estar.',
      ]
    );

    // Garante que esta pesquisa fica marcada como protegida mesmo se ja existia
    await queryRunner.query(
      `UPDATE pesquisa_modelos SET protegida = true WHERE nome = $1::text`,
      [NOME]
    );

    const [modelo] = await queryRunner.query(
      `SELECT id FROM pesquisa_modelos WHERE nome = $1::text LIMIT 1`,
      [NOME]
    );
    if (!modelo) return;
    const modeloId = modelo.id;

    const [{ cnt }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS cnt FROM pesquisa_perguntas WHERE modelo_id = $1::int`,
      [modeloId]
    );
    if (cnt > 0) return;

    // Escala padrao de frequencia (COPSOQ): 5 niveis
    const escalaFreq = ['Sempre', 'Muitas vezes', 'Às vezes', 'Raramente', 'Nunca'];
    // Escala de saude geral
    const escalaSaude = ['Excelente', 'Muito boa', 'Boa', 'Razoável', 'Ruim'];

    type Pergunta = {
      secao: string;
      enunciado: string;
      tipo?: 'multipla_escolha' | 'texto_longo';
      bloco: string;
      dimensao: string;
      inverter?: boolean;
      escala?: string[];
      obrigatoria?: boolean;
    };

    const perguntas: Pergunta[] = [
      // ===== BLOCO 1: EXIGÊNCIAS DO TRABALHO =====
      { secao: 'Exigências do Trabalho', bloco: 'exigencias', dimensao: 'demandas_quantitativas', inverter: true,
        enunciado: 'Com que frequência você precisa trabalhar muito rapidamente para dar conta das suas tarefas?' },
      { secao: 'Exigências do Trabalho', bloco: 'exigencias', dimensao: 'demandas_quantitativas',
        enunciado: 'Você tem tempo suficiente durante o expediente para realizar suas tarefas com qualidade?' },
      { secao: 'Exigências do Trabalho', bloco: 'exigencias', dimensao: 'demandas_emocionais', inverter: true,
        enunciado: 'Com que frequência seu trabalho exige que você esconda suas emoções ou se mantenha "no controle" o tempo todo?' },
      { secao: 'Exigências do Trabalho', bloco: 'exigencias', dimensao: 'demandas_cognitivas', inverter: true,
        enunciado: 'Com que frequência seu trabalho exige tomar decisões difíceis sob pressão?' },
      { secao: 'Exigências do Trabalho', bloco: 'exigencias', dimensao: 'demandas_emocionais', inverter: true,
        enunciado: 'Com que frequência você termina o dia de trabalho emocionalmente esgotado(a)?' },

      // ===== BLOCO 2: ORGANIZAÇÃO E CONTEÚDO =====
      { secao: 'Organização e Conteúdo do Trabalho', bloco: 'organizacao', dimensao: 'autonomia',
        enunciado: 'Você tem influência sobre a quantidade de trabalho que recebe?' },
      { secao: 'Organização e Conteúdo do Trabalho', bloco: 'organizacao', dimensao: 'autonomia',
        enunciado: 'Você tem influência sobre como o seu trabalho é feito (métodos, ritmo, organização das tarefas)?' },
      { secao: 'Organização e Conteúdo do Trabalho', bloco: 'organizacao', dimensao: 'desenvolvimento',
        enunciado: 'Seu trabalho oferece oportunidades para aprender coisas novas e desenvolver suas habilidades?' },
      { secao: 'Organização e Conteúdo do Trabalho', bloco: 'organizacao', dimensao: 'significado',
        enunciado: 'O seu trabalho tem um sentido ou propósito importante para você?' },

      // ===== BLOCO 3: RELAÇÕES E LIDERANÇA =====
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'previsibilidade',
        enunciado: 'Você recebe com antecedência as informações necessárias para fazer bem o seu trabalho?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'reconhecimento',
        enunciado: 'O seu trabalho é reconhecido e valorizado pela empresa?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'clareza_papel',
        enunciado: 'Suas responsabilidades no trabalho estão claramente definidas?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'conflito_papel', inverter: true,
        enunciado: 'Com que frequência você recebe exigências contraditórias de pessoas diferentes no trabalho?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'qualidade_lideranca',
        enunciado: 'Seu gestor direto é bom em planejar e organizar o trabalho da equipe?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'qualidade_lideranca',
        enunciado: 'Seu gestor direto é bom em resolver conflitos entre membros da equipe?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'apoio_gestor',
        enunciado: 'Seu gestor direto está disponível para te ouvir e ajudar quando você precisa?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'apoio_colegas',
        enunciado: 'Seus colegas de trabalho estão dispostos a ajudar quando você precisa?' },
      { secao: 'Relações Sociais e Liderança', bloco: 'relacoes', dimensao: 'comunidade_social',
        enunciado: 'Existe um bom clima de respeito e companheirismo entre você e seus colegas?' },

      // ===== BLOCO 4: INTERFACE TRABALHO-VIDA =====
      { secao: 'Trabalho e Vida Pessoal', bloco: 'interface', dimensao: 'inseguranca', inverter: true,
        enunciado: 'Com que frequência você se preocupa com a possibilidade de perder o seu emprego?' },
      { secao: 'Trabalho e Vida Pessoal', bloco: 'interface', dimensao: 'conflito_trabalho_familia', inverter: true,
        enunciado: 'Com que frequência as exigências do trabalho atrapalham sua vida pessoal ou familiar?' },
      { secao: 'Trabalho e Vida Pessoal', bloco: 'interface', dimensao: 'hiperconectividade', inverter: true,
        enunciado: 'Com que frequência você é cobrado(a) ou contatado(a) sobre trabalho fora do seu horário?' },

      // ===== BLOCO 5: VALORES NO TRABALHO =====
      { secao: 'Valores e Justiça', bloco: 'valores', dimensao: 'confianca',
        enunciado: 'Você confia nas informações e comunicados que recebe da direção da empresa?' },
      { secao: 'Valores e Justiça', bloco: 'valores', dimensao: 'justica',
        enunciado: 'As decisões importantes (promoções, escalas, benefícios) são tomadas de forma justa?' },
      { secao: 'Valores e Justiça', bloco: 'valores', dimensao: 'justica',
        enunciado: 'Quando há conflitos no trabalho, eles são resolvidos de forma adequada?' },

      // ===== BLOCO 6: SAÚDE E BEM-ESTAR =====
      { secao: 'Saúde e Bem-Estar', bloco: 'saude', dimensao: 'saude_geral', escala: escalaSaude,
        enunciado: 'Como você descreveria a sua saúde, de modo geral, hoje?' },
      { secao: 'Saúde e Bem-Estar', bloco: 'saude', dimensao: 'estresse', inverter: true,
        enunciado: 'Com que frequência você se sente estressado(a) por causa do trabalho?' },
      { secao: 'Saúde e Bem-Estar', bloco: 'saude', dimensao: 'burnout', inverter: true,
        enunciado: 'Com que frequência você se sente fisicamente esgotado(a) por causa do trabalho?' },
      { secao: 'Saúde e Bem-Estar', bloco: 'saude', dimensao: 'sono', inverter: true,
        enunciado: 'Com que frequência você tem dificuldade para dormir por causa de preocupações com o trabalho?' },

      // ===== BLOCO 7: COMPORTAMENTOS OFENSIVOS =====
      { secao: 'Comportamentos Ofensivos (últimos 12 meses)', bloco: 'ofensivos', dimensao: 'assedio_moral', inverter: true,
        enunciado: 'Nos últimos 12 meses, com que frequência você foi alvo de assédio moral (humilhações, agressões verbais, isolamento intencional) no trabalho?' },
      { secao: 'Comportamentos Ofensivos (últimos 12 meses)', bloco: 'ofensivos', dimensao: 'assedio_sexual', inverter: true,
        enunciado: 'Nos últimos 12 meses, com que frequência você foi alvo de assédio sexual no trabalho?' },
      { secao: 'Comportamentos Ofensivos (últimos 12 meses)', bloco: 'ofensivos', dimensao: 'violencia_ameaca', inverter: true,
        enunciado: 'Nos últimos 12 meses, com que frequência você sofreu ameaças de violência no trabalho (por colega, gestor ou cliente)?' },
      { secao: 'Comportamentos Ofensivos (últimos 12 meses)', bloco: 'ofensivos', dimensao: 'violencia_fisica', inverter: true,
        enunciado: 'Nos últimos 12 meses, com que frequência você sofreu violência física no trabalho?' },
      { secao: 'Comportamentos Ofensivos (últimos 12 meses)', bloco: 'ofensivos', dimensao: 'discriminacao', inverter: true,
        enunciado: 'Nos últimos 12 meses, com que frequência você sofreu ou presenciou discriminação no trabalho (por gênero, raça, idade, religião, orientação sexual ou outro motivo)?' },

      // ===== BLOCO 8: SUGESTÕES =====
      { secao: 'Sugestões', bloco: 'sugestoes', dimensao: 'sugestoes', tipo: 'texto_longo',
        enunciado: 'Na sua opinião, o que poderia ser melhorado no ambiente de trabalho para reduzir o estresse e proteger a saúde mental dos colaboradores?' },
      { secao: 'Sugestões', bloco: 'sugestoes', dimensao: 'sugestoes', tipo: 'texto_longo', obrigatoria: false,
        enunciado: 'Algum comentário adicional sobre saúde mental, qualidade de vida ou bem-estar no trabalho que queira compartilhar?' },
    ];

    let ordem = 0;
    for (const p of perguntas) {
      ordem++;
      const tipo = p.tipo || 'multipla_escolha';
      const obrigatoria = p.obrigatoria !== false; // default true
      const configuracao: Record<string, unknown> = {
        bloco_nr1: p.bloco,
        dimensao_nr1: p.dimensao,
      };
      if (tipo === 'multipla_escolha') {
        configuracao.opcoes = p.escala || escalaFreq;
        if (p.inverter) configuracao.inverter_escala = true;
      }
      await queryRunner.query(
        `INSERT INTO pesquisa_perguntas (modelo_id, secao, ordem, tipo, enunciado, obrigatoria, configuracao)
         VALUES ($1::int, $2::text, $3::int, $4::text, $5::text, $6::boolean, $7::jsonb)`,
        [modeloId, p.secao, ordem, tipo, p.enunciado, obrigatoria, JSON.stringify(configuracao)]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down nao remove dados (seed)
  }
}
