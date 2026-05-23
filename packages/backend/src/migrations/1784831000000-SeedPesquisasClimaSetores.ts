import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria 5 pesquisas de clima (uma por setor) idênticas aos Google Forms
 * originais do Tradição:
 *   - Pesquisa de Clima AÇOUGUE
 *   - Pesquisa de Clima PADARIA
 *   - Pesquisa de Clima HORTFRUTI
 *   - Pesquisa de Clima FRENTE DE CAIXA
 *   - Pesquisa de Clima REPOSIÇÃO
 *
 * Cada pesquisa tem as MESMAS 25 perguntas — só muda o nome do setor
 * no título do modelo. Idempotente: pula se já existir.
 *
 * Seções:
 *   1. Permanência (2)
 *   2. Salário (1)
 *   3. Metas (2)
 *   4. Infraestrutura (2)
 *   5. Reconhecimento & Crescimento (5)  ← extraído da Clima Organizacional
 *   6. Líder do Setor (2)
 *   7. Colegas (2)
 *   8. Gerente (2)
 *   9. Sub Gerente (2)
 *   10. Benefícios (1)
 *   11. Treinamentos (1)
 *   12. Sugestões (1)
 *   13. Orgulho (1)                      ← extraído da Clima Organizacional
 *   14. Satisfação Geral NPS (1)
 */
