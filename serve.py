#!/usr/bin/env python3
"""
Lightweight development server for Tasks.
Features:
- ThreadingHTTPServer (concurrent request handling)
- Zero external dependencies (Python standard library only)
- Safe handling of livereload, favicon fallbacks, and service workers
"""

import os
import sys
import time
import queue
import pathlib
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = 8000
WATCH_EXTENSIONS = {'.html', '.css', '.js', '.json', '.svg', '.png', '.webmanifest'}
IGNORE_DIRS = {'.git', '__pycache__', 'scratch', '.vscode'}

subscribers_lock = threading.Lock()
subscribers = []
shutdown_event = threading.Event()


class TaskManagerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent browser caching during local development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # Handle LiveReload SSE stream gracefully
        if self.path == '/__livereload':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            client_queue = queue.Queue()
            with subscribers_lock:
                subscribers.append(client_queue)

            try:
                self.wfile.write(b": connected\n\n")
                self.wfile.flush()

                while not shutdown_event.is_set():
                    try:
                        msg = client_queue.get(timeout=2.0)
                        self.wfile.write(f"data: {msg}\n\n".encode('utf-8'))
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
            except (ConnectionError, OSError):
                pass
            finally:
                with subscribers_lock:
                    if client_queue in subscribers:
                        subscribers.remove(client_queue)
            return

        clean_path = self.path.split('?')[0].split('#')[0]

        # Handle sw.js dummy response if requested
        if clean_path == '/sw.js' and not os.path.exists('sw.js'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return

        super().do_GET()


def get_files_snapshot(base_dir):
    snapshot = {}
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in WATCH_EXTENSIONS:
                full_path = os.path.join(root, f)
                try:
                    snapshot[full_path] = os.path.getmtime(full_path)
                except OSError:
                    pass
    return snapshot


def watch_files(base_dir):
    prev_snapshot = get_files_snapshot(base_dir)

    while not shutdown_event.is_set():
        time.sleep(0.6)
        current_snapshot = get_files_snapshot(base_dir)

        changed = False
        for path, prev_mtime in prev_snapshot.items():
            if path not in current_snapshot or current_snapshot[path] > prev_mtime:
                changed = True
                break

        if not changed:
            for path in current_snapshot:
                if path not in prev_snapshot:
                    changed = True
                    break

        if changed:
            prev_snapshot = current_snapshot
            with subscribers_lock:
                for q in subscribers:
                    q.put('reload')


def main():
    root_dir = pathlib.Path(__file__).parent.resolve()
    os.chdir(root_dir)

    port = PORT
    for i, arg in enumerate(sys.argv[1:]):
        if arg.isdigit():
            port = int(arg)
            break

    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, TaskManagerHandler)

    watcher_thread = threading.Thread(target=watch_files, args=(str(root_dir),), daemon=True)
    watcher_thread.start()

    print(f"Tasks server running on http://localhost:{port} (PID: {os.getpid()})", flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        shutdown_event.set()
        httpd.server_close()


if __name__ == '__main__':
    main()
