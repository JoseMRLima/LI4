export const permissionModules = [
  { key: 'dashboard', label: 'Dashboard Loja' },
  { key: 'products', label: 'Produtos' },
  { key: 'stock', label: 'Stock Local' },
  { key: 'sales', label: 'Vendas' },
  { key: 'orders', label: 'Encomendas' },
  { key: 'suppliers', label: 'Fornecedores' },
  { key: 'employees', label: 'Funcionários' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'day_closure', label: 'Fecho de Dia' },
  { key: 'users', label: 'Utilizadores' },
  { key: 'promotions', label: 'Promoções' },
  { key: 'audit', label: 'Auditoria' },
  { key: 'stores', label: 'Lojas' },
];

export const defaultPermissions = {
  admin: permissionModules.map((module) => module.key),
  manager: ['dashboard', 'products', 'stock', 'sales', 'orders', 'suppliers', 'employees', 'reports', 'day_closure'],
  cashier: [],
};

export const roleLabels = {
  admin: 'Admin',
  manager: 'Gerente',
  cashier: 'Caixa',
};

export function getRolePermissions(role) {
  return defaultPermissions[role] || [];
}

export function hasModuleAccess(role, moduleKey) {
  return getRolePermissions(role).includes(moduleKey);
}
