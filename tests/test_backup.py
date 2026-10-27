import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from server import BACKUP_DIR, KanbanHandler

class BackupTests(unittest.TestCase):
    def test_old_and_custom_statuses(self):
        data = {'format': 'kanban-local-backup', 'version': 1, 'tasks': []}
        KanbanHandler.validate_backup(data)
        data['statuses'] = [['todo', 'Para fazer'], ['doing', 'Fazendo'], ['stopped', 'Parado'], ['done', 'Concluído'], ['review', 'Revisão']]
        data['tasks'] = [{'id': 'a', 'title': 'Teste', 'description': '', 'status': 'review', 'priority': 'low', 'createdAt': 1}]
        KanbanHandler.validate_backup(data)
        data['statuses'].pop()
        with self.assertRaises(ValueError):
            KanbanHandler.validate_backup(data)

    def test_backup_api_writes_and_restores_configured_folder(self):
        data = {'format': 'kanban-local-backup', 'version': 1, 'tasks': []}
        with TemporaryDirectory() as directory, patch('server.BACKUP_DIR', Path(directory)):
            server = ThreadingHTTPServer(('127.0.0.1', 0), KanbanHandler)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(server.server_close)
            self.addCleanup(thread.join)
            self.addCleanup(server.shutdown)
            url = f'http://127.0.0.1:{server.server_port}/api/backup'
            request = Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'}, method='POST')
            with urlopen(request) as response:
                self.assertEqual(response.status, 200)
            with urlopen(url) as response:
                self.assertEqual(json.load(response), data)
            self.assertTrue((Path(directory) / 'kanban-latest.json').is_file())

    def test_invalid_backup_does_not_overwrite_last_good_copy(self):
        valid = {'format': 'kanban-local-backup', 'version': 1, 'tasks': []}
        with TemporaryDirectory() as directory, patch('server.BACKUP_DIR', Path(directory)):
            server = ThreadingHTTPServer(('127.0.0.1', 0), KanbanHandler)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(server.server_close)
            self.addCleanup(thread.join)
            self.addCleanup(server.shutdown)
            url = f'http://127.0.0.1:{server.server_port}/api/backup'
            good = Request(url, data=json.dumps(valid).encode(), method='POST')
            with urlopen(good):
                pass
            bad = Request(url, data=b'{"format":"invalid"}', method='POST')
            with self.assertRaises(HTTPError) as error:
                urlopen(bad)
            self.assertEqual(error.exception.code, 400)
            saved = json.loads((Path(directory) / 'kanban-latest.json').read_text(encoding='utf-8'))
            self.assertEqual(saved, valid)

if __name__ == '__main__':
    unittest.main()
