/**
 * FlashStore — Backups automáticos da BD SQLite central (RNF09)
 *
 * Estratégia:
 *  - Backup diário às 02:00 usando a API .backup() do better-sqlite3
 *    (hot backup sem bloquear leituras/escritas)
 *  - Retenção de 30 dias (backups mais antigos são apagados)
 *  - Backup manual disponível via POST /api/admin/backup
 */

const path = require('path');
const fs = require('fs');

const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 30;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function backupFilename() {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(BACKUP_DIR, `flashstore-${ts}.db`);
}

async function runBackup(db) {
  ensureBackupDir();
  const dest = backupFilename();
  await db.backup(dest);
  console.log(`[backup] ✅ Backup criado: ${dest}`);
  pruneOldBackups();
  return dest;
}

function pruneOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('flashstore-') && f.endsWith('.db'))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    files.slice(MAX_BACKUPS).forEach(({ name }) => {
      fs.unlinkSync(path.join(BACKUP_DIR, name));
      console.log(`[backup] 🗑️  Backup antigo removido: ${name}`);
    });
  } catch (err) {
    console.error('[backup] Erro ao limpar backups antigos:', err.message);
  }
}

function listBackups() {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('flashstore-') && f.endsWith('.db'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size_bytes: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Agenda backup diário às 02:00.
 * @param {import('better-sqlite3').Database} db
 */
function scheduleDailyBackup(db) {
  function msUntil2am() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  function scheduleNext() {
    const delay = msUntil2am();
    console.log(`[backup] Próximo backup agendado em ${Math.round(delay / 60000)} min`);
    setTimeout(async () => {
      try {
        await runBackup(db);
      } catch (err) {
        console.error('[backup] Falha no backup automático:', err.message);
      }
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

module.exports = { runBackup, listBackups, scheduleDailyBackup, BACKUP_DIR };
