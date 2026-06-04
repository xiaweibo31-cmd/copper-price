#!/usr/bin/env python3
"""沪铜行情 - 本地服务器 + API 代理"""

import http.server
import subprocess
import json
import os
import socket
import urllib.parse

PORT = int(os.environ.get("PORT", 8899))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
REFERER = 'Referer: https://quote.eastmoney.com/'

QUOTE_URL = (
    'https://push2.eastmoney.com/api/qt/stock/get'
    '?secid=113.cum'
    '&fields=f43,f44,f45,f46,f48,f50,f51,f57,f58,f60,f168,f169,f170,f171,f115,f116'
)
KLINE_URL = (
    'https://push2.eastmoney.com/api/qt/stock/kline/get'
    '?secid=113.cum&klt=101&fqt=1'
    '&fields1=f1,f2,f3'
    '&fields2=f51,f52,f53,f54,f55,f56,f57'
    '&lmt=120'
)

def curl_get(url, retries=2):
    """用系统 curl 请求，失败自动重试"""
    for attempt in range(1 + retries):
        try:
            result = subprocess.run(
                ['/usr/bin/curl', '-sL', '-4', '--max-time', '8',
                 '-A', UA, '-e', 'https://quote.eastmoney.com/', url],
                capture_output=True, timeout=12
            )
            if result.returncode == 0:
                data = result.stdout
                if data:
                    try:
                        json.loads(data)
                        return data, None
                    except:
                        return None, f'bad JSON: {data[:100]}'
            if attempt < retries:
                import time
                time.sleep(1)
        except subprocess.TimeoutExpired:
            if attempt >= retries:
                return None, 'timeout'
            import time
            time.sleep(1)
    return None, f'curl error ({result.returncode})' if result else 'failed'

class CopperHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/quote':
            return self._proxy(QUOTE_URL)
        if path == '/api/kline':
            return self._proxy(KLINE_URL)
        if path == '/api/check':
            return self._check()
        return super().do_GET()

    def _proxy(self, url):
        data, err = curl_get(url)
        if err:
            self._send_json(502, {'ok': False, 'error': err})
        else:
            self._send_json(200, json.loads(data))

    def _check(self):
        results = {}
        for name, url in [('quote', QUOTE_URL), ('kline', KLINE_URL)]:
            data, err = curl_get(url)
            results[name] = {'ok': data is not None, 'error': err} if err else {'ok': True}
        self._send_json(200, results)

    def _send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # 兼容 send_error 的 "code %d, message %s" 格式
        try:
            if len(args) == 3:
                print(f'[{self.log_date_time_string()}] {args[0]} {args[1]} {args[2]}')
            else:
                print(f'[{self.log_date_time_string()}] {fmt % args}')
        except:
            pass

def get_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('8.8.8.8', 80))
            return s.getsockname()[0]
    except:
        return '127.0.0.1'

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ip = get_local_ip()
    print('=' * 45)
    print('  沪铜行情 - 本地服务器')
    print('=' * 45)
    print(f'  手机访问: http://{ip}:{PORT}')
    print(f'  电脑访问: http://localhost:{PORT}')
    print(f'  按 Ctrl+C 停止')
    if os.environ.get("RENDER"):
        print(f"  云端地址: https://copper-price.onrender.com")
        print(f"  手机打开上面这个网址，添加到桌面即可")
    print('=' * 45)
    server = http.server.HTTPServer(('0.0.0.0', PORT), CopperHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')
        server.server_close()
