import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api, formatApiError } from '@/api/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CashierHeader from '@/components/layout/CashierHeader';
import CartPanel from '@/components/cashier/CartPanel';
import ProductGrid from '@/components/cashier/ProductGrid';
import PaymentModal from '@/components/cashier/PaymentModal';
import ShiftCloseModal from '@/components/cashier/ShiftCloseModal';
import ShiftHistoryModal from '@/components/cashier/ShiftHistoryModal';
import ShiftOpenModal from '@/components/cashier/ShiftOpenModal';
import CashDropModal from '@/components/cashier/CashDropModal';
import { getPosTerminalId, setPosTerminalId as persistPosTerminal } from '@/lib/posTerminal';
import BarcodeScannerModal from '@/components/cashier/BarcodeScannerModal';
import BarcodeInputModal from '@/components/cashier/BarcodeInputModal';
import StockLookupModal from '@/components/cashier/StockLookupModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Camera, Barcode, X, Package, ReceiptText, Ban, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { printReceipt } from '@/lib/receiptPrinter';
import { useConnectivity, isElectronApp } from '@/lib/connectivity';
import { useAuth } from '@/lib/AuthContext';
import { registerSale } from '@/lib/registerSale';
import { syncLocalCatalog, invalidateLocalCatalogQueries } from '@/lib/localCatalogSync';
import { pushPendingOutbox } from '@/lib/outboxSync';
import OfflineBanner from '@/components/electron/OfflineBanner';
import LocalSalesDialog from '@/components/electron/LocalSalesDialog';

function getActivePromotion(product, promotions) {
  const today = new Date().toISOString().split('T')[0];
  return promotions.find((promo) => {
    if (!promo.is_active) return false;
    if (promo.start_date > today || promo.end_date < today) return false;
    if (promo.applies_to === 'product' && promo.target_id === product.id) return true;
    if (promo.applies_to === 'category' && promo.target_name === product.category) return true;
    return false;
  }) || null;
}

function applyPromotion(price, promo) {
  if (!promo) return price;
  if (promo.type === 'percentage') return Math.max(0, price * (1 - promo.value / 100));
  if (promo.type === 'fixed') return Math.max(0, price - promo.value);
  return price;
}

/** Lotes vendáveis no PDV e no central (exclui expirados). */
function isSellableLot(lot) {
  if (Number(lot.quantity || 0) <= 0) return false;
  if (!lot.expiry_date) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(lot.expiry_date) >= today;
}

