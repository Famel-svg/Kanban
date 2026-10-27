import unittest
from server import KanbanHandler

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

if __name__ == '__main__':
    unittest.main()
