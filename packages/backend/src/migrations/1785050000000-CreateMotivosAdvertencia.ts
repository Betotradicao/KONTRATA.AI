import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cadastro de motivos/embasamentos para os documentos de ADVERTÊNCIA (fase 4
 * dos docs padronizados). Cada motivo tem um nome curto (ex: "Desídia") + um
 * texto longo que entra no doc + o embasamento legal (ex: "Art. 482, alínea
 * 'e' da CLT").
 *
 * O RH escolhe o motivo no momento de gerar a advertência pro colaborador.
 * A variável $MOTIVO_ADVERTENCIA$ no template do doc é substituída pelo
 * texto + embasamento.
 *
 * Seed inicial: as 12 hipóteses do Art. 482 da CLT (a-l) + parágrafo único.
 * O RH pode editar/criar novos livremente.
 */
export class CreateMotivosAdvertencia1785050000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_motivos_advertencia (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        texto TEXT NOT NULL,
        artigo VARCHAR(150) NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_motivos_advertencia_ativo ON rh_motivos_advertencia(ativo)`);

    // Seed Art. 482 da CLT (justa causa por iniciativa do empregador)
    const seed = [
      { ordem: 1,  nome: 'Improbidade',                         artigo: 'Art. 482, "a", CLT', texto: 'ato de improbidade (desonestidade, fraude, mau caráter)' },
      { ordem: 2,  nome: 'Incontinência / mau procedimento',    artigo: 'Art. 482, "b", CLT', texto: 'incontinência de conduta ou mau procedimento (conduta incabível)' },
      { ordem: 3,  nome: 'Negociação habitual / concorrência',  artigo: 'Art. 482, "c", CLT', texto: 'negociação habitual por conta própria ou alheia sem permissão do empregador, quando constituir ato de concorrência à empresa para a qual trabalha o empregado, ou for prejudicial ao serviço' },
      { ordem: 4,  nome: 'Condenação criminal',                 artigo: 'Art. 482, "d", CLT', texto: 'condenação criminal do empregado, passada em julgado, caso não tenha havido suspensão da execução da pena' },
      { ordem: 5,  nome: 'Desídia',                             artigo: 'Art. 482, "e", CLT', texto: 'desídia no desempenho das respectivas funções' },
      { ordem: 6,  nome: 'Embriaguez habitual ou em serviço',   artigo: 'Art. 482, "f", CLT', texto: 'embriaguez habitual ou em serviço' },
      { ordem: 7,  nome: 'Violação de segredo da empresa',      artigo: 'Art. 482, "g", CLT', texto: 'violação de segredo da empresa' },
      { ordem: 8,  nome: 'Indisciplina ou insubordinação',      artigo: 'Art. 482, "h", CLT', texto: 'ato de indisciplina ou de insubordinação' },
      { ordem: 9,  nome: 'Abandono de emprego',                 artigo: 'Art. 482, "i", CLT', texto: 'abandono de emprego' },
      { ordem: 10, nome: 'Ofensa contra terceiros',             artigo: 'Art. 482, "j", CLT', texto: 'ato lesivo da honra ou da boa fama praticado no serviço contra qualquer pessoa, ou ofensas físicas, nas mesmas condições, salvo em caso de legítima defesa, própria ou de outrem' },
      { ordem: 11, nome: 'Ofensa contra empregador',            artigo: 'Art. 482, "k", CLT', texto: 'ato lesivo da honra ou da boa fama ou ofensas físicas praticadas contra o empregador e superiores hierárquicos, salvo em caso de legítima defesa, própria ou de outrem' },
      { ordem: 12, nome: 'Jogos de azar',                       artigo: 'Art. 482, "l", CLT', texto: 'prática constante de jogos de azar' },
      // Casos típicos de ADVERTÊNCIA (não justa causa direta — base pra disciplina progressiva)
      { ordem: 20, nome: 'Atraso ou falta sem justificativa',   artigo: 'CLT, art. 482, "e" (desídia)',  texto: 'não cumprimento integral da jornada de trabalho, especialmente no que se refere ao descumprimento do horário estabelecido pela empresa, bem como faltas injustificadas, sem a devida comunicação ou autorização do superior hierárquico' },
      { ordem: 21, nome: 'Descumprimento de normas internas',   artigo: 'Regulamento Interno da empresa', texto: 'descumprimento das normas e procedimentos previstos no Regulamento Interno da empresa' },
      { ordem: 22, nome: 'Uso indevido de EPI',                 artigo: 'NR-6 / Regulamento Interno',     texto: 'descumprimento do uso obrigatório de Equipamentos de Proteção Individual (EPIs) durante o serviço' },
    ];
    for (const m of seed) {
      await queryRunner.query(
        `INSERT INTO rh_motivos_advertencia (ordem, nome, texto, artigo) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [m.ordem, m.nome, m.texto, m.artigo]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_motivos_advertencia`);
  }
}
