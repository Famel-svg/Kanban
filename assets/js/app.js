const DEFAULT_STATUSES=[['todo','Para fazer'],['doing','Fazendo'],['stopped','Cancelado/Parado'],['done','Concluído']];
const PRIORITIES={low:'Baixa',medium:'Média',high:'Alta'};
const KEY='kanban-local-v1',THEME_KEY='kanban-theme',PENDING_BACKUP_KEY='kanban-backup-pending-v1';
const STATUS_KEY='kanban-statuses-v1';
const isGitHubPages=()=>location.hostname.endsWith('.github.io');
let STATUSES=validateStatuses(JSON.parse(localStorage.getItem(STATUS_KEY)||'null'));
let tasks=loadTasks();
let draggedStatus=null,statusPreview=null,statusSlots=[];
let draggedId=null; let deferredPrompt;
let backupTimer;let backupQueue=Promise.resolve();
const $=id=>document.getElementById(id);
const save=()=>{localStorage.setItem(KEY,JSON.stringify(tasks));localStorage.setItem(STATUS_KEY,JSON.stringify(STATUSES));const backup=makeBackup();try{if(isGitHubPages()){localStorage.removeItem(PENDING_BACKUP_KEY);setBackupStatus('Demonstração online: os dados ficam neste navegador. Exporte um backup JSON para guardá-los.');return}localStorage.setItem(PENDING_BACKUP_KEY,backup);scheduleAutoBackup(backup)}catch{setBackupStatus('Backup pendente: armazenamento local indisponível.')}};
const icon={edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',grip:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>'};

function loadTasks(){
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');return Array.isArray(saved)?saved:[]}
  catch{return []}
}

function validateStatuses(value){
  if(value==null)return DEFAULT_STATUSES.map(item=>[...item]);
  if(!Array.isArray(value)||value.length<4||value.length>50)throw new Error('Lista de status inválida.');
  const ids=new Set();
  for(const item of value){
    if(!Array.isArray(item)||item.length!==2||typeof item[0]!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(item[0])||ids.has(item[0])||typeof item[1]!=='string'||!item[1].trim()||item[1].length>40)throw new Error('Status inválido.');
    ids.add(item[0]);
  }
  if(DEFAULT_STATUSES.some(([id])=>!ids.has(id)))throw new Error('Os status originais devem ser mantidos.');
  return value.map(([id,label])=>[id,label.trim()]);
}
function restoreBackup(backup){
  const restored=validateBackup(backup);
  STATUSES=validateStatuses(backup.statuses);tasks=restored;
  localStorage.setItem(STATUS_KEY,JSON.stringify(STATUSES));localStorage.setItem(KEY,JSON.stringify(tasks));
}

function validateBackup(backup){
  if(!backup||backup.format!=='kanban-local-backup'||backup.version!==1||!Array.isArray(backup.tasks))throw new Error('Este arquivo não é um backup válido do Kanban Local.');
  const statuses=validateStatuses(backup.statuses);
  const ids=new Set();
  return backup.tasks.map((task,index)=>{
    if(!task||typeof task!=='object'||Array.isArray(task))throw new Error(`A tarefa ${index+1} está inválida.`);
    const title=typeof task.title==='string'?task.title.trim():'';
    const description=task.description??'';
    if(typeof task.id!=='string'||!task.id||ids.has(task.id)||!title||title.length>100||typeof description!=='string'||description.length>280||!statuses.some(([id])=>id===task.status)||!Object.hasOwn(PRIORITIES,task.priority)||!Number.isFinite(task.createdAt)||task.createdAt<0)throw new Error(`A tarefa ${index+1} tem campos inválidos.`);
    ids.add(task.id);
    return {id:task.id,title,description,status:task.status,priority:task.priority,createdAt:task.createdAt};
  });
}

