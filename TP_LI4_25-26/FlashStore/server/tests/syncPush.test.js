// server/tests/syncPush.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { processSyncPush } from '../syncPush.js';

describe('SyncPush - Sincronização Push', () => {
  let db;
  let mockReq;
  let mockHelpers;

  beforeEach(() => {
    db = new Database(':memory:');
    createSyncTestSchema(db);
    seedSyncTestData(db);
    
    // Mock do request
    mockReq = {
      user: {
        email: 'cashier@flashstore.pt',
        role: 'cashier',
        store: 'Braga Centro'
      }
    };
    
    // Mock dos helpers
    mockHelpers = {
      genId: () => `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      logAudit: vi.fn(),
      allocateStockForSale: vi.fn(({ productId, store, requestedQuantity }) => {
        // Simular alocação de stock
        const lots = db.prepare(`
          SELECT * FROM stock 
          WHERE product_id = ? AND store = ? AND quantity > 0
          ORDER BY expiry_date ASC NULLS LAST
        `).all(productId, store);
        
        if (lots.length === 0) {
          throw new Error('Stock insuficiente');
        }
        
        let remaining = requestedQuantity;
        const allocations = [];
        
        for (const lot of lots) {
          if (remaining <= 0) break;
          const allocated = Math.min(remaining, lot.quantity);
          allocations.push({
            quantity: allocated,
            lot: {
              id: lot.id,
              serial_number: lot.serial_number,
              expiry_date: lot.expiry_date
            }
          });
          remaining -= allocated;
        }
        
        if (remaining > 0) {
          throw new Error('Stock insuficiente');
        }
        
        return allocations;
      }),
      buildReceiptText: vi.fn(() => 'RECEIPT_TEXT_MOCK'),
      ensureDayNotClosed: vi.fn()
    };
    
    // Mock console
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
  });

  describe('processSyncPush - Testes de Sucesso', () => {
    it('should sync a sale.create operation successfully', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-001',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-001',
              store: 'Braga Centro',
              items: [
                {
                  product_id: 'p1',
                  product_name: 'Produto A',
                  quantity: 2,
                  unit_price: 10.00,
                  iva_rate: 23
                }
              ],
              total: 20.00,
              total_iva: 3.74,
              payment_method: 'Numerário',
              amount_paid: 20.00,
              created_date: '2026-01-16T10:00:00Z'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results[0].status).toBe('synced');
      expect(result.results[0].skipped).toBe(false);
      
      // Verificar se a venda foi criada
      const sale = db.prepare("SELECT * FROM sales WHERE id = 'sale-sync-001'").get();
      expect(sale).toBeTruthy();
      expect(sale.total).toBe(20.00);
      expect(sale.store).toBe('Braga Centro');
      
      // Verificar se o stock foi atualizado
      const stock = db.prepare("SELECT * FROM stock WHERE product_id = 'p1' AND store = 'Braga Centro'").get();
      expect(stock.quantity).toBe(8); // 10 - 2
    });

    it('should sync a shift.open operation successfully', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-002',
            operation: 'shift.open',
            payload: {
              id: 'shift-001',
              store: 'Braga Centro',
              pos_terminal_id: 'POS-001',
              cashier_email: 'cashier@flashstore.pt',
              cashier_name: 'João Silva',
              shift_date: '2026-01-16',
              opening_declared_cash: 100.00
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.synced).toBe(1);
      expect(result.results[0].status).toBe('synced');
      
      const shift = db.prepare("SELECT * FROM shift_closures WHERE id = 'shift-001'").get();
      expect(shift).toBeTruthy();
      expect(shift.status).toBe('open');
      expect(shift.opening_declared_cash).toBe(100.00);
    });

    it('should sync a shift.close operation successfully', () => {
      // Primeiro criar um turno aberto
      db.prepare(`
        INSERT INTO shift_closures (id, store, cashier_email, shift_date, start_time, status)
        VALUES (?, ?, ?, ?, ?, 'open')
      `).run('shift-002', 'Braga Centro', 'cashier@flashstore.pt', '2026-01-16', '08:00');
      
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-003',
            operation: 'shift.close',
            payload: {
              shift_id: 'shift-002',
              store: 'Braga Centro',
              closing_cash: 500.00,
              notes: 'Turno normal'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.synced).toBe(1);
      
      const shift = db.prepare("SELECT * FROM shift_closures WHERE id = 'shift-002'").get();
      expect(shift.status).toBe('pending_approval');
      expect(shift.closing_declared_cash).toBe(500.00);
    });

    it('should process multiple operations in batch', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-004',
            operation: 'shift.open',
            payload: {
              id: 'shift-003',
              store: 'Braga Centro',
              shift_date: '2026-01-17'
            }
          },
          {
            outbox_id: 'outbox-005',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-002',
              store: 'Braga Centro',
              items: [
                {
                  product_id: 'p1',
                  product_name: 'Produto A',
                  quantity: 1,
                  unit_price: 10.00,
                  iva_rate: 23
                }
              ],
              total: 10.00,
              total_iva: 1.87,
              payment_method: 'MB Way'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.processed).toBe(2);
      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should skip already synced sales', () => {
      // Criar venda primeiro
      db.prepare(`
        INSERT INTO sales (id, store, total, total_iva, payment_method, status, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('sale-sync-003', 'Braga Centro', 30.00, 5.61, 'Numerário', 'completed', '2026-01-16');
      
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-006',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-003',
              store: 'Braga Centro',
              items: [{ product_id: 'p1', quantity: 1 }],
              total: 30.00,
              payment_method: 'Numerário'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.results[0].skipped).toBe(true);
      expect(result.synced).toBe(1);
    });
  });

  describe('processSyncPush - Testes de Exceção', () => {
    it('should handle empty operations array', () => {
      const body = {
        store: 'Braga Centro',
        operations: []
      };
      
      expect(() => processSyncPush(db, mockReq, mockHelpers, body))
        .toThrow('Lista operations vazia ou inválida');
    });

  it('should handle missing store in payload', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-007',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-004',
              items: [{ product_id: 'p1', quantity: 1 }],
              total: 10.00,
              payment_method: 'Numerário'
              // store em falta - vai falhar na validação do payload
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.failed).toBe(1);
      expect(result.results[0].status).toBe('failed');
      // O erro é "Payload de venda incompleto." porque falta store, items, etc
      expect(result.results[0].error).toBeTruthy();
    });
    it('should handle store mismatch', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-008',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-005',
              store: 'Porto', // Loja diferente
              items: [{ product_id: 'p1', quantity: 1 }],
              total: 10.00,
              payment_method: 'Numerário'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('não coincide');
    });

    it('should handle insufficient stock', () => {
      mockHelpers.allocateStockForSale = vi.fn(() => {
        throw new Error('Stock insuficiente');
      });
      
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-009',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-006',
              store: 'Braga Centro',
              items: [{ product_id: 'p1', product_name: 'Produto A', quantity: 999 }],
              total: 9990.00,
              total_iva: 1868.13,
              payment_method: 'Numerário'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('Stock insuficiente');
    });

    it('should handle invalid operation type', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-010',
            operation: 'invalid.operation',
            payload: {}
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('não suportada');
    });

    it('should handle invalid JSON in payload', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-011',
            operation: 'sale.create',
            payload: 'invalid-json-string'
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      // Deve falhar ao fazer JSON.parse
      expect(result.failed).toBe(1);
    });

    it('should handle non-existent shift for close operation', () => {
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-012',
            operation: 'shift.close',
            payload: {
              shift_id: 'non-existent-shift',
              store: 'Braga Centro'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('não encontrado');
    });
  });

  describe('processSyncPush - Testes de Segurança', () => {
    it('should prevent cashier from syncing to other store', () => {
      mockReq.user.role = 'cashier';
      mockReq.user.store = 'Braga Centro';
      
      const body = {
        store: 'Porto', // Loja diferente da do utilizador
        operations: [
          {
            outbox_id: 'outbox-013',
            operation: 'shift.open',
            payload: {
              id: 'shift-004',
              store: 'Porto'
            }
          }
        ]
      };
      
      expect(() => processSyncPush(db, mockReq, mockHelpers, body))
        .toThrow('Sem permissão');
    });

    it('should allow admin to sync any store', () => {
      mockReq.user.role = 'admin';
      mockReq.user.store = 'Admin';
      
      const body = {
        store: 'Porto',
        operations: [
          {
            outbox_id: 'outbox-014',
            operation: 'shift.open',
            payload: {
              id: 'shift-005',
              store: 'Porto',
              shift_date: '2026-01-17'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.synced).toBe(1);
    });

    it('should prevent SQL injection in product names', () => {
      const maliciousProductName = "Produto'); DROP TABLE sales;--";
      
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-015',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-007',
              store: 'Braga Centro',
              items: [
                {
                  product_id: 'p1',
                  product_name: maliciousProductName,
                  quantity: 1,
                  unit_price: 10.00
                }
              ],
              total: 10.00,
              payment_method: 'Numerário'
            }
          }
        ]
      };
      
      expect(() => processSyncPush(db, mockReq, mockHelpers, body)).not.toThrow();
      
      // Verificar que a tabela sales ainda existe
      const sales = db.prepare("SELECT * FROM sales").all();
      expect(sales.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle large batch limited to 50 operations', () => {
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push({
          outbox_id: `outbox-batch-${i}`,
          operation: 'shift.open',
          payload: {
            id: `shift-batch-${i}`,
            store: 'Braga Centro',
            shift_date: '2026-01-16'
          }
        });
      }
      
      const body = {
        store: 'Braga Centro',
        operations
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.processed).toBe(50); // Máximo 50 por batch
      expect(result.has_more).toBe(true);
    });
  });

  describe('processSyncPush - Testes de Integração', () => {
    it('should complete full sale sync with stock update', () => {
      const initialStock = db.prepare(
        "SELECT quantity FROM stock WHERE product_id = 'p1' AND store = 'Braga Centro'"
      ).get();
      
      const body = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-016',
            operation: 'sale.create',
            payload: {
              id: 'sale-sync-008',
              store: 'Braga Centro',
              items: [
                {
                  product_id: 'p1',
                  product_name: 'Produto A',
                  quantity: 3,
                  unit_price: 10.00,
                  iva_rate: 23
                }
              ],
              total: 30.00,
              total_iva: 5.61,
              payment_method: 'Numerário',
              amount_paid: 30.00,
              customer_nif: '123456789'
            }
          }
        ]
      };
      
      const result = processSyncPush(db, mockReq, mockHelpers, body);
      
      expect(result.synced).toBe(1);
      
      // Verificar venda
      const sale = db.prepare("SELECT * FROM sales WHERE id = 'sale-sync-008'").get();
      expect(sale.total).toBe(30.00);
      expect(sale.customer_nif).toBe('123456789');
      
      // Verificar itens da venda
      const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = 'sale-sync-008'").all();
      expect(items.length).toBeGreaterThan(0);
      expect(items.reduce((sum, item) => sum + item.quantity, 0)).toBe(3);
      
      // Verificar stock atualizado
      const finalStock = db.prepare(
        "SELECT quantity FROM stock WHERE product_id = 'p1' AND store = 'Braga Centro'"
      ).get();
      expect(finalStock.quantity).toBe(initialStock.quantity - 3);
      
      // Verificar auditoria
      expect(mockHelpers.logAudit).toHaveBeenCalled();
    });

    it('should handle shift open and close cycle', () => {
      // Abrir turno
      const openBody = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-017',
            operation: 'shift.open',
            payload: {
              id: 'shift-cycle-001',
              store: 'Braga Centro',
              pos_terminal_id: 'POS-001',
              cashier_email: 'cashier@flashstore.pt',
              shift_date: '2026-01-16',
              opening_declared_cash: 200.00
            }
          }
        ]
      };
      
      const openResult = processSyncPush(db, mockReq, mockHelpers, openBody);
      expect(openResult.synced).toBe(1);
      
      // Fechar turno
      const closeBody = {
        store: 'Braga Centro',
        operations: [
          {
            outbox_id: 'outbox-018',
            operation: 'shift.close',
            payload: {
              shift_id: 'shift-cycle-001',
              store: 'Braga Centro',
              closing_cash: 500.00,
              notes: 'Turno concluído'
            }
          }
        ]
      };
      
      const closeResult = processSyncPush(db, mockReq, mockHelpers, closeBody);
      expect(closeResult.synced).toBe(1);
      
      // Verificar estado final
      const shift = db.prepare("SELECT * FROM shift_closures WHERE id = 'shift-cycle-001'").get();
      expect(shift.status).toBe('pending_approval');
      expect(shift.opening_declared_cash).toBe(200.00);
      expect(shift.closing_declared_cash).toBe(500.00);
    });
  });
});

