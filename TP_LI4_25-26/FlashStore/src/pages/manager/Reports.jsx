import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SaftReport from '@/components/reports/SaftReport';
import DailyShiftReport from '@/components/reports/DailyShiftReport';

export default function Reports() {
  const { user } = useAuth();
  const managerStore = user?.store || user?.store_name || 'Braga Centro';

  return (
    <div className="space-y-4">
      <Tabs defaultValue="daily" className="w-full">
        <TabsList>
          <TabsTrigger value="daily">Relatório diário</TabsTrigger>
          <TabsTrigger value="saft">Resumo SAF-T</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <div className="space-y-2 pt-2">
            <div>
              <h1 className="text-2xl font-bold">Relatório diário</h1>
              <p className="text-sm text-muted-foreground">Totais por turno, método de pagamento e funcionário com exportação para PDF.</p>
            </div>
            <DailyShiftReport store={managerStore} />
          </div>
        </TabsContent>
        <TabsContent value="saft">
          <SaftReport mode="manager" storeName={managerStore} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
