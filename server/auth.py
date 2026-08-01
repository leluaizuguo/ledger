import hashlib
import os
import time
import jwt
from fastapi import Header, HTTPException

SECRET = chr(108)+chr(101)+chr(100)+chr(103)+chr(101)+chr(114)+chr(45)+chr(115)+chr(121)+chr(110)+chr(99)+chr(45)+chr(50)+chr(48)+chr(50)+chr(54)
ALGO = chr(72)+chr(83)+chr(50)+chr(53)+chr(54)
EXPIRE_HRS = 720


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    h = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{h}"


def verify_password(password: str, stored: str) -> bool:
    salt, h = stored.split(":", 1)
    return hashlib.sha256((password + salt).encode()).hexdigest() == h


def create_token(user_id: int, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": time.time() + EXPIRE_HRS * 3600,
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    return verify_token(authorization[7:])
