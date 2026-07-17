"""
CareerPick — Lokal onizleme sunucusu (sadece gormek/test icin)
==============================================================
Statik dosyalari servis eder VE POST /api/sohbet ile /api/assessment
isteklerini ilgili motorlara yonlendirir. Vercel'i beklemeden yeni
"Kariyer Sohbeti" sayfasini tarayicidan gorebilirsin.

Kullanim:
    pip install -r requirements.txt     # ilk sefer
    python scripts/dev_server.py        # http://localhost:8000/kariyer%20sohbet.html
"""

import os
import json
import importlib.util
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8000"))


def _load_env():
    p = os.path.join(ROOT, ".env.local")
    if not os.path.exists(p):
        print("[UYARI] .env.local yok — AI cagrilari calismayabilir.")
        return
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())
    print("[ENV] .env.local yuklendi")


_load_env()


def _load(modname, filename):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(ROOT, "api", filename))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


sohbet = _load("sohbet", "sohbet.py")


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".jsx"):
            return "application/javascript"
        return super().guess_type(path)

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path != "/api/sohbet":
            return self._json(404, {"error": "Bulunamadi"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception:
            return self._json(400, {"error": "Gecersiz JSON."})

        action = data.get("action")
        try:
            a, o, q = sohbet._clients()
            if action == "evaluate":
                print(f"[REQ] evaluate tip={data.get('type','profile')!r} cevap={str(data.get('cevap',''))[:40]!r}")
                return self._json(200, sohbet.degerlendir(
                    data.get("soru", ""),
                    data.get("cevap", ""),
                    a,
                    data.get("type") or "profile",
                    data.get("yetkinlik") or "",
                ))
            elif action == "recommend":
                print("[REQ] recommend")
                recs, yetkinlikler = sohbet.oner(data.get("cevaplar", []), a, o, q)
                return self._json(200, {"recommendations": recs, "yetkinlikler": yetkinlikler})
            return self._json(400, {"error": "Gecersiz action."})
        except Exception as e:
            import traceback; traceback.print_exc()
            return self._json(503, {"error": f"AI hata: {e}"})


if __name__ == "__main__":
    print(f"Onizleme -> http://localhost:{PORT}/kariyer%20sohbet.html")
    print("Durdurmak icin Ctrl+C")
    ThreadingHTTPServer(("0.0.0.0", PORT), DevHandler).serve_forever()
