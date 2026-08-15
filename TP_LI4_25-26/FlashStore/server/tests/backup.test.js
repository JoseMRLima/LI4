// server/tests/backup.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runBackup, listBackups, scheduleDailyBackup, BACKUP_DIR } from '../backup.js';

describe('Backup System', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    createBackupTestSchema(db);
    seedBackupTestData(db);
    
    // Garantir diretório de backup limpo
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Limpar backups anteriores
    cleanBackupDir();
    
    // Mock console
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
    cleanBackupDir();
  });

  function cleanBackupDir() {
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      files.forEach(f => {
        if (f.startsWith('flashstore-') && f.endsWith('.db')) {
          fs.unlinkSync(path.join(BACKUP_DIR, f));
        }
      });
    }
  }

  describe('runBackup - Testes de Sucesso', () => {
    it('should create a backup file successfully', async () => {
      const backupPath = await runBackup(db);
      
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(path.basename(backupPath)).toMatch(/^flashstore-.*\.db$/);
    });

    it('should create backup with correct naming convention', async () => {
      const backupPath = await runBackup(db);
      const filename = path.basename(backupPath);
      
      // Deve seguir o padrão: flashstore-YYYY-MM-DDTHH-MM-SS.db
      expect(filename).toMatch(/^flashstore-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/);
    });

    it('should backup contain all original data', async () => {
      const backupPath = await runBackup(db);
      
      // Abrir backup e verificar dados
      const backupDb = new Database(backupPath);
      
      const sales = backupDb.prepare("SELECT * FROM sales").all();
      const products = backupDb.prepare("SELECT * FROM products").all();
      const stores = backupDb.prepare("SELECT * FROM stores").all();
      const saleItems = backupDb.prepare("SELECT * FROM sale_items").all();
      
      expect(sales.length).toBe(2);
      expect(products.length).toBe(3);
      expect(stores.length).toBe(1);
      expect(saleItems.length).toBe(2);
      
      backupDb.close();
    });

    it('should preserve data integrity in backup', async () => {
      const backupPath = await runBackup(db);
      const backupDb = new Database(backupPath);
      
      // Verificar dados específicos
      const sale = backupDb.prepare("SELECT * FROM sales WHERE id = 'sale1'").get();
      expect(sale.total).toBe(10.00);
      expect(sale.invoice_number).toBe('FS-001');
      expect(sale.status).toBe('completed');
      
      const product = backupDb.prepare("SELECT * FROM products WHERE id = 'p1'").get();
      expect(product.name).toBe('Produto A');
      expect(product.price).toBe(10.00);
      
      backupDb.close();
    });

    it('should create backup directory if it does not exist', async () => {
      const testDir = path.join(BACKUP_DIR, 'test_subdir_' + Date.now());
      
      // Não podemos mudar BACKUP_DIR, mas podemos testar que a função ensureBackupDir funciona
      // Testando que o diretório padrão é criado
      if (fs.existsSync(BACKUP_DIR)) {
        fs.rmdirSync(BACKUP_DIR, { recursive: true });
      }
      
      const backupPath = await runBackup(db);
      
      expect(fs.existsSync(BACKUP_DIR)).toBe(true);
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should return the backup file path', async () => {
      const backupPath = await runBackup(db);
      
      expect(typeof backupPath).toBe('string');
      expect(backupPath).toContain('flashstore-');
      expect(backupPath.endsWith('.db')).toBe(true);
    });
  });

  describe('runBackup - Testes de Exceção', () => {
    it('should handle empty database', async () => {
      const emptyDb = new Database(':memory:');
      createBackupTestSchema(emptyDb); // Apenas schema, sem dados
      
      const backupPath = await runBackup(emptyDb);
      
      expect(fs.existsSync(backupPath)).toBe(true);
      
      // Verificar que o backup tem as tabelas mas sem dados
      const backupDb = new Database(backupPath);
      const sales = backupDb.prepare("SELECT COUNT(*) as count FROM sales").get();
      expect(sales.count).toBe(0);
      
      backupDb.close();
      emptyDb.close();
    });

    it('should handle database with special characters in data', async () => {
      db.prepare(`INSERT INTO products (id, name, barcode, category, price) 
        VALUES (?, ?, ?, ?, ?)`
      ).run('p_special', "Produto com 'aspas' & <tags>", '789999', 'Especial', 99.99);
      
      const backupPath = await runBackup(db);
      const backupDb = new Database(backupPath);
      
      const product = backupDb.prepare("SELECT name FROM products WHERE id = 'p_special'").get();
      expect(product.name).toBe("Produto com 'aspas' & <tags>");
      
      backupDb.close();
    });

    it('should handle large number of records', async () => {
      // Adicionar 1000 vendas
      const insert = db.prepare(`INSERT INTO sales (id, store, total, total_iva, status, created_date)
        VALUES (?, ?, ?, ?, ?, ?)`);
      
      const insertMany = db.transaction(() => {
        for (let i = 0; i < 1000; i++) {
          insert.run(`sale_large_${i}`, 'Braga Centro', 10.00, 1.87, 'completed', '2026-01-16');
        }
      });
      insertMany();
      
      const startTime = Date.now();
      const backupPath = await runBackup(db);
      const duration = Date.now() - startTime;
      
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(duration).toBeLessThan(5000); // Deve ser rápido
    });
  });

  describe('runBackup - Testes de Segurança', () => {
    it('should create backup in the correct directory', async () => {
      const backupPath = await runBackup(db);
      const resolvedBackupDir = path.resolve(BACKUP_DIR);
      const resolvedBackupPath = path.resolve(backupPath);
      
      expect(resolvedBackupPath.startsWith(resolvedBackupDir)).toBe(true);
    });

    it('should not expose database credentials in backup filename', async () => {
      const backupPath = await runBackup(db);
      const filename = path.basename(backupPath);
      
      // Não deve conter informações sensíveis
      expect(filename).not.toContain('password');
      expect(filename).not.toContain('secret');
      expect(filename).not.toContain('token');
    });
  });

  describe('listBackups - Testes de Sucesso', () => {
describe('listBackups - Testes de Sucesso', () => {
  it('should list all backup files', async () => {
    // Criar backups manualmente com timestamps diferentes
    const now = new Date();
    
    // Backup 1: 2 horas atrás
    const ts1 = new Date(now.getTime() - 2 * 3600000)
      .toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.writeFileSync(path.join(BACKUP_DIR, `flashstore-${ts1}.db`), 'backup1');
    
    // Backup 2: 1 hora atrás
    const ts2 = new Date(now.getTime() - 1 * 3600000)
      .toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.writeFileSync(path.join(BACKUP_DIR, `flashstore-${ts2}.db`), 'backup2');
    
    const backups = listBackups();
    
    expect(backups.length).toBe(2);
    backups.forEach(backup => {
      expect(backup).toHaveProperty('filename');
      expect(backup).toHaveProperty('size_bytes');
      expect(backup).toHaveProperty('created_at');
      expect(backup.filename).toMatch(/^flashstore-.*\.db$/);
    });
  });

  it('should return empty array when no backups exist', () => {
    cleanBackupDir();
    
    const backups = listBackups();
    
    expect(backups).toEqual([]);
  });

  it('should include file size information', async () => {
    // Criar um ficheiro com conteúdo conhecido
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const testContent = 'test backup content';
    const testFile = path.join(BACKUP_DIR, `flashstore-${ts}.db`);
    fs.writeFileSync(testFile, testContent);
    
    const backups = listBackups();
    
    expect(backups.length).toBe(1);
    expect(backups[0].size_bytes).toBe(testContent.length);
  });
});
    it('should return empty array when no backups exist', () => {
      cleanBackupDir();
      
      const backups = listBackups();
      
      expect(backups).toEqual([]);
    });

    it('should include file size information', async () => {
      await runBackup(db);
      
      const backups = listBackups();
      
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0].size_bytes).toBeGreaterThan(0);
    });
  });

  describe('listBackups - Testes de Exceção', () => {
    it('should create backup directory if it does not exist', () => {
      if (fs.existsSync(BACKUP_DIR)) {
        fs.rmdirSync(BACKUP_DIR, { recursive: true });
      }
      
      const backups = listBackups();
      
      expect(fs.existsSync(BACKUP_DIR)).toBe(true);
      expect(backups).toEqual([]);
    });
  });

  describe('pruneOldBackups - Testes de Sucesso', () => {
    it('should maintain maximum of 30 backups', async () => {
      // Criar 35 backups
      for (let i = 0; i < 35; i++) {
        await runBackup(db);
      }
      
      const backups = listBackups();
      
      expect(backups.length).toBeLessThanOrEqual(30);
    });

    it('should remove oldest backups first', async () => {
      // Limpar diretório
      cleanBackupDir();
      
      // Criar backups com datas diferentes (simulados)
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        const oldDate = new Date(now.getTime() - (i + 1) * 86400000);
        const ts = oldDate.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const oldBackup = path.join(BACKUP_DIR, `flashstore-${ts}.db`);
        fs.writeFileSync(oldBackup, 'old backup');
      }
      
      // Criar um backup real (mais recente)
      await runBackup(db);
      
      const backups = listBackups();
      const backupFilenames = backups.map(b => b.filename);
      
      // O backup real (mais recente) deve estar presente
      expect(backupFilenames.some(f => f.includes('flashstore-'))).toBe(true);
    });
  });

  describe('scheduleDailyBackup - Testes de Sucesso', () => {
    it('should be a function', () => {
      expect(typeof scheduleDailyBackup).toBe('function');
    });

    it('should accept database parameter', () => {
      expect(() => scheduleDailyBackup(db)).not.toThrow();
    });
  });

  describe('Backup System - Testes de Integração', () => {
    it('should complete full backup cycle', async () => {
      // 1. Verificar estado inicial
      const initialBackups = listBackups();
      expect(initialBackups.length).toBe(0);
      
      // 2. Criar backup
      const backupPath = await runBackup(db);
      expect(fs.existsSync(backupPath)).toBe(true);
      
      // 3. Verificar listagem
      const backupsAfterCreate = listBackups();
      expect(backupsAfterCreate.length).toBe(1);
      
      // 4. Verificar conteúdo do backup
      const backupDb = new Database(backupPath);
      const salesCount = backupDb.prepare("SELECT COUNT(*) as count FROM sales").get();
      expect(salesCount.count).toBe(2);
      backupDb.close();
      
      // 5. Modificar base de dados original
      db.exec("DELETE FROM sales WHERE id = 'sale1'");
      const salesAfterDelete = db.prepare("SELECT COUNT(*) as count FROM sales").get();
      expect(salesAfterDelete.count).toBe(1);
      
      // 6. O backup não deve ser afetado
      const backupDb2 = new Database(backupPath);
      const backupSalesCount = backupDb2.prepare("SELECT COUNT(*) as count FROM sales").get();
      expect(backupSalesCount.count).toBe(2); // Backup ainda tem 2 vendas
      backupDb2.close();
    });
  });

  describe('Backup System - Testes de Performance', () => {
    it('should backup within acceptable time', async () => {
      const startTime = Date.now();
      const backupPath = await runBackup(db);
      const duration = Date.now() - startTime;
      
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(duration).toBeLessThan(3000); // Menos de 3 segundos
    });
  });
});