function makeBackup(){return JSON.stringify({format:'kanban-local-backup',version:1,exportedAt:new Date().toISOString(),statuses:STATUSES,tasks})}
function setBackupStatus(message){const status=$('backupStatus');if(status)status.textContent=message}
function scheduleAutoBackup(backup){clearTimeout(backupTimer);backupTimer=setTimeout(()=>{backupQueue=backupQueue.then(()=>sendAutoBackup(backup)).catch(()=>{})},700)}
async function sendAutoBackup(backup){
  try{
    const response=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:backup,cache:'no-store'});
    if(!response.ok)throw new Error('backup unavailable');
    if(localStorage.getItem(PENDING_BACKUP_KEY)===backup)localStorage.removeItem(PENDING_BACKUP_KEY);
    setBackupStatus(`Backup gravado na pasta sincronizada do OneDrive às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.`);
  }catch{setBackupStatus('Backup automático pendente; será tentado novamente quando o servidor estiver disponível.');}
}
async function restoreAutoBackup(){
  if(localStorage.getItem(KEY)!==null)return;
  const pending=localStorage.getItem(PENDING_BACKUP_KEY);
  if(pending){try{restoreBackup(JSON.parse(pending));render(true)}catch{}}
  if(localStorage.getItem(KEY)===null){
    try{
      const response=await fetch('/api/backup',{cache:'no-store'});
      if(response.status===404){setBackupStatus('Backup automático será criado após a primeira alteração.');return}
      if(!response.ok)throw new Error('backup unavailable');
      restoreBackup(await response.json());render(true);
      setBackupStatus(`Backup do OneDrive restaurado (${tasks.length} tarefas).`);
    }catch{setBackupStatus('Não foi possível acessar o backup do OneDrive; tentando novamente na próxima abertura.');return}
  }
  const queued=localStorage.getItem(PENDING_BACKUP_KEY);
  if(queued)scheduleAutoBackup(queued);
}
function initializeAutoBackup(){
  if(isGitHubPages()){setBackupStatus('Demonstração online: os dados ficam neste navegador. Exporte um backup JSON para guardá-los.');return}
  if(localStorage.getItem(KEY)===null){restoreAutoBackup();return}
  const queued=localStorage.getItem(PENDING_BACKUP_KEY);
  if(queued){scheduleAutoBackup(queued);return}
  if(tasks.length){const backup=makeBackup();try{localStorage.setItem(PENDING_BACKUP_KEY,backup);scheduleAutoBackup(backup)}catch{setBackupStatus('Backup pendente: armazenamento local indisponível.')}}
}

