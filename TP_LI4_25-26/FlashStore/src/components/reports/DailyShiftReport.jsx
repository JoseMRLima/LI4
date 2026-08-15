import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import { Calendar, CreditCard, Download, FileText, Receipt, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, formatApiError } from '@/api/apiClient';
import { toast } from 'sonner';

function eur(value) {
  return `${Number(value || 0).toFixed(2)}€`;
}

function pct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function loadImageDataUrl(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawLogoFallback(doc, x, y, size) {
  doc.setFillColor(249, 115, 22);
  doc.roundedRect(x, y, size, size, 10, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold').setFontSize(15);
  doc.text('FS', x + 11, y + 26);
}

function drawMetric(doc, x, y, w, label, value, note) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x, y, w, 58, 8, 8, 'FD');
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(label, x + 12, y + 17);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(value, x + 12, y + 38);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(note, x + 12, y + 51);
}

function drawBarGroup(doc, rows, x, y, w, title, valueKey, labelKey = 'name') {
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text(title, x, y);

  const chartY = y + 16;
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
  const barGap = 8;
  const barH = 12;

  rows.slice(0, 6).forEach((row, index) => {
    const yy = chartY + index * (barH + barGap);
    const label = String(row[labelKey] || '—').slice(0, 24);
    const value = Number(row[valueKey] || 0);
    const barW = Math.max(4, (value / max) * (w - 145));

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text(label, x, yy + 9);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x + 92, yy, w - 145, barH, 4, 4, 'F');
    doc.setFillColor(249, 115, 22);
    doc.roundedRect(x + 92, yy, barW, barH, 4, 4, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text(eur(value), x + w - 48, yy + 9);
  });
}

/**
 * UC07 — Relatório diário por caixa.
 * Exibe totais de vendas/anulações/devoluções de uma data,
 * com filtros opcionais por loja e por funcionário (caixa).
 */
