import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rh_empresas')
export class RhEmpresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nome_fantasia', nullable: true })
  nomeFantasia?: string;

  @Column({ name: 'razao_social', nullable: true })
  razaoSocial?: string;

  @Column({ nullable: true })
  cnpj?: string;

  @Column({ name: 'cod_loja', type: 'int', nullable: true })
  codLoja: number | null;

  @Column({ type: 'varchar', nullable: true })
  apelido: string | null;

  @Column({ name: 'is_principal', type: 'boolean', default: false })
  isPrincipal: boolean;

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

  // Coords geocodadas do CEP da loja (pra distancia residencia->loja). Ver GeocodeService.
  @Column({ type: 'double precision', nullable: true })
  latitude?: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude?: number | null;

  @Column({ name: 'geo_cep', type: 'varchar', length: 9, nullable: true })
  geoCep?: string | null;

  @Column({ name: 'geo_updated_at', type: 'timestamptz', nullable: true })
  geoUpdatedAt?: Date | null;

  @Column({ nullable: true })
  telefone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ default: true })
  active: boolean;

  // Quando true, esconde a empresa da pagina publica de candidatura
  // (usada para "filiais" criadas so pra guardar documentos, sem vaga real).
  @Column({ name: 'oculto_recrutamento', type: 'boolean', default: false })
  ocultoRecrutamento: boolean;

  @Column({ name: 'foto_fachada_url', type: 'text', nullable: true })
  fotoFachadaUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
