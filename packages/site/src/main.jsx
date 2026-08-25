import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { iniciarAnalytics } from './analytics';
import { TextosProvider } from './textos';
import Home from './pages/Home';
import Treinamento from './pages/Treinamento';
import Admin from './admin/Admin';

// busca o ID no painel antes de carregar a medicao; nao trava a renderizacao
iniciarAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TextosProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/treinamento" element={<Treinamento />} />
          <Route path="/admin" element={<Admin />} />
          {/* Qualquer outra rota cai na home, igual ao site original */}
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </TextosProvider>
  </React.StrictMode>
);
