# Kanban Local

Um quadro Kanban simples para organizar tarefas no navegador. Os dados ficam no armazenamento local do navegador, com opções de exportação/importação e suporte a backup pelo servidor local.

## Recursos

- Quatro colunas iniciais e criação, renomeação e reordenação de status.
- Criação, edição, movimentação e exclusão de tarefas.
- Prioridade, busca, filtros por mês de criação e ordenação.
- Arrastar e soltar cartões, com alternativa acessível para mover tarefas.
- Tema claro e escuro, com preferência salva.
- Exportação e importação de backups em JSON.
- Aplicativo instalável (PWA) e cache offline após o primeiro carregamento.
- Backup automático pelo servidor local, quando configurado.

## Requisitos

- Windows para usar os atalhos `.bat` e `.vbs`.
- Python 3 para executar o servidor local.
- Navegador moderno. Animações usam Animate.css via CDN e precisam de internet; os recursos principais continuam funcionando offline após o carregamento inicial.

## Como executar

Na pasta do projeto, execute:

```powershell
py -3 server.py
```

Abra [http://localhost:8080](http://localhost:8080). Também é possível iniciar pelo `iniciar-kanban.bat`. O `iniciar-kanban.vbs` foi feito para abrir o servidor em segundo plano no Windows.

A instalação como aplicativo está disponível em navegadores compatíveis quando o Kanban é aberto por `localhost` ou HTTPS. Abrir `index.html` diretamente funciona, mas não habilita todos os recursos de instalação e offline.

## Dados e backup

As tarefas e preferências são armazenadas no navegador. Use **Configurações → Exportar backup** para salvar uma cópia JSON, ou **Importar backup** para restaurar uma cópia.

O servidor local oferece suporte ao backup automático em uma pasta do OneDrive no perfil do usuário. Esse backup depende de o servidor estar ativo e o cliente OneDrive estar conectado. A cópia JSON exportada é uma alternativa para backup manual.

## Testes

```powershell
node tests/app.test.cjs
py -3 -m unittest discover -s tests
```