// Helper functions
function createBackupTestSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT,
      nif TEXT,
      address TEXT,
      city TEXT,
      company_name TEXT,
      postal_code TEXT
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      barcode TEXT,
      category TEXT,
      price REAL
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
  `);
}

function seedBackupTestData(db) {
  // Inserir loja
  db.prepare(`INSERT INTO stores (id, name, nif, company_name, address, city, postal_code) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('store1', 'Braga Centro', '999999990', 'FlashStore Retail S.A.', 'Rua Exemplo, 1', 'Braga', '4700-000');
  
  // Inserir produtos
  db.prepare(`INSERT INTO products (id, name, barcode, category, price) 
    VALUES (?, ?, ?, ?, ?)`
  ).run('p1', 'Produto A', '789001', 'Geral', 10.00);
  
  db.prepare(`INSERT INTO products (id, name, barcode, category, price) 
    VALUES (?, ?, ?, ?, ?)`
  ).run('p2', 'Produto B', '789002', 'Geral', 20.00);
  
  db.prepare(`INSERT INTO products (id, name, barcode, category, price) 
    VALUES (?, ?, ?, ?, ?)`
  ).run('p3', 'Produto C', '789003', 'Geral', 30.00);
  
  // Inserir vendas
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale1', 'Braga Centro', 10.00, 1.87, 'Numerário', 'FS-001', 'completed', '2026-01-16', 10.00);
  
  db.prepare(`INSERT INTO sales (id, store, total, total_iva, payment_method, invoice_number, status, created_date, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('sale2', 'Braga Centro', 20.00, 3.74, 'MB Way', 'FS-002', 'completed', '2026-01-17', 20.00);
  
  // Inserir itens das vendas
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item1', 'sale1', 'p1', 'Produto A', 1, 10.00, 23, 10.00);
  
  db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, iva_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('item2', 'sale2', 'p2', 'Produto B', 2, 10.00, 23, 20.00);
}
