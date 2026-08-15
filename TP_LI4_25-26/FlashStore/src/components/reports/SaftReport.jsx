import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useQuery } from '@tanstack/react-query';
import { api, formatApiError } from '@/api/apiClient';
import { AlertTriangle, Building2, ClipboardCheck, Download, FileCode2, FileText, ReceiptText, ShoppingCart, Tags, Truck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from '@/components/manager/StatsCard';

const periodOptions = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

const pieColors = ['#f97316', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04'];

function eur(value) {
  return `${Number(value || 0).toFixed(2)}€`;
}

function dateOnly(value) {
  return value ? String(value).split('T')[0] : '—';
}

function buildReport({ sales, products, suppliers, period, storeName, isAdmin }) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(period));

  const scopedSales = sales.filter((sale) => {
    const inPeriod = new Date(sale.created_date) >= cutoff;
    const inStore = isAdmin || sale.store === storeName;
    return inPeriod && inStore;
  });

  const completedSales = scopedSales.filter((sale) => sale.status !== 'cancelled');
  const cancelledSales = scopedSales.filter((sale) => sale.status === 'cancelled');
  const totalGross = completedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const totalTax = completedSales.reduce((sum, sale) => sum + Number(sale.total_iva || 0), 0);
  const totalNet = totalGross - totalTax;

  const customerNifs = Array.from(new Set(scopedSales.map((sale) => sale.customer_nif).filter(Boolean)));
  const stores = Array.from(new Set(completedSales.map((sale) => sale.store).filter(Boolean)));

  const byDay = {};
  const byStore = {};
  const byTax = {};
  const byCategory = {};

  for (const sale of completedSales) {
    const day = dateOnly(sale.created_date);
    if (!byDay[day]) byDay[day] = { date: day.slice(5), total: 0, count: 0 };
    byDay[day].total += Number(sale.total || 0);
    byDay[day].count += 1;

    const store = sale.store || 'Loja';
    if (!byStore[store]) byStore[store] = { store, total: 0, count: 0 };
    byStore[store].total += Number(sale.total || 0);
    byStore[store].count += 1;

    for (const item of sale.items || []) {
      const rate = Number(item.iva_rate || 0);
      const subtotal = Number(item.subtotal || 0);
      const tax = subtotal * rate / (100 + rate);
      const product = products.find((entry) => entry.id === item.product_id);
      const category = product?.category || 'Sem categoria';

      if (!byTax[rate]) byTax[rate] = { rate, taxable: 0, tax: 0, gross: 0 };
      byTax[rate].gross += subtotal;
      byTax[rate].tax += tax;
      byTax[rate].taxable += subtotal - tax;

      if (!byCategory[category]) byCategory[category] = { name: category, total: 0 };
      byCategory[category].total += subtotal;
    }
  }

  const invoices = completedSales.slice(0, 12).map((sale) => ({
    no: sale.invoice_number || sale.id,
    date: dateOnly(sale.created_date),
    store: sale.store,
    customer: sale.customer_nif || 'Consumidor final',
    gross: Number(sale.total || 0),
    tax: Number(sale.total_iva || 0),
  }));

  const fiscalDocuments = scopedSales.map((sale) => ({
    no: sale.invoice_number || sale.id,
    type: sale.document_type || 'Fatura Simplificada',
    status: sale.status === 'cancelled' ? 'Anulado' : 'Emitido',
    date: dateOnly(sale.created_date),
    store: sale.store,
    customer: sale.customer_nif || 'Consumidor final',
    gross: Number(sale.total || 0),
    tax: Number(sale.total_iva || 0),
  }));

  const fiscalDocumentsByType = fiscalDocuments.reduce((acc, document) => {
    if (!acc[document.type]) acc[document.type] = { type: document.type, count: 0, gross: 0 };
    acc[document.type].count += 1;
    acc[document.type].gross += document.gross;
    return acc;
  }, {});

  return {
    scopeLabel: isAdmin ? 'Cadeia FlashStore' : storeName,
    fiscalPeriod: `${dateOnly(cutoff.toISOString())} a ${dateOnly(new Date().toISOString())}`,
    stores,
    company: {
      name: isAdmin ? 'FlashStore' : `FlashStore · ${storeName}`,
      taxRegistrationNumber: '999999990',
      currency: 'EUR',
      accountingBasis: 'F',
      productId: 'FlashStore POS',
    },
    customers: customerNifs,
    totals: {
      invoices: completedSales.length,
      fiscalDocuments: scopedSales.length,
      cancelled: cancelledSales.length,
      products: products.length,
      suppliers: suppliers.length,
      customers: customerNifs.length || 1,
      receipts: completedSales.length,
      transports: 0,
      conferenceDocuments: 0,
      gross: totalGross,
      tax: totalTax,
      net: totalNet,
      avgTicket: completedSales.length ? totalGross / completedSales.length : 0,
    },
    dailyData: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    storeData: Object.values(byStore).sort((a, b) => b.total - a.total),
    taxData: Object.values(byTax).sort((a, b) => a.rate - b.rate),
    categoryData: Object.values(byCategory).sort((a, b) => b.total - a.total),
    fiscalDocumentsByType: Object.values(fiscalDocumentsByType).sort((a, b) => b.gross - a.gross),
    fiscalDocuments: fiscalDocuments.slice(0, 12),
    invoices,
  };
}

