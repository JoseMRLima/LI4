const LS_KEY = 'flashstore_pos_terminal';

/**
 * Último caixa seleccionado no browser (fallback até existir instalação por POS).
 * A lista válida de códigos vem da API `pos-terminals` por loja.
 */
export function getPosTerminalId() {
  const env = import.meta.env?.VITE_POS_TERMINAL_ID;
  if (env && String(env).trim()) return String(env).trim();
  const stored = localStorage.getItem(LS_KEY);
  if (stored && stored.trim()) return stored.trim();
  return '';
}

export function setPosTerminalId(id) {
  if (id && String(id).trim()) localStorage.setItem(LS_KEY, String(id).trim());
}
