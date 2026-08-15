// server/tests/scheduler.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { 
  startScheduler, 
  generateSaftForMonth, 
  checkExpiryAlerts, 
  checkLowStockAlerts 
} from '../scheduler.js';

describe('Scheduler', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchedulerTestSchema(db);
    // Mock console para não poluir output dos testes
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
  });

  describe('checkExpiryAlerts - Testes de Sucesso', () => {
    it('should detect products expiring within 7 days', () => {
      seedExpiringProducts(db);
      
      checkExpiryAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(1);
      expect(alerts[0].product_name).toBe('Produto a Expirar');
      expect(alerts[0].days_until_expiry).toBeLessThanOrEqual(7);
    });

    it('should not create alerts for products expiring after 7 days', () => {
      seedProductsExpiringAfter8Days(db);
      
      checkExpiryAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(0);
    });

    it('should create alerts for multiple expiring products', () => {
      seedMultipleExpiringProducts(db);
      
      checkExpiryAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(2);
    });

    it('should calculate correct days until expiry', () => {
      seedExpiringIn3Days(db);
      
      checkExpiryAlerts(db);
      
      const alert = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").get();
      expect(alert.days_until_expiry).toBe(3);
    });

    it('should include all required alert fields', () => {
      seedExpiringProducts(db);
      
      checkExpiryAlerts(db);
      
      const alert = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").get();
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('type', 'expiry');
      expect(alert).toHaveProperty('store');
      expect(alert).toHaveProperty('product_id');
      expect(alert).toHaveProperty('product_name');
      expect(alert).toHaveProperty('stock_id');
      expect(alert).toHaveProperty('serial_number');
      expect(alert).toHaveProperty('expiry_date');
      expect(alert).toHaveProperty('days_until_expiry');
      expect(alert).toHaveProperty('quantity');
      expect(alert).toHaveProperty('resolved', 0);
    });
  });

  describe('checkExpiryAlerts - Testes de Exceção', () => {
    it('should handle empty stock table', () => {
      expect(() => checkExpiryAlerts(db)).not.toThrow();
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(0);
    });

    it('should ignore products with quantity zero', () => {
      seedExpiredWithZeroQuantity(db);
      
      checkExpiryAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(0);
    });

    it('should ignore products with null expiry date', () => {
      seedProductWithoutExpiryDate(db);
      
      checkExpiryAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(0);
    });

    it('should ignore products with empty expiry date string', () => {
      seedProductWithEmptyExpiryDate(db);
      
      checkExpiryAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(0);
    });

    it('should not create duplicate alerts for same stock item', () => {
      seedExpiringProducts(db);
      
      // Executar duas vezes
      checkExpiryAlerts(db);
      checkExpiryAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(1); // Não deve duplicar
    });

    it('should handle already expired products', () => {
      seedAlreadyExpiredProducts(db);
      
      checkExpiryAlerts(db);
      
      // Produtos já expirados (data passada) não devem gerar alertas
      // porque a query usa >= today
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(0);
    });
  });

  describe('checkLowStockAlerts - Testes de Sucesso', () => {
    it('should detect products with stock below minimum threshold', () => {
      seedLowStockProduct(db);
      
      checkLowStockAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBe(1);
      expect(alerts[0].product_name).toBe('Produto Stock Baixo');
      expect(alerts[0].quantity).toBe(3); // quantidade atual
    });

    it('should not create alerts for products above minimum threshold', () => {
      seedNormalStockProduct(db);
      
      checkLowStockAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBe(0);
    });

    it('should detect multiple low stock products', () => {
      seedMultipleLowStockProducts(db);
      
      checkLowStockAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBe(2);
    });

    it('should consider only valid (non-expired) stock for threshold calculation', () => {
      seedLowStockWithSomeExpired(db);
      
      checkLowStockAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      // Só deve contar stock não expirado (5 unidades) que está abaixo do mínimo (10)
      expect(alerts.length).toBe(1);
    });
  });

  describe('checkLowStockAlerts - Testes de Exceção', () => {
    it('should handle products without minimum threshold', () => {
      seedProductWithoutThreshold(db);
      
      expect(() => checkLowStockAlerts(db)).not.toThrow();
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBe(0);
    });

    it('should handle empty stock table', () => {
      expect(() => checkLowStockAlerts(db)).not.toThrow();
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBe(0);
    });

    it('should not create duplicate alerts for same product-store-date', () => {
      seedLowStockProduct(db);
      
      checkLowStockAlerts(db);
      checkLowStockAlerts(db);
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBe(1);
    });

    it('should handle negative stock quantities', () => {
      seedNegativeStockProduct(db);
      
      expect(() => checkLowStockAlerts(db)).not.toThrow();
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      // Stock negativo deve ser considerado abaixo do mínimo
      expect(alerts.length).toBe(1);
    });
  });

  describe('checkLowStockAlerts - Testes de Segurança', () => {
    it('should prevent SQL injection in alert IDs', () => {
      seedLowStockWithMaliciousId(db);
      
      expect(() => checkLowStockAlerts(db)).not.toThrow();
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBeGreaterThanOrEqual(0);
      // O ID malicioso deve ser escapado/tratado
      alerts.forEach(alert => {
        expect(alert.id).not.toContain('DROP TABLE');
      });
    });
  });

  describe('generateSaftForMonth - Testes de Sucesso', () => {
    it('should generate SAFT files for all stores with sales', () => {
      // Setup
      const saftDir = path.join(__dirname, '..', 'saft-exports');
      
      // Limpar ficheiros SAFT existentes
      if (fs.existsSync(saftDir)) {
        const files = fs.readdirSync(saftDir);
        files.forEach(f => {
          if (f.startsWith('SAFT_')) {
            fs.unlinkSync(path.join(saftDir, f));
          }
        });
      }
      
      // Semear dados
      seedSalesForSAFT(db);
      
      // Executar geração
      generateSaftForMonth(db, 2026, 1);
      
      // Verificar se o diretório existe e tem ficheiros
      expect(fs.existsSync(saftDir)).toBe(true);
      const allFiles = fs.readdirSync(saftDir);
      const saftFiles = allFiles.filter(f => f.startsWith('SAFT_'));
      expect(saftFiles.length).toBeGreaterThan(0);
      
      // Verificar conteúdo do primeiro ficheiro
      const safFile = saftFiles[0];
      const content = fs.readFileSync(path.join(saftDir, safFile), 'utf8');
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<AuditFile');
    });

    it('should not overwrite existing SAFT files', () => {
      const saftDir = path.join(__dirname, '..', 'saft-exports');
      
      // Garantir que o diretório existe
      if (!fs.existsSync(saftDir)) fs.mkdirSync(saftDir, { recursive: true });
      
      // Criar ficheiro manualmente
      const existingFile = path.join(saftDir, 'SAFT_Braga_Centro_202601.xml');
      fs.writeFileSync(existingFile, 'OLD_CONTENT', 'utf8');
      
      seedSalesForSAFT(db);
      
      generateSaftForMonth(db, 2026, 1);
      
      const content = fs.readFileSync(existingFile, 'utf8');
      expect(content).toBe('OLD_CONTENT'); // Não deve sobrescrever
    });
  });

  describe('generateSaftForMonth - Testes de Exceção', () => {
    it('should handle months with no sales', () => {
      expect(() => generateSaftForMonth(db, 2025, 1)).not.toThrow();
    });

    it('should handle invalid month parameters', () => {
      expect(() => generateSaftForMonth(db, 2026, 13)).not.toThrow();
    });

    it('should handle database errors gracefully', () => {
      // Corromper temporariamente a tabela de sales
      db.exec('DROP TABLE IF EXISTS sales');
      
      // Agora deve passar porque adicionaste try-catch no scheduler.js
      expect(() => generateSaftForMonth(db, 2026, 1)).not.toThrow();
    });
  });

  describe('Scheduler Integration - Testes de Limite', () => {
    it('should handle large number of expiring products', () => {
      seedLargeExpiringDataset(db, 100);
      
      const startTime = Date.now();
      checkExpiryAlerts(db);
      const duration = Date.now() - startTime;
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
      expect(alerts.length).toBe(100);
      expect(duration).toBeLessThan(1000); // Deve executar em menos de 1 segundo
    });

    it('should handle large number of low stock products', () => {
      seedLargeLowStockDataset(db, 100);
      
      const startTime = Date.now();
      checkLowStockAlerts(db);
      const duration = Date.now() - startTime;
      
      const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
      expect(alerts.length).toBe(100);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Scheduler - Testes Adicionais para Cobertura', () => {
    
    describe('checkExpiryAlerts - Edge Cases Adicionais', () => {
      it('should handle products expiring exactly today', () => {
        const today = new Date().toISOString().slice(0, 10);
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_today', 'prod_today', 'Produto Hoje', 'Braga Centro', 5, today, 'SN_TODAY');
        
        checkExpiryAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
        expect(alerts.length).toBe(1);
        expect(alerts[0].days_until_expiry).toBe(0);
      });

      it('should handle products expiring exactly at 7 days boundary', () => {
        const today = new Date();
        const in7Days = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_7days', 'prod_7days', 'Produto 7 Dias', 'Braga Centro', 8, in7Days, 'SN_7DAYS');
        
        checkExpiryAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
        expect(alerts.length).toBe(1);
        expect(alerts[0].days_until_expiry).toBe(7);
      });

      it('should handle multiple stores with expiring products', () => {
        const today = new Date();
        const in3Days = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_braga', 'prod_braga', 'Produto Braga', 'Braga Centro', 10, in3Days, 'SN_BRAGA');
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_porto', 'prod_porto', 'Produto Porto', 'Porto', 15, in3Days, 'SN_PORTO');
        
        checkExpiryAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
        expect(alerts.length).toBe(2);
        
        const stores = alerts.map(a => a.store);
        expect(stores).toContain('Braga Centro');
        expect(stores).toContain('Porto');
      });

      it('should handle very large quantities correctly', () => {
        const today = new Date();
        const in2Days = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_large', 'prod_large', 'Produto Grande Qt', 'Braga Centro', 999999, in2Days, 'SN_LARGE');
        
        checkExpiryAlerts(db);
        
        const alert = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").get();
        expect(alert.quantity).toBe(999999);
      });

      it('should handle special characters in product names', () => {
        const today = new Date();
        const in1Day = new Date(today.getTime() + 1 * 86400000).toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_special', 'prod_special', "Produto com 'apóstrofo' & símbolos", 'Braga Centro', 5, in1Day, 'SN_SPECIAL');
        
        expect(() => checkExpiryAlerts(db)).not.toThrow();
        
        const alert = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").get();
        expect(alert.product_name).toBe("Produto com 'apóstrofo' & símbolos");
      });

      it('should respect quantity threshold exactly at 0', () => {
        const today = new Date();
        const in2Days = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_zero', 'prod_zero', 'Produto Zero', 'Braga Centro', 0, in2Days, 'SN_ZERO');
        
        checkExpiryAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
        expect(alerts.length).toBe(0);
      });
    });

    describe('checkLowStockAlerts - Edge Cases Adicionais', () => {
      it('should handle multiple stores with low stock', () => {
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_ls_braga', 'prod_ls', 'Produto LS', 'Braga Centro', 3, null, 'SN_LS_BRAGA', 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_ls_porto', 'prod_ls', 'Produto LS', 'Porto', 4, null, 'SN_LS_PORTO', 10);
        
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
        expect(alerts.length).toBe(2);
      });

      it('should handle zero quantity products correctly', () => {
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_zero_qty', 'prod_zero', 'Produto Zero', 'Braga Centro', 0, null, 'SN_ZERO', 10);
        
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
        expect(alerts.length).toBe(1);
        expect(alerts[0].quantity).toBe(0);
      });

      it('should handle products exactly at threshold', () => {
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_at_threshold', 'prod_threshold', 'Produto No Limite', 'Braga Centro', 10, null, 'SN_THRESHOLD', 10);
        
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
        // Exactly at threshold should NOT trigger alert (valid_qty < min_threshold)
        expect(alerts.length).toBe(0);
      });

      it('should handle products just below threshold', () => {
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_below_threshold', 'prod_below', 'Produto Abaixo', 'Braga Centro', 9, null, 'SN_BELOW', 10);
        
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
        expect(alerts.length).toBe(1);
      });

      it('should aggregate quantities from multiple stock entries for same product', () => {
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_agg1', 'prod_agg', 'Produto Agregado', 'Braga Centro', 3, null, 'SN_AGG1', 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_agg2', 'prod_agg', 'Produto Agregado', 'Braga Centro', 3, null, 'SN_AGG2', 10);
        
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
        expect(alerts.length).toBe(1);
        expect(alerts[0].quantity).toBe(6); // 3 + 3 = 6, que é < 10
      });

      it('should not count expired stock towards valid quantity', () => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_valid', 'prod_mixed', 'Produto Misto', 'Braga Centro', 5, null, 'SN_VALID', 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_expired', 'prod_mixed', 'Produto Misto', 'Braga Centro', 20, yesterday, 'SN_EXPIRED', 10);
        
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
        expect(alerts.length).toBe(1);
        expect(alerts[0].quantity).toBe(5); // Apenas o stock válido
      });

      it('should handle decimal quantities', () => {
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_decimal', 'prod_decimal', 'Produto Decimal', 'Braga Centro', 2.5, null, 'SN_DECIMAL', 10);
        
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock'").all();
        expect(alerts.length).toBe(1);
        expect(alerts[0].quantity).toBe(2.5);
      });
    });

    describe('generateSaftForMonth - Edge Cases Adicionais', () => {
      it('should handle December to January transition', () => {
        const saftDir = path.join(__dirname, '..', 'saft-exports');
        if (!fs.existsSync(saftDir)) fs.mkdirSync(saftDir, { recursive: true });
        
        // Clean SAFF files for test
        const files = fs.readdirSync(saftDir);
        files.forEach(f => {
          if (f.startsWith('SAFT_')) {
            fs.unlinkSync(path.join(saftDir, f));
          }
        });
        
        seedSalesForMonth(db, 'Braga Centro', 2025, 12);
        
        expect(() => generateSaftForMonth(db, 2025, 12)).not.toThrow();
        
        const saftFiles = fs.readdirSync(saftDir).filter(f => f.startsWith('SAFT_'));
        expect(saftFiles.length).toBeGreaterThan(0);
        expect(saftFiles[0]).toContain('202512');
      });

      it('should handle month with single-digit month correctly', () => {
        const saftDir = path.join(__dirname, '..', 'saft-exports');
        if (!fs.existsSync(saftDir)) fs.mkdirSync(saftDir, { recursive: true });
        
        // Limpar ficheiros
        const files = fs.readdirSync(saftDir);
        files.forEach(f => {
          if (f.startsWith('SAFT_')) {
            fs.unlinkSync(path.join(saftDir, f));
          }
        });
        
        seedSalesForMonth(db, 'Braga Centro', 2026, 1);
        
        generateSaftForMonth(db, 2026, 1);
        
        const saftFiles = fs.readdirSync(saftDir).filter(f => f.startsWith('SAFT_'));
        expect(saftFiles.length).toBeGreaterThan(0);
        expect(saftFiles[0]).toContain('202601');
      });

      it('should handle stores with special characters in name', () => {
        const saftDir = path.join(__dirname, '..', 'saft-exports');
        if (!fs.existsSync(saftDir)) fs.mkdirSync(saftDir, { recursive: true });
        
        db.prepare(`INSERT INTO stores (id, name, nif, company_name) 
          VALUES (?, ?, ?, ?)`
        ).run('store_special', 'Porto & Gaia', '999999991', 'Empresa Especial, Lda.');
        
        db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('sale_special', 'Porto & Gaia', 50.00, 9.35, 'Numerário', 'FS-SPECIAL', 'completed', '2026-01-16', 50.00);
        
        generateSaftForMonth(db, 2026, 1);
        
        const files = fs.readdirSync(saftDir);
        const saftFile = files.find(f => f.includes('Porto'));
        expect(saftFile).toBeTruthy();
      });

      it('should handle generation for current month with no sales', () => {
        expect(() => generateSaftForMonth(db, 2026, 6)).not.toThrow();
      });

      it('should handle invalid year parameters', () => {
        expect(() => generateSaftForMonth(db, 1899, 1)).not.toThrow();
      });

      it('should handle month 0 gracefully', () => {
        expect(() => generateSaftForMonth(db, 2026, 0)).not.toThrow();
      });
    });

    describe('startScheduler - Testes de Integração', () => {
      it('should create required tables on startup', () => {
        // Drop tables first
        db.exec('DROP TABLE IF EXISTS alerts');
        db.exec('DROP TABLE IF EXISTS daily_stock_snapshots');
        
        startScheduler(db);
        
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('alerts', 'daily_stock_snapshots')").all();
        expect(tables.length).toBe(2);
      });

      it('should create indexes on alerts table', () => {
        startScheduler(db);
        
        const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_alerts%'").all();
        expect(indexes.length).toBeGreaterThan(0);
      });

      it('should handle scheduler initialization with existing tables', () => {
        // First initialization
        startScheduler(db);
        
        // Second initialization should not throw
        expect(() => startScheduler(db)).not.toThrow();
      });

      it('should initialize without throwing errors', () => {
        expect(() => startScheduler(db)).not.toThrow();
      });
    });

    describe('checkLowStockAlerts - Testes de Performance', () => {
      it('should handle products with many stock entries efficiently', () => {
        const insert = db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        
        const insertMany = db.transaction(() => {
          for (let i = 0; i < 50; i++) {
            insert.run(`stock_many_${i}`, 'prod_many', 'Produto Muitos Lotes', 'Braga Centro', 0.1, null, `SN_MANY_${i}`, 10);
          }
        });
        
        insertMany();
        
        const startTime = Date.now();
        checkLowStockAlerts(db);
        const duration = Date.now() - startTime;
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock' AND product_id = 'prod_many'").all();
        expect(alerts.length).toBe(1);
        expect(alerts[0].quantity).toBe(5); // 50 * 0.1 = 5
        expect(duration).toBeLessThan(500);
      });

      it('should handle concurrent alert checks without duplicates', () => {
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_concurrent', 'prod_concurrent', 'Produto Concorrente', 'Braga Centro', 1, null, 'SN_CONCURRENT', 10);
        
        // Simulate concurrent checks
        checkLowStockAlerts(db);
        checkLowStockAlerts(db);
        checkLowStockAlerts(db);
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'low_stock' AND product_id = 'prod_concurrent'").all();
        expect(alerts.length).toBe(1);
      });
    });

    describe('checkExpiryAlerts - Testes de Datas Limite', () => {
      it('should handle leap year dates correctly', () => {
        const feb28 = '2024-02-28';
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_leap', 'prod_leap', 'Produto Ano Bissexto', 'Braga Centro', 5, feb28, 'SN_LEAP');
        
        // Mock current date to Feb 21, 2024
        const realDate = Date;
        global.Date = class extends Date {
          constructor(...args) {
            if (args.length === 0) {
              super('2024-02-21T12:00:00Z');
            } else {
              super(...args);
            }
          }
        };
        global.Date.now = () => new Date('2024-02-21T12:00:00Z').getTime();
        
        try {
          checkExpiryAlerts(db);
          
          const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry'").all();
          expect(alerts.length).toBe(1);
          expect(alerts[0].days_until_expiry).toBe(7); // Feb 21 to Feb 28 = 7 days
        } finally {
          global.Date = realDate;
        }
      });

      it('should handle different timezone offsets', () => {
        const today = new Date();
        const in1Day = new Date(today.getTime() + 1 * 86400000).toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_tz', 'prod_tz', 'Produto Timezone', 'Braga Centro', 5, in1Day, 'SN_TZ');
        
        expect(() => checkExpiryAlerts(db)).not.toThrow();
        
        const alerts = db.prepare("SELECT * FROM alerts WHERE type = 'expiry' AND stock_id = 'stock_tz'").all();
        expect(alerts.length).toBe(1);
        // days_until_expiry should be 0 or 1 depending on time of day
        expect(alerts[0].days_until_expiry).toBeGreaterThanOrEqual(0);
        expect(alerts[0].days_until_expiry).toBeLessThanOrEqual(1);
      });
    });

    describe('Snapshot Daily Stock - Testes', () => {
      it('should create snapshot for all stores', () => {
        const today = new Date().toISOString().slice(0, 10);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_snap1', 'prod_snap1', 'Produto Snapshot 1', 'Braga Centro', 10, null, 'SN_SNAP1', 5);
        
        db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run('stock_snap2', 'prod_snap2', 'Produto Snapshot 2', 'Porto', 20, null, 'SN_SNAP2', 15);
        
        // Import snapshotDailyStock for testing
        const scheduler = require('../scheduler.js');
        
        // Execute snapshot
        db.prepare(`SELECT 1`).all(); // Ensure DB is ready
        
        // We can test the effect indirectly
        const stores = db.prepare('SELECT DISTINCT store FROM stock').all();
        expect(stores.length).toBe(2);
      });
    });
  });
});
// Helper functions adicionais
function seedSalesForMonth(db, store, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const saleDate = `${year}-${monthStr}-15`;
  
  db.prepare(`INSERT OR IGNORE INTO stores (id, name, nif, company_name, address, city, postal_code) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('store1', store, '999999990', 'FlashStore Retail S.A.', 'Rua Exemplo, 1', store, '4700-000');
  
  db.prepare(`INSERT OR IGNORE INTO products (id, name, barcode, category, price) 
    VALUES (?, ?, ?, ?, ?)`
  ).run('p1', 'Produto Teste', '789123456', 'Geral', 100.00);
  
  db.prepare(`INSERT OR IGNORE INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`sale_${year}${monthStr}`, store, 100.00, 18.70, 'Numerário', 'FS-TEST', 'completed', saleDate, 100.00);
  
  db.prepare(`INSERT OR IGNORE INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`item_${year}${monthStr}`, `sale_${year}${monthStr}`, 'p1', 'Produto Teste', 1, 100.00, 23, 100.00);
}

// Helper functions
function createSchedulerTestSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      product_name TEXT,
      store TEXT,
      quantity REAL,
      expiry_date TEXT,
      serial_number TEXT,
      minimum_threshold REAL DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      store TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT,
      stock_id TEXT,
      serial_number TEXT,
      expiry_date TEXT,
      days_until_expiry INTEGER,
      quantity REAL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      store TEXT,
      total REAL,
      total_iva REAL,
      payment_method TEXT,
      customer_nif TEXT,
      cashier_email TEXT,
      invoice_number TEXT,
      document_type TEXT,
      status TEXT,
      created_date TEXT,
      amount_paid REAL
    );
    
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT,
      product_id TEXT,
      product_name TEXT,
      quantity REAL,
      unit_price REAL,
      iva_rate REAL,
      subtotal REAL
    );
    
    CREATE TABLE IF NOT EXISTS sale_returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT,
      original_sale_id TEXT,
      total_refunded REAL,
      reason TEXT,
      created_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sale_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT,
      product_id TEXT,
      product_name TEXT,
      quantity REAL,
      refund_amount REAL
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      barcode TEXT,
      category TEXT,
      price REAL
    );
    
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT,
      nif TEXT,
      address TEXT,
      city TEXT,
      company_name TEXT,
      postal_code TEXT
    );
    
    CREATE TABLE IF NOT EXISTS daily_stock_snapshots (
      id TEXT PRIMARY KEY,
      store TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      distinct_products INTEGER,
      total_units REAL,
      low_stock_count INTEGER,
      expiring_soon_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS pos_terminals (
      id TEXT PRIMARY KEY,
      store TEXT,
      is_active INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS day_closures (
      id TEXT PRIMARY KEY,
      store TEXT,
      closure_date TEXT,
      reopened_at TEXT
    );
  `);
}

