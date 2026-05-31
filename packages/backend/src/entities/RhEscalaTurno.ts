import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rh_escala_turnos')
export class RhEscalaTurno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ length: 20 })
  codigo: string;

  @Column({ length: 100 })
  nome: string;

  @Column({ name: 'hora_inicio', type: 'time', nullable: true })
  horaInicio: string | null;

  @Column({ name: 'hora_fim', type: 'time', nullable: true })
  horaFim: string | null;

  @Column({ name: 'total_horas', type: 'numeric', precision: 5, scale: 2, nullable: true })
  totalHoras: number | null;

  @Column({ name: 'pausa_minutos', type: 'int', default: 0 })
  pausaMinutos: number;

  @Column({ name: 'pausa_inicio', type: 'time', nullable: true })
  pausaInicio: string | null;

  @Column({ name: 'pausa_fim', type: 'time', nullable: true })
  pausaFim: string | null;

  @Column({ length: 20, default: 'turno' })
  tipo: string; // turno | folga | ferias | feriado | licenca

  @Column({ type: 'varchar', length: 7, nullable: true })
  cor: string | null;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