function exportTasks(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(JSON.parse(makeBackup()),null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`kanban-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}

async function importTasks(file){
  const previous=tasks,previousStatuses=STATUSES;
  try{
    const backup=JSON.parse(await file.text());const imported=validateBackup(backup);
    if(previous.length&&!confirm(`Importar ${imported.length} tarefas e substituir as ${previous.length} tarefas atuais?`))return;
    tasks=imported;STATUSES=validateStatuses(backup.statuses);
    try{save()}catch{tasks=previous;STATUSES=previousStatuses;throw new Error('Não foi possível salvar o backup. As tarefas atuais foram mantidas.');}
    render(true);
    alert(`Backup importado: ${tasks.length} tarefas.`);
  }catch(error){alert(error instanceof SyntaxError?'O arquivo não contém JSON válido.':error.message||'Não foi possível importar esse backup.');}
  finally{$('importTasksInput').value='';}
}

function render(animate=false){
  const query=$('searchInput').value.trim().toLowerCase(); const sort=$('sortSelect').value;
  const selectedMonth=$('monthFilter').value;
  const monthKey=timestamp=>{const date=new Date(timestamp);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`};
  const months=[...new Set(tasks.map(task=>monthKey(task.createdAt)))].sort().reverse();
  if(selectedMonth&&!months.includes(selectedMonth))months.push(selectedMonth);
  $('monthFilter').innerHTML='<option value="">Todos os meses</option>'+months.map(month=>{const [year,number]=month.split('-');const label=new Date(Number(year),Number(number)-1,1).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}).replace('.', '').replace(' de ','/');return `<option value="${month}">${label}</option>`}).join('');
  $('monthFilter').value=selectedMonth;
  const filtered=tasks.filter(task=>(task.title+' '+(task.description||'')).toLowerCase().includes(query)&&(!selectedMonth||monthKey(task.createdAt)===selectedMonth)); const rank={high:3,medium:2,low:1};
  if(sort==='priority')filtered.sort((a,b)=>rank[b.priority]-rank[a.priority]); else filtered.sort((a,b)=>(sort==='oldest'?1:-1)*(a.createdAt-b.createdAt));
  $('board').innerHTML=STATUSES.map(([id,label])=>{const list=filtered.filter(task=>task.status===id);return `<article class="column status-${id}" data-status="${id}"><div class="column-head"><div class="column-title"><button class="status-grip drag-handle" type="button" draggable="true" data-status-drag="${id}" aria-label="Mover status ${escapeHtml(label)}. Use as setas do teclado para reordenar." title="Arraste para mover · ou use as setas do teclado">${icon.grip}</button><span class="dot" aria-hidden="true"></span><h3><input class="status-name" data-status-name="${id}" value="${escapeHtml(label)}" maxlength="40" aria-label="Nome do status ${escapeHtml(label)}" title="Clique para renomear · Enter para salvar · Esc para cancelar"></h3></div><span class="count" aria-label="${list.length} tarefas">${list.length}</span></div><div class="task-list">${list.length?list.map(taskCard).join(''):`<div class="empty"><span aria-hidden="true">${icon.grip}</span><strong>Nenhuma tarefa</strong><small>Os cartões aparecerão aqui.</small></div>`}</div></article>`}).join('');
  document.querySelectorAll('.column').forEach(column=>{
    column.addEventListener('dragover',event=>{if(draggedStatus)return;event.preventDefault();column.classList.add('drag-over')});
    column.addEventListener('dragleave',event=>{if(!column.contains(event.relatedTarget))column.classList.remove('drag-over')});
    column.addEventListener('drop',event=>{event.preventDefault();if(draggedStatus)return;const task=tasks.find(item=>item.id===draggedId);if(task&&task.status!==column.dataset.status){task.status=column.dataset.status;save();render(true)}column.classList.remove('drag-over')});
  });
  document.querySelectorAll('[data-status-drag]').forEach(handle=>{
    handle.addEventListener('dragstart',event=>{draggedId=null;draggedStatus=handle.dataset.statusDrag;event.dataTransfer.setData('text/plain',draggedStatus);event.dataTransfer.effectAllowed='move';const column=handle.closest('.column');event.dataTransfer.setDragImage(column,24,24);statusPreview=STATUSES.map(([id])=>id);statusSlots=[...$('board').children].map(item=>item.getBoundingClientRect());requestAnimationFrame(()=>{if(draggedStatus===handle.dataset.statusDrag){column.classList.add('status-placeholder');$('board').classList.add('reordering-status')}})});
    handle.addEventListener('dragend',()=>{if(draggedStatus){draggedStatus=null;statusPreview=null;$('board').classList.remove('reordering-status');render()}});
    handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const index=STATUSES.findIndex(([id])=>id===handle.dataset.statusDrag);const target=index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);if(STATUSES[target]){moveStatus(handle.dataset.statusDrag,STATUSES[target][0]);$('board').querySelector(`[data-status-drag="${handle.dataset.statusDrag}"]`)?.focus()}});
  });
  document.querySelectorAll('[data-status-name]').forEach(input=>{
    input.addEventListener('change',()=>{const status=STATUSES.find(([id])=>id===input.dataset.statusName);const name=input.value.trim();if(!name||STATUSES.some(([id,label])=>id!==status[0]&&label.toLocaleLowerCase()===name.toLocaleLowerCase())){input.value=status[1];input.setCustomValidity('Use um nome preenchido e diferente dos demais status.');input.reportValidity();return}input.setCustomValidity('');status[1]=name;save();render()});
    input.addEventListener('input',()=>input.setCustomValidity(''));
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur()}if(event.key==='Escape'){input.value=STATUSES.find(([id])=>id===input.dataset.statusName)[1];input.setCustomValidity('');input.blur()}});
  });
  document.querySelectorAll('.task').forEach(element=>{
    element.addEventListener('dragstart',()=>{draggedStatus=null;draggedId=element.dataset.id;element.classList.add('dragging')});
    element.addEventListener('dragend',()=>{draggedId=null;element.classList.remove('dragging');document.querySelectorAll('.column').forEach(column=>column.classList.remove('drag-over'))});
  });
  const done=tasks.filter(task=>task.status==='done').length; const progress=tasks.length?Math.round(done/tasks.length*100):0;
  $('summary').innerHTML=`<div class="stat"><span class="stat-icon total" aria-hidden="true">${tasks.length}</span><div><strong>${tasks.length}</strong><span>Total de tarefas</span></div></div><div class="stat"><span class="stat-icon progress" aria-hidden="true">${progress}%</span><div><strong>${done}</strong><span>Concluídas</span></div></div>`;
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelectorAll('.task').forEach((element,index)=>{element.classList.add('animate__animated','animate__fadeInUp');element.style.setProperty('--animate-duration','360ms');element.style.setProperty('--animate-delay',`${Math.min(index*35,245)}ms`)});
}

