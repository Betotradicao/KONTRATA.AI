# Autosave da Ficha de Admissão pública + paridade de obrigatórios

**Data:** 2026-08-21
**Arquivo:** `packages/frontend/src/pages/AdmissaoPublica.jsx`

## Problema relatado
Candidatos começavam a preencher o link, precisavam sair, e ao voltar **perdiam
tudo**.

## Descoberta importante: o backend JÁ suportava retomar
Não precisou de rota nova. `PUT /rh/fichas-admissao/public/:token` aceita
`{ dados, finalizar }`:
- `finalizar: false` → grava `candidato_dados` **sem mexer no status**
- `GET` da mesma rota devolve `candidato_dados`, e a página já pré-preenchia

O buraco era só de UX: **só salvava se o candidato clicasse "Salvar rascunho"**.
Ninguém clicava.

## Solução
Autosave com debounce de 2s + espelho no `localStorage`.

### A trava que evita perda de dados (não remover)
```js
const [carregado, setCarregado] = useState(false);
useEffect(() => { if (!carregado || finalizado) return; /* ...autosave... */ }, [dados, ...]);
```
Sem o `carregado`, o autosave dispararia com o **state inicial vazio** e
sobrescreveria no servidor tudo que o candidato já tinha preenchido antes.

### Regra do localStorage: servidor vence, exceto se houver coisa não sincronizada
Snapshot gravado como `{ sincronizado: bool, dados }`:
- toda mudança → `sincronizado: false`
- PUT bem-sucedido → `sincronizado: true`
- no load, só restaura do local se `sincronizado === false` (navegador fechou ou
  internet caiu antes do autosave subir)

Assim nunca há "merge" ambíguo entre local e servidor.

`ultimoSalvoRef` guarda o JSON do último payload enviado — evita PUT repetido
quando o state muda por referência mas não por conteúdo.

## ⚠️ Convenção: as DUAS listas de obrigatórios andam juntas
| Onde | Lista |
|---|---|
| Cadastro Geral | `RhCadastroGeral.jsx` → `camposObrigatorios` |
| Link público | `AdmissaoPublica.jsx` → `obrigatorios` (dentro de `finalizar`) |

Se um obrigatório existe no Cadastro Geral **e o candidato é quem preenche**,
ele TEM que estar nas duas. Senão o RH recebe ficha `preenchida` que trava na
hora de criar o colaborador.

**Único furo encontrado em 21/08/2026: `sexo`** — corrigido. Os demais
obrigatórios do Cadastro Geral (matrícula, empresa, cargo, jornada, escala,
regime, setor, admissão, salário) são **do RH**, o candidato nunca vê — por isso
não entram na lista pública.

O link já exige MAIS que o Cadastro Geral no endereço (rua, número, bairro,
cidade, UF) e foto. Isso é proposital, não é divergência a corrigir.

## Tags
#feature #rh #admissao #ux #autosave
