import sqlite3
import os
import secrets
import string

DB_PATH = os.path.join(os.path.dirname(__file__), "ledger3.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()

    # Core tables
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            invite_code TEXT NOT NULL UNIQUE,
            created_by INTEGER NOT NULL,
            created_at REAL NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            group_id INTEGER NOT NULL DEFAULT 0,
            created_at REAL NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (group_id) REFERENCES groups(id)
        );

        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL DEFAULT 0,
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

    # Migrate: add columns if missing (for existing DBs)
    try:
        conn.execute("ALTER TABLE users ADD COLUMN group_id INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE bills ADD COLUMN group_id INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass

    # If any users have group_id=0, create a default group for them
    orphan = conn.execute("SELECT id FROM users WHERE group_id = 0 LIMIT 1").fetchone()
    if orphan:
        code = secrets.token_hex(3).upper()
        conn.execute(
            "INSERT INTO groups (name, invite_code, created_by) VALUES (?, ?, ?)",
            ("默认圈子", code, orphan["id"]),
        )
        gid = conn.execute("SELECT id FROM groups WHERE invite_code = ?", (code,)).fetchone()["id"]
        conn.execute("UPDATE users SET group_id = ? WHERE group_id = 0", (gid,))
        conn.execute("UPDATE bills SET group_id = ? WHERE group_id = 0", (gid,))

    conn.commit()
    conn.close()


def gen_invite_code():
    return secrets.token_hex(4).upper()
