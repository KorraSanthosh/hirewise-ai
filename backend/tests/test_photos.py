import io
import struct
import zlib

from tests.conftest import register_login


def tiny_png() -> bytes:
    raw = zlib.compress(b"\x00\xff\x00\x00")
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")


def test_candidate_photo_upload_view_replace_delete(client, tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    cand = register_login(client, "candidate")
    prof = client.get("/api/candidates/profile", headers=cand).json()
    assert prof["photoUrl"] is None
    up = lambda data, name="p.png": client.post("/api/candidates/profile/photo", files={"file": (name, io.BytesIO(data), "image/png")}, headers=cand)
    assert up(b"not an image").status_code == 400
    assert up(b"\x89PNG\r\n\x1a\n" + b"0" * (3 * 1024 * 1024)).status_code == 400
    r = up(tiny_png())
    assert r.status_code == 201, r.text
    url = r.json()["data"]["photoUrl"]
    prof = client.get("/api/candidates/profile", headers=cand).json()
    assert prof["photoUrl"] == url
    img = client.get(url)  # public by unguessable id, so <img> works without a token
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"
    # another candidate cannot overwrite it
    other = register_login(client, "candidate", email="other@x.com")
    assert client.post(f"/api/candidates/{prof['id']}/photo", files={"file": ("p.png", io.BytesIO(tiny_png()), "image/png")}, headers=other).status_code == 403
    assert client.delete("/api/candidates/profile/photo", headers=cand).status_code == 200
    assert client.get("/api/candidates/profile", headers=cand).json()["photoUrl"] is None