export default function CashierPOS() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [showPayment, setShowPayment] = useState(false);
  const [showShiftClose, setShowShiftClose] = useState(false);
  const [showShiftHistory, setShowShiftHistory] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [showStockLookup, setShowStockLookup] = useState(false);
  const [showCashDrop, setShowCashDrop] = useState(false);
  const [pendingReceiptSale, setPendingReceiptSale] = useState(null);
  const [showLocalSalesDialog, setShowLocalSalesDialog] = useState(false);
  const saleWasOfflineRef = useRef(false);
  /** @type {React.MutableRefObject<Map<string, string>>} */
  const cashDropStatusRef = useRef(new Map());
  const [cashDropNoticeQueue, setCashDropNoticeQueue] = useState(
    /** @type {Array<{ id: string; status: string; amount: number; reason: string }>} */ ([])
  );
  const searchRef = useRef(null);
  const categoryScrollRef = useRef(null);

  const [posTerminalId, setPosTerminalId] = useState(getPosTerminalId);
  const [outboxPending, setOutboxPending] = useState(0);
  const [outboxFailed, setOutboxFailed] = useState(0);
  const [lastSyncErrors, setLastSyncErrors] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const syncInFlightRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const syncCooldownUntilRef = useRef(0);
  const { isOnline, checking: connectivityChecking, refresh: refreshConnectivity } = useConnectivity();

  const refreshOutbox = useCallback(async () => {
    if (!isElectronApp() || !window.flashstore?.db?.ping) return;
    try {
      const p = await window.flashstore.db.ping();
      setOutboxPending(p?.outboxPending ?? 0);
      setOutboxFailed(p?.outboxFailed ?? 0);
      setLastSyncErrors(p?.lastSyncErrors ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const handlePosCodeChange = useCallback((code) => {
    if (code && String(code).trim()) {
      persistPosTerminal(code);
      setPosTerminalId(String(code).trim());
    }
  }, []);

  useEffect(() => {
    if (user?.store && isOnline && isElectronApp()) {
      syncLocalCatalog(user.store)
        .then(() => {
          invalidateLocalCatalogQueries(queryClient, user.store);
          queryClient.invalidateQueries({ queryKey: ['stock', user.store] });
          queryClient.invalidateQueries({ queryKey: ['products'] });
          return refreshOutbox();
        })
        .catch(console.warn);
    }
  }, [user?.store, isOnline, refreshOutbox, queryClient]);

  useEffect(() => {
    refreshOutbox();
  }, [isOnline, refreshOutbox]);

  const runOutboxSync = useCallback(
    async ({ manual = false } = {}) => {
      if (!isElectronApp() || !user?.store) {
        if (manual) toast.error('Loja ou app Electron não disponível.');
        return;
      }
      if (syncInFlightRef.current) {
        if (manual) toast.info('Sincronização já em curso…');
        return;
      }
      if (!manual && Date.now() < syncCooldownUntilRef.current) return;

      syncInFlightRef.current = true;
      setSyncing(true);
      try {
        let totalSynced = 0;
        let totalFailed = 0;
        let lastErrors = [];
        let rounds = 0;
        do {
          const result = await pushPendingOutbox(user.store);
          totalSynced += result.synced || 0;
          totalFailed += result.failed || 0;
          lastErrors = result.results?.filter((r) => r.error).map((r) => r.error) || lastErrors;
          rounds += 1;
          if (!result.hasMore) break;
        } while (rounds < 10);

        await refreshOutbox();

        if (totalSynced > 0) {
          toast.success(
            totalSynced === 1
              ? '1 venda sincronizada com o servidor central.'
              : `${totalSynced} vendas sincronizadas com o servidor central.`
          );
          await syncLocalCatalog(user.store);
          invalidateLocalCatalogQueries(queryClient, user.store);
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['stock', user.store] });
        }
        if (totalFailed > 0) {
          const detail = lastErrors[0] || 'Verifique stock/catálogo no servidor central.';
          syncCooldownUntilRef.current = Date.now() + 60_000;
          if (manual) {
            toast.error(
              totalFailed === 1
                ? `1 venda não sincronizou: ${detail}`
                : `${totalFailed} vendas não sincronizaram. ${detail}`
            );
          }
        }
      } catch (error) {
        syncCooldownUntilRef.current = Date.now() + 60_000;
        if (manual) toast.error(formatApiError(error, 'Erro ao sincronizar vendas offline.'));
      } finally {
        setSyncing(false);
        syncInFlightRef.current = false;
      }
    },
    [user?.store, refreshOutbox, queryClient]
  );

  useEffect(() => {
    if (!isElectronApp()) return;
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current && outboxPending > 0 && !syncing) {
      wasOfflineRef.current = false;
      const timer = setTimeout(() => runOutboxSync({ manual: false }), 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, outboxPending, syncing, runOutboxSync]);

  const {
    data: activeShift,
    refetch: refetchActiveShift,
    isFetched: openShiftFetched,
  } = useQuery({
    queryKey: ['myOpenShift', user?.store, user?.email],
    queryFn: () => api.shifts.myOpen(user.store),
    enabled: Boolean(user?.store && user?.role === 'cashier'),
  });

  useEffect(() => {
    if (activeShift?.pos_terminal_id) {
      persistPosTerminal(activeShift.pos_terminal_id);
      setPosTerminalId((prev) => prev || activeShift.pos_terminal_id);
    }
  }, [activeShift?.pos_terminal_id]);

  useEffect(() => {
    cashDropStatusRef.current = new Map();
    setCashDropNoticeQueue([]);
  }, [activeShift?.id]);

  const effectivePosCode = activeShift?.pos_terminal_id || posTerminalId;

  const { data: shiftCashDrops = [] } = useQuery({
    queryKey: ['cashDrops', 'shift', activeShift?.id],
    queryFn: () => api.cashDrops.list({ shift_closure_id: activeShift.id }),
    enabled: Boolean(activeShift?.id),
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (!activeShift?.id) return;
    const map = cashDropStatusRef.current;
    const newNotices = [];
    for (const d of shiftCashDrops) {
      const prev = map.get(d.id);
      const st = d.status;
      if (prev === 'pending' && (st === 'approved' || st === 'rejected')) {
        newNotices.push({
          id: d.id,
          status: st,
          amount: Number(d.amount || 0),
          reason: d.reason || '',
        });
      }
      map.set(d.id, st);
    }
    if (newNotices.length) {
      setCashDropNoticeQueue((q) => [...q, ...newNotices]);
    }
  }, [shiftCashDrops, activeShift?.id]);

  const cashDropNotice = cashDropNoticeQueue[0] ?? null;

  const dismissCashDropNotice = useCallback(() => {
    setCashDropNoticeQueue((q) => q.slice(1));
  }, []);

  const { data: cashSummary, refetch: refetchCashSummary } = useQuery({
    queryKey: ['shiftCashSummary', activeShift?.id],
    queryFn: () => api.shifts.cashSummary(activeShift.id),
    enabled: Boolean(activeShift?.id),
    refetchInterval: 20_000,
  });

  /** Online: stock/catálogo do central (igual gerente). Offline: cópia local. */
  const useLocalCatalog = isElectronApp() && !isOnline;

  const { data: remoteProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.entities.Product.filter({ is_active: true }),
    enabled: isOnline && !useLocalCatalog,
  });

  const { data: localProductRows = [] } = useQuery({
    queryKey: ['localProducts', user?.store],
    queryFn: async () => {
      const r = await window.flashstore.db.getProducts({ store: user.store });
      return r.products || [];
    },
    enabled: useLocalCatalog && Boolean(user?.store),
  });

  const products = useMemo(() => {
    if (!useLocalCatalog) return isOnline ? remoteProducts : [];
    return localProductRows.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      price: p.price,
      category: p.category,
      image_url: p.image_url,
      iva_rate: p.iva_rate ?? 23,
      is_active: true,
    }));
  }, [useLocalCatalog, isOnline, remoteProducts, localProductRows]);

  const { data: promotions = [] } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => api.entities.Promotion.list(),
    enabled: isOnline,
  });

  const { data: remoteStockList = [] } = useQuery({
    queryKey: ['stock', user?.store],
    queryFn: () => api.entities.Stock.filter({ store: user.store }),
    enabled: Boolean(user?.store && isOnline && !useLocalCatalog),
  });

  const { data: localStockList = [] } = useQuery({
    queryKey: ['localStock', user?.store],
    queryFn: async () => {
      const r = await window.flashstore.db.getStock({ store: user.store });
      return r.stock || [];
    },
    enabled: useLocalCatalog && Boolean(user?.store),
  });

  const stockList = useMemo(() => {
    if (useLocalCatalog) return localStockList;
    return isOnline ? remoteStockList : [];
  }, [useLocalCatalog, isOnline, remoteStockList, localStockList]);

  /** Stock que o caixa pode vender (válido no central e na sync offline). */
  const stockMap = useMemo(() => {
    const map = /** @type {Record<string, number>} */ ({});
    for (const s of stockList) {
      if (!isSellableLot(s)) continue;
      map[s.product_id] = (map[s.product_id] || 0) + Number(s.quantity || 0);
    }
    return map;
  }, [stockList]);

  const stockLotsByProduct = useMemo(() => {
    const grouped = /** @type {Record<string, Array<any>>} */ ({});
    for (const lot of stockList) {
      if (!isSellableLot(lot)) continue;
      if (!grouped[lot.product_id]) grouped[lot.product_id] = [];
      grouped[lot.product_id].push(lot);
    }

    for (const lots of Object.values(grouped)) {
      lots.sort((a, b) => {
        const aExpiry = a.expiry_date || '9999-12-31';
        const bExpiry = b.expiry_date || '9999-12-31';
        if (aExpiry !== bExpiry) return aExpiry.localeCompare(bExpiry);
        return String(a.created_date || '').localeCompare(String(b.created_date || ''));
      });
    }

    return grouped;
  }, [stockList]);

  const cartWithLotPreview = useMemo(() => {
    return cart.map((item) => {
      let remaining = Number(item.quantity || 0);
      const lots = stockLotsByProduct[item.product_id] || [];
      const allocations = [];

      for (const lot of lots) {
        if (remaining <= 0) break;
        const quantity = Math.min(Number(lot.quantity || 0), remaining);
        if (quantity <= 0) continue;
        allocations.push({
          quantity,
          serial_number: lot.serial_number || 'SEM-LOTE',
          expiry_date: lot.expiry_date || null,
        });
        remaining -= quantity;
      }

      return { ...item, lot_preview: allocations };
    });
  }, [cart, stockLotsByProduct]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
    );
    return ['Todas', ...uniqueCategories];
  }, [products]);

  const addToCart = useCallback((product) => {
    const available = stockMap[product.id] ?? null;
    const inCart = cart.find((i) => i.product_id === product.id)?.quantity ?? 0;
    if (available !== null && available <= inCart) {
      toast.error(`Sem stock disponível para "${product.name}".`);
      return;
    }

    const promo = getActivePromotion(product, promotions);
    const finalPrice = applyPromotion(product.price, promo);

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          category: product.category,
          image_url: product.image_url,
          quantity: 1,
          unit_price: finalPrice,
          original_price: promo ? product.price : null,
          promo_name: promo ? promo.name : null,
          iva_rate: product.iva_rate || 23,
          subtotal: finalPrice,
        },
      ];
    });
    setSearchTerm('');
    searchRef.current?.focus();
  }, [promotions, stockMap, cart]);

  const updateQuantity = useCallback((productId, newQty) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.product_id !== productId));
    } else {
      const available = Object.prototype.hasOwnProperty.call(stockMap, productId) ? stockMap[productId] : null;
      if (available !== null && newQty > available) {
        toast.error('Sem stock suficiente.');
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          item.product_id === productId
            ? { ...item, quantity: newQty, subtotal: newQty * item.unit_price }
            : item
        )
      );
    }
  }, [stockMap]);

  const removeItem = useCallback((productId) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartIva = cart.reduce(
    (sum, item) => sum + (item.subtotal * item.iva_rate) / (100 + item.iva_rate),
    0
  );

  const handlePaymentComplete = async (paymentData) => {
    const saleData = {
      store: user?.store || 'Braga Centro',
      items: cart,
      total: cartTotal,
      total_iva: cartIva,
      payment_method: paymentData.method,
      amount_paid: paymentData.amountPaid || cartTotal,
      change_given: paymentData.change || 0,
      customer_nif: paymentData.nif || '',
      cashier_email: user?.email || '',
      cashier_name: user?.full_name || '',
      status: 'completed',
      invoice_number: `FS-${Date.now()}`,
      shift_closure_id: activeShift?.id || undefined,
    };

    try {
      const wasOnline = isOnline;
      const createdSale = await registerSale(saleData);
      saleWasOfflineRef.current = !wasOnline;
      if (wasOnline) {
        if (useLocalCatalog) {
          await syncLocalCatalog(user.store);
          invalidateLocalCatalogQueries(queryClient, user.store);
        } else {
          queryClient.invalidateQueries({ queryKey: ['stock', user.store] });
          queryClient.invalidateQueries({ queryKey: ['products'] });
          if (isElectronApp()) {
            await syncLocalCatalog(user.store);
            invalidateLocalCatalogQueries(queryClient, user.store);
          }
        }
        if (activeShift?.id) {
          queryClient.invalidateQueries({ queryKey: ['shiftCashSummary', activeShift.id] });
        }
      } else {
        invalidateLocalCatalogQueries(queryClient, user?.store);
        await refreshOutbox();
      }
      setCart([]);
      setShowPayment(false);
      setPendingReceiptSale(createdSale);
      toast.success(
        wasOnline ? 'Venda registada.' : 'Venda registada offline — será sincronizada quando houver rede.'
      );
      if (!wasOnline) {
        await refreshOutbox();
      }
    } catch (error) {
      console.error(error);
      toast.error(formatApiError(error, 'Erro ao registar a venda.'));
    }
  };

  const handleReceiptChoice = (shouldPrint) => {
    if (shouldPrint && pendingReceiptSale) {
      printReceipt(
        pendingReceiptSale.receipt_text,
        pendingReceiptSale.receipt_number || pendingReceiptSale.invoice_number
      );
    }
    const wasOffline = saleWasOfflineRef.current;
    setPendingReceiptSale(null);
    saleWasOfflineRef.current = false;
    if (wasOffline && isElectronApp()) {
      setShowLocalSalesDialog(true);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSearchKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
      }
    },
    [filteredProducts, addToCart]
  );

  const needsShiftOpen =
    isOnline && user?.role === 'cashier' && user?.store && openShiftFetched && !activeShift;

  const CATEGORY_META = {
    'Todas':       { emoji: '🛒', bg: 'from-orange-400 to-orange-600' },
    'Bebidas':     { emoji: '🥤', bg: 'from-blue-400 to-blue-600' },
    'Snacks':      { emoji: '🍿', bg: 'from-yellow-400 to-orange-500' },
    'Tabaco':      { emoji: '🚬', bg: 'from-slate-500 to-slate-700' },
    'Lacticínios': { emoji: '🥛', bg: 'from-sky-300 to-sky-500' },
    'Padaria':     { emoji: '🥐', bg: 'from-amber-300 to-amber-500' },
    'Congelados':  { emoji: '❄️', bg: 'from-cyan-300 to-cyan-500' },
    'Higiene':     { emoji: '🧴', bg: 'from-emerald-400 to-emerald-600' },
    'Limpeza':     { emoji: '🧹', bg: 'from-lime-400 to-lime-600' },
    'Outros':      { emoji: '📦', bg: 'from-slate-400 to-slate-600' },
  };

  const scrollCategories = (dir) => {
    categoryScrollRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <CashierHeader
        user={user}
        posTerminalId={effectivePosCode}
        activeShift={activeShift}
        expectedDrawerCash={cashSummary?.expected_drawer_cash}
        pendingDropsTotal={cashSummary?.pending_drops_total}
        isOnline={isOnline}
        connectivityChecking={connectivityChecking}
      />
      {isElectronApp() && (
        <div className="px-4 pt-2">
          <OfflineBanner
            isOnline={isOnline}
            checking={connectivityChecking}
            outboxPending={outboxPending}
            outboxFailed={outboxFailed}
            lastSyncErrors={lastSyncErrors}
            syncing={syncing}
            onSync={() => runOutboxSync({ manual: true })}
            onRequeueFailed={async () => {
              if (!window.flashstore?.db?.requeueFailedOutbox) return;
              const { requeued } = await window.flashstore.db.requeueFailedOutbox();
              await refreshOutbox();
              if (requeued > 0) {
                toast.info(`${requeued} venda(s) repostas na fila. Importe o catálogo e sincronize.`);
              }
            }}
            onRefresh={async () => {
              await refreshConnectivity();
              await refreshOutbox();
              if (user?.store && (await refreshConnectivity())) {
                await syncLocalCatalog(user.store);
                invalidateLocalCatalogQueries(queryClient, user.store);
                queryClient.invalidateQueries({ queryKey: ['products'] });
                queryClient.invalidateQueries({ queryKey: ['stock', user.store] });
                if ((await window.flashstore?.db?.ping?.())?.outboxPending > 0) {
                  runOutboxSync({ manual: true });
                }
              }
            }}
          />
        </div>
      )}
      <div className="flex-1 flex overflow-hidden bg-slate-100 gap-2.5 p-2.5">
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-lg min-w-0">
          {/* Greeting + search — linha única */}
          <div className="border-b border-slate-100">
            <div className="w-full px-6 py-5 flex items-center gap-8">
              <div className="shrink-0">
                <h2 className="text-base font-bold text-slate-800 whitespace-nowrap">
                  Olá, {user?.full_name?.split(' ')[0] || 'Operador'}
                </h2>
                <p className="text-[11px] text-slate-400">{user?.store || 'FlashStore'}</p>
              </div>

              <div className="ml-auto flex items-center gap-3 flex-1 min-w-0 justify-end">
                <div className="relative w-full max-w-[560px] min-w-[280px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Pesquisar produto ou código de barras..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full h-14 pl-11 pr-10 text-sm bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-orange-400 focus:bg-white focus:outline-none transition-colors"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(''); searchRef.current?.focus(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Limpar pesquisa"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowBarcodeInput(true)}
                  className="h-14 w-14 flex items-center justify-center bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-orange-400 hover:bg-orange-50 transition-colors shrink-0"
                  title="Inserir código de barras"
                >
                  <Barcode className="w-5 h-5 text-slate-500" />
                </button>
                <button
                  onClick={() => setShowScanner(true)}
                  className="h-14 w-14 flex items-center justify-center bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-orange-400 hover:bg-orange-50 transition-colors shrink-0"
                  title="Câmara"
                >
                  <Camera className="w-5 h-5 text-slate-500" />
                </button>
                <button
                  onClick={() => setShowStockLookup(true)}
                  className="h-14 w-14 flex items-center justify-center bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-orange-400 hover:bg-orange-50 transition-colors shrink-0"
                  title="Consultar stock"
                >
                  <Package className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Category pills — centradas */}
          <div className="bg-white border-b border-slate-100">
            <div className="w-full px-6 py-3 flex items-center gap-1.5">
              <button
                onClick={() => scrollCategories(-1)}
                className="shrink-0 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
                aria-label="Scroll esquerda"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <div
                ref={categoryScrollRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 py-0.5"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {categories.map((category) => {
                  const meta = CATEGORY_META[category] || { emoji: '📦', bg: 'from-slate-400 to-slate-600' };
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      style={{ scrollSnapAlign: 'start' }}
                      className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all select-none whitespace-nowrap
                        ${isActive
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600'
                        }`}
                    >
                      <span className="text-base leading-none">{meta.emoji}</span>
                      {category}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => scrollCategories(1)}
                className="shrink-0 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
                aria-label="Scroll direita"
              >
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          <ProductGrid
            products={filteredProducts}
            onAddToCart={addToCart}
            onUpdateQuantity={updateQuantity}
            stockMap={stockMap}
            cart={cart}
            promotions={promotions}
            userStore={user?.store || ''}
          />
        </div>

        {/* Cart wrapper — fundo mais escuro cria contraste, CartPanel aparece como card branco */}
        <div className="w-[328px] shrink-0 flex flex-col">
          <CartPanel
            cart={cartWithLotPreview}
            total={cartTotal}
            totalIva={cartIva}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onCheckout={() => setShowPayment(true)}
            onCloseShift={() => setShowShiftClose(true)}
            onViewHistory={() => setShowShiftHistory(true)}
            onCashDrop={activeShift?.id ? () => setShowCashDrop(true) : undefined}
            expectedDrawerCash={cashSummary?.expected_drawer_cash}
          />
        </div>
      </div>

      {showBarcodeInput && (
        <BarcodeInputModal
          products={products}
          onScanned={addToCart}
          onClose={() => setShowBarcodeInput(false)}
        />
      )}

      {showScanner && (
        <BarcodeScannerModal
          products={products}
          onScanned={addToCart}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showPayment && (
        <PaymentModal
          total={cartTotal}
          onComplete={handlePaymentComplete}
          onClose={() => setShowPayment(false)}
        />
      )}

      {pendingReceiptSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ReceiptText className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold">Deseja talão?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {saleWasOfflineRef.current
                ? 'A venda foi guardada na base de dados local desta loja.'
                : 'A venda foi registada com sucesso.'}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleReceiptChoice(false)}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border font-semibold transition-colors hover:bg-muted"
              >
                <Ban className="h-5 w-5" />
                Não
              </button>
              <button
                type="button"
                onClick={() => handleReceiptChoice(true)}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ReceiptText className="h-5 w-5" />
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {isElectronApp() && (
        <LocalSalesDialog open={showLocalSalesDialog} onOpenChange={setShowLocalSalesDialog} />
      )}

      {needsShiftOpen && (
        <ShiftOpenModal
          user={user}
          onPosChange={handlePosCodeChange}
          onShiftOpened={() => {
            queryClient.invalidateQueries({ queryKey: ['myOpenShift', user?.store, user?.email] });
            refetchActiveShift();
          }}
        />
      )}

      {showShiftClose && activeShift && (
        <ShiftCloseModal
          user={user}
          activeShift={activeShift}
          isOnline={isOnline}
          onClose={() => setShowShiftClose(false)}
          onShiftClosed={() => {
            queryClient.invalidateQueries({ queryKey: ['myOpenShift', user?.store, user?.email] });
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            refetchActiveShift();
          }}
        />
      )}

      {showShiftHistory && activeShift && (
        <ShiftHistoryModal
          user={user}
          activeShift={activeShift}
          onClose={() => setShowShiftHistory(false)}
          onSaleCancelled={() => {
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['shiftCashSummary', activeShift.id] });
          }}
        />
      )}

      {showCashDrop && activeShift && (
        <CashDropModal
          shiftId={activeShift.id}
          onClose={() => setShowCashDrop(false)}
          onCreated={() => {
            refetchCashSummary();
            queryClient.invalidateQueries({ queryKey: ['cashDrops'] });
          }}
        />
      )}

      <AlertDialog
        open={Boolean(cashDropNotice)}
        onOpenChange={(open) => {
          if (!open) dismissCashDropNotice();
        }}
      >
        <AlertDialogContent key={cashDropNotice?.id ?? 'none'} className="z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cashDropNotice?.status === 'approved'
                ? 'Sangria aprovada'
                : cashDropNotice?.status === 'rejected'
                  ? 'Sangria rejeitada'
                  : 'Sangria atualizada'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {cashDropNotice ? (
                  <>
                    <p>
                      O pedido de{' '}
                      <span className="font-semibold text-foreground">
                        {cashDropNotice.amount.toFixed(2)}€
                      </span>{' '}
                      foi{' '}
                      <span className="font-medium text-foreground">
                        {cashDropNotice.status === 'approved' ? 'aprovado' : 'rejeitado'}
                      </span>
                      .
                    </p>
                    {cashDropNotice.reason ? (
                      <p>
                        <span className="text-xs uppercase tracking-wide">Motivo indicado</span>
                        <br />
                        {cashDropNotice.reason}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction type="button" onClick={dismissCashDropNotice}>
              Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showStockLookup && (
        <StockLookupModal
          products={products}
          stockList={stockList}
          onClose={() => setShowStockLookup(false)}
        />
      )}
    </div>
  );
}
