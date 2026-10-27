import json
import os
import re
import tempfile
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8080
BACKUP_DIR = Path.home() / "OneDrive - NUCLEO ENGENHARIA" / "Documentos" / "Kanban Backups"
STATUSES = {"todo", "doing", "stopped", "done"}
PRIORITIES = {"low", "medium", "high"}
MAX_BODY = 5 * 1024 * 1024


class KanbanHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/backup":
            latest = BACKUP_DIR / "kanban-latest.json"
            if not latest.is_file():
                return self.send_json(404, {"error": "backup_not_found"})
            try:
                data = json.loads(latest.read_text(encoding="utf-8"))
                return self.send_json(200, data)
            except (OSError, json.JSONDecodeError):
                return self.send_json(500, {"error": "backup_unreadable"})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/backup":
            return self.send_json(404, {"error": "not_found"})
        if self.headers.get("Origin") not in (None, "http://localhost:8080"):
            return self.send_json(403, {"error": "origin_not_allowed"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_json(400, {"error": "invalid_content_length"})
        if not 0 < size <= MAX_BODY:
            return self.send_json(413, {"error": "invalid_backup_size"})
        try:
            data = json.loads(self.rfile.read(size))
            self.validate_backup(data)
            payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            self.atomic_write(BACKUP_DIR / "kanban-latest.json", payload)
            day = datetime.now().strftime("%Y-%m-%d")
            self.atomic_write(BACKUP_DIR / f"kanban-{day}.json", payload)
            return self.send_json(200, {"ok": True})
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            return self.send_json(400, {"error": str(error)})
        except OSError:
            return self.send_json(503, {"error": "backup_folder_unavailable"})

    @staticmethod
    def validate_backup(data):
        if not isinstance(data, dict) or data.get("format") != "kanban-local-backup" or data.get("version") != 1:
            raise ValueError("invalid_backup_format")
        tasks = data.get("tasks")
        if not isinstance(tasks, list) or len(tasks) > 10000:
            raise ValueError("invalid_task_list")
        statuses = data.get("statuses")
        valid_statuses = STATUSES
        if statuses is not None:
            if not isinstance(statuses, list) or not 4 <= len(statuses) <= 50:
                raise ValueError("invalid_status_list")
            valid_statuses = set()
            for item in statuses:
                if (not isinstance(item, list) or len(item) != 2
                        or not isinstance(item[0], str) or not re.fullmatch(r"[a-zA-Z0-9-]{1,80}", item[0])
                        or item[0] in valid_statuses or not isinstance(item[1], str)
                        or not item[1].strip() or len(item[1]) > 40):
                    raise ValueError("invalid_status")
                valid_statuses.add(item[0])
            if not STATUSES.issubset(valid_statuses):
                raise ValueError("missing_default_status")
        seen = set()
        for task in tasks:
            if not isinstance(task, dict):
                raise ValueError("invalid_task")
            task_id = task.get("id")
            title = task.get("title")
            description = task.get("description", "")
            if (not isinstance(task_id, str) or not task_id or task_id in seen
                    or not isinstance(title, str) or not title.strip() or len(title) > 100
                    or not isinstance(description, str) or len(description) > 280
                    or task.get("status") not in valid_statuses
                    or task.get("priority") not in PRIORITIES
                    or not isinstance(task.get("createdAt"), (int, float))):
                raise ValueError("invalid_task")
            seen.add(task_id)

    @staticmethod
    def atomic_write(path, payload):
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".kanban-", suffix=".tmp", delete=False) as file:
                temporary = Path(file.name)
                file.write(payload)
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary, path)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), KanbanHandler).serve_forever()
