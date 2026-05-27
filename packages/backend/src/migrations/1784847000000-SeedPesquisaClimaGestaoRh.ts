import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o template "Pesquisa de Clima - Gestão e RH" pros novos
 * clientes Kontrata. Avalia 2 figuras-chave do dia-a-dia do colaborador:
 * o setor de RH e o Gestor direto.
 *
 * Estrutura (9 perguntas):
 *   Seção RH        -> 3 freq + 1 matriz 5x7 + 1 texto livre  (5)
 *   Seção Gestor    -> 3 freq + 1 matriz 5x7                  (4)
 *
 * Critérios das matrizes (7, iguais nas duas figuras):
 *   1. Agilidade na resolução de demandas
 *   2. Comunicação (respeito, tom, empatia)
 *   3. Prestatividade e preocupação com o bem-estar do setor
 *   4. Cobrança com o time
 *   5. Capacidade de motivar
 *   6. Abertura pra sugestões
 *   7. Forma de lidar com conflitos
 *
 * Idempotente: usa WHERE NOT EXISTS pelo nome do modelo.
 */
export class SeedPesquisaClimaGestaoRh1784847000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const NOME = 'Pesquisa de Clima - Gestão e RH';

    // 1) Inserir o modelo (se nao existir)
    await queryRunner.query(
      `INSERT INTO pesquisa_modelos (nome, descricao, cor, icone, ativa, anonima)
       SELECT $1::text, $2::text, 'purple', '🤝', true, true
       WHERE NOT EXISTS (SELECT 1 FROM pesquisa_modelos WHERE nome = $1::text)`,
      [
        NOME,
        'Sua opinião é muito importante para que possamos trazer uma melhoria constante no nosso ambiente de trabalho, vale lembrar que a pesquisa é totalmente anônima para garantir sigilo absoluto.',
      ]
    );

    const [modelo] = await queryRunner.query(
      `SELECT id FROM pesquisa_modelos WHERE nome = $1::text LIMIT 1`,
      [NOME]
    );
    if (!modelo) return;
    const modeloId = modelo.id;

    // Se ja tem perguntas, nao mexe (evita duplicar em reinstalacao)
    const [{ cnt }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS cnt FROM pesquisa_perguntas WHERE modelo_id = $1::int`,
      [modeloId]
    );
    if (cnt > 0) return;

    const opcoesFrequencia = {
      opcoes: ['Sempre', 'As vezes', 'Raramente', 'Nunca'],
    };
    const criteriosMatriz = {
      criterios: [
        'Como você avalia a agilidade e eficiência na resolução de solicitações e demandas',
        'Como você avalia o atendimento e a forma como se comunica (respeito, tom de voz, empatia, etc...)',
        'Como você avalia a prestatividade e preocupação com o seu setor (bem-estar e desenvolvimento dos colaboradores)',
        'Como você avalia a cobrança com o time',
        'Como você avalia a capacidade de motivar e inspirar a equipe?',
        'Como você avalia a abertura para receber sugestões e ideias?',
        'Como você avalia a forma como lida com conflitos e desafios?',
      ],
      escala_labels: ['EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'PESSIMO'],
    };

    const perguntas = [
      // === SEÇÃO RH ===
      { secao: 'Recursos Humanos', tipo: 'multipla_escolha',
        enunciado: 'Com que frequência o setor de RH se mostra acessível e fácil de contatar para atender as suas necessidades?',
        configuracao: opcoesFrequencia },
      { secao: 'Recursos Humanos', tipo: 'multipla_escolha',
        enunciado: 'Com que frequência as informações e orientações fornecidas pelo setor de RH são claras, completas e fáceis de entender?',
        configuracao: opcoesFrequencia },
      { secao: 'Recursos Humanos', tipo: 'multipla_escolha',
        enunciado: 'Você se sente confortável e seguro(a) para abordar o RH com suas dúvidas, preocupações ou problemas?',
        configuracao: opcoesFrequencia },
      { secao: 'Recursos Humanos', tipo: 'rating_5_matriz',
        enunciado: 'Como você avaliaria o RH em cada segmento?',
        configuracao: criteriosMatriz },
      { secao: 'Recursos Humanos', tipo: 'texto_longo',
        enunciado: 'Na sua opinião, o que o RH poderia fazer para que a sua equipe alcance resultados melhores?',
        configuracao: {} },
      // === SEÇÃO GESTOR ===
      { secao: 'Gestor', tipo: 'multipla_escolha',
        enunciado: 'Com que frequência o Gestor se mostra acessível e fácil de contatar para atender as suas necessidades?',
        configuracao: opcoesFrequencia },
      { secao: 'Gestor', tipo: 'multipla_escolha',
        enunciado: 'Com que frequência as informações e orientações fornecidas pelo Gestor são claras, completas e fáceis de entender?',
        configuracao: opcoesFrequencia },
      { secao: 'Gestor', tipo: 'multipla_escolha',
        enunciado: 'Você se sente confortável e seguro(a) para abordar o Gestor com suas dúvidas, preocupações ou problemas?',
        configuracao: opcoesFrequencia },
      { secao: 'Gestor', tipo: 'rating_5_matriz',
        enunciado: 'Como você avaliaria o Gestor em cada segmento?',
        configuracao: criteriosMatriz },
    ];

    let ordem = 0;
    for (const p of perguntas) {
      ordem++;
      await queryRunner.query(
        `INSERT INTO pesquisa_perguntas (modelo_id, secao, ordem, tipo, enunciado, obrigatoria, configuracao)
         VALUES ($1::int, $2::text, $3::int, $4::text, $5::text, true, $6::jsonb)`,
        [modeloId, p.secao, ordem, p.tipo, p.enunciado, JSON.stringify(p.configuracao)]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down nao remove dados (seed)
  }
}
