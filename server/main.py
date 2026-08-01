from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import time

from database import get_db, init_db, gen_invite_code
from auth import hash_password, verify_password, create_token, get_current_user

app = FastAPI(title="Ledger Sync")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    init_db()


# --- Models ---
class RegisterReq(BaseModel):
    username: str
    display_name: str
    password: str
    invite_code: Optional[str] = ""


class LoginReq(BaseModel):
    username: str
    password: str


class SyncBill(BaseModel):
    client_id: str
    amount: int
    type: str
    category_id: str
    account_id: str
    target_account_id: Optional[str] = None
    note: str = ""
    date: str
    is_reimbursable: bool = False
    reimbursed: bool = False
    installment_id: Optional[int] = None
    image_data: Optional[str] = None
    updated_at: float


class PushReq(BaseModel):
    device_id: str
    bills: List[SyncBill]


def _get_user_group(db, user_id: int) -> Optional[int]:
    u = db.execute("SELECT group_id FROM users WHERE id = ?", (user_id,)).fetchone()
    return u["group_id"] if u else None


def _get_group_members(db, group_id: int):
    rows = db.execute(
        "SELECT id, username, display_name FROM users WHERE group_id = ?", (group_id,)
    ).fetchall()
    return [{"id": r["id"], "username": r["username"], "display_name": r["display_name"]} for r in rows]


# --- Auth Routes ---
@app.post("/api/auth/register")
def register(req: RegisterReq):
    db = get_db()
    if db.execute("SELECT id FROM users WHERE username = ?", (req.username,)).fetchone():
        db.close()
        raise HTTPException(400, "Username taken")

    # Determine group
    if req.invite_code:
        g = db.execute("SELECT id, name FROM groups WHERE invite_code = ?", (req.invite_code,)).fetchone()
        if not g:
            db.close()
            raise HTTPException(400, "Invalid invite code")
        group_id, group_name = g["id"], g["name"]
    else:
        code = gen_invite_code()
        # We need a group name, but user display_name is what we have
        db.execute("INSERT INTO groups (name, invite_code, created_by) VALUES (?, ?, 0)", (req.display_name + "的家", code))
        group_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        group_name = req.display_name + "的家"
        db.commit()

    db.execute(
        "INSERT INTO users (username, display_name, password_hash, group_id) VALUES (?, ?, ?, ?)",
        (req.username, req.display_name, hash_password(req.password), group_id),
    )
    # Update group's created_by
    user_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute("UPDATE groups SET created_by = ? WHERE id = ? AND created_by = 0", (user_id, group_id))
    db.commit()

    invite = db.execute("SELECT invite_code FROM groups WHERE id = ?", (group_id,)).fetchone()["invite_code"]
    members = _get_group_members(db, group_id)
    db.close()

    token = create_token(user_id, req.username)
    return {
        "token": token,
        "user": {"id": user_id, "username": req.username, "display_name": req.display_name},
        "group": {"id": group_id, "name": group_name, "invite_code": invite, "members": members},
    }


@app.post("/api/auth/login")
def login(req: LoginReq):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ?", (req.username,)).fetchone()
    if not user or not verify_password(req.password, user["password_hash"]):
        db.close()
        raise HTTPException(401, "Invalid username or password")

    g = db.execute("SELECT id, name, invite_code FROM groups WHERE id = ?", (user["group_id"],)).fetchone()
    members = _get_group_members(db, user["group_id"])
    db.close()

    token = create_token(user["id"], req.username)
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "display_name": user["display_name"]},
        "group": {"id": g["id"], "name": g["name"], "invite_code": g["invite_code"], "members": members},
    }


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    db = get_db()
    u = db.execute("SELECT id, username, display_name, group_id FROM users WHERE id = ?", (user["user_id"],)).fetchone()
    if not u:
        db.close()
        raise HTTPException(404, "User not found")
    g = db.execute("SELECT id, name, invite_code FROM groups WHERE id = ?", (u["group_id"],)).fetchone()
    members = _get_group_members(db, u["group_id"])
    db.close()
    return {
        "id": u["id"], "username": u["username"], "display_name": u["display_name"],
        "group": {"id": g["id"], "name": g["name"], "invite_code": g["invite_code"], "members": members},
    }


