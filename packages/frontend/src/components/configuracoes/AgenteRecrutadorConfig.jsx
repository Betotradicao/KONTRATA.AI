import RhRecrutadorIA from '../../pages/RhRecrutadorIA';

// Embute a pagina completa do Recrutador IA dentro da aba.
// Inclui Treinar Entrevistadora, Vagas e Criterios, Banco de Perguntas,
// Enviar Entrevista e Entrevistas Realizadas.
export default function AgenteRecrutadorConfig() {
  return (
    <div className="-mx-6 -my-2">
      <RhRecrutadorIA embedded />
    </div>
  );
}
