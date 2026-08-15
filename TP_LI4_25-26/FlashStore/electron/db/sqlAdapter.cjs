/**
 * Adaptador sql.js com API semelhante a better-sqlite3 (sem módulos nativos).
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js').default || require('sql.js');

async function openDatabase(dbPath) {
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  let db;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  let inTransaction = false;

  const persist = () => {
    if (inTransaction) return;
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  };

  const wrap = {
    exec(sql) {
      db.exec(sql);
      persist();
    },
    pragma(sql) {
      db.run(sql);
    },
    transaction(fn) {
      return function (...args) {
        inTransaction = true;
        db.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          db.run('COMMIT');
          return result;
        } catch (err) {
          try {
            db.run('ROLLBACK');
          } catch {
            /* ignore rollback errors */
          }
          throw err;
        } finally {
          inTransaction = false;
          persist();
        }
      };
    },
    prepare(sql) {
      return {
        run(...params) {
          db.run(sql, params);
          persist();
        },
        all(...params) {
          const stmt = db.prepare(sql);
          try {
            if (params.length) stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
              rows.push(stmt.getAsObject());
            }
            return rows;
          } finally {
            stmt.free();
          }
        },
        get(...params) {
          const stmt = db.prepare(sql);
          try {
            if (params.length) stmt.bind(params);
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally {
            stmt.free();
          }
        },
      };
    },
    close() {
      persist();
      db.close();
    },
  };

  return wrap;
}

module.exports = { openDatabase };
