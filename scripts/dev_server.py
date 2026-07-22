"""
CareerPick — Lokal onizleme sunucusu
Statik dosyalar + /api/sohbet + /api/job-match + /api/public-config
"""

import os
import json
import sys
import importlib.util
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8000"))
API_DIR = os.path.join(ROOT, "api")
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)


def _load_env():
    p = os.path.join(ROOT, ".env.local")
    if not os.path.exists(p):
        print("[UYARI] .env.local yok — AI / Supabase cagrilari calismayabilir.")
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
job_match = _load("job_match", "job-match.py")
yatay_gecis = _load("yatay_gecis", "yatay-gecis.py")


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

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/public-config":
            url = os.environ.get("SUPABASE_URL", "")
            anon = os.environ.get("SUPABASE_ANON_KEY", "")
            if not url or not anon:
                return self._json(503, {"configured": False, "error": "Supabase yapilandirmasi eksik."})
            return self._json(200, {
                "configured": True,
                "supabaseUrl": url,
                "supabaseAnonKey": anon,
            })
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/public-config":
            return self.do_GET()
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception:
            return self._json(400, {"error": "Gecersiz JSON."})

        if path == "/api/job-match":
            try:
                print("[REQ] job-match")
                result = job_match.analyze_job(
                    data.get("url") or "",
                    data.get("text") or "",
                    data.get("profile") if isinstance(data.get("profile"), dict) else {},
                )
                return self._json(200 if result.get("ok") else 422, result)
            except Exception as e:
                import traceback; traceback.print_exc()
                return self._json(503, {"ok": False, "error": f"AI hata: {e}", "need_paste": True})

        if path == "/api/yatay-gecis":
            try:
                print("[REQ] yatay-gecis")
                return self._json(200, yatay_gecis.oner_yatay_gecis(data.get("mevcut_rol") or ""))
            except Exception as e:
                import traceback; traceback.print_exc()
                return self._json(200, {"ok": True, "suggestions": []})

        if path != "/api/sohbet":
            return self._json(404, {"error": "Bulunamadi"})

        action = data.get("action")
        try:
            a, o, q = sohbet._clients()
            if action == "evaluate":
                print(f"[REQ] evaluate tip={data.get('type','profile')!r} attempt={data.get('attempt',0)} cevap={str(data.get('cevap',''))[:40]!r}")
                return self._json(200, sohbet.degerlendir(
                    data.get("soru", ""),
                    data.get("cevap", ""),
                    a,
                    data.get("type") or "profile",
                    data.get("yetkinlik") or "",
                    data.get("attempt", 0),
                ))
            elif action == "scenarios":
                print("[REQ] scenarios")
                return self._json(200, sohbet.senaryolari_hazirla(data.get("cevaplar", []), o, q))
            elif action == "recommend":
                print("[REQ] recommend")
                recs, yetkinlikler = sohbet.oner(data.get("cevaplar", []), a, o, q)
                return self._json(200, {"recommendations": recs, "yetkinlikler": yetkinlikler})
            elif action == "roadmap":
                print("[REQ] roadmap")
                return self._json(200, sohbet.yol_haritasi_uret(
                    data.get("hedef") or "",
                    data.get("yetkinlikler") if isinstance(data.get("yetkinlikler"), list) else [],
                    data.get("trainings") if isinstance(data.get("trainings"), list) else [],
                    a,
                    o,
                    q,
                ))
            elif action == "micro_tasks":
                print("[REQ] micro_tasks")
                return self._json(200, sohbet.mikro_gorev_uret(
                    data.get("yetkinlikler") if isinstance(data.get("yetkinlikler"), list) else [],
                    a,
                ))
            elif action == "compare_summary":
                print("[REQ] compare_summary")
                return self._json(200, {"summary": ""})
            return self._json(400, {"error": "Gecersiz action."})
        except Exception as e:
            import traceback; traceback.print_exc()
            return self._json(503, {"error": f"AI hata: {e}"})


if __name__ == "__main__":
    print(f"Onizleme -> http://localhost:{PORT}/kariyer%20sohbet.html")
    print(f"Profil   -> http://localhost:{PORT}/profil.html")
    print(f"Ilan     -> http://localhost:{PORT}/ilan-uyumu.html")
    print("Durdurmak icin Ctrl+C")
    ThreadingHTTPServer(("0.0.0.0", PORT), DevHandler).serve_forever()
