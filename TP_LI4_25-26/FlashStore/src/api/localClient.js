/**
 * FlashStore — Cliente API
 *
 * Centraliza todos os pedidos HTTP ao servidor Express (porta 3001).
 * Expõe a interface usada por todas as páginas React:
 *   api.entities.Product.list()
 *   api.entities.Sale.create(data)
 *   api.auth.me()
 */

// Browser/Vite dev: proxy `/api` → Express. Electron dist / API remota: VITE_API_URL=http://host:3001
const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = API_ROOT ? `${API_ROOT}/api` : '/api';

// ─────────────────────────────────────────────
// Gestão do token JWT (localStorage)
// ─────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('flashstore_token');
}
function setToken(t) {
  if (t) localStorage.setItem('flashstore_token', t);
  else localStorage.removeItem('flashstore_token');
}

// ─────────────────────────────────────────────
// Cache do perfil de utilizador para modo offline
// ─────────────────────────────────────────────
function getCachedUser() {
  try {
    const raw = localStorage.getItem('flashstore_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setCachedUser(user) {
  if (user) localStorage.setItem('flashstore_user', JSON.stringify(user));
  else localStorage.removeItem('flashstore_user');
}

// TypeError = connection refused (servidor completamente down)
// status >= 500 = Vite proxy devolve 500 quando o target está inacessível
function isNetworkError(err) {
  return err instanceof TypeError || (err.status != null && err.status >= 500);
}

// ─────────────────────────────────────────────
// Função base de pedidos HTTP
// ─────────────────────────────────────────────
async function request(method, path, body = null) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401) {
    // Token expirado → limpar e redirecionar para login
    setToken(null);
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Erro na API'), { status: res.status, data: err });
  }

  return res.json();
}

// ─────────────────────────────────────────────
// Factory de entidade
// Cria um objecto com list(), filter(), create(), update(), delete()
// ─────────────────────────────────────────────
function makeEntity(endpoint) {
  return {
    /**
     * list(sortField, limit)
     * Nota: o servidor ordena por defecto; limit é ignorado aqui
     * mas mantemos a assinatura para compatibilidade
     */
    async list(_sort, limit) {
      const q = limit ? `?limit=${limit}` : '';
      return request('GET', `/${endpoint}${q}`);
    },

    /**
     * filter(conditions)
     * Converte { is_active: true } → ?is_active=true
     */
    async filter(conditions = {}) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(conditions)) {
        params.append(k, String(v));
      }
      const q = params.toString() ? `?${params.toString()}` : '';
      return request('GET', `/${endpoint}${q}`);
    },

    async get(id) {
      return request('GET', `/${endpoint}/${id}`);
    },

    async create(data) {
      return request('POST', `/${endpoint}`, data);
    },

    async update(id, data) {
      return request('PUT', `/${endpoint}/${id}`, data);
    },

    async delete(id) {
      return request('DELETE', `/${endpoint}/${id}`);
    },
  };
}

// ─────────────────────────────────────────────
// Módulo de autenticação local
// ─────────────────────────────────────────────
const auth = {
  async login(email, password) {
    const data = await request('POST', '/auth/login', { email, password });
    setToken(data.token);
    setCachedUser(data.user);
    return data.user;
  },

  async me() {
    return request('GET', '/auth/me');
  },

  logout(redirectUrl) {
    setToken(null);
    // Não apagamos o perfil em cache — permite re-login offline com o mesmo email
    window.location.href = redirectUrl || '/login';
  },

  // Redireciona para a nossa página de login local
  redirectToLogin(fromUrl) {
    const next = fromUrl ? `?next=${encodeURIComponent(fromUrl)}` : '';
    window.location.href = `/login${next}`;
  },

  isAuthenticated() {
    return !!getToken();
  },

  getCachedUser,
  isNetworkError,
};

