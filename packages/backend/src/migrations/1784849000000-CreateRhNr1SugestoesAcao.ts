import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cataloga sugestoes de acao pra cada dimensao NR-1. Quando o Farol
 * identificar um setor 🔴 em "burnout" ou "assedio_moral", o sistema
 * mostra essas sugestoes prontas pra usuario adicionar ao Plano.
 *
 * Conteudo extraido do Manual GRO/PGR do MTE (mar/2026) + boas praticas
 * de RH consagradas. Idempotente: pula se ja existir.
 */
export class CreateRhNr1SugestoesAcao1784849000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_nr1_sugestoes_acao (
        id SERIAL PRIMARY KEY,
        dimensao_nr1 VARCHAR(80) NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT NOT NULL,
        categoria VARCHAR(40) NOT NULL,
        prazo_sugerido_dias INT,
        ativa BOOLEAN NOT NULL DEFAULT true,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_nr1_sug_dim ON rh_nr1_sugestoes_acao(dimensao_nr1)`);

    const sugestoes: Array<[string, string, string, string, number | null]> = [
      // [dimensao, titulo, descricao, categoria, prazo_dias]

      // Sobrecarga / Demandas quantitativas
      ['demandas_quantitativas', 'Revisar distribuição de tarefas e escalas', 'Mapear gargalos do setor crítico, redistribuir tarefas entre colaboradores e ajustar a escala pra equilibrar carga.', 'reorganizacao', 15],
      ['demandas_quantitativas', 'Contratar reforço sazonal nos picos', 'Identificar períodos de alta demanda (datas comerciais, final de mês) e contratar reforço temporário.', 'reorganizacao', 30],
      ['demandas_quantitativas', 'Implementar pausas obrigatórias a cada 2h', 'Estabelecer no regulamento interno pausas curtas (10 min) a cada 2 horas trabalhadas.', 'politica', 15],

      // Demandas cognitivas
      ['demandas_cognitivas', 'Treinamento em tomada de decisão sob pressão', 'Workshop de 8h focado em frameworks de decisão rápida e priorização.', 'treinamento', 45],
      ['demandas_cognitivas', 'Definir protocolos claros pra decisões críticas', 'Documentar fluxograma de decisão pros casos mais frequentes do setor.', 'reorganizacao', 30],

      // Demandas emocionais
      ['demandas_emocionais', 'Treinamento de gestão emocional', 'Workshop com psicólogo (8h) sobre regulação emocional e prevenção de esgotamento.', 'treinamento', 45],
      ['demandas_emocionais', 'Acesso a apoio psicológico (EAP)', 'Contratar Employee Assistance Program: 4-6 sessões/ano por colaborador, confidencial.', 'programa', 60],

      // Autonomia
      ['autonomia', 'Reuniões de planejamento participativo do setor', 'Reuniões mensais onde a equipe ajuda a definir metas e métodos.', 'reorganizacao', 15],
      ['autonomia', 'Empowerment de decisões operacionais', 'Definir até que valor/escopo cada colaborador pode decidir sem autorização do gestor.', 'politica', 30],

      // Desenvolvimento
      ['desenvolvimento', 'Plano de Desenvolvimento Individual (PDI)', 'PDI documentado por colaborador, revisado a cada 6 meses.', 'programa', 45],
      ['desenvolvimento', 'Treinamentos técnicos trimestrais', 'Cronograma anual de capacitações técnicas por cargo.', 'treinamento', 60],

      // Significado do trabalho
      ['significado', 'Programa de propósito e impacto', 'Workshop mostrando o impacto do trabalho de cada setor no resultado final da empresa.', 'treinamento', 45],

      // Previsibilidade
      ['previsibilidade', 'Reunião semanal de alinhamento da equipe', 'Reunião de 30 min toda segunda-feira com agenda da semana e prioridades.', 'reorganizacao', 10],
      ['previsibilidade', 'Comunicação antecipada de mudanças', 'Toda mudança operacional comunicada com no mínimo 7 dias de antecedência.', 'politica', 15],

      // Reconhecimento
      ['reconhecimento', 'Programa formal de reconhecimento mensal', 'Destaque do mês por setor: critérios claros, prêmio simbólico, anúncio público.', 'programa', 30],
      ['reconhecimento', 'Feedback estruturado quinzenal', 'Conversa individual de 15 min a cada 2 semanas entre gestor e cada subordinado.', 'reorganizacao', 15],
      ['reconhecimento', 'Premiação por meta atingida', 'Bônus financeiro ou folga adicional quando o setor bate a meta do mês.', 'programa', 30],

      // Clareza de papel
      ['clareza_papel', 'Mapear e documentar responsabilidades por cargo', 'Job description detalhado, entregue no admissional e revisado anualmente.', 'reorganizacao', 30],
      ['clareza_papel', 'Reunião de onboarding estruturada', 'Plano de integração de 30 dias com checklist de aprendizado.', 'programa', 15],

      // Conflito de papel
      ['conflito_papel', 'Definir hierarquia única de comando', 'Cada colaborador tem UM gestor direto formal. Outras demandas passam por esse gestor.', 'politica', 15],
      ['conflito_papel', 'Workshop de alinhamento entre lideranças', 'Reunião quinzenal entre líderes pra alinhar prioridades e evitar demandas contraditórias.', 'reorganizacao', 30],

      // Qualidade da liderança
      ['qualidade_lideranca', 'Programa de Desenvolvimento de Líderes (LDP)', 'Capacitação de 40h em 3 meses: comunicação, gestão de conflitos, feedback, coaching.', 'treinamento', 90],
      ['qualidade_lideranca', 'Mentoria cruzada entre gestores', 'Cada líder júnior tem um líder sênior como mentor por 6 meses.', 'programa', 60],
      ['qualidade_lideranca', 'Avaliação 360º de lideranças', 'Avaliação anônima do gestor pelos subordinados, pares e superiores.', 'programa', 45],

      // Apoio do gestor
      ['apoio_gestor', 'Reunião 1:1 mensal gestor-subordinado', 'Conversa de 30 min focada em desenvolvimento, bloqueios e bem-estar.', 'reorganizacao', 15],
      ['apoio_gestor', 'Treinamento de líderes em escuta ativa', 'Workshop de 8h sobre técnicas de escuta empática e comunicação não violenta.', 'treinamento', 30],

      // Apoio dos colegas
      ['apoio_colegas', 'Atividades de team building', 'Encontros trimestrais pra fortalecer vínculo da equipe (almoço, dinâmica, integração).', 'programa', 45],
      ['apoio_colegas', 'Programa de mentoria entre pares', 'Novos colaboradores pareados com sênior pelos primeiros 3 meses.', 'programa', 60],

      // Comunidade social
      ['comunidade_social', 'Pesquisa de pulso quinzenal', 'Mini-pesquisa de 3 perguntas a cada 2 semanas pra monitorar clima.', 'programa', 30],
      ['comunidade_social', 'Encontros sociais mensais', 'Café da manhã ou almoço coletivo uma vez por mês.', 'programa', 15],

      // Insegurança no emprego
      ['inseguranca', 'Comunicação transparente sobre planos da empresa', 'Reunião trimestral abrindo resultados, projetos e perspectivas.', 'politica', 15],
      ['inseguranca', 'Plano de carreira documentado', 'Trilhas de progressão claras com critérios objetivos por cargo.', 'programa', 60],

      // Conflito trabalho-família
      ['conflito_trabalho_familia', 'Política de flexibilização de jornada', 'Possibilidade de banco de horas, jornada reduzida ou home office em determinados casos.', 'politica', 30],
      ['conflito_trabalho_familia', 'Banco de horas estruturado', 'Acordo coletivo pra compensação de horas, com regras claras.', 'politica', 45],
      ['conflito_trabalho_familia', 'Plantões e folgas justas', 'Sistema de rodízio transparente, evitando concentração em mesmos colaboradores.', 'reorganizacao', 15],

      // Hiperconectividade
      ['hiperconectividade', 'Política formal de desconexão fora do horário', 'Proibir cobrança em ferramentas digitais fora do horário, exceto emergências documentadas.', 'politica', 15],
      ['hiperconectividade', 'WhatsApp restrito ao horário de trabalho', 'Grupos de trabalho silenciados após o expediente. Mensagens só são respondidas no dia seguinte.', 'politica', 10],

      // Confiança vertical
      ['confianca', 'Reunião trimestral com a liderança máxima', 'Diretor/dono fala diretamente com todos os colaboradores, abre Q&A.', 'programa', 30],
      ['confianca', 'Comunicado mensal de resultados e decisões', 'Boletim interno com vendas, projetos, mudanças.', 'politica', 15],

      // Justiça
      ['justica', 'Política transparente de promoções e benefícios', 'Critérios objetivos publicados pra todos. Decisões justificadas formalmente.', 'politica', 30],
      ['justica', 'Canal de ouvidoria independente', 'Canal externo (e-mail/telefone) gerido por terceiro pra reclamações sigilosas.', 'canal', 45],

      // Saúde geral
      ['saude_geral', 'Programa de qualidade de vida', 'Convênio com academia, nutricionista, check-up anual subsidiado.', 'programa', 60],
      ['saude_geral', 'Ginástica laboral diária', 'Sessão de 10 min antes do início do expediente, conduzida por educador físico.', 'programa', 30],

      // Estresse
      ['estresse', 'Pausas obrigatórias (3x/dia, 10 min)', 'Definir horários fixos de pausa no quadro do setor.', 'politica', 15],
      ['estresse', 'Acesso a apoio psicológico (EAP)', 'Convênio com plataforma de terapia online.', 'programa', 45],
      ['estresse', 'Ambiente de descanso adequado', 'Sala de descanso silenciosa, com poltronas e iluminação suave.', 'reorganizacao', 30],

      // Burnout
      ['burnout', 'Avaliação individual com psicólogo (PCMSO)', 'Avaliação anual psicossocial individual integrada ao PCMSO.', 'programa', 45],
      ['burnout', 'Plano de redução de carga emergencial', 'Quando identificado caso, ajustar imediatamente as demandas da pessoa por 30 dias.', 'reorganizacao', 15],
      ['burnout', 'Programa de saúde mental', 'EAP + workshops de prevenção + canal de escuta.', 'programa', 60],

      // Sono
      ['sono', 'Revisar escalas noturnas', 'Análise das jornadas com pico de fadiga; redistribuir turno noturno.', 'reorganizacao', 30],
      ['sono', 'Garantir intervalo de 11h entre jornadas', 'Auditar escalas pra cumprir o intervalo mínimo legal entre uma jornada e outra.', 'politica', 10],

      // Assédio moral
      ['assedio_moral', 'Política antiassédio publicada + treinamento obrigatório', 'Documento formal, divulgado a todos, com treinamento anual obrigatório.', 'politica', 30],
      ['assedio_moral', 'Canal de denúncia anônima', 'Hotline ou e-mail externo independente da hierarquia interna.', 'canal', 15],
      ['assedio_moral', 'Investigação independente em casos confirmados', 'Comitê interno ou consultoria externa pra apuração sigilosa.', 'programa', 7],
      ['assedio_moral', 'Treinamento de lideranças em comunicação não violenta', 'Workshop de 16h focado em comunicação assertiva e respeitosa.', 'treinamento', 45],

      // Assédio sexual
      ['assedio_sexual', 'Política específica antiassédio sexual', 'Documento formal separado, com canal de denúncia próprio e exclusivo.', 'politica', 15],
      ['assedio_sexual', 'Canal de denúncia confidencial', 'Linha direta com profissional especializada (psicóloga ou advogada).', 'canal', 10],
      ['assedio_sexual', 'Comitê de gênero e diversidade', 'Grupo interno com representatividade pra acolhimento e investigação.', 'programa', 45],
      ['assedio_sexual', 'Treinamento obrigatório anual', 'Capacitação de 4h pra todos os colaboradores e gestores.', 'treinamento', 30],

      // Ameaças de violência
      ['violencia_ameaca', 'Protocolo de segurança e acionamento', 'Manual com passos pra acionamento da polícia, segurança patrimonial e RH.', 'politica', 10],
      ['violencia_ameaca', 'Treinamento em desescalada de conflitos', 'Capacitação de seguranças e atendentes pra resolução pacífica.', 'treinamento', 30],
      ['violencia_ameaca', 'Segurança patrimonial reforçada', 'Avaliação de câmeras, iluminação, presença de seguranças.', 'reorganizacao', 45],

      // Violência física
      ['violencia_fisica', 'Análise imediata e afastamento do agressor', 'Em caso confirmado, afastamento preventivo enquanto durar a apuração.', 'politica', 1],
      ['violencia_fisica', 'Suporte psicológico à vítima', 'Atendimento psicológico pago pela empresa, imediato.', 'programa', 7],
      ['violencia_fisica', 'Revisão dos protocolos de segurança', 'Análise da ocorrência e plano de prevenção pra evitar recorrência.', 'reorganizacao', 30],

      // Discriminação
      ['discriminacao', 'Treinamento de Diversidade e Inclusão obrigatório', 'Workshop anual de 8h sobre DEI: gênero, raça, idade, religião, deficiência.', 'treinamento', 30],
      ['discriminacao', 'Política antidiscriminação publicada', 'Documento formal com consequências disciplinares claras.', 'politica', 15],
      ['discriminacao', 'Métricas de diversidade no recrutamento', 'Indicadores de % de admissões por gênero/raça nas vagas, com metas anuais.', 'programa', 45],
    ];

    for (let i = 0; i < sugestoes.length; i++) {
      const [dim, tit, desc, cat, prazo] = sugestoes[i];
      await queryRunner.query(
        `INSERT INTO rh_nr1_sugestoes_acao (dimensao_nr1, titulo, descricao, categoria, prazo_sugerido_dias, ordem)
         SELECT $1::text, $2::text, $3::text, $4::text, $5::int, $6::int
         WHERE NOT EXISTS (
           SELECT 1 FROM rh_nr1_sugestoes_acao WHERE dimensao_nr1 = $1::text AND titulo = $2::text
         )`,
        [dim, tit, desc, cat, prazo, i]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_nr1_sugestoes_acao`);
  }
}
