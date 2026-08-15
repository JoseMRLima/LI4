/**
 * FlashStore — Gerador SAFT-PT (RF17, RNF11)
 *
 * Estrutura conforme Portaria n.º 321-A/2007 (versão 1.04_01).
 * Hash encadeado por documento: SHA-256 de (hash_anterior + data_fatura + data_sistema + nº_fatura + total_bruto).
 * Nota: a certificação AT real requer chave RSA registada — esta implementação usa SHA-256 como hash de integridade
 * auditável internamente, indicado como software não certificado (SoftwareCertificateNumber = 0).
 */

const crypto = require('crypto');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(str) {
  return String(str || '').slice(0, 10);
}

function isoDateTime(str) {
  const s = String(str || '');
  if (s.includes('T')) return s.slice(0, 19);
  return `${s.slice(0, 10)}T00:00:00`;
}

function taxCode(rate) {
  const r = Number(rate || 23);
  if (r <= 6) return 'RED';
  if (r <= 13) return 'INT';
  return 'NOR';
}

/**
 * Calcula hash encadeado conforme lógica AT (simplificado com SHA-256):
 * hash_i = SHA256(hash_{i-1} + ";" + InvoiceDate + ";" + SystemEntryDate + ";" + InvoiceNo + ";" + GrossTotal)
 */
function computeHash(prevHash, invoiceDate, systemEntryDate, invoiceNo, grossTotal) {
  const data = [prevHash, invoiceDate, systemEntryDate, invoiceNo, grossTotal.toFixed(2)].join(';');
  return crypto.createHash('sha256').update(data, 'utf8').digest('base64');
}

