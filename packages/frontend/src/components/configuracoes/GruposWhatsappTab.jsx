import { useState } from 'react';
import VagasAbertasWhatsTab from './VagasAbertasWhatsTab';
import SaudeOcupacionalWhatsTab from './SaudeOcupacionalWhatsTab';
import DenunciaNr1WhatsTab from './DenunciaNr1WhatsTab';
import DepartamentoPessoalWhatsTab from './DepartamentoPessoalWhatsTab';
import AniversarioWhatsTab from './AniversarioWhatsTab';
import DisparoVagasWhatsTab from './DisparoVagasWhatsTab';
import EncarteWhatsTab from './EncarteWhatsTab';
import BancoHorasWhatsTab from './BancoHorasWhatsTab';

const SUBABAS = [
  { id: 'disparo_vagas', label: '📣 Disparo de Vagas' },
  { id: 'vagas', label: '💼 Vagas em Aberto' },
  { id: 'aso', label: '🩺 Saúde Ocupacional' },
  { id: 'denuncia', label: '🚨 Denúncia NR1' },
  { id: 'dp', label: '📁 Departamento Pessoal' },
  { id: 'aniversario', label: '🎉 Aniversariantes' },
  { id: 'encarte', label: '🖼️ Encartes de Vaga' },
  { id: 'banco_horas', label: '🏦 Banco de Horas' },
];

export default function GruposWhatsappTab() {
  const [sub, setSub] = useState('disparo_vagas');

  return (
    <div className="space-y-5">
      {/* Sub-abas */}
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {SUBABAS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              sub === s.id ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'disparo_vagas' && <DisparoVagasWhatsTab />}
      {sub === 'vagas' && <VagasAbertasWhatsTab />}
      {sub === 'aso' && <SaudeOcupacionalWhatsTab />}
      {sub === 'denuncia' && <DenunciaNr1WhatsTab />}
      {sub === 'dp' && <DepartamentoPessoalWhatsTab />}
      {sub === 'aniversario' && <AniversarioWhatsTab />}
      {sub === 'encarte' && <EncarteWhatsTab />}
      {sub === 'banco_horas' && <BancoHorasWhatsTab />}
    </div>
  );
}
