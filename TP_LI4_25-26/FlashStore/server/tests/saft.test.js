// server/tests/saft.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { generateSaftXml, escapeXml } from '../saft.js';
import crypto from 'crypto';

describe('SAFT-PT Generator', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    createSaftTestSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('escapeXml - Testes de Sucesso', () => {
    it('should escape special XML characters', () => {
      expect(escapeXml('a&b')).toBe('a&amp;b');
      expect(escapeXml('a<b')).toBe('a&lt;b');
      expect(escapeXml('a>b')).toBe('a&gt;b');
      expect(escapeXml('a"b')).toBe('a&quot;b');
      expect(escapeXml('a\'b')).toBe('a&apos;b');
    });

    it('should not escape normal text', () => {
      expect(escapeXml('texto normal')).toBe('texto normal');
    });

    it('should handle Portuguese special characters', () => {
      expect(escapeXml('café ação órgão')).toBe('café ação órgão');
      expect(escapeXml('Nº Contribuinte')).toBe('Nº Contribuinte');
    });
  });

  describe('escapeXml - Testes de Exceção', () => {
    it('should handle null and undefined', () => {
      expect(escapeXml(null)).toBe('');
      expect(escapeXml(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      expect(escapeXml('')).toBe('');
    });

    it('should handle numbers and booleans', () => {
      expect(escapeXml(123)).toBe('123');
      expect(escapeXml(0)).toBe('0');
      expect(escapeXml(true)).toBe('true');
      expect(escapeXml(false)).toBe('false');
    });

    it('should handle multiple special characters in sequence', () => {
      expect(escapeXml('&&<<>>""\'\'')).toBe('&amp;&amp;&lt;&lt;&gt;&gt;&quot;&quot;&apos;&apos;');
    });

    it('should handle XML injection attempt', () => {
      const malicious = '<script>alert("xss")</script>';
      const escaped = escapeXml(malicious);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });
  });

  describe('generateSaftXml - Testes de Sucesso', () => {
    it('should generate valid XML structure with all required elements', () => {
      seedBasicTestData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<AuditFile');
      expect(xml).toContain('</AuditFile>');
      expect(xml).toContain('<Header>');
      expect(xml).toContain('<MasterFiles>');
      expect(xml).toContain('<SourceDocuments>');
    });

    it('should include company header information correctly', () => {
      seedBasicTestData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<CompanyID>999999990</CompanyID>');
      expect(xml).toContain('<TaxRegistrationNumber>999999990</TaxRegistrationNumber>');
      expect(xml).toContain('<CompanyName>FlashStore Retail S.A.</CompanyName>');
      expect(xml).toContain('<CurrencyCode>EUR</CurrencyCode>');
      expect(xml).toContain('<FiscalYear>2026</FiscalYear>');
    });

    it('should include sales invoices within date range', () => {
      seedBasicTestData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-15',
        endDate: '2026-01-20'
      });
      
      expect(xml).toContain('<NumberOfEntries>1</NumberOfEntries>');
      expect(xml).toContain('<SalesInvoices>');
      expect(xml).toContain('</SalesInvoices>');
      expect(xml).toContain('<InvoiceNo>FS-001</InvoiceNo>');
    });

    it('should handle multiple sales with different tax rates', () => {
      seedMultipleTaxRatesData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<TaxCode>RED</TaxCode>');  // 6%
      expect(xml).toContain('<TaxCode>INT</TaxCode>');   // 13%
      expect(xml).toContain('<TaxCode>NOR</TaxCode>');   // 23%
    });

    it('should compute hash chain correctly for multiple invoices', () => {
      seedMultipleInvoicesData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      const hashMatches = xml.match(/<Hash>[^<]+<\/Hash>/g);
      expect(hashMatches).toBeTruthy();
      expect(hashMatches.length).toBeGreaterThanOrEqual(2);
      
      // O primeiro hash não deve ser '0' para faturas normais
      if (hashMatches.length > 1) {
        expect(hashMatches[0]).not.toBe('<Hash>0</Hash>');
        // Cada hash deve ser diferente (encadeamento)
        expect(hashMatches[0]).not.toBe(hashMatches[1]);
      }
    });

    it('should include customers master data', () => {
      seedCustomerData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<Customer>');
      expect(xml).toContain('<CustomerTaxID>123456789</CustomerTaxID>');
      expect(xml).toContain('<CustomerTaxID>999999990</CustomerTaxID>'); // consumidor final
    });

    it('should include products master data', () => {
      seedProductsData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<Product>');
      expect(xml).toContain('<ProductCode>PROD001</ProductCode>');
      expect(xml).toContain('<ProductDescription>Produto A</ProductDescription>');
    });

    it('should handle payment methods correctly', () => {
      seedPaymentMethodsData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<PaymentMechanism>NU</PaymentMechanism>');  // Numerário (dinheiro)
      expect(xml).toContain('<PaymentMechanism>MB</PaymentMechanism>');  // MB Way
    });
  });

  describe('generateSaftXml - Testes de Exceção', () => {
    it('should handle empty sales period', () => {
      seedBasicTestData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      });
      
      expect(xml).toContain('<NumberOfEntries>0</NumberOfEntries>');
      expect(xml).toContain('<TotalDebit>0.00</TotalDebit>');
      expect(xml).toContain('<TotalCredit>0.00</TotalCredit>');
      expect(xml).not.toContain('<Invoice>');
    });

    it('should handle store with no sales', () => {
      const xml = generateSaftXml(db, {
        store: 'Loja Vazia',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<NumberOfEntries>0</NumberOfEntries>');
      expect(xml).toContain('<CompanyName>FlashStore Retail S.A.</CompanyName>');
    });

    it('should exclude cancelled sales', () => {
      seedCancelledSalesData(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<NumberOfEntries>1</NumberOfEntries>');
      expect(xml).toContain('<InvoiceNo>FS-001</InvoiceNo>');
      expect(xml).not.toContain('<InvoiceNo>FS-002-CANCEL</InvoiceNo>');
    });

    it('should handle sales with zero or negative amounts', () => {
      seedZeroAmountData(db);
      expect(() => {
        generateSaftXml(db, {
          store: 'Braga Centro',
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        });
      }).not.toThrow();
    });

    it('should handle missing store information gracefully', () => {
      const xml = generateSaftXml(db, {
        store: 'Loja Inexistente',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      // Deve usar valores padrão
      expect(xml).toContain('<TaxRegistrationNumber>999999990</TaxRegistrationNumber>');
      expect(xml).toContain('<CompanyName>FlashStore Retail S.A.</CompanyName>');
    });

    it('should handle sales with missing products', () => {
      seedSaleWithMissingProduct(db);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain('<Invoice>');
      expect(xml).not.toContain('<ProductCode></ProductCode>');
    });

    it('should handle invalid date formats gracefully', () => {
      expect(() => {
        generateSaftXml(db, {
          store: 'Braga Centro',
          startDate: '2026/01/01',  // formato inválido
          endDate: '2026-01-31'
        });
      }).not.toThrow();
    });
  });

  describe('generateSaftXml - Testes de Segurança', () => {
    it('should prevent XML injection in company name', () => {
      db.exec(`UPDATE stores SET name = '<script>alert("xss")</script>' WHERE id = 's1'`);
      seedBasicTestData(db);
      
      const xml = generateSaftXml(db, {
        store: '<script>alert("xss")</script>',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).not.toContain('<script>alert');
      expect(xml).toContain('&lt;script&gt;alert');
    });

    it('should prevent XML injection in invoice numbers', () => {
      db.exec(`DELETE FROM sales`);
      db.exec(`DELETE FROM sale_items`);
      db.prepare(`
        INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('sale_xss', 'Braga Centro', 10.00, 1.87, 'Numerário', 
             '<malicious>', 'completed', '2026-01-16T10:00:00Z', 10.00);
      
      db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('item_xss', 'sale_xss', 'p1', 'Produto', 1, 10.00, 23, 10.00);
      
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).not.toContain('<InvoiceNo><malicious></InvoiceNo>');
      expect(xml).toContain('&lt;malicious&gt;');
    });

    it('should prevent XML injection in customer data', () => {
      seedBasicTestData(db);
      // Usar prepared statement para evitar problemas com caracteres especiais no SQL
      db.prepare(`UPDATE sales SET customer_nif = ? WHERE id = ?`).run('123&<script>', 'sale1');
      
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).not.toContain('<script>');
      expect(xml).toContain('&lt;script&gt;');
    });

    it('should prevent XML injection in product descriptions', () => {
      // Primeiro criar a venda, depois o item com XSS
      db.prepare(`
        INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('sale_xss_prod', 'Braga Centro', 10.00, 1.87, 'Numerário', 'FS-XSS', 'completed', '2026-01-16T10:00:00Z', 10.00);
      
      // Inserir o item malicioso
      db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('item_xss_prod', 'sale_xss_prod', 'p_xss', '<img src=x onerror=alert(1)>', 1, 10.00, 23, 10.00);
      
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).not.toContain('<img src=x onerror=alert(1)>');
      expect(xml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('should maintain hash integrity even with special characters', () => {
      seedBasicTestData(db);
      db.prepare(`UPDATE sales SET invoice_number = ? WHERE id = ?`).run('FS-001&Special', 'sale1');
      
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      const hashMatch = xml.match(/<Hash>([^<]+)<\/Hash>/);
      expect(hashMatch).toBeTruthy();
      expect(hashMatch[1].length).toBeGreaterThan(0);
      // Hash deve ser válido base64
      expect(() => Buffer.from(hashMatch[1], 'base64')).not.toThrow();
    });

    it('should not expose database errors in output', () => {
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: 'invalid-date',
        endDate: '2026-01-31'
      });
      
      // Não deve conter mensagens de erro SQL
      expect(xml).not.toContain('SQLITE');
      expect(xml).not.toContain('Error');
      expect(xml).not.toContain('error');
    });
  });

  describe('generateSaftXml - Testes de Limite', () => {
    it('should handle large number of sales', () => {
      seedLargeDataset(db, 100);
      const xml = generateSaftXml(db, {
        store: 'Braga Centro',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain(`<NumberOfEntries>100</NumberOfEntries>`);
      const invoiceCount = (xml.match(/<InvoiceNo>/g) || []).length;
      expect(invoiceCount).toBe(100);
    });

    it('should handle very long text fields', () => {
      const longName = 'A'.repeat(1000);
      db.prepare(`UPDATE stores SET name = ? WHERE id = ?`).run(longName, 's1');
      seedBasicTestData(db);
      
      const xml = generateSaftXml(db, {
        store: longName,
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(xml).toContain(longName);
    });
  });
});

// Helper functions for database setup
function createSaftTestSchema(db) {
  db.exec(`
    CREATE TABLE stores (id TEXT PRIMARY KEY, name TEXT, nif TEXT, address TEXT, city TEXT, company_name TEXT, postal_code TEXT);
    CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, barcode TEXT, category TEXT, price REAL);
    CREATE TABLE sales (
      id TEXT PRIMARY KEY, store TEXT, total REAL, total_iva REAL, payment_method TEXT,
      customer_nif TEXT, cashier_email TEXT, invoice_number TEXT, document_type TEXT,
      status TEXT, created_date TEXT, amount_paid REAL
    );
    CREATE TABLE sale_items (
      id TEXT PRIMARY KEY, sale_id TEXT, product_id TEXT, product_name TEXT,
      quantity REAL, unit_price REAL, iva_rate REAL, subtotal REAL
    );
    CREATE TABLE sale_returns (
      id TEXT PRIMARY KEY, sale_id TEXT, original_sale_id TEXT, total_refunded REAL,
      reason TEXT, created_at TEXT
    );
    CREATE TABLE sale_return_items (
      id TEXT PRIMARY KEY, return_id TEXT, product_id TEXT, product_name TEXT,
      quantity REAL, refund_amount REAL
    );
    INSERT INTO stores (id, name, nif, company_name, address, city, postal_code) 
    VALUES ('s1', 'Braga Centro', '999999990', 'FlashStore Retail S.A.', 'Rua Exemplo, 1', 'Braga', '4700-000');
  `);
}

function seedBasicTestData(db) {
  db.exec(`DELETE FROM sales`);
  db.exec(`DELETE FROM sale_items`);
  
  db.prepare(`
    INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('sale1', 'Braga Centro', 10.00, 1.87, 'Numerário', 'FS-001', 'completed', '2026-01-16T10:00:00Z', 10.00);
  
  db.prepare(`
    INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('item1', 'sale1', 'p1', 'Produto Teste', 1, 10.00, 23, 10.00);
}

function seedMultipleTaxRatesData(db) {
  db.exec(`DELETE FROM sales`);
  db.exec(`DELETE FROM sale_items`);
  
  // Venda com IVA 6%
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_red', 'Braga Centro', 5.30, 0.30, 'Numerário', 'FS-RED', 'completed', '2026-01-16T10:00:00Z', 5.30);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item_red', 'sale_red', 'p_red', 'Produto Taxa Reduzida', 1, 5.30, 6, 5.30);
  
  // Venda com IVA 13%
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_int', 'Braga Centro', 11.30, 1.30, 'Numerário', 'FS-INT', 'completed', '2026-01-17T10:00:00Z', 11.30);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item_int', 'sale_int', 'p_int', 'Produto Taxa Intermédia', 1, 11.30, 13, 11.30);
  
  // Venda com IVA 23%
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_nor', 'Braga Centro', 12.30, 2.30, 'Numerário', 'FS-NOR', 'completed', '2026-01-18T10:00:00Z', 12.30);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item_nor', 'sale_nor', 'p_nor', 'Produto Taxa Normal', 1, 12.30, 23, 12.30);
}

function seedMultipleInvoicesData(db) {
  seedBasicTestData(db);
  
  // Adicionar segunda fatura
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale2', 'Braga Centro', 20.00, 3.74, 'mbway', 'FS-002', 'completed', '2026-01-17T10:00:00Z', 20.00);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item2', 'sale2', 'p2', 'Produto Teste 2', 2, 10.00, 23, 20.00);
}

function seedCustomerData(db) {
  seedBasicTestData(db);
  db.prepare(`UPDATE sales SET customer_nif = ? WHERE id = ?`).run('123456789', 'sale1');
}

function seedProductsData(db) {
  db.exec(`DELETE FROM products`);
  db.exec(`INSERT INTO products (id, name, barcode, category) VALUES ('p1', 'Produto A', 'PROD001', 'Geral')`);
  seedBasicTestData(db);
}

function seedPaymentMethodsData(db) {
  // Limpar todos os dados existentes
  db.exec(`DELETE FROM sale_items`);
  db.exec(`DELETE FROM sales`);
  
  // Inserir venda com dinheiro
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_cash', 'Braga Centro', 10.00, 1.87, 'dinheiro', 'FS-CASH', 'completed', '2026-01-16T10:00:00Z', 10.00);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item_cash', 'sale_cash', 'p1', 'Produto Dinheiro', 1, 10.00, 23, 10.00);
  
  // Inserir venda com MB Way
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_mb', 'Braga Centro', 20.00, 3.74, 'mbway', 'FS-MB', 'completed', '2026-01-17T10:00:00Z', 20.00);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item_mb', 'sale_mb', 'p2', 'Produto MB Way', 2, 10.00, 23, 20.00);
}

function seedCancelledSalesData(db) {
  seedBasicTestData(db);
  
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_canc', 'Braga Centro', 50.00, 9.35, 'Numerário', 'FS-002-CANCEL', 'cancelled', '2026-01-17T10:00:00Z', 50.00);
}

function seedZeroAmountData(db) {
  db.exec(`DELETE FROM sales`);
  db.exec(`DELETE FROM sale_items`);
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_zero', 'Braga Centro', 0.00, 0.00, 'Numerário', 'FS-ZERO', 'completed', '2026-01-16T10:00:00Z', 0.00);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item_zero', 'sale_zero', 'p_zero', 'Produto Zero', 1, 0.00, 23, 0.00);
}

function seedSaleWithMissingProduct(db) {
  db.exec(`DELETE FROM sales`);
  db.exec(`DELETE FROM sale_items`);
  
  // Criar venda sem items (produto em falta)
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale_no_prod', 'Braga Centro', 15.00, 2.80, 'Numerário', 'FS-NOPROD', 'completed', '2026-01-16T10:00:00Z', 15.00);
}

function seedLargeDataset(db, count) {
  db.exec(`DELETE FROM sales`);
  db.exec(`DELETE FROM sale_items`);
  
  const insertSale = db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const insertItem = db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const id = `sale${i}`;
      const day = 10 + Math.floor(i / 5);
      insertSale.run(id, 'Braga Centro', 10.00, 1.87, 'Numerário', `FS-${String(i).padStart(3, '0')}`, 
                     'completed', `2026-01-${String(day).padStart(2, '0')}T10:00:00Z`, 10.00);
      insertItem.run(`item${i}`, id, 'p1', `Produto ${i}`, 1, 10.00, 23, 10.00);
    }
  });
  
  insertMany();
}
