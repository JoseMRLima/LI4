import React, { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

function ProductCardImage({ url, category }) {
  const [failed, setFailed] = useState(false);
  const icon = CATEGORY_ICONS[category] || '📦';
  if (!url || failed) return <span className="text-5xl select-none">{icon}</span>;
  return (
    <img
      src={url}
      className="w-full h-full object-contain p-1"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

const CATEGORY_ICONS = {
  'Bebidas':     '🥤',
  'Snacks':      '🍿',
  'Tabaco':      '🚬',
  'Lacticínios': '🥛',
  'Padaria':     '🥐',
  'Congelados':  '❄️',
  'Higiene':     '🧴',
  'Limpeza':     '🧹',
  'Outros':      '📦',
};

function getActivePromo(product, promotions, store) {
  const today = new Date().toISOString().split('T')[0];
  return promotions.find((promo) => {
    if (!promo.is_active) return false;
    if (promo.start_date > today || promo.end_date < today) return false;
    // Filtro de scope por loja
    const storeList = Array.isArray(promo.applies_to_stores_list)
      ? promo.applies_to_stores_list
      : promo.applies_to_stores
        ? (() => { try { return JSON.parse(promo.applies_to_stores); } catch { return null; } })()
        : null;
    if (Array.isArray(storeList) && storeList.length > 0 && store && !storeList.includes(store)) return false;
    if (promo.applies_to === 'chain') return true;
    if (promo.applies_to === 'store') return Array.isArray(storeList) && storeList.includes(store);
    if (promo.applies_to === 'product') return promo.target_id === product.id;
    if (promo.applies_to === 'category') return promo.target_name === product.category;
    return false;
  }) || null;
}

function applyPromo(price, promo) {
  if (!promo) return price;
  if (promo.type === 'percentage') return Math.max(0, price * (1 - promo.value / 100));
  if (promo.type === 'fixed') return Math.max(0, price - promo.value);
  return price;
}

export default function ProductGrid({ products, onAddToCart, onUpdateQuantity, stockMap = {}, cart = [], promotions = [], userStore = '' }) {
  const cartMap = useMemo(() => {
    const map = {};
    for (const item of cart) map[item.product_id] = item;
    return map;
  }, [cart]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-6 pb-6 pt-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {products.map((product) => {
            const stockQty = Number(stockMap[product.id] ?? 0);
            const outOfStock = stockQty <= 0;
            const cartItem = cartMap[product.id];
            const inCart = !!cartItem;
            const cartQty = cartItem?.quantity ?? 0;

            // Promoção ativa para este produto (antes e depois de adicionar ao carrinho)
            const activePromo = getActivePromo(product, promotions, userStore);
            const hasPromo = activePromo !== null;
            // Preço efetivo: usa o já calculado no carrinho, ou calcula da promoção ativa
            const effectivePrice = cartItem ? cartItem.unit_price : applyPromo(product.price, activePromo);

            return (
              <div
                key={product.id}
                className={`relative flex flex-col rounded-2xl overflow-hidden transition-all bg-white
                ${outOfStock ? 'opacity-40' : ''}
                ${inCart
                  ? 'ring-2 ring-orange-400 shadow-lg'
                  : 'border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-200'
                }`}
            >
              {/* Image — fundo neutro, imagem a ocupar o máximo do espaço */}
              <button
                onClick={() => !outOfStock && onAddToCart(product)}
                disabled={outOfStock}
                className={`w-full h-36 bg-white flex items-center justify-center relative shrink-0
                  ${outOfStock ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.97] transition-transform'}`}
              >
                <ProductCardImage url={product.image_url} category={product.category} />

                {/* Promo badge — visível mesmo antes de adicionar ao carrinho */}
                {hasPromo && (
                  <div className="absolute top-2 left-2 bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm">
                    Promo
                  </div>
                )}

                {/* Qty badge quando no carrinho */}
                {inCart && (
                  <div className="absolute top-2 right-2 bg-orange-500 text-white text-[11px] font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1 shadow">
                    {cartQty}
                  </div>
                )}

                {outOfStock && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-white/90 px-2 py-1 rounded-full border border-red-200">
                      Esgotado
                    </span>
                  </div>
                )}
              </button>

              {/* Footer */}
              <div className="px-2.5 py-2 flex flex-col gap-1.5 border-t border-slate-100">
                <p className="text-[12px] font-semibold leading-tight line-clamp-2 text-slate-800 min-h-[32px]">
                  {product.name}
                </p>
                <div className="flex items-center justify-between gap-1">
                  <div>
                    {hasPromo && (
                      <p className="text-[10px] text-slate-400 line-through leading-none">
                        {product.price?.toFixed(2)}€
                      </p>
                    )}
                    <p className="text-[13px] font-bold text-orange-500 tabular-nums leading-tight">
                      {effectivePrice?.toFixed(2)}€
                    </p>
                  </div>
                  {inCart && onUpdateQuantity && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQty - 1); }}
                        className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors"
                        aria-label="Remover unidade"
                      >
                        <Minus className="w-3 h-3" strokeWidth={3} />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-slate-700 tabular-nums">{cartQty}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(product.id, cartQty + 1); }}
                        disabled={cartQty >= stockQty}
                        className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors disabled:opacity-40"
                        aria-label="Adicionar unidade"
                      >
                        <Plus className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </div>
            );
          })}

          {products.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <span className="text-4xl">🔍</span>
              <p className="text-sm font-medium">Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
