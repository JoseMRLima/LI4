# FlashStore

**Nota:** 16 — Sistema de Gestão de Ponto de Venda

Projeto desenvolvido no âmbito da UC **Laboratórios de Informática IV (LI4)** — Licenciatura em Engenharia Informática, **Universidade do Minho**, ano letivo 2025/2026.

---

## Sobre o Projeto

**FlashStore** é um sistema de gestão integrada para uma cadeia regional de lojas de conveniência. Suporta operação em modo híbrido: as lojas funcionam de forma autónoma com base de dados local (SQLite) e sincronizam com o servidor central quando a ligação está disponível.

O desenvolvimento foi fortemente assistido por LLMs (Claude e GitHub Copilot) em todas as fases — requisitos, arquitetura, implementação e revisão de código — seguindo a metodologia documentada no relatório.

---

## Equipa

| Número | Nome | Função |
|---|---|---|
| A106842 | Gonçalo Ribeiro | Coordenador |
| A100753 | Rui Castro | Engenheiro de Software |
| A106888 | José Lima | Analista |
| A106923 | Eduardo Freitas | Engenheiro de Software |
| A106924 | Diogo Cardoso | Testador |

---

## Arquitetura

O sistema divide-se em três camadas:

| Camada | Tecnologias | Descrição |
|---|---|---|
| **Servidor** | Express 4, SQLite (better-sqlite3), JWT, bcryptjs | API REST central com autenticação, lógica de negócio e base de dados partilhada |
| **Web** | React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Router v6, Recharts | Backoffice para gerentes e administradores (browser) |
| **Electron** | Electron 34, SQLite local, outbox de sincronização | Aplicação desktop para operadores de caixa — funciona offline, sincroniza automaticamente |

### Três perfis de utilizador

- **Administrador** — gestão global de lojas, utilizadores e relatórios consolidados
- **Gerente** — backoffice da loja (produtos, stock, encomendas, fechos de dia, relatórios)
- **Caixeiro** — terminal de ponto de venda com suporte offline

---

## Estrutura do Repositório

```
LI4-TP-2526/
├── FlashStore/              ← Código fonte da aplicação
│   ├── src/                 ← Frontend React (páginas, componentes, lib)
│   ├── server/              ← Backend Express + SQLite
│   ├── electron/            ← Processo principal Electron + IPC + SQLite local
│   └── package.json
├── SETUP.md                 ← Guia de instalação e execução
├── Relatorio.pdf            ← Relatório do projeto
└── resources/               ← Recursos auxiliares (diagramas, etc.)
```

---

## Execução Rápida

Ver [SETUP.md](./SETUP.md) para instruções completas. Em resumo:

```bash
# 1. Servidor (porta 3001)
cd FlashStore/server && npm install && node seed.js && npm run dev

# 2. Web — browser (porta 5173)
cd FlashStore && npm install && npm run dev

# 3. Electron — POS desktop (porta 5174)
cd FlashStore && npm run electron:dev:5174
```

---

## Credenciais de Demonstração

Todas as contas têm password `123456`.

| Perfil | Email | Loja |
|---|---|---|
| Administrador | `admin@flashstore.pt` | Sede |
| Gerente | `gerente.braga@flashstore.pt` | Braga Centro |
| Gerente | `gerente.gualtar@flashstore.pt` | Gualtar |
| Caixeiro | `caixa1.braga@flashstore.pt` | Braga Centro |
| Caixeiro | `caixa1.gualtar@flashstore.pt` | Gualtar |
