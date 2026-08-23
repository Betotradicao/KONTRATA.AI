import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { iniciarAnalytics } from './analytics';
import Home from './pages/Home';
import Treinamento from './pages/Treinamento';
import Admin from './admin/Admin';

iniciarAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/treinamento" element={<Treinamento />} />
        <Route path="/admin" element={<Admin />} />
        {/* Qualquer outra rota cai na home, igual ao site original */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
