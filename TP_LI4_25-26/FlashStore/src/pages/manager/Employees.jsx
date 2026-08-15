import React from 'react';
import { api } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Users, Mail, MapPin, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';

export default function Employees() {
  const { user } = useAuth();
  const managerStore = user?.store || user?.store_name || 'Braga Centro';

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.entities.User.list(),
  });

  const localUsers = users.filter((u) => u.store === managerStore);
  const managers = localUsers.filter((u) => u.role === 'manager');
  const cashiers = localUsers.filter((u) => u.role === 'cashier');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <p className="text-muted-foreground text-sm">{localUsers.length} utilizadores registados · {managerStore}</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Gerentes ({managers.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {managers.map(u => (
            <Card key={u.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {u.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{u.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                    {u.store && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{u.store}</p>}
                  </div>
                  <Badge className="bg-primary/10 text-primary">Gerente</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-secondary" /> Operadores de Caixa ({cashiers.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cashiers.map(u => (
            <Card key={u.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold">
                    {u.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{u.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                    {u.store && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{u.store}</p>}
                  </div>
                  <Badge variant="secondary">Caixa</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {cashiers.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
              Nenhum operador de caixa registado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