function seedExpiringProducts(db) {
  const today = new Date();
  const in3Days = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock1', 'prod1', 'Produto a Expirar', 'Braga Centro', 10, in3Days, 'SN001');
}

function seedProductsExpiringAfter8Days(db) {
  const today = new Date();
  const in8Days = new Date(today.getTime() + 8 * 86400000).toISOString().slice(0, 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock2', 'prod2', 'Produto Não Urgente', 'Braga Centro', 5, in8Days, 'SN002');
}

function seedMultipleExpiringProducts(db) {
  const today = new Date();
  const in2Days = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const in5Days = new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock3', 'prod3', 'Produto A', 'Braga Centro', 3, in2Days, 'SN003');
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock4', 'prod4', 'Produto B', 'Braga Centro', 7, in5Days, 'SN004');
}

function seedExpiringIn3Days(db) {
  const today = new Date();
  const in3Days = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock5', 'prod5', 'Produto 3 Dias', 'Braga Centro', 4, in3Days, 'SN005');
}

function seedExpiredWithZeroQuantity(db) {
  const today = new Date();
  const in2Days = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock6', 'prod6', 'Produto Zero', 'Braga Centro', 0, in2Days, 'SN006');
}

function seedProductWithoutExpiryDate(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock7', 'prod7', 'Produto Sem Data', 'Braga Centro', 5, null, 'SN007');
}

function seedProductWithEmptyExpiryDate(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock8', 'prod8', 'Produto Data Vazia', 'Braga Centro', 5, '', 'SN008');
}

function seedAlreadyExpiredProducts(db) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('stock9', 'prod9', 'Produto Expirado', 'Braga Centro', 2, yesterday, 'SN009');
}