export default function DailyShiftReport({ store, allowStoreSelection = false }) {
  const [date, setDate] = useState(todayISO());
  const [cashier, setCashier] = useState('');
  const [storeFilter, setStoreFilter] = useState(store || '');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.entities.User.list(),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => api.entities.Store.list(),
    enabled: allowStoreSelection,
  });

  const targetStore = allowStoreSelection ? storeFilter : store;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daily-report', date, targetStore, cashier],
    queryFn: () => api.reports.daily({ date, store: targetStore || undefined, cashier: cashier || undefined }),
  });

  const cashiersForStore = useMemo(
    () => users.filter((u) => u.role === 'cashier' && (!targetStore || u.store === targetStore)),
    [users, targetStore]
  );

  const totals = data?.totals || {};
  const ticket = data?.ticket_average || 0;
  const byMethod = data?.byMethod || [];
  const byCashier = data?.byCashier || [];
  const cancelled = data?.cancelledSales || [];
  const returnsRows = data?.returns || [];
  const refundedTotal = returnsRows.reduce((sum, row) => sum + Number(row.total_refunded || 0), 0);

  const cashierRows = useMemo(() => {
    const totalSales = Number(totals.total_sales || 0);
    return byCashier.map((row) => {
      const total = Number(row.total || 0);
      const transactions = Number(row.transactions || 0);
      return {
        ...row,
        name: row.cashier_name || row.cashier_email || '—',
        total,
        transactions,
        average: transactions ? total / transactions : 0,
        share: totalSales ? (total / totalSales) * 100 : 0,
      };
    });
  }, [byCashier, totals.total_sales]);

  const methodRows = byMethod.map((row) => ({
    method: row.method || 'Outro',
    total: Number(row.total || 0),
    count: Number(row.count || 0),
  }));

  const exportPdf = async () => {
    if (!data) return;
    try {
      const logoDataUrl = await loadImageDataUrl('/images/Flashstore.png');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 36;

      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageW, 842, 'F');
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, 28, pageW - margin * 2, 112, 14, 14, 'F');
      doc.setFillColor(249, 115, 22);
      doc.roundedRect(margin, 28, 8, 112, 4, 4, 'F');

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 24, 52, 48, 48, 12, 12, 'F');
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin + 30, 58, 36, 36);
      } else {
        drawLogoFallback(doc, margin + 30, 58, 36);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold').setFontSize(20);
      doc.text('Relatório diário de vendas', margin + 88, 68);
      doc.setFont('helvetica', 'normal').setFontSize(10);
      doc.setTextColor(226, 232, 240);
      doc.text('FlashStore Retail S.A.', margin + 88, 86);
      doc.text(`${date} · ${targetStore || 'Todas as lojas'} · ${cashier || 'Todos os funcionários'}`, margin + 88, 104);

      doc.setFillColor(255, 237, 213);
      doc.roundedRect(pageW - margin - 150, 58, 118, 38, 10, 10, 'F');
      doc.setTextColor(154, 52, 18);
      doc.setFont('helvetica', 'bold').setFontSize(9);
      doc.text('TOTAL DO DIA', pageW - margin - 132, 73);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold').setFontSize(14);
      doc.text(eur(totals.total_sales), pageW - margin - 132, 91);

      drawMetric(doc, margin, 164, 122, 'Total vendas', eur(totals.total_sales), `${totals.transactions || 0} talões`);
      drawMetric(doc, margin + 136, 164, 122, 'Ticket médio', eur(ticket), `${eur(totals.total_iva)} IVA`);
      drawMetric(doc, margin + 272, 164, 122, 'Anuladas', String(totals.cancelled || 0), 'vendas canceladas');
      drawMetric(doc, margin + 408, 164, 122, 'Devoluções', eur(refundedTotal), `${returnsRows.length} registos`);

      drawBarGroup(doc, cashierRows, margin, 270, 250, 'Desempenho por funcionário', 'total');
      drawBarGroup(doc, methodRows, margin + 288, 270, 250, 'Métodos de pagamento', 'total', 'method');

      let y = 446;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold').setFontSize(12);
      doc.text('Detalhe por funcionário', margin, y);
      y += 16;

      const headers = ['Funcionário', 'Talões', 'Total', 'Ticket médio', 'Peso'];
      const widths = [205, 58, 82, 82, 62];
      let x = margin;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, 520, 24, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold').setFontSize(8);
      headers.forEach((header, index) => {
        doc.text(header, x + 8, y + 15);
        x += widths[index];
      });
      y += 24;

      doc.setFont('helvetica', 'normal').setFontSize(8);
      cashierRows.slice(0, 14).forEach((row, index) => {
        if (y > 760) {
          doc.addPage();
          y = 44;
        }
        doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, 520, 24, 'F');
        x = margin;
        const cells = [row.name, row.transactions, eur(row.total), eur(row.average), pct(row.share)];
        cells.forEach((cell, cellIndex) => {
          doc.setTextColor(cellIndex === 0 ? 15 : 71, cellIndex === 0 ? 23 : 85, cellIndex === 0 ? 42 : 105);
          doc.text(String(cell), x + 8, y + 15);
          x += widths[cellIndex];
        });
        y += 24;
      });

      if (cancelled.length > 0 || returnsRows.length > 0) {
        y += 18;
        doc.setFont('helvetica', 'bold').setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('Ocorrências', margin, y);
        y += 16;
        doc.setFont('helvetica', 'normal').setFontSize(8);
        [...cancelled.map((row) => `Anulada · ${row.invoice_number} · ${eur(row.total)}`), ...returnsRows.map((row) => `Devolução · ${row.reason || 'Sem motivo'} · ${eur(row.total_refunded)}`)]
          .slice(0, 10)
          .forEach((line) => {
            if (y > 760) {
              doc.addPage();
              y = 44;
            }
            doc.text(line, margin, y);
            y += 13;
          });
      }

      doc.save(`relatorio-diario-${date}${targetStore ? `-${targetStore}` : ''}.pdf`);
    } catch (err) {
      toast.error(formatApiError(err, 'Erro ao gerar PDF.'));
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {allowStoreSelection && (
              <div>
                <Label className="text-xs">Loja</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                >
                  <option value="">Todas as lojas</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label className="text-xs">Funcionário</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
              >
                <option value="">Todos</option>
                {cashiersForStore.map((u) => (
                  <option key={u.id} value={u.email}>{u.full_name} · {u.email}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => refetch()}>Atualizar</Button>
              <Button onClick={exportPdf} disabled={!data}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-red-700">
            Erro ao carregar relatório: {formatApiError(error)}
          </CardContent>
        </Card>
      )}

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-slate-950 px-6 py-5 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-orange-200">
              <Calendar className="h-4 w-4" />
              {date} · {targetStore || 'Todas as lojas'}
            </div>
            <h2 className="mt-1 text-2xl font-bold">Relatório diário de vendas</h2>
            <p className="mt-1 text-sm text-slate-300">Resumo limpo do desempenho por funcionário e forma de pagamento.</p>
          </div>
          <div className="rounded-md bg-white/10 px-4 py-3 text-right">
            <p className="text-xs text-slate-300">Total líquido do dia</p>
            <p className="text-2xl font-extrabold">{eur(totals.total_sales)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {[
            ['Talões', totals.transactions || 0, 'transações concluídas'],
            ['Ticket médio', eur(ticket), `${eur(totals.total_iva)} de IVA`],
            ['Anuladas', totals.cancelled || 0, 'vendas canceladas'],
            ['Devoluções', eur(refundedTotal), `${returnsRows.length} registos`],
          ].map(([label, value, note]) => (
            <div key={label} className="bg-white p-5">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold">Desempenho por funcionário</h3>
            </div>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Funcionário</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Talões</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ticket médio</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cashierRows.map((row) => (
                    <tr key={row.cashier_email || row.name} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-right">{row.transactions}</td>
                      <td className="px-4 py-3 text-right font-semibold">{eur(row.total)}</td>
                      <td className="px-4 py-3 text-right">{eur(row.average)}</td>
                      <td className="px-4 py-3 text-right">{pct(row.share)}</td>
                    </tr>
                  ))}
                  {cashierRows.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan="5" className="px-4 py-10 text-center text-muted-foreground">Sem vendas neste filtro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6 xl:col-span-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold">Métodos de pagamento</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={methodRows} layout="vertical" margin={{ top: 4, right: 18, left: 18, bottom: 4 }}>
                  <CartesianGrid stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="method" width={92} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => eur(value)} />
                  <Bar dataKey="total" fill="#f97316" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold">Comparativo de totais</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cashierRows} margin={{ top: 4, right: 14, left: 0, bottom: 32 }}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-18} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => eur(value)} />
                  <Bar dataKey="total" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {(cancelled.length > 0 || returnsRows.length > 0) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {cancelled.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Vendas anuladas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs">Documento</th>
                      <th className="px-4 py-2 text-left text-xs">Funcionário</th>
                      <th className="px-4 py-2 text-right text-xs">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cancelled.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2 font-mono text-xs">{row.invoice_number}</td>
                        <td className="px-4 py-2">{row.cashier_name || '—'}</td>
                        <td className="px-4 py-2 text-right">{eur(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {returnsRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Devoluções
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs">Devolução</th>
                      <th className="px-4 py-2 text-left text-xs">Motivo</th>
                      <th className="px-4 py-2 text-right text-xs">Reembolsado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {returnsRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2 font-mono text-xs">{row.id.slice(-8)}</td>
                        <td className="px-4 py-2">{row.reason || '—'}</td>
                        <td className="px-4 py-2 text-right">{eur(row.total_refunded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
