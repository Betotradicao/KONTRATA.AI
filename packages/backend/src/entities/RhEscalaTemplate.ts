import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rh_escala_templates')
export class RhEscalaTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'colaborador_id', type: 'int' })
  colaboradorId: number;

  @Column({ name: 'tipo_rotacao', length: 30, default: '6x1' })
  tipoRotacao: string;

  @Column({ name: 'folga_preferida', type: 'varchar', length: 30, nullable: true })
  folgaPreferida: string | null;

  @Column({ name: 'trabalha_feriado', default: true })
  trabalhaFeriado: boolean;

  // padrao_semanal: array de semanas, cada semana = array de 7 turnoIds (dom..sab) ou null
  // ex: [ [null, "uuidTM", "uuidTM", "uuidFG", "uuidTM", "uuidTM", "uuidTM"], [... sem2] ]
  @Column({ name: 'padrao_semanal', type: 'jsonb', default: () => "'[]'" })
  padraoSemanal: (string | null)[][];

  @Column({ name: 'vigencia_inicio', type: 'date', nullable: true })
  vigenciaInicio: string | null;

  @Column({ name: 'vigencia_fim', type: 'date', nullable: true })
  vigenciaFim: string | null;

  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @Column({ default: true })
  ativo: boolean;

  // === Configuracao avancada do pre-preencher automatico (Fase 1+2) ===
  // tipo_folga: 'FIXA' (sempre no mesmo dia da semana) | 'ROTATIVA' (gira)
  @Column({ name: 'tipo_folga', type: 'varchar', length: 10, nullable: true })
  tipoFolga: string | null;

  // dia_folga_fixa: 0=Dom, 1=Seg, ..., 6=Sab — usado quando tipo_folga='FIXA'
  @Column({ name: 'dia_folga_fixa', type: 'int', nullable: true })
  diaFolgaFixa: number | null;

  // dia_folga_fixa_2: segundo dia de folga semanal (usado em 5x2 — sab + dom)
  @Column({ name: 'dia_folga_fixa_2', type: 'int', nullable: true })
  diaFolgaFixa2: number | null;

  // data_ref_folga: ultima folga conhecida quando tipo_folga='ROTATIVA',
  // pra projetar as proximas a cada 6/7 dias.
  @Column({ name: 'data_ref_folga', type: 'date', nullable: true })
  dataRefFolga: string | null;

  // rotacao_domingo: 'sempre' (trabalha todo dom) | 'nunca' | '1x1' (alternado)
  // | '2x1' (trab 2, folga 1) | '3x1' | 'mensal_1' | 'mensal_2' | 'mensal_3'
  @Column({ name: 'rotacao_domingo', type: 'varchar', length: 20, nullable: true })
  rotacaoDomingo: string | null;

  // data_ref_domingo: ultimo domingo de FOLGA conhecido (pra rodar 2x1, 1x1)
  @Column({ name: 'data_ref_domingo', type: 'date', nullable: true })
  dataRefDomingo: string | null;

  // turno_*_id: turno padrao por tipo de dia. Permite ter turno diferente
  // pra sabado/domingo (geralmente reduzido).
  @Column({ name: 'turno_padrao_id', type: 'uuid', nullable: true })
  turnoPadraoId: string | null;

  @Column({ name: 'turno_sabado_id', type: 'uuid', nullable: true })
  turnoSabadoId: string | null;

  @Column({ name: 'turno_domingo_id', type: 'uuid', nullable: true })
  turnoDomingoId: string | null;

  // feriado_comportamento: 'trabalha' | 'folga' | 'compensa'
  @Column({ name: 'feriado_comportamento', type: 'varchar', length: 15, nullable: true })
  feriadoComportamento: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