// ─────────────────────────────────────────────
// Helpers especializados para os novos endpoints
// ─────────────────────────────────────────────
const dashboard = {
  store(storeName, opts = {}) {
    const params = new URLSearchParams();
    if (opts.date) params.set('date', opts.date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request('GET', `/dashboard/store/${encodeURIComponent(storeName)}${query}`);
  },
  global(opts = {}) {
    const params = new URLSearchParams();
    if (opts.date) params.set('date', opts.date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request('GET', `/dashboard/global${query}`);
  },
};

const audit = {
  list(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request('GET', `/audit-logs${query}`);
  },
};

const dayClosures = {
  list(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request('GET', `/day-closures${query}`);
  },
  get(store, date) {
    return request('GET', `/day-closures/${encodeURIComponent(store)}/${date}`);
  },
  create(data) {
    return request('POST', '/day-closures', data);
  },
  reopen(id, reason) {
    return request('POST', `/day-closures/${id}/reopen`, { reason });
  },
};

const returns = {
  forSale(saleId) {
    return request('GET', `/sales/${saleId}/returns`);
  },
  create(saleId, data) {
    return request('POST', `/sales/${saleId}/return`, data);
  },
};

const reports = {
  daily(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request('GET', `/sales/daily-report${query}`);
  },
  comparative(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request('GET', `/reports/comparative${query}`);
  },
};

const shifts = {
  getActive(store, posTerminalId) {
    const params = new URLSearchParams({ store, pos_terminal_id: posTerminalId });
    return request('GET', `/shift-closures/active?${params}`);
  },
  myOpen(store) {
    return request('GET', `/shift-closures/my-open?${new URLSearchParams({ store })}`);
  },
  open(data) {
    return request('POST', '/shift-closures/open', data);
  },
  cashSummary(shiftId) {
    return request('GET', `/shift-closures/${shiftId}/cash-summary`);
  },
};

const registerFloats = {
  list(store, businessDate) {
    const q = new URLSearchParams({ store, business_date: businessDate });
    return request('GET', `/register-opening-floats?${q}`);
  },
  set(data) {
    return request('POST', '/register-opening-floats', data);
  },
};

const cashDrops = {
  list(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request('GET', `/cash-drops${query}`);
  },
  create(data) {
    return request('POST', '/cash-drops', data);
  },
  setStatus(id, status) {
    return request('PUT', `/cash-drops/${id}`, { status });
  },
};

const posTerminals = {
  list(store, { includeInactive = false } = {}) {
    const params = new URLSearchParams({ store });
    if (includeInactive) params.set('include_inactive', '1');
    return request('GET', `/pos-terminals?${params}`);
  },
  create(data) {
    return request('POST', '/pos-terminals', data);
  },
  update(id, data) {
    return request('PUT', `/pos-terminals/${id}`, data);
  },
};

async function downloadSaft({ from, to, store } = {}) {
  const token = getToken();
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (store) params.set('store', store);
  const url = `${API_BASE}/saft/export?${params.toString()}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Erro ao exportar SAFT-PT'), { status: res.status });
  }
  return res.blob();
}

// Utilidade para mensagens de erro consistentes em PT
export function formatApiError(err, fallback = 'Ocorreu um erro inesperado.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.data?.error) return err.data.error;
  if (err.message && err.message !== 'Erro na API') return err.message;
  return fallback;
}

// ─────────────────────────────────────────────
// Exportação principal — compatível com o SDK
// ─────────────────────────────────────────────
export const api = {
  auth,
  dashboard,
  audit,
  dayClosures,
  returns,
  reports,
  shifts,
  registerFloats,
  cashDrops,
  posTerminals,
  saft: { download: downloadSaft },
  admin: {
    franchiseProducts() {
      return request('GET', '/admin/franchise-products');
    },
    updateStockMinimum(data) {
      return request('PUT', '/admin/stock-minimum', data);
    },
    createCategory(data) {
      return request('POST', '/admin/categories', data);
    },
    updateCategory(id, data) {
      return request('PUT', `/admin/categories/${id}`, data);
    },
    deleteCategory(id) {
      return request('DELETE', `/admin/categories/${id}`);
    },
  },
  entities: {
    Category: makeEntity('categories'),
    Product:           makeEntity('products'),
    Sale:              makeEntity('sales'),
    Stock:             makeEntity('stock'),
    Supplier:          makeEntity('suppliers'),
    Promotion:         makeEntity('promotions'),
    User:              makeEntity('users'),
    Store:             makeEntity('stores'),
    ShiftClosure:      makeEntity('shift-closures'),
    SupplierOrder:     makeEntity('supplier-orders'),
    MerchandiseEntry:  makeEntity('merchandise-entries'),
    DayClosure:        makeEntity('day-closures'),
  },
};

export default api;
