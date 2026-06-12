import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sector } from './Sector';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Column({ name: 'sector_id' })
  sector_id: number;

  @ManyToOne(() => Sector)
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;

  @Column({ type: 'varchar', length: 255 })
  function_description: string;

  @Column({ type: 'varchar', unique: true, length: 100, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'boolean', default: true })
  first_access: boolean;

  @Column({ type: 'varchar', unique: true, length: 50, nullable: true })
  barcode: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', nullable: true })
  cod_loja: number | null;

  // Lojas a que o colaborador tem acesso (multi-loja). cod_loja segue como a loja
  // principal/primeira pra compatibilidade com logica antiga.
  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  cod_lojas: number[] | null;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role_kontrata: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email_recuperacao: string | null;

  @Column({ type: 'boolean', default: false })
  is_conferente: boolean;

  @Column({ type: 'boolean', default: false })
  is_cpd: boolean;

  @Column({ type: 'boolean', default: false })
  is_financeiro: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
