import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Check, Pencil, Plus, Search, Tags, Trash2, Warehouse, X } from 'lucide-react';
import { api } from '@/api/apiClient';
import DashboardHeader from '@/components/backoffice/DashboardHeader';
import DashboardSection from '@/components/backoffice/DashboardSection';
import ProductForm from '@/components/manager/ProductForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ProductLotsDialog from '@/components/stock/ProductLotsDialog';
import { toast } from '@/components/ui/use-toast';

const QUERY_KEY = ['admin-franchise-products'];

function storeRowDefaults(storeName) {
  return {
    store: storeName,
    quantity: 0,
    minimum_threshold: 10,
    below_minimum: true,
  };
}

export default function AdminFranchiseProducts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogProduct, setDialogProduct] = useState(null);
  const [minDraft, setMinDraft] = useState({});
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductFormKey, setNewProductFormKey] = useState(0);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryDraft, setEditCategoryDraft] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [lotsDialog, setLotsDialog] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.admin.franchiseProducts(),
  });

  const products = data?.products ?? [];
  const allStores = data?.stores ?? [];

  useEffect(() => {
    if (!dialogProduct) {
      setMinDraft({});
      return;
    }
    const draft = {};
    for (const storeName of allStores) {
      const row = dialogProduct.stores.find((s) => s.store === storeName);
      draft[storeName] = String(row?.minimum_threshold ?? 10);
    }
    setMinDraft(draft);
  }, [dialogProduct, allStores]);

  const { data: categoryList = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.entities.Category.list(),
    enabled: categoriesOpen,
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name) => api.admin.createCategory({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewCategoryName('');
      toast({ title: 'Categoria adicionada' });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível adicionar',
        description: error.message || 'Nome duplicado ou inválido.',
        variant: 'destructive',
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }) => api.admin.updateCategory(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin-promotion-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      setEditingCategoryId(null);
      setEditCategoryDraft('');
      toast({ title: 'Categoria actualizada', description: 'Produtos e promoções por categoria foram sincronizados.' });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível actualizar',
        description: error.message || 'Nome duplicado ou inválido.',
        variant: 'destructive',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => api.admin.deleteCategory(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin-promotion-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      setCategoryToDelete(null);
      const n = data.products_reassigned ?? 0;
      toast({
        title: 'Categoria removida',
        description:
          n > 0
            ? `${n} produto(s) e promoções associadas passaram para «${data.reassigned_to}». Nenhum produto foi apagado.`
            : `Referências passaram para «${data.reassigned_to}».`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível remover',
        description: error.message || 'Verifique se não é a última categoria.',
        variant: 'destructive',
      });
    },
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.admin.updateStockMinimum(payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title: 'Mínimo actualizado',
        description: `${data.store}: mínimo ${data.minimum_threshold} un.`,
      });
      setDialogProduct((prev) => {
        if (!prev || prev.id !== variables.product_id) return prev;
        const nextStores = prev.stores.filter((s) => s.store !== data.store);
        nextStores.push({
          store: data.store,
          quantity: data.quantity,
          minimum_threshold: data.minimum_threshold,
          below_minimum: data.below_minimum,
        });
        nextStores.sort((a, b) => a.store.localeCompare(b.store, 'pt'));
        return { ...prev, stores: nextStores };
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao guardar',
        description: error.message || 'Não foi possível actualizar o mínimo.',
        variant: 'destructive',
      });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, search]);

  const rowsWithMeta = useMemo(() => {
    return filtered.map((p) => {
      const lowCount = p.stores.filter((s) => s.below_minimum).length;
      const totalQty = p.stores.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
      return { ...p, lowCount, totalQty };
    });
  }, [filtered]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Produtos da franquia"
        subtitle="Catálogo global, stock por loja e mínimos para alertas de reposição em cada unidade."
        profileLabel="Admin Central"
        storeLabel="FlashStore · Sede"
        variant="admin"
        showSearch={false}
        secondaryActions={
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2 shrink-0"
              onClick={() => {
                setNewCategoryName('');
                setCategoriesOpen(true);
              }}
            >
              <Tags className="h-4 w-4" />
              Categorias
            </Button>
            <Button
              type="button"
              className="gap-2 shrink-0"
              onClick={() => {
                setNewProductFormKey((k) => k + 1);
                setNewProductOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo produto
            </Button>
          </>
        }
      />

      <DashboardSection
        title="Catálogo e inventário"
        subtitle="Defina o stock mínimo por produto e por loja. Os gerentes vêem o alerta quando o total na loja (soma dos lotes) não ultrapassa esse mínimo."
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, categoria ou código de barras…"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading && (
          <p className="py-12 text-center text-sm text-muted-foreground">A carregar produtos…</p>
        )}
        {isError && (
          <p className="py-12 text-center text-sm text-destructive">Não foi possível carregar os dados.</p>
        )}

        {!isLoading && !isError && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="hidden md:table-cell">Código</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Qtd. cadeia</TableHead>
                  <TableHead className="text-center">Alertas</TableHead>
                  <TableHead className="text-right">Stock por loja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithMeta.map((p) => (
                  <TableRow key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{p.name}</span>
                        {!p.is_active ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactivo
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.category}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                      {p.barcode || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(p.price || 0).toFixed(2)} €</TableCell>
                    <TableCell className="text-right tabular-nums">{p.totalQty}</TableCell>
                    <TableCell className="text-center">
                      {p.lowCount > 0 ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          {p.lowCount} loja{p.lowCount !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setDialogProduct(p)}>
                        <Warehouse className="mr-1.5 h-3.5 w-3.5" />
                        Ver / editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rowsWithMeta.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum produto corresponde à pesquisa.
              </p>
            )}
          </div>
        )}
      </DashboardSection>

      <Dialog
        open={categoriesOpen}
        onOpenChange={(open) => {
          setCategoriesOpen(open);
          if (!open) {
            setEditingCategoryId(null);
            setEditCategoryDraft('');
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Categorias do catálogo</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Criar, editar ou remover categorias. Ao remover, os produtos mantêm-se: passam automaticamente para
              outra categoria (prioridade a «Outros»). As promoções por categoria são actualizadas.
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da nova categoria"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const name = newCategoryName.trim();
                    if (name) addCategoryMutation.mutate(name);
                  }
                }}
              />
              <Button
                type="button"
                disabled={!newCategoryName.trim() || addCategoryMutation.isPending}
                onClick={() => addCategoryMutation.mutate(newCategoryName.trim())}
              >
                Adicionar
              </Button>
            </div>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">A carregar…</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
                {categoryList.length === 0 ? (
                  <li className="text-muted-foreground">Sem categorias.</li>
                ) : (
                  categoryList.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 border-b border-border/60 py-1.5 last:border-0"
                    >
                      {editingCategoryId === c.id ? (
                        <>
                          <Input
                            className="h-8 flex-1"
                            value={editCategoryDraft}
                            onChange={(e) => setEditCategoryDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const name = editCategoryDraft.trim();
                                if (name) {
                                  updateCategoryMutation.mutate({ id: c.id, name });
                                }
                              }
                              if (e.key === 'Escape') {
                                setEditingCategoryId(null);
                                setEditCategoryDraft('');
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            disabled={!editCategoryDraft.trim() || updateCategoryMutation.isPending}
                            onClick={() => {
                              const name = editCategoryDraft.trim();
                              if (name) updateCategoryMutation.mutate({ id: c.id, name });
                            }}
                            aria-label="Guardar"
                          >
                            <Check className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              setEditingCategoryId(null);
                              setEditCategoryDraft('');
                            }}
                            aria-label="Cancelar edição"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 font-medium truncate">{c.name}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingCategoryId(c.id);
                              setEditCategoryDraft(c.name);
                            }}
                            aria-label={`Editar ${c.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={categoryList.length <= 1}
                            onClick={() => setCategoryToDelete({ id: c.id, name: c.name })}
                            aria-label={`Remover ${c.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria «{categoryToDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos não serão apagados. Serão movidos para outra categoria (por omissão «Outros», se existir).
              Promoções que visavam esta categoria passarão a usar essa categoria de destino.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCategoryMutation.isPending}
              onClick={() => {
                if (categoryToDelete?.id) deleteCategoryMutation.mutate(categoryToDelete.id);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo produto no catálogo</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Os mesmos campos que no resto do sistema: preço, IVA, categoria, imagem, fornecedor, perecível, etc.
            </p>
          </DialogHeader>
          <ProductForm
            key={newProductFormKey}
            compact
            product={null}
            onCancel={() => setNewProductOpen(false)}
            onSave={() => {
              setNewProductOpen(false);
              queryClient.invalidateQueries({ queryKey: QUERY_KEY });
              queryClient.invalidateQueries({ queryKey: ['products'] });
              toast({ title: 'Produto criado', description: 'O catálogo foi atualizado.' });
            }}
          />
        </DialogContent>
      </Dialog>

      <ProductLotsDialog
        open={Boolean(lotsDialog)}
        onOpenChange={(open) => !open && setLotsDialog(null)}
        productId={lotsDialog?.productId}
        productName={lotsDialog?.productName}
        storeName={lotsDialog?.storeName}
        allowTerminateLot={false}
      />

      <Dialog open={!!dialogProduct} onOpenChange={(open) => !open && setDialogProduct(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-8">{dialogProduct?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Stock total e mínimo por loja. O mínimo aplica-se a todos os lotes dessa loja (alerta quando a
              soma ≤ mínimo).
            </p>
          </DialogHeader>

          {dialogProduct && allStores.length > 0 ? (
            <div className="space-y-3">
              {allStores.map((storeName) => {
                const row = dialogProduct.stores.find((s) => s.store === storeName) || storeRowDefaults(storeName);
                const draftVal = minDraft[storeName] ?? String(row.minimum_threshold);
                return (
                  <div
                    key={storeName}
                    className={`rounded-lg border p-3 ${row.below_minimum ? 'border-destructive/40 bg-destructive/5' : ''}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{storeName}</p>
                        <p className="text-xs text-muted-foreground">
                          Em stock:{' '}
                          <span className="font-medium text-foreground">{row.quantity}</span> un.
                        </p>
                        {row.below_minimum ? (
                          <p className="mt-0.5 text-xs text-destructive">Abaixo ou igual ao mínimo definido</p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() =>
                          setLotsDialog({
                            productId: dialogProduct.id,
                            productName: dialogProduct.name,
                            storeName,
                          })
                        }
                      >
                        <Boxes className="mr-1.5 h-3.5 w-3.5" />
                        Ver lotes
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[120px]">
                        <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`min-${storeName}`}>
                          Mínimo (alerta)
                        </label>
                        <Input
                          id={`min-${storeName}`}
                          type="number"
                          min={0}
                          step={1}
                          value={draftVal}
                          onChange={(e) =>
                            setMinDraft((prev) => ({ ...prev, [storeName]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() => {
                          const n = Number(draftVal);
                          if (Number.isNaN(n) || n < 0) {
                            toast({
                              title: 'Valor inválido',
                              description: 'Indique um número ≥ 0.',
                              variant: 'destructive',
                            });
                            return;
                          }
                          mutation.mutate({
                            product_id: dialogProduct.id,
                            store: storeName,
                            minimum_threshold: Math.floor(n),
                          });
                        }}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem lojas definidas na base de dados.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
