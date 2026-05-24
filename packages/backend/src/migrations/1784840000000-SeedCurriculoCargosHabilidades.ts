import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed inicial pra Modelo de Currículo (template Recrutamento).
 *
 * Cargos, habilidades (pontos fortes) e tipos de vaga padrão pra
 * supermercados — extraídos da base do cliente "novacentral" (Radar)
 * que tem o template mais completo.
 *
 * Idempotente: usa NOT EXISTS pra não duplicar se rodar 2x ou se
 * o cliente já cadastrou manualmente.
 */
export class SeedCurriculoCargosHabilidades1784840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== CARGOS =====
    const cargos = [
      'AÇOUGUEIRO', 'AUX DE AÇOUGUE', 'AUXILIAR ADMINISTRATIVO',
      'AUXILIAR DE RH', 'BALCONISTA DE PADARIA', 'CONFEITEIRO',
      'CONFERENTE', 'FISCAL DE CAIXA', 'GERENTE',
      'MOTORISTA', 'OP DE CAIXA', 'PADEIRO',
      'REPOSITOR', 'REPOSITOR DE FLV', 'SUB GERENTE',
    ];
    for (const nome of cargos) {
      await queryRunner.query(
        `INSERT INTO curriculo_cargos (nome, ativo, ordem)
         SELECT $1::text, true, 0
         WHERE NOT EXISTS (SELECT 1 FROM curriculo_cargos WHERE nome = $1::text)`,
        [nome]
      );
    }

    // ===== HABILIDADES (Pontos Fortes) =====
    const habilidades = [
      'ATENDIMENTO AO CLIENTE', 'CRIATIVIDADE', 'FLEXIBILIDADE',
      'INTELIGÊNCIA EMOCIONAL', 'LIDERANÇA', 'ORGANIZAÇÃO',
      'PROATIVIDADE', 'TRABALHO EM EQUIPE',
    ];
    for (const nome of habilidades) {
      await queryRunner.query(
        `INSERT INTO curriculo_habilidades (nome, ativo, ordem)
         SELECT $1::text, true, 0
         WHERE NOT EXISTS (SELECT 1 FROM curriculo_habilidades WHERE nome = $1::text)`,
        [nome]
      );
    }

    // ===== TIPOS DE VAGA =====
    // CLT e Menor Aprendiz já vêm por padrão na maioria, mas garantimos
    const tipos = [
      { nome: 'CLT', ordem: 1 },
      { nome: 'Menor Aprendiz', ordem: 2 },
    ];
    for (const t of tipos) {
      await queryRunner.query(
        `INSERT INTO curriculo_tipos_vaga (nome, ativo, ordem)
         SELECT $1::text, true, $2::int
         WHERE NOT EXISTS (SELECT 1 FROM curriculo_tipos_vaga WHERE nome = $1::text)`,
        [t.nome, t.ordem]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Não remove — seed permanece mesmo em rollback
  }
}
