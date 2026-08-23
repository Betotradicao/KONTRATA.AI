import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Nomes com hash: garante que o navegador do visitante nao sirva bundle
    // velho depois de um deploy (a mesma dor que ja tivemos no app dos clientes).
    assetsDir: 'assets',
  },
});
