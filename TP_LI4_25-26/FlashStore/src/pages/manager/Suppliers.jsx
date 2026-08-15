import React, { useMemo, useState } from 'react';
import { api } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Search, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function Suppliers() {
  const [search, setSearch] = useState('');

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.entities.Supplier.list('-created_date', 200),
  });

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return suppliers.filter((supplier) =>
      supplier.name?.toLowerCase().includes(needle) ||
      supplier.nif?.includes(search) ||
      supplier.email?.toLowerCase().includes(needle)
    );
  }, [search, suppliers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <p className="text-muted-foreground text-sm">{suppliers.length} fornecedores registados</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar fornecedor..." className="pl-10" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((supplier) => (
          <Card key={supplier.id} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                  <Truck className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{supplier.name}</h3>
                  <p className="text-xs text-muted-foreground">NIF: {supplier.nif}</p>
                </div>
              </div>
              {supplier.contact && <p className="mt-3 text-sm text-muted-foreground">Contacto: {supplier.contact}</p>}
              {supplier.email && <p className="text-sm text-muted-foreground">Email: {supplier.email}</p>}
              {supplier.address && <p className="text-sm text-muted-foreground">Morada: {supplier.address}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado</div>
      )}
    </div>
  );
}