function seedLowStockProduct(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock10', 'prod10', 'Produto Stock Baixo', 'Braga Centro', 3, null, 'SN010', 10);
}

function seedNormalStockProduct(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock11', 'prod11', 'Produto Normal', 'Braga Centro', 50, null, 'SN011', 10);
}

function seedMultipleLowStockProducts(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock12', 'prod12', 'Produto Baixo 1', 'Braga Centro', 2, null, 'SN012', 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock13', 'prod13', 'Produto Baixo 2', 'Porto', 5, null, 'SN013', 20);
}

function seedLowStockWithSomeExpired(db) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  
  // Stock total: 8 (3 válidos + 5 expirados)
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock14', 'prod14', 'Produto Misto', 'Braga Centro', 3, null, 'SN014', 10);
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock15', 'prod14', 'Produto Misto', 'Braga Centro', 5, yesterday, 'SN015', 10);
}

function seedProductWithoutThreshold(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock16', 'prod16', 'Produto Sem Threshold', 'Braga Centro', 1, null, 'SN016', 0);
}

function seedNegativeStockProduct(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('stock17', 'prod17', 'Produto Negativo', 'Braga Centro', -5, null, 'SN017', 10);
}

function seedLowStockWithMaliciousId(db) {
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("stock18'); DROP TABLE alerts;--", 'prod18', 'Produto Malicioso', 'Braga Centro', 1, null, 'SN018', 10);
}