function taskCard(task){
  const moves=STATUSES.map(([id,label])=>`<option value="${id}" ${id===task.status?'selected':''}>${escapeHtml(label)}</option>`).join('');
  return `<article class="task ${task.status==='done'?'task-compact':''}" draggable="true" data-id="${task.id}"><div class="task-top"><span class="drag-handle" aria-hidden="true">${icon.grip}</span><span class="priority ${task.priority}">${PRIORITIES[task.priority]}</span></div><h4><button class="task-title-button" data-edit="${task.id}" type="button" aria-label="Editar ${escapeHtml(task.title)}">${escapeHtml(task.title)}</button></h4>${task.description?`<p>${escapeHtml(task.description)}</p>`:''}<div class="task-meta"><time datetime="${new Date(task.createdAt).toISOString()}">${new Date(task.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</time><label class="move-label">Mover para <select data-move="${task.id}" aria-label="Mover ${escapeHtml(task.title)} para">${moves}</select></label></div>${task.status==='done'?'':`<div class="task-actions"><button class="card-action" type="button" data-edit="${task.id}" aria-label="Editar ${escapeHtml(task.title)}">${icon.edit}<span>Editar</span></button><button class="card-action danger" type="button" data-delete="${task.id}" aria-label="Excluir ${escapeHtml(task.title)}">${icon.trash}<span>Excluir</span></button></div>`}</article>`;
}
function escapeHtml(value){return value.replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]))}
function openTask(task){$('taskId').value=task?.id||'';$('dialogTitle').textContent=task?'Editar tarefa':'Nova tarefa';$('taskTitle').value=task?.title||'';$('taskDescription').value=task?.description||'';$('taskStatus').innerHTML=STATUSES.map(([id,label])=>`<option value="${id}" ${id===(task?.status||'todo')?'selected':''}>${escapeHtml(label)}</option>`).join('');$('taskPriority').value=task?.priority||'medium';$('taskDialog').showModal();$('taskTitle').focus()}
function closeTask(){$('taskDialog').close()}
function applyTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme);const dark=theme==='dark';$('themeButton').setAttribute('aria-pressed',dark);$('themeButton').setAttribute('aria-label',dark?'Ativar tema claro':'Ativar tema escuro');document.querySelector('meta[name="theme-color"]').content=dark?'#111318':'#f7f8fa'}