# --- Group ---
@app.get("/api/groups/info")
def group_info(user=Depends(get_current_user)):
    db = get_db()
    gid = _get_user_group(db, user["user_id"])
    if not gid:
        db.close()
        raise HTTPException(404, "No group")
    g = db.execute("SELECT id, name, invite_code FROM groups WHERE id = ?", (gid,)).fetchone()
    members = _get_group_members(db, gid)
    db.close()
    return {"id": g["id"], "name": g["name"], "invite_code": g["invite_code"], "members": members}


# --- Sync Routes ---
@app.post("/api/sync/push")
def sync_push(req: PushReq, user=Depends(get_current_user)):
    db = get_db()
    uid = user["user_id"]
    gid = _get_user_group(db, uid)
    mapped = []

    for b in req.bills:
        existing = db.execute(
            "SELECT id FROM bills WHERE client_id = ? AND user_id = ?",
            (b.client_id, uid),
        ).fetchone()

        if existing:
            db.execute(
                "UPDATE bills SET amount=?, type=?, category_id=?, account_id=?, "
                "target_account_id=?, note=?, date=?, is_reimbursable=?, "
                "reimbursed=?, installment_id=?, image_data=?, "
                "updated_at=MAX(updated_at, ?) WHERE id=?",
                (b.amount, b.type, b.category_id, b.account_id,
                 b.target_account_id, b.note, b.date,
                 1 if b.is_reimbursable else 0, 1 if b.reimbursed else 0,
                 b.installment_id, b.image_data, b.updated_at, existing["id"]),
            )
            mapped.append({"client_id": b.client_id, "server_id": existing["id"]})
        else:
            now = time.time()
            cur = db.execute(
                "INSERT INTO bills (client_id, user_id, group_id, amount, type, category_id, account_id, "
                "target_account_id, note, date, is_reimbursable, reimbursed, "
                "installment_id, image_data, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (b.client_id, uid, gid, b.amount, b.type, b.category_id, b.account_id,
                 b.target_account_id, b.note, b.date,
                 1 if b.is_reimbursable else 0, 1 if b.reimbursed else 0,
                 b.installment_id, b.image_data, now, b.updated_at),
            )
            mapped.append({"client_id": b.client_id, "server_id": cur.lastrowid})

    db.commit()
    db.close()
    return {"ok": True, "mapped": mapped}


@app.get("/api/sync/pull")
def sync_pull(since: float = 0, device_id: str = "", user=Depends(get_current_user)):
    db = get_db()
    gid = _get_user_group(db, user["user_id"])

    if device_id:
        db.execute(
            "INSERT INTO sync_log (device_id, last_pull_at) VALUES (?, ?) "
            "ON CONFLICT(device_id) DO UPDATE SET last_pull_at = ?",
            (device_id, time.time(), time.time()),
        )

    # Pull ALL bills in the group (not just current user)
    rows = db.execute(
        "SELECT * FROM bills WHERE group_id = ? AND updated_at > ? ORDER BY updated_at",
        (gid, since),
    ).fetchall()

    bills = []
    user_ids = set()
    for r in rows:
        bills.append({
            "id": r["id"], "client_id": r["client_id"], "user_id": r["user_id"],
            "amount": r["amount"], "type": r["type"], "category_id": r["category_id"],
            "account_id": r["account_id"], "target_account_id": r["target_account_id"],
            "note": r["note"], "date": r["date"],
            "is_reimbursable": bool(r["is_reimbursable"]),
            "reimbursed": bool(r["reimbursed"]),
            "installment_id": r["installment_id"], "image_data": r["image_data"],
            "updated_at": r["updated_at"],
        })
        user_ids.add(r["user_id"])

    users_map = {}
    if user_ids:
        placeholders = ",".join("?" * len(user_ids))
        urows = db.execute(
            "SELECT id, display_name FROM users WHERE id IN (" + placeholders + ")",
            tuple(user_ids),
        ).fetchall()
        users_map = {u["id"]: u["display_name"] for u in urows}

    db.close()

    for b in bills:
        b["display_name"] = users_map.get(b["user_id"], "unknown")

    return {"bills": bills, "server_time": time.time()}


# --- Health ---
@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
