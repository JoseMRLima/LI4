# FlashStore

Sistema de gestão integrada para uma cadeia de lojas de conveniência.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui + TanStack Query
- **Backend:** Node.js + Express + SQLite (better-sqlite3) + JWT
- **Desktop:** Electron (modo offline com SQLite local via sql.js)

## Iniciar

```bash
# Instalar dependências
npm install
cd server && npm install && cd ..

# Inicializar base de dados
cd server && node seed.js && cd ..

# Iniciar servidor + frontend + Electron
npm run electron:dev:all
```

## Testes

```bash
cd server && npm test
```
