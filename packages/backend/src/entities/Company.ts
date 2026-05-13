import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nome_fantasia' })
  nomeFantasia: string;

  @Column({ name: 'razao_social', nullable: true })
  razaoSocial?: string;

  @Column({ nullable: true })
  cnpj?: string;

  @Column({ nullable: true })
  identificador?: string;

  @Column({ name: 'cod_loja', type: 'int', nullable: true })
  codLoja: number | null;

  @Column({ type: 'varchar', nullable: true })
  apelido: string | null;

  @Column({ name: 'responsavel_nome', nullable: true })
  responsavelNome?: string;

  @Column({ name: 'responsavel_email', nullable: true })
  responsavelEmail?: string;

  @Column({ name: 'responsavel_telefone', nullable: true })
  responsavelTelefone?: string;

  @Column({ nullable: true })
  cep?: string;

  @Column({ nullable: true })
  rua?: string;

  @Column({ nullable: true })
  numero?: string;

  @Column({ nullable: true })
  complemento?: string;

  @Column({ nullable: true })
  bairro?: string;

  @Column({ nullable: true })
  cidade?: string;

  @Column({ nullable: true })
  estado?: string;

  @Column({ nullable: true })
  telefone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'foto_fachada_url', type: 'text', nullable: true })
  fotoFachadaUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
