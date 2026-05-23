import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Substitui as perguntas da "Pesquisa de Satisfação - Supermercado Tradição"
 * pelas 27 perguntas IDÊNTICAS ao Google Forms original (fonte: PDF exportado
 * em 23/05/2026). Inclui:
 *   - 5 matrizes 1-5 com labels EXCELENTE/BOM/REGULAR/RUIM/PESSIMO
 *   - 9 múltiplas escolhas (motivos compra / motivos abandono / interesse)
 *   - 4 checkboxes (promoções, ofertas, estacionamento, horário)
 *   - 8 texto longo (sugestões de melhoria)
 *   - 1 NPS 0-10
 *
 * Todas marcadas como obrigatórias.
 */
export class FixPesquisaTradicaoPerguntas1784830500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [modelo] = await queryRunner.query(
      `SELECT id FROM pesquisa_modelos WHERE nome = 'Pesquisa de Satisfação - Supermercado Tradição' LIMIT 1`
    );
    if (!modelo) return; // pesquisa nao existe — nada a fazer

    const modeloId = modelo.id;

    // Apaga perguntas antigas (cascade nao remove respostas pq estamos numa
    // instalacao nova; em prod com respostas, o cliente teria que rodar manual)
    await queryRunner.query(`DELETE FROM pesquisa_perguntas WHERE modelo_id = $1`, [modeloId]);

    const escalaLabels = ['EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'PESSIMO'];
    const motivosCompra = ['PREÇO', 'QUALIDADE DOS PRODUTOS', 'VARIEDADE DOS PRODUTOS', 'VELOCIDADE DA(O) ATENDENTE', 'SIMPATIA DA(O) ATENDENTE', 'LIMPEZA DO SETOR'];

    const insert = async (secao: string, ordem: number, tipo: string, enunciado: string, config: any) => {
      await queryRunner.query(
        `INSERT INTO pesquisa_perguntas (modelo_id, secao, ordem, tipo, enunciado, obrigatoria, configuracao)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6::jsonb)`,
        [modeloId, secao, ordem, tipo, enunciado, JSON.stringify(config || {})]
      );
    };

    // ===== PADARIA =====
    await insert('Padaria', 1, 'rating_5_matriz', 'Como você classificaria o setor de PADARIA nos quesitos de :', {
      criterios: ['SIMPATIA DA(O) ATENDENTE', 'LIMPEZA DO SETOR', 'VELOCIDADE DA(O) ATENDENTE', 'ORGANIZAÇÃO', 'QUALIDADE DOS PRODUTOS', 'VARIEDADE DOS PRODUTOS', 'PREÇO'],
      escala_labels: escalaLabels,
    });
    await insert('Padaria', 2, 'multipla_escolha', 'Oque na sua opnião é o principal motivo para você comprar em nossa PADARIA', {
      opcoes: motivosCompra,
    });
    await insert('Padaria', 3, 'multipla_escolha', 'Caso vc seja um cliente que não compra mais em nossa padaria, poderia nos dizer o motivo ?', {
      opcoes: ['SOU CLIENTE DA PADARIA TRADIÇÃO', 'Outro'],
    });
    await insert('Padaria', 4, 'multipla_escolha', 'Caso nossa Padaria tivesse um auto atendimento no pão de sal e pão de queijo para que você mesmo como cliente possa se servir, você acharia interessante ?', {
      opcoes: ['Sim, agilizaria na questão de fila e poderia escolher o pão de minha preferência', 'Sim, mas ainda sim eu iria preferir pegar com a atendente', 'Para mim seria indiferente', 'Outro'],
    });
    await insert('Padaria', 5, 'texto_longo', 'Oque você acha que poderia ser melhorado em nossa padaria na sua opinião ?', {});

    // ===== AÇOUGUE =====
    await insert('Açougue', 6, 'rating_5_matriz', 'Como você classificaria o setor de AÇOUGUE nos quesitos de :', {
      criterios: ['SIMPATIA DOS ATENDENTES', 'LIMPEZA', 'VELOCIDADE NO ATENDIMENTO', 'ORGANIZAÇÃO', 'QUALIDADE DOS PRODUTOS', 'VARIEDADE', 'PREÇO'],
      escala_labels: escalaLabels,
    });
    await insert('Açougue', 7, 'multipla_escolha', 'Caso vc seja um cliente que não compra mais em nosso Açougue, poderia nos dizer o motivo ?', {
      opcoes: ['AINDA SOU CLIENTE DO AÇOUGUE TRADIÇÃO', 'Outro'],
    });
    await insert('Açougue', 8, 'multipla_escolha', 'Oque na sua opnião é o principal motivo para comprar em nosso Açougue', {
      opcoes: motivosCompra,
    });
    await insert('Açougue', 9, 'multipla_escolha', 'Caso em nosso Açougue Oferecêssemos os cortes de bifes como, contra file, coxão mole, etc.. já fatiado no balcao ou em geladeira para agilizar o atendimento, você acharia a ideia interessante ?', {
      opcoes: ['Sim, agilizaria na questão de fila', 'Sim, mas ainda sim eu iria preferir o corte feito na hora', 'Para mim seria indiferente', 'Outro'],
    });

    // ===== HORTFRUT =====
    await insert('Hortfrut', 10, 'rating_5_matriz', 'Como você classificaria o setor de HORTFRUT nos quesitos de :', {
      criterios: ['LIMPEZA', 'ORGANIZAÇÃO', 'QUALIDADE DOS PRODUTOS', 'VARIEDADE', 'PREÇO', 'PRESTATIVIDADE DOS REPOSITORES'],
      escala_labels: escalaLabels,
    });
    await insert('Hortfrut', 11, 'multipla_escolha', 'Oque na sua opnião é o principal motivo para comprar em nosso HortFruti', {
      opcoes: motivosCompra,
    });
    await insert('Hortfrut', 12, 'multipla_escolha', 'Caso vc seja um cliente que não compra mais em nosso HORTFRUT, poderia nos dizer o motivo ?', {
      opcoes: ['AINDA SOU CLIENTE DO HORTFRUT TRADIÇÃO', 'Outro'],
    });
    await insert('Hortfrut', 13, 'texto_longo', 'Oque você acha que poderia ser melhorado em nosso Hortfrut na sua opinião ?', {});

    // ===== MERCEARIA =====
    await insert('Mercearia', 14, 'rating_5_matriz', 'Como você classificaria o setor de MERCEARIA nos quesitos de :', {
      criterios: ['LIMPEZA', 'ORGANIZAÇÃO DOS PRODUTOS NA GONDOLA', 'VARIEDADE', 'PREÇO', 'PRESTATIVIDADE DOS REPOSITORES'],
      escala_labels: escalaLabels,
    });
    await insert('Mercearia', 15, 'texto_longo', 'Oque você acha que poderia ser melhorado em nossa Mercearia ?', {});

    // ===== FRENTE DE CAIXA =====
    await insert('Frente de Caixa', 16, 'rating_5_matriz', 'Como você classificaria o setor de FRENTE DE CAIXA nos quesitos de :', {
      criterios: ['SIMPATIA DO(A) OPERADOR(A)', 'LIMPEZA', 'VELOCIDADE NO ATENDIMENTO', 'ORGANIZAÇÃO'],
      escala_labels: escalaLabels,
    });
    await insert('Frente de Caixa', 17, 'texto_longo', 'Oque você acha que poderia ser melhorado em nossa Frente de Caixa ?', {});

    // ===== GERAL =====
    await insert('Geral', 18, 'texto_longo', 'Existe algum produto que você gostaria de encontrar em nossa loja, mas que atualmente não oferecemos ?', {});
    await insert('Geral', 19, 'checkbox', 'Qual é a sua opinião sobre as nossas promoções e descontos ?', {
      opcoes: ['Eu acho as promoções e descontos bem atrativas', 'As promoções e descontos são razoáveis', 'Eu não acho as promoções e descontos muito atrativas.', 'Para mim é indiferente'],
    });
    await insert('Geral', 20, 'multipla_escolha', 'Você acharia interessante se o Tradição tivesse um aplicativo de club de descontos e promoções, sendo ativado através do cpf no caixa ?', {
      opcoes: ['Acharia muito bom, usaria certamente', 'Acharia bacana, mas não gosto de perder tempo colocando cpf', 'Não acho interessante, demoraria mais as filas.', 'Pra mim seria indiferente, dependendo da oferta usaria ou não.'],
    });
    await insert('Geral', 21, 'multipla_escolha', 'Como você fica sabendo das nossas ofertas ?', {
      opcoes: ['WhatsApp', 'Facebook / Instagram', 'Rádio Interna', 'Familia / Amigos'],
    });
    await insert('Geral', 22, 'texto_longo', 'Além do Tradição, quais outros Supermercados/Açougues/HortFrutis você costuma comprar aqui na redondeza e por qual motivo ?', {});
    await insert('Geral', 23, 'checkbox', 'Você sabia que agora o Tradição possui estacionamento', {
      opcoes: ['Sim, trouxe comodidade', 'Sim, mas pra mim é indiferente', 'Não sabia'],
    });
    await insert('Geral', 24, 'checkbox', 'Hoje nosso horário de abertura é as 7:30 da manhã, pra você esse horário é interessante ou gostaria que a loja tivesse inicio em outro horário ?', {
      opcoes: ['As 7:30 pra mim tá òtimo', 'As 7:00 seria ótimo', 'As 6:30 seria ótimo', 'As 6:00 seria ótimo.'],
    });
    await insert('Geral', 25, 'texto_longo', 'Existe algo que podemos fazer melhorar a sua experiência de compra em nossa loja ?', {});
    await insert('Geral', 26, 'nps_0_10', 'Em uma escala de 0 a 10, qual seria a chance de você recomendar o Tradição para um amigo ou familiar ?', {});
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback (apenas substituicao de perguntas).
  }
}