export class SeedPesquisasClimaSetores1784831000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const SETORES = [
      { nome: 'AÇOUGUE',         icone: '🥩' },
      { nome: 'PADARIA',         icone: '🥐' },
      { nome: 'HORTFRUTI',       icone: '🥬' },
      { nome: 'FRENTE DE CAIXA', icone: '🛒' },
      { nome: 'REPOSIÇÃO',       icone: '📦' },
    ];

    const escalaLabels = ['EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'PESSIMO'];

    // Critérios da matriz do LIDER (8 itens)
    const criteriosLider = [
      'Como você avalia o conhecimento das rotinas do setor do seu lider',
      'Como você avalia a prestatividade do lider em ajudar a equipe nas atividades',
      'Como você avalia a frenquencia de reuniões de alinhamento com o time',
      'Como você avalia a forma como o lider se comunica (respeito, tom de voz, etc)',
      'Como você avalia a cobrança do lider com o time',
      'Como você avalia a capacidade da sua liderança de motivar e inspirar a equipe?',
      'Como você avalia a abertura da sua liderança para receber sugestões e ideias?',
      'Como você avalia a forma como sua liderança lida com conflitos e desafios?',
    ];

    // Critérios da matriz dos COLEGAS (5 itens)
    const criteriosColegas = [
      'Como você avalia o conhecimento e habilidade nas rotinas do setor',
      'Como você avalia a prestatividade para ajudar os colegas',
      'Como você avalia o respeito com os colegas',
      'Como você avalia o respeito com o lider de setor desse colega',
      'Como você avalia o atendimento ao cliente desse colega',
    ];

    // Critérios das matrizes do GERENTE e SUB GERENTE (7 itens, mesmas em ambas)
    const criteriosGestao = [
      'Como você avalia o conhecimento e habilidade nas rotinas do seu setor',
      'Como você avalia a prestatividade para ajudar os colegas',
      'Como você avalia a forma de se comunicar com os colegas (respeito, tom de voz, etc)',
      'Como você avalia o atendimento ao cliente',
      'Como você avalia a capacidade da sua liderança de motivar e inspirar a equipe?',
      'Como você avalia a abertura da sua liderança para receber sugestões e ideias?',
      'Como você avalia a forma como ele lida com conflitos e desafios?',
    ];

    for (const setor of SETORES) {
      const nomePesquisa = `Pesquisa de Clima ${setor.nome} - Supermercado Tradição`;
      const [existe] = await queryRunner.query(
        `SELECT id FROM pesquisa_modelos WHERE nome = $1 LIMIT 1`,
        [nomePesquisa]
      );
      if (existe) continue; // ja criada — pula

      const [modelo] = await queryRunner.query(`
        INSERT INTO pesquisa_modelos (nome, descricao, cor, icone, ativa, anonima)
        VALUES ($1, $2, 'purple', $3, TRUE, TRUE) RETURNING id
      `, [
        nomePesquisa,
        'Sua opinião é muito importante para que possamos trazer uma melhoria constante no nosso ambiente de trabalho, vale lembrar que a pesquisa é totalmente anonima para garantir sigilo absoluto.',
        setor.icone,
      ]);
      const mid = modelo.id;

      const insert = async (secao: string, ordem: number, tipo: string, enunciado: string, config: any, obrig = true) => {
        await queryRunner.query(
          `INSERT INTO pesquisa_perguntas (modelo_id, secao, ordem, tipo, enunciado, obrigatoria, configuracao)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [mid, secao, ordem, tipo, enunciado, obrig, JSON.stringify(config || {})]
        );
      };

      // ===== PERMANÊNCIA / SALÁRIO / METAS =====
      await insert('Permanência', 1, 'multipla_escolha', 'Em relação ao ano atual, qual seria os seus planos em relação a continuar na Equipe Tradição !!', {
        opcoes: [
          'Me sinto bem e quero continuar na equipe Tradição nesse ano',
          'Me sinto bem porém tenho outros planos para minha carreira nesse ano e estou esperando uma oportunidade melhor para sair.',
          'Não me sinto bem, estou esperando uma oportunidade melhor para sair',
        ],
      });
      await insert('Permanência', 2, 'multipla_escolha', 'Caso você tenha optado por não continuar, qual seria o principal motivo.', {
        opcoes: ['Liderança', 'Salário', 'Horário', 'Motivos Pessoais', 'Misto das alternativas anteriores', 'Não Pretendo sair.'],
      });
      await insert('Salário', 3, 'multipla_escolha', 'Como você avalia o seu salário em relação ao que outros estabelecimentos do mesmo ramo estão pagando referente ao trabalho que você desenvolve ?', {
        opcoes: escalaLabels,
      });
      await insert('Metas', 4, 'multipla_escolha', 'Você acharia interessante se a empresa estimulasse metas com premiações ao serem atingidas ?', {
        opcoes: ['Acharia interessante, daria um incentivo a mais ...', 'Acharia interessante dependendo do valor pago ...', 'Não acharia interessante', 'Pra mim tanto faz !!'],
      });
      await insert('Metas', 5, 'checkbox', 'Caso você bata a meta, quanto em R$ você acharia interessante receber pelo prêmio..', {
        opcoes: ['De 50,00 a 150,00', 'De 150,00 a 250,00', 'De 250,00 a 300,00', 'Acima de 300,00', 'Não Gostaria de Dinheiro e sim vale presentes, como vale cinema, vale restaurante, etc.', 'Não gosto de metas.'],
      });

      // ===== INFRAESTRUTURA =====
      await insert('Infraestrutura', 6, 'multipla_escolha', 'Como você avalia a infraestrutura e ferramentas de trabalho disponíveis?', {
        opcoes: escalaLabels,
      });
      await insert('Infraestrutura', 7, 'texto_longo', 'Se você deu uma nota como Regular, Ruim ou Pessimo para estrutura ou ferramenta de trabalho, poderia nos dizer especificamente quais são os equipamentos ou estrutura que fizeram você dar essa nota ?', {});

      // ===== ✨ RECONHECIMENTO & CRESCIMENTO (importado da Clima Organizacional) =====
      await insert('Reconhecimento & Crescimento', 8, 'multipla_escolha', 'Você se sente reconhecido pelo trabalho que faz?', {
        opcoes: ['Sempre', 'Frequentemente', 'Às vezes', 'Raramente', 'Nunca'],
      });
      await insert('Reconhecimento & Crescimento', 9, 'multipla_escolha', 'Que forma de reconhecimento você mais valoriza?', {
        opcoes: ['Elogio público (na frente da equipe)', 'Aumento de salário', 'Bonificação / prêmio em dinheiro', 'Promoção / mudança de cargo', 'Dia de folga extra', 'Cesta básica / vale presente', 'Outro'],
      });
      await insert('Reconhecimento & Crescimento', 10, 'sim_nao', 'Você vê possibilidade de crescimento dentro da empresa?', {});
      await insert('Reconhecimento & Crescimento', 11, 'multipla_escolha', 'Como você avalia sua carga de trabalho?', {
        opcoes: ['Muito leve, poderia fazer mais', 'Adequada, está no ponto certo', 'Um pouco pesada', 'Excessiva, sinto muito desgaste'],
      });
      await insert('Reconhecimento & Crescimento', 12, 'sim_nao', 'Você consegue manter equilíbrio entre vida pessoal e profissional?', {});

      // ===== LIDER DO SETOR =====
      await insert('Líder do Setor', 13, 'rating_5_matriz', 'Como você avaliaria o(a) lider do seu setor em cada segmento ?', {
        criterios: criteriosLider,
        escala_labels: escalaLabels,
      });
      await insert('Líder do Setor', 14, 'texto_longo', 'Oque você acha que falta no seu lider para que ele consiga tirar um resultado melhor da equipe ?', {});

      // ===== COLEGAS =====
      await insert('Colegas', 15, 'rating_5_matriz', 'Como você avalia o seus colegas de trabalho de um modo geral nos quisitos abaixo.', {
        criterios: criteriosColegas,
        escala_labels: escalaLabels,
      });
      await insert('Colegas', 16, 'texto_longo', 'Oque você acha de um modo geral que falta nos seus colegas para que o setor obtenha um resultado melhor ?', {});

      // ===== GERENTE DE LOJA (Jeferson) =====
      await insert('Gerente', 17, 'rating_5_matriz', 'Como você avalia o seu Gerente de Loja (Jeferson)', {
        criterios: criteriosGestao,
        escala_labels: escalaLabels,
      });
      await insert('Gerente', 18, 'texto_longo', 'Oque você acha de um modo geral que falta nos seu Gerente para que o seu setor obtenha um resultado melhor ?', {});

      // ===== SUB GERENTE (Wanderson) =====
      await insert('Sub Gerente', 19, 'rating_5_matriz', 'Como você avalia o seu Sub Gerente de Loja (Wanderson)', {
        criterios: criteriosGestao,
        escala_labels: escalaLabels,
      });
      await insert('Sub Gerente', 20, 'texto_longo', 'Oque você acha de um modo geral que falta nos seu Sub Gerente para que o seu setor obtenha um resultado melhor ?', {});

      // ===== BENEFÍCIOS / TREINAMENTOS / SUGESTÕES =====
      await insert('Benefícios', 21, 'multipla_escolha', 'Se o Tradição fosse dar algum beneficio aos colaboradores, qual você acharia mais interessante ?', {
        opcoes: ['Plano de saúde', 'Plano odontologico', 'Cesta básica', 'Vale compra em loja', 'Cartão Vale Alimentação', 'Outro'],
      });
      await insert('Treinamentos', 22, 'multipla_escolha', 'Você acharia interessante se o Tradição realizasse treinamentos para desenvolver suas habilidades no seu setor ?', {
        opcoes: ['Acharia excelente, sinto que as vezes falta direcionamento', 'Não gosto muito de sala de aula, mas acho que seria bom', 'Não gosto muito de sala de aula, não iria curtir muito não ...', 'Talvez, só fazendo pra saber.', 'Outro'],
      });
      await insert('Sugestões', 23, 'texto_longo', 'Você tem alguma sugestão ou ideia para melhorar o ambiente de trabalho e a sua experiência na empresa?', {});

      // ===== ✨ ORGULHO (importado da Clima Organizacional) =====
      await insert('Orgulho', 24, 'texto_longo', 'O que mais te ORGULHA de trabalhar aqui? (pra capturar pontos fortes que podem ser usados em divulgação)', {}, false);

      // ===== SATISFAÇÃO GERAL (NPS) =====
      await insert('Satisfação Geral', 25, 'nps_0_10', 'Em geral, como você avalia a sua satisfação com o seu trabalho na empresa?', {}, false);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const setores = ['AÇOUGUE', 'PADARIA', 'HORTFRUTI', 'FRENTE DE CAIXA', 'REPOSIÇÃO'];
    for (const s of setores) {
      await queryRunner.query(
        `DELETE FROM pesquisa_modelos WHERE nome = $1`,
        [`Pesquisa de Clima ${s} - Supermercado Tradição`]
      );
    }
  }
}