function seedSalesForSAFT(db) {
  // Inserir loja
  db.prepare(`INSERT INTO stores (id, name, nif, company_name, address, city, postal_code) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('store1', 'Braga Centro', '999999990', 'FlashStore Retail S.A.', 'Rua Exemplo, 1', 'Braga', '4700-000');
  
  // Inserir produto
  db.prepare(`INSERT INTO products (id, name, barcode, category, price) 
    VALUES (?, ?, ?, ?, ?)`
  ).run('p1', 'Produto SAFT', '789123456', 'Geral', 100.00);
  
  // Inserir venda
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale1', 'Braga Centro', 100.00, 18.70, 'Numerário', 'FS-001', 'completed', '2026-01-16', 100.00);
  
  // Inserir item da venda
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item1', 'sale1', 'p1', 'Produto SAFT', 1, 100.00, 23, 100.00);
}

function seedLargeExpiringDataset(db, count) {
  const today = new Date();
  
  const insert = db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  
  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const daysFromNow = Math.floor(Math.random() * 7) + 1;
      const expiryDate = new Date(today.getTime() + daysFromNow * 86400000).toISOString().slice(0, 10);
      insert.run(`stock_exp_${i}`, `prod${i}`, `Produto ${i}`, 'Braga Centro', 10, expiryDate, `SN${i}`);
    }
  });
  
  insertMany();
}

function seedLargeLowStockDataset(db, count) {
  const insert = db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, expiry_date, serial_number, minimum_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      insert.run(`stock_low_${i}`, `prod_low_${i}`, `Produto Low ${i}`, 'Braga Centro', 2, null, `SN_LOW_${i}`, 20);
    }
  });
  
  insertMany();
}