$('newTaskButton').onclick=()=>openTask(); $('closeDialogButton').onclick=closeTask; $('cancelDialogButton').onclick=closeTask;
$('exportTasksButton').onclick=exportTasks;
$('importTasksButton').onclick=()=>$('importTasksInput').click();
$('importTasksInput').addEventListener('change',event=>{const file=event.target.files[0];if(file)importTasks(file)});
$('monthFilter').onchange=()=>render();
function toggleStatusCreation(open){
  $('statusForm').hidden=!open;$('newStatusButton').hidden=open;$('newStatusButton').setAttribute('aria-expanded',String(open));
  $('statusName').value='';$('statusError').textContent='';
  (open?$('statusName'):$('newStatusButton')).focus();
}
$('newStatusButton').onclick=()=>toggleStatusCreation(true);
$('cancelStatusButton').onclick=()=>toggleStatusCreation(false);
$('statusName').oninput=()=>{$('statusError').textContent=''};
$('statusForm').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();toggleStatusCreation(false)}});
$('statusForm').onsubmit=event=>{
  event.preventDefault();const name=$('statusName').value.trim();
  const error=!name?'Informe o nome do status.':STATUSES.length>=50?'Limite de 50 status atingido.':STATUSES.some(([,label])=>label.toLocaleLowerCase()===name.toLocaleLowerCase())?'Já existe um status com esse nome.':'';
  if(error){$('statusError').textContent=error;$('statusName').focus();return}
  STATUSES.push([crypto.randomUUID(),name]);save();render();toggleStatusCreation(false);$('board').lastElementChild?.scrollIntoView({block:'nearest',inline:'nearest'});
};
function previewStatusPosition(x,y){
  if(!draggedStatus||!statusSlots.length)return;
  let target=0,distance=Infinity;
  statusSlots.forEach((rect,index)=>{const dx=Math.max(rect.left-x,0,x-rect.right),dy=Math.max(rect.top-y,0,y-rect.bottom);const next=dx*dx+dy*dy;if(next<distance){target=index;distance=next}});
  if(statusPreview.indexOf(draggedStatus)===target)return;
  const columns=[...$('board').children];
  columns.forEach(column=>column.getAnimations().forEach(animation=>animation.cancel()));
  const before=columns.map(column=>column.getBoundingClientRect());
  statusPreview=statusPreview.filter(id=>id!==draggedStatus);statusPreview.splice(target,0,draggedStatus);
  columns.forEach(column=>{column.style.order=statusPreview.indexOf(column.dataset.status)});
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)columns.forEach((column,index)=>{const after=column.getBoundingClientRect();const dx=before[index].left-after.left,dy=before[index].top-after.top;if(dx||dy)column.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:180,easing:'ease-out'})});
}
$('board').addEventListener('dragover',event=>{if(!draggedStatus)return;event.preventDefault();event.dataTransfer.dropEffect='move';previewStatusPosition(event.clientX,event.clientY)});
$('board').addEventListener('drop',event=>{
  if(!draggedStatus||!statusPreview)return;event.preventDefault();
  STATUSES=statusPreview.map(id=>STATUSES.find(([key])=>key===id));
  draggedStatus=null;statusPreview=null;$('board').classList.remove('reordering-status');save();render();
});
function moveStatus(id,targetId){
  const index=STATUSES.findIndex(([key])=>key===id),target=STATUSES.findIndex(([key])=>key===targetId);
  if(index<0||target<0||index===target)return;
  const [status]=STATUSES.splice(index,1);STATUSES.splice(target,0,status);save();render();
}
$('searchInput').oninput=()=>render(); $('sortSelect').onchange=()=>render();
$('themeButton').onclick=()=>{document.documentElement.classList.add('theme-transition');applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');setTimeout(()=>document.documentElement.classList.remove('theme-transition'),250)};
$('taskForm').addEventListener('submit',event=>{event.preventDefault();const id=$('taskId').value;const data={title:$('taskTitle').value.trim(),description:$('taskDescription').value.trim(),status:$('taskStatus').value,priority:$('taskPriority').value};if(!data.title)return;if(id)Object.assign(tasks.find(task=>task.id===id),data);else tasks.push({id:crypto.randomUUID(),...data,createdAt:Date.now()});save();closeTask();render(true)});
$('board').addEventListener('change',event=>{const id=event.target.dataset.move;if(!id)return;const task=tasks.find(item=>item.id===id);if(task){task.status=event.target.value;save();render(true)}});
$('board').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const edit=button.dataset.edit,remove=button.dataset.delete;if(edit)openTask(tasks.find(task=>task.id===edit));if(remove&&confirm('Excluir esta tarefa?')){tasks=tasks.filter(task=>task.id!==remove);save();render(true)}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;$('installButton').hidden=true});
$('installButton').onclick=async()=>{
  if(matchMedia('(display-mode: standalone)').matches){alert('O Kanban Local já está instalado.');return}
  if(deferredPrompt){const result=await deferredPrompt.prompt();deferredPrompt=null;if(result.outcome==='accepted')$('installButton').hidden=true;return}
  alert('No Brave, abra esta página por http://localhost:8080 e use o ícone de instalação na barra de endereços ou Menu ⋮ > Instalar Kanban Local. O prompt pode levar alguns segundos para ficar disponível.')
};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
window.addEventListener('online',()=>{const queued=localStorage.getItem(PENDING_BACKUP_KEY);if(queued)scheduleAutoBackup(queued)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){const queued=localStorage.getItem(PENDING_BACKUP_KEY);if(queued)scheduleAutoBackup(queued)}});
applyTheme(document.documentElement.dataset.theme); render(true); initializeAutoBackup();