function exportPdf(report, title) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(title, margin, y);
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Âmbito: ${report.scopeLabel}`, margin, y);
  y += 16;
  doc.text(`Período fiscal: ${report.fiscalPeriod}`, margin, y);
  y += 22;

  const lines = [
    ['Cabeçalho', `${report.company.name} · NIF ${report.company.taxRegistrationNumber} · ${report.company.currency}`],
    ['Ficheiros mestre', `${report.totals.products} produtos · ${report.totals.suppliers} fornecedores · ${report.totals.customers} clientes (NIF)`],
    ['Documentos de origem', `${report.totals.fiscalDocuments} documentos fiscais · ${report.totals.cancelled} anulados · ${report.totals.receipts} recibos`],
    ['Resumo AT', 'Empresa, clientes com transações e documentos de venda do período'],
    [
      'Totais',
      `Líquido ${eur(report.totals.net)} · IVA ${eur(report.totals.tax)} · Total bruto ${eur(report.totals.gross)}`,
    ],
  ];

  for (const [label, value] of lines) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 95, y);
    y += 18;
  }

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('IVA por taxa', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  for (const row of report.taxData) {
    doc.text(`IVA ${row.rate}% · Base ${eur(row.taxable)} · Imposto ${eur(row.tax)} · Bruto ${eur(row.gross)}`, margin, y);
    y += 16;
  }

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Documentos de venda', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  for (const invoice of report.fiscalDocuments) {
    if (y > 760) {
      doc.addPage();
      y = 44;
    }
    doc.text(`${invoice.no} · ${invoice.status} · ${invoice.date} · ${invoice.store} · ${eur(invoice.gross)}`, margin, y);
    y += 15;
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

export default function SaftReport({ mode = 'manager', storeName = 'Braga Centro', embedInAdminLayout = false }) {
  const [period, setPeriod] = useState('30');
  const isAdmin = mode === 'admin';

  const { data: sales = [] } = useQuery({
    queryKey: ['report-sales', mode],
    queryFn: () => api.entities.Sale.list('-created_date', 2000),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['report-products'],
    queryFn: () => api.entities.Product.list('-created_date', 1000),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['report-suppliers'],
    queryFn: () => api.entities.Supplier.list('-created_date', 500),
  });

  const report = useMemo(() => buildReport({ sales, products, suppliers, period, storeName, isAdmin }), [isAdmin, period, products, sales, storeName, suppliers]);
  const title = isAdmin ? 'Relatório SAF-T PT da Cadeia' : 'Relatório SAF-T PT da Loja';
  const [exportingXml, setExportingXml] = useState(false);

  const exportSaftXml = async () => {
    setExportingXml(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(period));
      const from = cutoff.toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const blob = await api.saft.download({ from, to, store: isAdmin ? undefined : storeName });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAFT-PT_${from}_${to}${isAdmin ? '' : `_${storeName}`}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('SAF-T XML exportado.');
    } catch (err) {
      toast.error(formatApiError(err, 'Erro ao exportar SAF-T XML.'));
    } finally {
      setExportingXml(false);
    }
  };

  const toolbar = (
    <div className={`flex flex-col gap-2 sm:flex-row ${embedInAdminLayout ? 'sm:justify-end' : ''}`}>
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          {periodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={() => exportPdf(report, title)}>
        <Download className="mr-2 h-4 w-4" />
        PDF
      </Button>
      <Button type="button" onClick={exportSaftXml} disabled={exportingXml}>
        <FileCode2 className="mr-2 h-4 w-4" />
        {exportingXml ? 'A gerar XML...' : 'SAF-T XML'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {embedInAdminLayout ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border/60 pb-4">{toolbar}</div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Resumo alinhado com as ideias do SAF-T (Portugal): identificação da empresa, dados mestres e documentos de venda do período — linguagem simples para leitura humana.
            </p>
          </div>
          {toolbar}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatsCard
          title="Documentos fiscais"
          value={report.totals.fiscalDocuments}
          subtitle={`${report.totals.cancelled} anulados no período`}
          icon={ReceiptText}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <StatsCard
          title="Total bruto"
          value={eur(report.totals.gross)}
          subtitle="Valor com IVA incluído"
          icon={ShoppingCart}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatsCard
          title="IVA liquidado"
          value={eur(report.totals.tax)}
          subtitle="Total de imposto no período"
          icon={FileText}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatsCard
          title="Catálogo"
          value={report.totals.products}
          subtitle={`${report.totals.suppliers} fornecedores`}
          icon={Tags}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <StatsCard
          title="Clientes"
          value={report.totals.customers}
          subtitle="Com NIF ou consumidor final"
          icon={Users}
          color="text-cyan-700"
          bgColor="bg-cyan-50"
        />
        <StatsCard
          title="Lojas"
          value={isAdmin ? report.stores.length : 1}
          subtitle={report.scopeLabel}
          icon={Building2}
          color="text-slate-700"
          bgColor="bg-slate-100"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
          <div>
            <p className="text-xs text-muted-foreground">Nome</p>
            <p className="font-semibold">{report.company.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">NIF</p>
            <p className="font-semibold">{report.company.taxRegistrationNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Base de tributação</p>
            <p className="font-semibold">{report.company.accountingBasis} — regime de caixa (faturação)</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Moeda</p>
            <p className="font-semibold">{report.company.currency}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Período analisado</p>
            <p className="font-semibold">{report.fiscalPeriod}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{isAdmin ? 'Vendas por loja' : 'Vendas por dia'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={isAdmin ? report.storeData : report.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={isAdmin ? 'store' : 'date'} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => eur(value)} />
                <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={report.categoryData.slice(0, 7)} dataKey="total" nameKey="name" innerRadius={54} outerRadius={90}>
                  {report.categoryData.slice(0, 7).map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => eur(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes, fornecedores e produtos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="font-semibold">Clientes</p>
              <p className="text-muted-foreground">{report.totals.customers} identificadores distintos (NIF ou operações sem NIF) no período.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">Fornecedores</p>
              <p className="text-muted-foreground">{report.totals.suppliers} fornecedores no catálogo.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">Produtos</p>
              <p className="text-muted-foreground">{report.totals.products} artigos no catálogo.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos de documentos fiscais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <ReceiptText className="mb-2 h-4 w-4 text-primary" />
              <p className="font-semibold">Documentos de venda</p>
              <p className="text-muted-foreground">Faturas, faturas simplificadas, notas e anulados.</p>
            </div>
            <div className="rounded-lg border p-3">
              <ClipboardCheck className="mb-2 h-4 w-4 text-green-700" />
              <p className="font-semibold">Recibos</p>
              <p className="text-muted-foreground">{report.totals.receipts} recibos associados a vendas concluídas.</p>
            </div>
            <div className="rounded-lg border p-3">
              <Truck className="mb-2 h-4 w-4 text-slate-700" />
              <p className="font-semibold">Transporte/conferência</p>
              <p className="text-muted-foreground">{report.totals.transports} transportes · {report.totals.conferenceDocuments} conferências.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IVA por taxa</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground">Taxa</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground">Base tributável</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground">IVA</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground">Valor bruto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.taxData.map((row) => (
                  <tr key={row.rate}>
                    <td className="px-4 py-3 font-medium">IVA {row.rate}%</td>
                    <td className="px-4 py-3 text-right">{eur(row.taxable)}</td>
                    <td className="px-4 py-3 text-right">{eur(row.tax)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{eur(row.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo para comunicação à Autoridade Tributária</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-semibold">1. Identificação da empresa</p>
              <p className="text-muted-foreground">{report.company.name} · NIF {report.company.taxRegistrationNumber}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">2. Clientes com transações</p>
              <p className="text-muted-foreground">{report.totals.customers} clientes/NIF reportáveis no período escolhido.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">3. Documentos de venda fiscalmente relevantes</p>
              <p className="text-muted-foreground">{report.totals.fiscalDocuments} documentos, incluindo {report.totals.cancelled} anulados.</p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p>Este relatório é operacional e não substitui a exportação XML SAF-T oficial validada por software certificado.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos documentos fiscalmente relevantes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">N.º documento</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Data</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs text-muted-foreground">Loja</th>}
                <th className="px-4 py-3 text-left text-xs text-muted-foreground">Cliente / NIF</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground">IVA</th>
                <th className="px-4 py-3 text-right text-xs text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.fiscalDocuments.map((invoice) => (
                <tr key={invoice.no}>
                  <td className="px-4 py-3 font-medium">{invoice.no}</td>
                  <td className="px-4 py-3">{invoice.type}</td>
                  <td className="px-4 py-3">{invoice.status}</td>
                  <td className="px-4 py-3">{invoice.date}</td>
                  {isAdmin && <td className="px-4 py-3">{invoice.store}</td>}
                  <td className="px-4 py-3">{invoice.customer}</td>
                  <td className="px-4 py-3 text-right">{eur(invoice.tax)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{eur(invoice.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.fiscalDocuments.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Sem documentos no período selecionado.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
