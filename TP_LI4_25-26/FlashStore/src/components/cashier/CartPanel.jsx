import React, { useState } from 'react';
import { Trash2, CreditCard, Clock, History, ArrowLeft, Vault, Smartphone, Banknote, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export default function CartPanel({
  cart,
  total,
  totalIva,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  onQuickPay,
  onCloseShift,
  onViewHistory,
  onCashDrop,
  expectedDrawerCash,
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearClick = () => {
    if (confirmClear) {
      onClearCart();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  const subtotal = total - totalIva;

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden min-h-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Resumo do Pedido</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {cart.length} {cart.length === 1 ? 'artigo' : 'artigos'}
            </p>
          </div>
          {cart.length > 0 && (
            <button
              onClick={handleClearClick}
              className={`p-1.5 rounded-lg transition-colors ${
                confirmClear
                  ? 'bg-red-500 text-white'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title={confirmClear ? 'Confirmar limpeza?' : 'Limpar carrinho'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 py-12">
            <ShoppingCart className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium text-slate-400">Carrinho vazio</p>
            <p className="text-xs text-slate-300 mt-1">Adicione produtos para iniciar</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors"
            >
              {/* Thumbnail */}
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.product_name}
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : (
                  <span className="text-lg leading-none">
                    {CATEGORY_ICONS[item.category] || '📦'}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                  {item.product_name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {item.original_price != null ? (
                    <>
                      <span className="text-[10px] text-slate-400 line-through">
                        {item.original_price.toFixed(2)}€
                      </span>
                      <span className="text-[10px] text-orange-500 font-semibold">
                        {item.unit_price.toFixed(2)}€/un
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {item.quantity} × {item.unit_price.toFixed(2)}€
                    </span>
                  )}
                </div>
              </div>

              {/* Subtotal + delete */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-bold text-slate-800 tabular-nums">
                  {item.subtotal.toFixed(2)}€
                </span>
                <button
                  onClick={() => onRemoveItem(item.product_id)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment summary + actions */}
      <div className="border-t border-slate-100 p-4 space-y-3">
        {expectedDrawerCash != null && (
          <div className="flex justify-between text-xs text-slate-400 md:hidden">
            <span>Numerário estimado gaveta</span>
            <span className="font-mono font-medium text-slate-600">
              {Number(expectedDrawerCash).toFixed(2)}€
            </span>
          </div>
        )}

        {/* Payment breakdown */}
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Subtotal</span>
            <span className="tabular-nums">{subtotal.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>IVA</span>
            <span className="tabular-nums">{totalIva.toFixed(2)}€</span>
          </div>
          <div className="h-px bg-slate-200" />
          <div className="flex justify-between text-base font-bold text-slate-800">
            <span>Total</span>
            <span className="text-orange-500 tabular-nums">{total.toFixed(2)}€</span>
          </div>
        </div>

        {/* Checkout */}
        {onQuickPay ? (
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => onQuickPay('dinheiro')}
              disabled={cart.length === 0}
              className="h-12 flex-col gap-0.5 text-xs font-bold bg-green-600 hover:bg-green-700 rounded-xl"
            >
              <Banknote className="w-4 h-4" />
              Dinheiro
            </Button>
            <Button
              onClick={() => onQuickPay('cartao')}
              disabled={cart.length === 0}
              className="h-12 flex-col gap-0.5 text-xs font-bold bg-primary hover:bg-primary/90 rounded-xl"
            >
              <CreditCard className="w-4 h-4" />
              Cartão
            </Button>
            <Button
              onClick={() => onQuickPay('mbway')}
              disabled={cart.length === 0}
              className="h-12 flex-col gap-0.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 rounded-xl"
            >
              <Smartphone className="w-4 h-4" />
              MB Way
            </Button>
          </div>
        ) : (
          <Button
            onClick={onCheckout}
            disabled={cart.length === 0}
            className="w-full h-12 text-base font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Confirmar Pagamento
          </Button>
        )}

        {/* Shift management */}
        <div className="grid grid-cols-2 gap-2">
          {onCashDrop && (
            <Button
              variant="outline"
              onClick={onCashDrop}
              className="h-9 text-xs rounded-xl border-slate-200"
              type="button"
            >
              <Vault className="w-3.5 h-3.5 shrink-0 mr-1" />
              <span className="truncate">Sangria</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onViewHistory}
            className="h-9 text-xs rounded-xl border-slate-200"
            type="button"
          >
            <History className="w-3.5 h-3.5 shrink-0 mr-1" />
            <span className="truncate">Ver turno</span>
          </Button>
          <Button
            variant="outline"
            onClick={onCloseShift}
            className={`h-9 text-xs rounded-xl border-slate-200 ${onCashDrop ? 'col-span-2' : ''}`}
            type="button"
          >
            <Clock className="w-3.5 h-3.5 shrink-0 mr-1" />
            <span className="truncate">Fechar turno</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