// Helper functions
function createSyncTestSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      store TEXT,
      total REAL,
      total_iva REAL,
      payment_method TEXT,
      amount_paid REAL,
      change_given REAL,
      customer_nif TEXT,
      cashier_email TEXT,
      cashier_name TEXT,
      invoice_number TEXT,
      document_type TEXT,
      receipt_number TEXT,
      receipt_issued_at TEXT,
      receipt_text TEXT,
      status TEXT,
      shift_closure_id TEXT,
      created_date TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT,
      product_id TEXT,
      product_name TEXT,
      quantity REAL,
      unit_price REAL,
      iva_rate REAL,
      subtotal REAL,
      stock_id TEXT,
      serial_number TEXT,
      expiry_date TEXT
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      barcode TEXT,
      category TEXT,
      price REAL,
      is_active INTEGER DEFAULT 1
    );
    
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
    
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT,
      nif TEXT,
      address TEXT,
      city TEXT,
      company_name TEXT,
      postal_code TEXT
    );
    
    CREATE TABLE IF NOT EXISTS shift_closures (
      id TEXT PRIMARY KEY,
      store TEXT,
      pos_terminal_id TEXT,
      cashier_email TEXT,
      cashier_name TEXT,
      shift_date TEXT,
      start_time TEXT,
      end_time TEXT,
      opening_declared_cash REAL,
      closing_declared_cash REAL,
      notes TEXT,
      status TEXT,
      created_date TEXT
    );
    
    CREATE TABLE IF NOT EXISTS pos_terminals (
      id TEXT PRIMARY KEY,
      store TEXT,
      code TEXT,
      is_active INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT,
      store TEXT,
      product_id TEXT,
      product_name TEXT,
      created_at TEXT
    );
  `);
}

function seedSyncTestData(db) {
  // Inserir lojas
  db.prepare(`INSERT INTO stores (id, name, nif, company_name) 
    VALUES (?, ?, ?, ?)`
  ).run('store1', 'Braga Centro', '999999990', 'FlashStore Retail S.A.');
  
  db.prepare(`INSERT INTO stores (id, name, nif, company_name) 
    VALUES (?, ?, ?, ?)`
  ).run('store2', 'Porto', '999999991', 'FlashStore Retail S.A.');
  
  // Inserir produtos
  db.prepare(`INSERT INTO products (id, name, barcode, category, price) 
    VALUES (?, ?, ?, ?, ?)`
  ).run('p1', 'Produto A', '789001', 'Geral', 10.00);
  
  db.prepare(`INSERT INTO products (id, name, barcode, category, price) 
    VALUES (?, ?, ?, ?, ?)`
  ).run('p2', 'Produto B', '789002', 'Geral', 20.00);
  
  // Inserir stock
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, serial_number) 
    VALUES (?, ?, ?, ?, ?, ?)`
  ).run('stock1', 'p1', 'Produto A', 'Braga Centro', 10, 'SN001');
  
  db.prepare(`INSERT INTO stock (id, product_id, product_name, store, quantity, serial_number) 
    VALUES (?, ?, ?, ?, ?, ?)`
  ).run('stock2', 'p2', 'Produto B', 'Braga Centro', 5, 'SN002');
  
  // Inserir terminal POS
  db.prepare(`INSERT INTO pos_terminals (id, store, code, is_active) 
    VALUES (?, ?, ?, ?)`
  ).run('pos1', 'Braga Centro', 'POS-001', 1);
}
