/**
 * Підключення до PostgreSQL + ініціалізація схеми для CarFlow.
 * Режими: PostgreSQL (USE_IN_MEMORY_DB=false), in-memory (true), persist (знімок на диск).
 * @module db
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { newDb } = require('pg-mem');
const bcrypt = require('bcryptjs');

let pool;
let memDb = null;
let isInitialized = false;
let persistMode = false;

const SNAPSHOT_TABLES = [
    'clients',
    'services',
    'vehicles',
    'users',
    'orders',
    'order_items',
    'appointments',
];

const schemaSql = `
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    vin TEXT NOT NULL UNIQUE,
    plate TEXT NOT NULL UNIQUE,
    year INTEGER
);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    type TEXT NOT NULL DEFAULT 'work',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'cancelled')),
    description TEXT DEFAULT '',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * @returns {string}
 */
function getSnapshotPath() {
    const raw = process.env.DB_SNAPSHOT_PATH || 'data/sto-snapshot.json';
    return path.isAbsolute(raw) ? raw : path.join(__dirname, raw);
}

/**
 * @returns {boolean}
 */
function isPersistMode() {
    return process.env.USE_IN_MEMORY_DB === 'persist' || Boolean(process.env.DB_SNAPSHOT_PATH && process.env.USE_IN_MEMORY_DB !== 'false');
}

/**
 * @returns {boolean}
 */
function isMemoryMode() {
    if (isPersistMode()) return true;
    return process.env.USE_IN_MEMORY_DB === 'true' || (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL);
}

/**
 * Lazy-ініціалізація пулу: PostgreSQL або pg-mem за змінними оточення.
 * @returns {import('pg').Pool} активний пул
 */
function createPool() {
    if (pool) return pool;

    persistMode = isPersistMode();

    if (isMemoryMode()) {
        memDb = newDb();
        const adapter = memDb.adapters.createPg();
        pool = new adapter.Pool();
        return pool;
    }

    pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sto_project',
    });
    return pool;
}

/**
 * @param {string} table
 * @returns {Promise<void>}
 */
async function resetTableSequence(table) {
    try {
        const res = await query(`SELECT COALESCE(MAX(id), 0) AS mx FROM ${table}`);
        const maxId = Number(res.rows[0].mx);
        if (maxId <= 0) return;

        if (memDb) {
            // pg-mem скидає sequence після DELETE, тому просуваємо nextval maxId разів
            for (let i = 0; i < maxId; i++) {
                await query(`SELECT nextval('${table}_id_seq')`);
            }
            return;
        }

        // Real PostgreSQL
        await query(`ALTER SEQUENCE ${table}_id_seq RESTART WITH ${maxId + 1}`);
    } catch { /* ignore */ }
}

/**
 * @returns {Promise<boolean>}
 */
async function loadSnapshot() {
    if (!persistMode) return false;

    const filePath = getSnapshotPath();
    if (!fs.existsSync(filePath)) return false;

    let payload;
    try {
        payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return false;
    }

    const tables = payload.tables || payload;
    if (!tables || typeof tables !== 'object') return false;

    for (const table of [...SNAPSHOT_TABLES].reverse()) {
        await query(`DELETE FROM ${table}`).catch(() => undefined);
    }

    for (const table of SNAPSHOT_TABLES) {
        const rows = tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        const colList = columns.join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        for (const row of rows) {
            const values = columns.map((col) => row[col]);
            await query(
                `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
                values,
            );
        }
        await resetTableSequence(table);
    }

    return true;
}

/**
 * Зберігає знімок основних таблиць на диск (режим persist).
 * @returns {Promise<void>}
 */
async function saveSnapshot() {
    if (!persistMode || !pool || !isInitialized) return;

    const tables = {};
    for (const table of SNAPSHOT_TABLES) {
        try {
            const result = await query(`SELECT * FROM ${table} ORDER BY id`);
            tables[table] = result.rows;
        } catch {
            tables[table] = [];
        }
    }

    const filePath = getSnapshotPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
        filePath,
        JSON.stringify({ version: 1, savedAt: new Date().toISOString(), tables }, null, 2),
        'utf8',
    );
}

/**
 * Виконує параметризований SQL через поточний пул.
 * @param {string} text SQL-текст
 * @param {unknown[]} [params] параметри `$1`, `$2`, … (якщо не передано — порожній масив)
 * @returns {Promise<import('pg').QueryResult>} результат виконання запиту від драйвера `pg`
 */
async function query(text, params = []) {
    const activePool = createPool();
    return activePool.query(text, params);
}

/**
 * Створює адміністратора та базові послуги, якщо їх ще немає (ідемпотентно).
 * @returns {Promise<void>}
 */
async function ensureDefaultData() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sto.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const hash = await bcrypt.hash(adminPassword, 10);

    await query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'admin')
         ON CONFLICT (email) DO NOTHING`,
        [adminEmail, hash],
    );

    const services = [
        ['Заміна масла', 800, 'work'],
        ['Діагностика ходової', 500, 'work'],
        ['Гальмівні колодки', 1200, 'part'],
        ['Компʼютерна діагностика', 650, 'work'],
    ];

    for (const [title, price, type] of services) {
        await query(
            `INSERT INTO services (title, price, type, is_active)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT DO NOTHING`,
            [title, price, type],
        );
    }
}

/**
 * Створює базові таблиці (без міграцій і без знімка).
 * @returns {Promise<void>}
 */
async function initSchema() {
    createPool();
    await query(schemaSql);
}

/**
 * Після міграцій: знімок з диска або дефолтні дані.
 * @returns {Promise<void>}
 */
async function initData() {
    const restored = await loadSnapshot();
    if (!restored) {
        await ensureDefaultData();
    }
}

/**
 * Ініціалізує схему БД й дефолтні дані один раз за життя процесу.
 * @returns {Promise<void>}
 */
async function initDb() {
    if (isInitialized) return;
    await initSchema();
    const restored = await loadSnapshot();
    if (!restored) {
        await ensureDefaultData();
    }
    isInitialized = true;
}

/**
 * @param {boolean} value
 */
function setInitialized(value) {
    isInitialized = value;
}

/**
 * @returns {boolean}
 */
function isDbInitialized() {
    return isInitialized;
}

/**
 * Коректно закриває пул з’єднань (для тестів і graceful shutdown).
 * @returns {Promise<void>}
 */
async function closeDb() {
    if (persistMode && isInitialized) {
        await saveSnapshot();
    }
    if (pool) {
        await pool.end();
    }
    pool = null;
    isInitialized = false;
}

function registerPersistShutdownHooks() {
    if (!isPersistMode() || process.env.NODE_ENV === 'test') return;

    const flush = () => {
        if (!pool || !isInitialized) return;
        saveSnapshot().catch(() => undefined);
    };

    process.once('SIGINT', flush);
    process.once('SIGTERM', flush);
}

registerPersistShutdownHooks();

module.exports = {
    initDb,
    initSchema,
    initData,
    setInitialized,
    isDbInitialized,
    query,
    closeDb,
    saveSnapshot,
    loadSnapshot,
    ensureDefaultData,
};
