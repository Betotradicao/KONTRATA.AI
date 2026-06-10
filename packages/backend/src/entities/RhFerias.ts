import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rh_ferias')
export class RhFerias {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'colaborador_id', type: 'int' })
  colaboradorId: number;

  @Column({ name: 'periodo_aquisitivo_inicio', type: 'date' })
  periodoAquisitivoInicio: string;

  @Column({ name: 'periodo_aquisitivo_fim', type: 'date' })
  periodoAquisitivoFim: string;

  @Column({ name: 'periodo_concessivo_inicio', type: 'date' })
  periodoConcessivoInicio: string;

  @Column({ name: 'periodo_concessivo_fim', type: 'date' })
  periodoConcessivoFim: string;

  @Column({ name: 'data_programada', type: 'date', nullable: true })
  dataProgramada: string | null;

  @Column({ name: 'data_inicio_gozo', type: 'date', nullable: true })
  dataInicioGozo: string | null;

  @Column({ name: 'data_fim_gozo', type: 'date', nullable: true })
  dataFimGozo: string | null;

  @Column({ name: 'dias_gozados', type: 'int', default: 0 })
  diasGozados: number;

  @Column({ name: 'abono_pecuniario_dias', type: 'int', default: 0 })
  abonoPecuniarioDias: number;

  // 'pendente' | 'programada' | 'em_gozo' | 'gozada'
  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: string;

  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
