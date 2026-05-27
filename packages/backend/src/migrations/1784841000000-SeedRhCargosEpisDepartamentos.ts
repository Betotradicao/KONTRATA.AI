import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed inicial pra Departamentos (Setores), EPIs/EPCs e Cargos do RH.
 *
 * Dados extraídos do cliente "tradicao" (Radar) — supermercado típico.
 * Permite que novos clientes Kontrata venham pré-populados com a
 * configuração padrão do segmento.
 *
 * Idempotente: usa NOT EXISTS pra não duplicar se rodar 2x ou se
 * o cliente já cadastrou manualmente.
 */
export class SeedRhCargosEpisDepartamentos1784841000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== DEPARTAMENTOS (Setores) =====
    const departamentos = [
      'AÇOUGUE', 'ADMINISTRATIVO', 'COMPRAS', 'CONFERENCIA',
      'CPD', 'PADARIA', 'PADARIA PRODUÇÃO', 'PREVENÇÃO DE PERDAS',
      'RECURSOS HUMANOS', 'PISO DE LOJA', 'MERCEARIA', 'FRENTE DE CAIXA',
    ];
    for (const nome of departamentos) {
      await queryRunner.query(
        `INSERT INTO rh_departamentos (nome, ativo)
         SELECT $1::text, true
         WHERE NOT EXISTS (SELECT 1 FROM rh_departamentos WHERE nome = $1::text)`,
        [nome]
      );
    }

    // ===== EPIs / EPCs =====
    const episEpcs: Array<{
      nome: string;
      tipo: 'epi' | 'epc';
      descricao: string;
      ca: string;
      validade_meses: number | null;
    }> = [
      { nome: 'Luva de açougueiro (cota de malha)', tipo: 'epi', descricao: 'Luva de aço inox para corte de carnes', ca: '', validade_meses: 24 },
      { nome: 'Luva nitrílica descartável', tipo: 'epi', descricao: 'Para manuseio de alimentos e produtos químicos leves', ca: '', validade_meses: 1 },
      { nome: 'Luva impermeável longa', tipo: 'epi', descricao: 'Para limpeza com produtos químicos', ca: '', validade_meses: 6 },
      { nome: 'Touca descartável', tipo: 'epi', descricao: 'Padaria, açougue, hortifruti, produção', ca: '', validade_meses: 1 },
      { nome: 'Avental de açougueiro', tipo: 'epi', descricao: 'Avental de PVC ou couro para açougue', ca: '', validade_meses: 12 },
      { nome: 'Avental impermeável', tipo: 'epi', descricao: 'Padaria, frente de caixa', ca: '', validade_meses: 12 },
      { nome: 'Bota de PVC antiderrapante', tipo: 'epi', descricao: 'Açougue, hortifruti, limpeza', ca: '', validade_meses: 12 },
      { nome: 'Sapato de segurança com biqueira', tipo: 'epi', descricao: 'Recebimento, estoque, açougue', ca: '', validade_meses: 18 },
      { nome: 'Cinta abdominal lombar', tipo: 'epi', descricao: 'Repositores, conferentes, recebimento', ca: '', validade_meses: 12 },
      { nome: 'Óculos de proteção', tipo: 'epi', descricao: 'Limpeza com produtos químicos, padaria', ca: '', validade_meses: 12 },
      { nome: 'Máscara descartável', tipo: 'epi', descricao: 'Padaria, açougue, hortifruti', ca: '', validade_meses: 1 },
      { nome: 'Protetor auricular', tipo: 'epi', descricao: 'Setores de produção e câmaras frias', ca: '', validade_meses: 6 },
      { nome: 'Capacete de segurança', tipo: 'epi', descricao: 'Recebimento e estoque', ca: '', validade_meses: 36 },
      { nome: 'Jaqueta térmica para câmara fria', tipo: 'epi', descricao: 'Conferentes e açougueiros em câmara fria', ca: '', validade_meses: 24 },
      { nome: 'Cinto de segurança tipo paraquedista', tipo: 'epi', descricao: 'Trabalho em altura (estoque alto)', ca: '', validade_meses: 12 },
      { nome: 'Avental de Pano', tipo: 'epi', descricao: 'Avental de pano', ca: '', validade_meses: 12 },
      { nome: 'Luva borracha', tipo: 'epi', descricao: 'Luva para setor de limpeza de ambientes', ca: '', validade_meses: 12 },
      { nome: 'Sapato antiderrapante', tipo: 'epi', descricao: 'Sapato Antiderrapante CA 48583 Branco / padaria', ca: '48583', validade_meses: null },
      { nome: 'Luva térmica', tipo: 'epi', descricao: 'Padaria', ca: '', validade_meses: null },
      // EPCs (coletivos)
      { nome: 'Faixa antiderrapante no piso', tipo: 'epc', descricao: 'Acesso a câmaras frias e áreas molhadas', ca: '', validade_meses: null },
      { nome: 'Placa de piso molhado', tipo: 'epc', descricao: 'Sinalização de risco em manutenção/limpeza', ca: '', validade_meses: null },
      { nome: 'Extintor de incêndio CO2/PQS', tipo: 'epc', descricao: 'Recarga conforme NBR — verificar validade', ca: '', validade_meses: 12 },
      { nome: 'Saída de emergência sinalizada', tipo: 'epc', descricao: 'Iluminação de emergência funcionando', ca: '', validade_meses: null },
      { nome: 'Chuveiro/lava-olhos de emergência', tipo: 'epc', descricao: 'Próximo a setores que usam químicos', ca: '', validade_meses: null },
      { nome: 'Guarda-corpo em escadas', tipo: 'epc', descricao: 'Conformidade com NR-8', ca: '', validade_meses: null },
      { nome: 'Proteção de polia em equipamentos', tipo: 'epc', descricao: 'Padaria (masseira, divisora) e açougue (moedor)', ca: '', validade_meses: null },
      { nome: 'Trava de segurança em câmara fria', tipo: 'epc', descricao: 'Botão pânico interno na câmara fria', ca: '', validade_meses: null },
    ];
    for (const e of episEpcs) {
      await queryRunner.query(
        `INSERT INTO rh_epis_epcs (nome, tipo, descricao, ca, validade_meses, ativo)
         SELECT $1::text, $2::text, $3::text, $4::text, $5::int, true
         WHERE NOT EXISTS (SELECT 1 FROM rh_epis_epcs WHERE nome = $1::text)`,
        [e.nome, e.tipo, e.descricao, e.ca, e.validade_meses]
      );
    }

    // ===== CARGOS =====
    const cargos: Array<{
      nome: string;
      tipo: string;
      salario_base: number;
      descritivo_atividades: string;
      requisitos: string;
    }> = [
      { nome: 'ACOUGUEIRO', tipo: 'OPERACIONAL', salario_base: 2150.67, descritivo_atividades: 'Realizar corte diverso de carnes\nLimpeza do setor\nAbastecimento de produtos\nDesossas bovinos e suinos', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário' },
      { nome: 'AUXILIAR DE ACOUGUE', tipo: 'OPERACIONAL', salario_base: 2101.34, descritivo_atividades: 'Atendimento ao publico, montagem de bandejas, pesagem de produtos, limpeza e organização de setor, controle de preço e prazo de produtos.', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário' },
      { nome: 'AUXILIAR DE LIMPEZA', tipo: 'OPERACIONAL', salario_base: 1886.80, descritivo_atividades: 'Limpeza e organização de loja e estoques (lavar piso de loja, banheiros, cestinhos e carrinhos utilizados para compras, cozinha e salas administrativas), limpeza de vitrines e geladeiras.', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário' },
      { nome: 'AUXILIAR DE PADARIA', tipo: 'OPERACIONAL', salario_base: 2101.34, descritivo_atividades: 'Auxilio ao confeiteiro, produção (bolos, doces e salgados), limpeza e organização de setor.', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário' },
      { nome: 'BALCONISTA DE PADARIA', tipo: 'OPERACIONAL', salario_base: 1719.10, descritivo_atividades: 'Atendimento ao cliente, pesagem e precificação de produtos, produção de fatiados, controle de preço e prazos de mercadorias da padaria, reposição e precificação de produtos da padaria, enfornar pães, limpeza e organização de setor.', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário' },
      { nome: 'CONFEITEIRO', tipo: 'OPERACIONAL', salario_base: 2168.95, descritivo_atividades: 'Produção e entrega de Bolos, doces e salgados para o setor de padaria, limpeza e organização da confeitaria.', requisitos: '- Experiência anterior na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'MOTORISTA', tipo: 'OPERACIONAL', salario_base: 2726.89, descritivo_atividades: 'Responsável por realizar trajetos em busca de mercadorias, auxilio na descarga de caminhão, compras e apoio ao hortifrúti.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CNH categoria C;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'OPERADOR(A) DE CAIXA', tipo: 'OPERACIONAL', salario_base: 2267.66, descritivo_atividades: 'Operação de caixa, atendimento aos clientes, auxilio na precificação e reposição de produtos destinados a frente de caixa, limpeza e organização de setor.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'REPOSITOR(A)', tipo: 'OPERACIONAL', salario_base: 2101.34, descritivo_atividades: 'Abastecimento de loja, limpeza e organização de prateleiras e estoques.\nDescarga de caminhão e atendimento ao publico.', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'REPOSITOR(A) DE FLV', tipo: 'OPERACIONAL', salario_base: 2101.34, descritivo_atividades: 'Abastecimento de loja, limpeza e organização de prateleiras e estoques.\nDescarga de caminhão e atendimento ao publico.', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'MENOR APRENDIZ (CAIXA)', tipo: 'OPERACIONAL', salario_base: 700.00, descritivo_atividades: 'Operação de caixa, atendimento ao cliente, limpeza e organização de setor, reposição e precificação de produtos destinados ao setor.', requisitos: '- Estar cursando ensino médio (entre 1° e 3° ano do ensino médio);\n- Disponibilidade de horário.' },
      { nome: 'MARKETING', tipo: 'OPERACIONAL', salario_base: 2101.34, descritivo_atividades: 'Divulgação de produtos, promoções, vagas, campanhas e novidades da loja;\nAtendimento ao cliente de forma online e presencial;\nProdução, edição e divulgação de conteúdos, para marketing interno e externo;', requisitos: '- Desejável formação em marketing ou áreas correlatas;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'MENOR APRENDIZ (REPOSICAO)', tipo: 'OPERACIONAL', salario_base: 700.00, descritivo_atividades: 'Reposição, organização, precificação e controle de validade de mercadorias da loja.\nAtendimento ao cliente.', requisitos: '- Estar cursando ensino médio (entre 1° e 3° ano do ensino médio);\n- Disponibilidade de horário.' },
      { nome: 'MENOR APRENDIZ (ADM)', tipo: 'OPERACIONAL', salario_base: 700.00, descritivo_atividades: 'Auxilio nas atividades administrativas, responsável pelo setor de prevenção de perdas, lançamentos e alimentação do sistema da loja, apoio na conferencia de preços, apoio em demais setores.', requisitos: '- Estar cursando ensino médio (entre 1° e 3° ano do ensino médio);\n- Desejável noção em informática;\n- Disponibilidade para atuar no turno da manha.' },
      { nome: 'COMPRADOR', tipo: 'ESTRATEGICO', salario_base: 2385.00, descritivo_atividades: 'Controle e agendamentos de pedidos, verificação de estoque, atendimento a vendedores, pesquisa de produtos e preços.\nResponsável pelo setor financeiro da loja, pagamentos de boletos e funcionários, pedidos de suprimentos e matérias, prestação de contas em sistema, alimentação de planilhas.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'CONFERENTE', tipo: 'ESTRATEGICO', salario_base: 2101.34, descritivo_atividades: 'Recebimento e conferencia de mercadorias, acompanhamento e vistoria de entregas, organização de estoques.', requisitos: '- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário' },
      { nome: 'CPD', tipo: 'ESTRATEGICO', salario_base: 2101.34, descritivo_atividades: 'Recebimento e conferencia de mercadorias, lançamento de notas em sistema, controle de produtos destinados a trocas, atendimento a fornecedoras, organização de estoques.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'FINANCEIRO', tipo: 'ESTRATEGICO', salario_base: 2385.00, descritivo_atividades: 'Controle e agendamentos de pedidos, verificação de estoque, atendimento a vendedores, pesquisa de produtos e preços.\nResponsável pelo setor financeiro da loja, pagamentos de boletos e funcionários, pedidos de suprimentos e matérias, prestação de contas em sistema, alimentação de planilhas.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'FISCAL DE CAIXA', tipo: 'ESTRATEGICO', salario_base: 2480.10, descritivo_atividades: 'Responsável pela equipe de operadores de caixa, cancelamento, trocas de dinheiro, sangrias, estornos, operação de caixa.\nLimpeza, organização e abastecimento de produtos da frente de caixa.', requisitos: '- Operação de caixa;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'GERENTE', tipo: 'ESTRATEGICO', salario_base: 3785.73, descritivo_atividades: 'Supervisão e apoio nas operações diárias, organização de loja, controle de estoque e apoio em pedidos, atendimento a clientes e colaboradores.', requisitos: '- Experiência comprovada na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'LIDER DE ACOUGUE', tipo: 'ESTRATEGICO', salario_base: 2289.31, descritivo_atividades: 'Desossa de carnes, montagem e exposição de produtos, limpeza e organização de setor, atendimento ao cliente.\nResponsável pela equipe de açougue, treinamento, orientação e atendimento a toda equipe de açougue.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'LIDER DE CAIXA', tipo: 'ESTRATEGICO', salario_base: 2639.10, descritivo_atividades: 'Responsável pela equipe de frente de caixa (operadores e fiscais), cancelamento, trocas de dinheiro, sangrias, estornos, operação de caixa.\nLimpeza, organização e abastecimento de produtos da frente de caixa.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'LIDER DE FLV', tipo: 'ESTRATEGICO', salario_base: 2289.31, descritivo_atividades: 'Responsável pela equipe de hortifrúti, treinamento, orientação e atendimento a toda equipe.\nRecebimento e abastecimento de mercadorias destinadas ao setor, atendimento ao cliente, controle de preço e prazo, limpeza e organização de setor.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'LIDER DE MERCEARIA', tipo: 'ESTRATEGICO', salario_base: 2289.31, descritivo_atividades: 'Responsável pela equipe de mercearia, treinamento, orientação e atendimento a toda equipe.\nRecebimento e abastecimento de mercadorias destinadas ao setor, atendimento ao cliente, controle de preço e prazo, limpeza e organização de setor.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'LIDER DE PADARIA', tipo: 'ESTRATEGICO', salario_base: 2289.31, descritivo_atividades: 'Responsável pela equipe de padaria, treinamento, orientação e atendimento a toda equipe.\nRecebimento e abastecimento de mercadorias destinadas ao setor, atendimento ao cliente, controle de preço e prazo, limpeza e organização de setor.', requisitos: '- Desejável experiência na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
      { nome: 'AUXILIAR DE RECURSOS HUMANOS', tipo: 'ESTRATEGICO', salario_base: 2101.34, descritivo_atividades: 'Responsável pelo setor de departamento pessoal, admissões, demissões, fechamento de folhas de pagamento.\nControle de férias, afastamentos e licenças, formulação de escalas, controle de equipes.', requisitos: '- Necessário formação em Gestão de Recursos Humanos ou áreas correlatas;\n- Desejável experiência na área;\n- Maior de 18 anos;\n- Ter disponibilidade de horário.' },
      { nome: 'SUB GERENTE', tipo: 'ESTRATEGICO', salario_base: 2101.34, descritivo_atividades: 'Responsável por supervisionar a operação diária, liderar equipes, controlar estoques, garantir o atendimento ao cliente e manter a organização e higiene da loja.', requisitos: '- Experiência comprovada na área;\n- Maior de 18 anos;\n- Possuir CDI (certificado de dispensa do exercito);\n- Ter disponibilidade de horário.' },
    ];

    // Garante que a coluna `tipo` existe (alguns DBs antigos não a tinham)
    await queryRunner.query(
      `ALTER TABLE rh_cargos ADD COLUMN IF NOT EXISTS tipo VARCHAR(100)`
    );

    for (const c of cargos) {
      await queryRunner.query(
        `INSERT INTO rh_cargos (nome, tipo, salario_base, descricao, descritivo_atividades, requisitos, ativo)
         SELECT $1::text, $2::text, $3::numeric, '', $4::text, $5::text, true
         WHERE NOT EXISTS (SELECT 1 FROM rh_cargos WHERE nome = $1::text)`,
        [c.nome, c.tipo, c.salario_base, c.descritivo_atividades, c.requisitos]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Não remove — seed permanece mesmo em rollback
  }
}
