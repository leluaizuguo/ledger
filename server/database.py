import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "ledger.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at REAL NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            type TEXT NOT NULL,
            category_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            target_account_id TEXT,
            note TEXT DEFAULT '',
            date TEXT NOT NULL,
            is_reimbursable INTEGER DEFAULT 0,
            reimbursed INTEGER DEFAULT 0,
            installment_id INTEGER,
            image_data TEXT,
            created_at REAL NOT NULL DEFAULT (unixepoch()),
            updated_at REAL NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sync_log (
            device_id TEXT NOT NULL,
            last_pull_at REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (device_id)
        );
    """)
    conn.commit()
    conn.close()
