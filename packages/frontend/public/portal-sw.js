// Service worker mínimo do Portal do Colaborador: existe só pra o Chrome/Android
// oferecer "Instalar app". NÃO guarda nada em cache — holerite é dado pessoal e
// tem que vir sempre do servidor (com o token do colaborador).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* passa direto pra rede */ });
