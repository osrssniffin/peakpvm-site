"""Optional local preview with restricted Temple proxy. Python 3, no dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.parse import urlsplit, parse_qs
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent)
ALLOWED={'player_stats.php','pets/pet_count.php','collection-log/player_collection_log.php','collection-log/categories.php','collection-log/items.php'}
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        u=urlsplit(self.path)
        if not u.path.startswith('/api/'): return super().do_GET()
        route=u.path[5:]
        if route not in ALLOWED or any(v.lower()!='all 420s' for v in parse_qs(u.query).get('player',[])):
            self.send_error(403);return
        try:
            with urlopen(Request('https://templeosrs.com/api/'+route+('?' + u.query if u.query else ''),headers={'Accept':'application/json','User-Agent':'PeakPvM local preview'}),timeout=18) as r: data=r.read(10000000)
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
        except Exception as e: self.send_error(502,str(e))
print('Open http://localhost:8765/ in your browser')
ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
