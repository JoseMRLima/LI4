# FlashStore — Guia de Instalação e Execução

---

## Pré-requisitos

```bash
node --version   # v18 ou superior
npm --version    # qualquer versão recente
```

Se não tens Node.js: https://nodejs.org (descarrega a versão LTS)

---

## 1. Servidor

O servidor Express corre na porta **3001** e é necessário para todos os modos (web e Electron).

```bash
cd FlashStore/server
npm install
```

### Popular a base de dados (primeira vez)

```bash
node seed.js
```

Deves ver:
```
✅ 26 utilizadores criados (password: 123456)
✅ 4 fornecedores criados
✅ 20 produtos criados
✅ stock criado por loja
✅ vendas de exemplo criadas
```

### Arrancar o servidor

```bash
npm run dev
```

```
✅ Base de dados SQLite inicializada em: .../server/flashstore.db
✅ FlashStore API a correr em http://localhost:3001
```

> Mantém este terminal aberto durante toda a sessão.

---

## 2. Web (browser)

Interface backoffice para gerentes e administradores. Requer o servidor a correr.

```bash
cd FlashStore
npm install
npm run dev
```

Abre **http://localhost:5173** no browser.

```
  VITE v6.x.x  ready

  ➜  Local:   http://localhost:5173/
```

---

## 3. Electron (aplicação POS)

Terminal de ponto de venda com suporte offline. Corre numa janela desktop separada. Requer o servidor a correr.

```bash
cd FlashStore
npm run electron:dev:5174
```

Este comando arranca o Vite na porta **5174** e abre a janela Electron automaticamente. Usa a porta 5174 para não colidir com a sessão web (5173) se ambas estiverem abertas em simultâneo.

```
[vite]     VITE v6.x.x  ready
[vite]     ➜  Local:   http://localhost:5174/
[electron] FlashStore — Dev
```

> Para testar em simultâneo a interface web (gerente) e o POS (caixeiro), arranca os dois:
> ```bash
> # Terminal 1 — servidor
> cd FlashStore/server && npm run dev
>
> # Terminal 2 — web
> cd FlashStore && npm run dev
>
> # Terminal 3 — Electron
> cd FlashStore && npm run electron:dev:5174
> ```

---

## Credenciais de acesso

Todas as contas têm password `123456`.

| Perfil | Email | Loja |
|---|---|---|
| Administrador | `admin@flashstore.pt` | Sede |
| Gerente | `gerente.braga@flashstore.pt` | Braga Centro |
| Gerente | `gerente.gualtar@flashstore.pt` | Gualtar |
| Gerente | `gerente.guim@flashstore.pt` | Guimarães |
| Gerente | `gerente.barc@flashstore.pt` | Barcelos |
| Gerente | `gerente.povoa@flashstore.pt` | Póvoa de Lanhoso |
| Gerente | `gerente.vnf@flashstore.pt` | Vila Nova de Famalicão |
| Gerente | `gerente.espo@flashstore.pt` | Esposende |
| Gerente | `gerente.vizela@flashstore.pt` | Vizela |
| Caixeiro | `caixa1.braga@flashstore.pt` | Braga Centro |
| Caixeiro | `caixa2.braga@flashstore.pt` | Braga Centro |
| Caixeiro | `caixa1.gualtar@flashstore.pt` | Gualtar |
| Caixeiro | `caixa2.gualtar@flashstore.pt` | Gualtar |
| Caixeiro | `caixa1.guim@flashstore.pt` | Guimarães |
| Caixeiro | `caixa1.espo@flashstore.pt` | Esposende |

---

## Estrutura do projeto

```
FlashStore/
├── src/                          ← Frontend React
│   ├── pages/
│   │   ├── Login.jsx             ← Login local com JWT
│   │   ├── cashier/CashierPOS.jsx← Terminal de venda (PDV)
│   │   ├── manager/              ← Backoffice do gerente (9 páginas)
│   │   └── admin/                ← Backoffice do administrador
│   ├── components/
│   │   ├── cashier/              ← Componentes do PDV
│   │   ├── backoffice/           ← Componentes partilhados de backoffice
│   │   └── layout/               ← Layouts (ManagerLayout, ManagerSidebar, etc.)
│   └── lib/
│       ├── AuthContext.jsx        ← Autenticação JWT local
│       ├── connectivity.js        ← Deteção de conectividade
│       ├── outboxSync.js          ← Sincronização offline → servidor
│       └── localCatalogSync.js    ← Sincronização do catálogo local
│
├── server/                       ← Backend Express + SQLite
│   ├── index.js                  ← API REST (todos os endpoints)
│   ├── database.js               ← Schema e inicialização SQLite
│   ├── seed.js                   ← Dados de demonstração
│   ├── saft.js                   ← Exportação SAF-T PT
│   └── syncPush.js               ← Receção do outbox offline
│
├── electron/                     ← Processo principal Electron
│   ├── main.cjs                  ← Janela principal + ciclo de vida
│   ├── preload.cjs               ← Bridge segura React ↔ Electron
│   ├── db/localDb.cjs            ← SQLite local por loja
│   └── ipc/dbHandlers.cjs        ← Handlers IPC (vendas, turnos, catálogo)
│
├── vite.config.js                ← Proxy /api → localhost:3001
└── package.json                  ← Scripts de arranque
```

---