function buildSaftXml(db, { store, startDate, endDate }) {
  const fromDate = isoDate(startDate);
  const toDate = isoDate(endDate);
  const fiscalYear = fromDate.slice(0, 4);
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 19);
  const period = Number(fromDate.slice(5, 7));

  // --- Sales e items ---
  const salesRows = db.prepare(`
    SELECT * FROM sales
    WHERE store = ? AND created_date >= ? AND created_date < ?
      AND status != 'cancelled'
    ORDER BY created_date ASC
  `).all(store, `${fromDate}T00:00:00`, `${toDate}T23:59:59.999`);

  const itemsStmt = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');

  // --- Produtos usados ---
  const usedProductIds = new Set();
  const salesWithItems = salesRows.map((s) => {
    const items = itemsStmt.all(s.id);
    items.forEach((i) => usedProductIds.add(i.product_id));
    return { ...s, items };
  });

  const products = usedProductIds.size > 0
    ? db.prepare(`SELECT * FROM products WHERE id IN (${[...usedProductIds].map(() => '?').join(',')})`).all(...usedProductIds)
    : [];

  // --- Clientes únicos ---
  const nifSet = new Set();
  salesRows.forEach((s) => { if (s.customer_nif && s.customer_nif !== '') nifSet.add(s.customer_nif); });
  nifSet.add('999999990'); // consumidor final sempre presente

  // --- Devoluções ---
  const returnsRows = db.prepare(`
    SELECT sr.*, s.store, s.cashier_email FROM sale_returns sr
    JOIN sales s ON sr.sale_id = s.id
    WHERE s.store = ? AND sr.created_at >= ? AND sr.created_at < ?
    ORDER BY sr.created_at ASC
  `).all(store, `${fromDate}T00:00:00`, `${toDate}T23:59:59.999`);
  const returnItemsStmt = db.prepare('SELECT * FROM sale_return_items WHERE return_id = ?');

  // --- Informação da loja ---
  const storeRow = db.prepare('SELECT * FROM stores WHERE name = ? LIMIT 1').get(store) || {};
  const companyNif = storeRow.nif || '999999990';
  const companyName = storeRow.company_name || 'FlashStore Retail S.A.';
  const companyAddress = storeRow.address || 'Rua Exemplo, 1';
  const companyCity = storeRow.city || 'Braga';
  const companyPostal = storeRow.postal_code || '4700-000';

  // --- XML: MasterFiles → Customers ---
  const customersXml = [...nifSet].map((nif) => `
    <Customer>
      <CustomerID>${escapeXml(nif === '999999990' ? 'CONS-FINAL' : `CLI-${nif}`)}</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>${escapeXml(nif)}</CustomerTaxID>
      <CompanyName>${escapeXml(nif === '999999990' ? 'Consumidor final' : 'Cliente')}</CompanyName>
      <BillingAddress>
        <AddressDetail>Desconhecido</AddressDetail>
        <City>Desconhecido</City>
        <PostalCode>0000-000</PostalCode>
        <Country>PT</Country>
      </BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`).join('');

  // --- XML: MasterFiles → Products ---
  const productsXml = products.map((p) => `
    <Product>
      <ProductType>P</ProductType>
      <ProductCode>${escapeXml(p.barcode || p.id)}</ProductCode>
      <ProductGroup>${escapeXml(p.category || 'Geral')}</ProductGroup>
      <ProductDescription>${escapeXml(p.name)}</ProductDescription>
      <ProductNumberCode>${escapeXml(p.barcode || p.id)}</ProductNumberCode>
      <CustomsDetails/>
    </Product>`).join('');

  // --- XML: TaxTable ---
  const taxTableXml = `
    <TaxTableEntry>
      <TaxType>IVA</TaxType>
      <TaxCountryRegion>PT</TaxCountryRegion>
      <TaxCode>RED</TaxCode>
      <Description>Taxa Reduzida</Description>
      <TaxPercentage>6.00</TaxPercentage>
    </TaxTableEntry>
    <TaxTableEntry>
      <TaxType>IVA</TaxType>
      <TaxCountryRegion>PT</TaxCountryRegion>
      <TaxCode>INT</TaxCode>
      <Description>Taxa Intermédia</Description>
      <TaxPercentage>13.00</TaxPercentage>
    </TaxTableEntry>
    <TaxTableEntry>
      <TaxType>IVA</TaxType>
      <TaxCountryRegion>PT</TaxCountryRegion>
      <TaxCode>NOR</TaxCode>
      <Description>Taxa Normal</Description>
      <TaxPercentage>23.00</TaxPercentage>
    </TaxTableEntry>`;

  // --- Hash encadeado e XML de faturas ---
  let prevHash = '0';
  let totalCredit = 0;
  let totalDebit = 0;

  const invoicesXml = salesWithItems.map((sale) => {
    const invoiceDate = isoDate(sale.created_date);
    const systemEntryDate = isoDateTime(sale.created_date);
    const invoiceNo = escapeXml(sale.invoice_number || sale.id);
    const grossTotal = Number(sale.total || 0);
    const netTotal = grossTotal - Number(sale.total_iva || 0);
    const taxPayable = Number(sale.total_iva || 0);

    const hash = computeHash(prevHash, invoiceDate, systemEntryDate, invoiceNo, grossTotal);
    prevHash = hash;
    totalCredit += grossTotal;

    const linesXml = sale.items.map((item, idx) => {
      const credit = Number(item.subtotal || 0);
      const unitPrice = Number(item.unit_price || 0);
      const qty = Number(item.quantity || 0);
      const ivaPct = Number(item.iva_rate || 23);
      const taxAmt = (credit * ivaPct) / (100 + ivaPct);
      return `
        <Line>
          <LineNumber>${idx + 1}</LineNumber>
          <ProductCode>${escapeXml(item.product_id)}</ProductCode>
          <ProductDescription>${escapeXml(item.product_name)}</ProductDescription>
          <Quantity>${qty.toFixed(4)}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${unitPrice.toFixed(4)}</UnitPrice>
          <TaxPointDate>${invoiceDate}</TaxPointDate>
          <References/>
          <Description>${escapeXml(item.product_name)}</Description>
          <CreditAmount>${credit.toFixed(2)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>PT</TaxCountryRegion>
            <TaxCode>${taxCode(ivaPct)}</TaxCode>
            <TaxPercentage>${ivaPct.toFixed(2)}</TaxPercentage>
          </Tax>
          <TaxExemptionReason/>
          <TaxExemptionCode/>
          <SettlementAmount>0.00</SettlementAmount>
        </Line>`;
    }).join('');

    const customerId = (sale.customer_nif && sale.customer_nif !== '') ? `CLI-${sale.customer_nif}` : 'CONS-FINAL';
    const payMethod = sale.payment_method === 'dinheiro' ? 'NU' : sale.payment_method === 'mbway' ? 'MB' : 'CC';

    return `
      <Invoice>
        <InvoiceNo>${invoiceNo}</InvoiceNo>
        <ATCUD>0</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${systemEntryDate}</InvoiceStatusDate>
          <SourceID>${escapeXml(sale.cashier_email || 'system')}</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${escapeXml(hash)}</Hash>
        <HashControl>1</HashControl>
        <Period>${period}</Period>
        <InvoiceDate>${invoiceDate}</InvoiceDate>
        <InvoiceType>FS</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>${escapeXml(sale.cashier_email || 'system')}</SourceID>
        <SystemEntryDate>${systemEntryDate}</SystemEntryDate>
        <CustomerID>${escapeXml(customerId)}</CustomerID>
        ${linesXml}
        <DocumentTotals>
          <TaxPayable>${taxPayable.toFixed(2)}</TaxPayable>
          <NetTotal>${netTotal.toFixed(2)}</NetTotal>
          <GrossTotal>${grossTotal.toFixed(2)}</GrossTotal>
          <Settlement>
            <SettlementAmount>0.00</SettlementAmount>
          </Settlement>
          <Payment>
            <PaymentMechanism>${payMethod}</PaymentMechanism>
            <PaymentAmount>${Number(sale.amount_paid || grossTotal).toFixed(2)}</PaymentAmount>
            <PaymentDate>${invoiceDate}</PaymentDate>
          </Payment>
        </DocumentTotals>
      </Invoice>`;
  }).join('');

  // --- Devoluções como Notas de Crédito ---
  const creditNotesXml = returnsRows.map((ret, idx) => {
    const items = returnItemsStmt.all(ret.id);
    const refDate = isoDate(ret.created_at);
    const sysDate = isoDateTime(ret.created_at);
    const ncNo = `NC/${String(idx + 1).padStart(4, '0')}/${fiscalYear}`;
    const gross = Number(ret.total_refunded || 0);
    totalDebit += gross;

    const linesXml = items.map((item, li) => `
        <Line>
          <LineNumber>${li + 1}</LineNumber>
          <ProductCode>${escapeXml(item.product_id)}</ProductCode>
          <ProductDescription>${escapeXml(item.product_name || '')}</ProductDescription>
          <Quantity>${Number(item.quantity).toFixed(4)}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${(Number(item.refund_amount) / Math.max(Number(item.quantity), 1)).toFixed(4)}</UnitPrice>
          <TaxPointDate>${refDate}</TaxPointDate>
          <References>
            <Reference>${escapeXml(ret.original_sale_id || '')}</Reference>
            <Reason>${escapeXml(ret.reason || 'Devolução')}</Reason>
          </References>
          <Description>Devolução — ${escapeXml(item.product_name || '')}</Description>
          <DebitAmount>${Number(item.refund_amount).toFixed(2)}</DebitAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>PT</TaxCountryRegion>
            <TaxCode>NOR</TaxCode>
            <TaxPercentage>23.00</TaxPercentage>
          </Tax>
          <TaxExemptionReason/>
          <TaxExemptionCode/>
          <SettlementAmount>0.00</SettlementAmount>
        </Line>`).join('');

    return `
      <Invoice>
        <InvoiceNo>${escapeXml(ncNo)}</InvoiceNo>
        <ATCUD>0</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${sysDate}</InvoiceStatusDate>
          <SourceID>${escapeXml(ret.cashier_email || 'system')}</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>0</Hash>
        <HashControl>1</HashControl>
        <Period>${period}</Period>
        <InvoiceDate>${refDate}</InvoiceDate>
        <InvoiceType>NC</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>${escapeXml(ret.cashier_email || 'system')}</SourceID>
        <SystemEntryDate>${sysDate}</SystemEntryDate>
        <CustomerID>CONS-FINAL</CustomerID>
        ${linesXml}
        <DocumentTotals>
          <TaxPayable>0.00</TaxPayable>
          <NetTotal>${gross.toFixed(2)}</NetTotal>
          <GrossTotal>${gross.toFixed(2)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`;
  }).join('');

  const totalEntries = salesWithItems.length + returnsRows.length;

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="urn:OECD:StandardAuditFile-Tax:PT_1.04_01 SAFTPT.xsd">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${escapeXml(companyNif)}</CompanyID>
    <TaxRegistrationNumber>${escapeXml(companyNif)}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXml(companyName)}</CompanyName>
    <BusinessName>${escapeXml(store)}</BusinessName>
    <CompanyAddress>
      <AddressDetail>${escapeXml(companyAddress)}</AddressDetail>
      <City>${escapeXml(companyCity)}</City>
      <PostalCode>${escapeXml(companyPostal)}</PostalCode>
      <Country>PT</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${fromDate}</StartDate>
    <EndDate>${toDate}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${nowIso.slice(0, 10)}</DateCreated>
    <TaxEntity>${escapeXml(store)}</TaxEntity>
    <ProductCompanyTaxID>${escapeXml(companyNif)}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>FlashStore/FlashStore Retail</ProductID>
    <ProductVersion>1.0.0</ProductVersion>
  </Header>
  <MasterFiles>
    ${customersXml}
    ${productsXml}
    <TaxTable>
      ${taxTableXml}
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${totalEntries}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>
      ${invoicesXml}
      ${creditNotesXml}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>
`;
}

module.exports = { generateSaftXml: buildSaftXml, escapeXml };
