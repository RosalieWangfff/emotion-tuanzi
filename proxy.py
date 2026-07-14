"""
proxy.py — 情绪团子本地一体化开发服务器
- 端口 8000：静态文件服务（HTML/JS/CSS/图片）
- /api/chat：转发到火山引擎 Agent Plan 端点

启动：python proxy.py
访问：http://localhost:8000/

API key 读取顺序：
1. 环境变量 ARK_API_KEY
2. .env 文件中的 ARK_API_KEY=...

停止：Ctrl + C
"""
import http.server
import ssl
import os
import sys
import json
import urllib.request
import urllib.error
from http import HTTPStatus

# 强制 stdout/stderr 用 UTF-8 输出（避免 Windows GBK 编码错误）
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

PORT = 8000
TARGET_HOST = 'ark.cn-beijing.volces.com'
SSL_CTX = ssl.create_default_context()


def get_api_key():
    """从环境变量或 .env 文件读取 API key"""
    # 1. 环境变量
    key = os.environ.get('ARK_API_KEY')
    if key:
        return key.strip()
    # 2. .env 文件
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('ARK_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    return None


def ensure_env_template():
    """如果 .env 不存在，创建一个模板"""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if not os.path.exists(env_path):
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write('# 火山引擎 Agent Plan API key\n')
            f.write('# 获取：https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey\n')
            f.write('ARK_API_KEY=ark-在这里粘贴你的key\n')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # 静态文件根目录设为脚本所在目录
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/chat':
            self._handle_chat()
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def _handle_chat(self):
        # 读取请求体
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # 获取 API key：优先用前端传来的，没有就用环境变量
        auth = self.headers.get('Authorization')
        if not auth:
            key = get_api_key()
            if key:
                auth = f'Bearer {key}'

        if not auth:
            self.send_response(HTTPStatus.UNAUTHORIZED)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write('{"error":"ARK_API_KEY 未配置：请在 .env 文件中设置 ARK_API_KEY=ark-..."}'.encode('utf-8'))
            return

        # 注入默认参数（如果前端没传）
        try:
            body_json = json.loads(body) if body else {}
            body_json.setdefault('model', 'ark-code-latest')
            body_json.setdefault('thinking', {'type': 'disabled'})
            body_json.setdefault('temperature', 0.65)
            body_json.setdefault('top_p', 0.9)
            body = json.dumps(body_json).encode('utf-8')
        except Exception:
            pass

        # 转发到火山引擎 Agent Plan
        target_url = f'https://{TARGET_HOST}/api/plan/v3/chat/completions'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': auth,
        }

        req = urllib.request.Request(target_url, data=body, headers=headers, method='POST')

        try:
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(err_body)
        except Exception as e:
            err_msg = json.dumps({'error': 'Proxy error', 'message': str(e)}).encode('utf-8')
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(err_msg)

    def end_headers(self):
        # 静态文件也加 CORS 头（开发环境）
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # 简化日志
        import sys
        if self.path.startswith('/api/'):
            sys.stderr.write(f'[API] {self.command} {self.path} → {args[1] if len(args) > 1 else ""}\n')
        else:
            sys.stderr.write(f'[Static] {self.command} {self.path}\n')


def main():
    # 切换到脚本所在目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # 创建 .env 模板（如果不存在）
    ensure_env_template()

    server = http.server.HTTPServer(('127.0.0.1', PORT), Handler)
    print('=' * 56)
    print('  情绪团子 — 本地一体化开发服务器')
    print('=' * 56)
    print(f'  访问地址：http://localhost:{PORT}')
    print(f'  AI 转发：/api/chat → https://{TARGET_HOST}')
    print('')

    key = get_api_key()
    if key:
        masked = f'{key[:16]}...{key[-4:]}' if len(key) > 24 else key
        print(f'  API Key：{masked} [OK]')
    else:
        print('  [!] 警告：ARK_API_KEY 未配置')
        print('    请编辑项目根目录的 .env 文件，写入：')
        print('    ARK_API_KEY=ark-你的key')
        print('    然后重新启动')
    print('')
    print('  停止：Ctrl + C')
    print('=' * 56)
    print('')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止。')
        server.server_close()


if __name__ == '__main__':
    main()
