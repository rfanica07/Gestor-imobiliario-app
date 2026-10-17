const STORAGE_KEY = 'gestor-imobiliario-v1';
const stages = ['Acompanhamento','Avaliação','CPCV','Escritura','Concluído'];

const emptyState = { properties: [], clients: [], processes: [], agenda: [], commissions: [] };
let state = loadState();
let editing = { type: null, id: null };
let currentView = 'dashboard';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const euro = value => new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(value)||0);
const dateFmt = value => value ? new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${value}T12:00:00`)) : '—';
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));

function loadState(){
  try{
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored && typeof stored === 'object' ? {...emptyState,...stored} : structuredClone(emptyState);
  }catch{ return structuredClone(emptyState); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderAll(); }
function showToast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800); }

const viewMeta = {
  dashboard:['Dashboard','Visão geral da operação'], properties:['Imóveis','Carteira e próximas ações'], clients:['Clientes','Proprietários, compradores e contactos'], processes:['Processos','Pipeline do negócio'], agenda:['Agenda','Compromissos e tarefas'], commissions:['Comissões','Previsto, recebido e pendente']
};
const quickAddMeta = {
  dashboard:['property','+ Novo imóvel'],
  properties:['property','+ Novo imóvel'],
  clients:['client','+ Novo cliente'],
  processes:['process','+ Novo processo'],
  agenda:['agenda','+ Novo compromisso'],
  commissions:['commission','+ Nova comissão']
};
function setView(name){
  currentView=name;
  $$('.view').forEach(v=>v.classList.remove('active'));
  $$('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  $(`#${name}View`).classList.add('active');
  $('#pageTitle').textContent=viewMeta[name][0];
  $('#pageSubtitle').textContent=viewMeta[name][1];
  $('#quickAddBtn').textContent=quickAddMeta[name][1];
  $('#quickAddBtn').dataset.type=quickAddMeta[name][0];
  $('#sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'instant'});
}
$$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
$('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));

const formConfig = {
  property:{ title:'Imóvel', subtitle:'Regista o imóvel e define claramente a próxima ação.', fields:[
    ['title','Imóvel / referência','text',true],
    ['owner','Proprietário','text',true],
    ['zone','Zona','text',false],
    ['price','Preço (€) — ex.: 240000','number',false],
    ['status','Estado','select',true,['Ativo','Reservado','Vendido','Suspenso']],
    ['nextActionType','Tipo de próxima ação','select',false,['','Visita','Chamada','Angariação','Avaliação','CPCV','Escritura','Filmagem','Follow-up','Outro']],
    ['nextActionDetail','O que é preciso fazer','text',false],
    ['nextAction','Data da próxima ação','date',false],
    ['nextActionTime','Hora','time',false],
    ['notes','Notas','textarea',false]
  ]},
  client:{ title:'Cliente', subtitle:'Guarda os contactos importantes num único local.', fields:[
    ['name','Nome','text',true],['type','Tipo','select',true,['Proprietário','Comprador','Investidor','Parceiro','Outro']],['phone','Telefone','tel',false],['email','Email','email',false],['notes','Notas','textarea',false]
  ]},
  process:{ title:'Processo', subtitle:'Acompanha o negócio desde o início até à escritura.', fields:[
    ['title','Negócio / processo','text',true],['client','Cliente','text',false],['property','Imóvel','text',false],['stage','Fase','select',true,stages],['date','Próxima data','date',false],['value','Valor do negócio (€)','number',false],['notes','Notas','textarea',false]
  ]},
  agenda:{ title:'Compromisso', subtitle:'Adiciona uma visita, chamada, CPCV, avaliação ou escritura.', fields:[
    ['title','Assunto','text',true],['type','Tipo','select',true,['Visita','Chamada','Angariação','Avaliação','CPCV','Escritura','Filmagem','Outro']],['date','Data','date',true],['time','Hora','time',false],['location','Local / morada','text',false],['notes','Notas','textarea',false]
  ]},
  commission:{ title:'Comissão', subtitle:'Controla o que tens previsto e o que já recebeste.', fields:[
    ['deal','Negócio','text',true],['amount','Valor (€)','number',true],['status','Estado','select',true,['Pendente','Recebida']],['date','Data prevista','date',false],['notes','Notas','textarea',false]
  ]}
};
const collectionFor = type => ({property:'properties',client:'clients',process:'processes',agenda:'agenda',commission:'commissions'}[type]);

function fieldHTML([name,label,type,required,options], value=''){
  const full = type==='textarea' ? ' full' : '';
  const req = required ? 'required' : '';
  let input;
  if(type==='select') input=`<select name="${name}" ${req}>${options.map(o=>`<option value="${escapeHTML(o)}" ${String(value)===o?'selected':''}>${escapeHTML(o || 'Selecionar…')}</option>`).join('')}</select>`;
  else if(type==='textarea') input=`<textarea name="${name}" ${req}>${escapeHTML(value)}</textarea>`;
  else input=`<input name="${name}" type="${type}" value="${escapeHTML(value)}" ${req} ${type==='number'?'min="0" step="1"':''}/>`;
  return `<div class="field${full}"><label>${label}</label>${input}</div>`;
}
function openModal(type,id=null){
  const cfg=formConfig[type];
  const collection=state[collectionFor(type)];
  const item=id ? collection.find(x=>x.id===id) : null;
  editing={type,id};
  $('#modalTitle').textContent=`${id?'Editar':'Adicionar'} ${cfg.title.toLowerCase()}`;
  $('#modalSubtitle').textContent=cfg.subtitle;
  $('#formFields').innerHTML=cfg.fields.map(f=>fieldHTML(f,item?.[f[0]] ?? '')).join('');
  $('#entityModal').showModal();
}
function closeModal(){ $('#entityModal').close(); editing={type:null,id:null}; }
$('#closeModal').addEventListener('click',closeModal);
$('#cancelModal').addEventListener('click',closeModal);
$$('[data-open-modal]').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.openModal)));
$('#quickAddBtn').addEventListener('click',()=>openModal($('#quickAddBtn').dataset.type || 'property'));

$('#entityForm').addEventListener('submit',e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget).entries());
  ['price','value','amount'].forEach(k=>{if(k in data)data[k]=Number(data[k]||0)});
  const key=collectionFor(editing.type);
  const collection=state[key];
  if(editing.id){
    const idx=collection.findIndex(x=>x.id===editing.id);
    collection[idx]={...collection[idx],...data};
  } else {
    collection.unshift({id:uid(),createdAt:new Date().toISOString(),...data});
  }
  saveState(); closeModal(); showToast(editing.id?'Alterações guardadas':'Guardado com sucesso');
});

function deleteItem(type,id){
  if(!confirm('Eliminar este registo?')) return;
  const key=collectionFor(type);
  state[key]=state[key].filter(x=>x.id!==id);
  saveState(); showToast('Registo eliminado');
}
window.editItem=(type,id)=>openModal(type,id);
window.deleteItem=deleteItem;

function statusBadge(status){
  const cls = ['Vendido','Concluído','Recebida'].includes(status) ? 'success' : ['Suspenso'].includes(status) ? 'danger' : ['Reservado','CPCV','Escritura'].includes(status) ? 'warn' : '';
  return `<span class="badge ${cls}">${escapeHTML(status||'—')}</span>`;
}
function emptyRow(cols,text='Ainda não há registos.') { return `<tr><td colspan="${cols}" class="empty">${text}</td></tr>`; }
function propertyAction(x){
  if(!x.nextAction && !x.nextActionType && !x.nextActionDetail) return '—';
  const line=[x.nextActionType,dateFmt(x.nextAction),x.nextActionTime].filter(Boolean).join(' · ');
  return `<strong>${escapeHTML(line || 'Próxima ação')}</strong>${x.nextActionDetail?`<br><small>${escapeHTML(x.nextActionDetail)}</small>`:''}`;
}

function renderProperties(){
  const q=$('#propertySearch').value.trim().toLowerCase();
  const items=state.properties.filter(x=>[x.title,x.owner,x.zone,x.status,x.nextActionType,x.nextActionDetail].join(' ').toLowerCase().includes(q));
  $('#propertiesTable').innerHTML=items.length?items.map(x=>`<tr>
    <td data-label="Imóvel"><strong>${escapeHTML(x.title)}</strong><br><small>${escapeHTML(x.zone||'')}</small></td>
    <td data-label="Proprietário">${escapeHTML(x.owner)}</td>
    <td data-label="Preço">${euro(x.price)}</td>
    <td data-label="Estado">${statusBadge(x.status)}</td>
    <td data-label="Próxima ação">${propertyAction(x)}</td>
    <td data-label="Ações"><div class="actions"><button class="mini" onclick="editItem('property','${x.id}')">Editar</button><button class="mini danger" onclick="deleteItem('property','${x.id}')">Apagar</button></div></td>
  </tr>`).join(''):emptyRow(6);
}
function renderClients(){
  const q=$('#clientSearch').value.trim().toLowerCase();
  const items=state.clients.filter(x=>[x.name,x.type,x.phone,x.email,x.notes].join(' ').toLowerCase().includes(q));
  $('#clientsTable').innerHTML=items.length?items.map(x=>`<tr>
    <td data-label="Nome"><strong>${escapeHTML(x.name)}</strong></td>
    <td data-label="Tipo">${statusBadge(x.type)}</td>
    <td data-label="Telefone">${escapeHTML(x.phone||'—')}</td>
    <td data-label="Email">${escapeHTML(x.email||'—')}</td>
    <td data-label="Notas">${escapeHTML(x.notes||'—')}</td>
    <td data-label="Ações"><div class="actions"><button class="mini" onclick="editItem('client','${x.id}')">Editar</button><button class="mini danger" onclick="deleteItem('client','${x.id}')">Apagar</button></div></td>
  </tr>`).join(''):emptyRow(6);
}
function renderProcesses(){
  $('#processBoard').innerHTML=stages.map(stage=>{
    const items=state.processes.filter(x=>x.stage===stage);
    return `<section class="kanban-col"><div class="kanban-head"><h3>${stage}</h3><span class="badge">${items.length}</span></div>${items.map(x=>`<article class="kanban-card"><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.client||x.property||'')}</small><small>${x.value?euro(x.value):''}</small><div class="kanban-meta"><span>${dateFmt(x.date)}</span><div class="actions"><button class="mini" onclick="editItem('process','${x.id}')">Editar</button><button class="mini danger" onclick="deleteItem('process','${x.id}')">Apagar</button></div></div></article>`).join('') || '<div class="empty">Sem processos</div>'}</section>`;
  }).join('');
}
function renderAgenda(){
  const sorted=[...state.agenda].sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  if(!sorted.length){ $('#agendaList').innerHTML='<div class="panel empty">Ainda não há compromissos.</div>'; return; }
  const groups=Object.groupBy ? Object.groupBy(sorted,x=>x.date) : sorted.reduce((acc,x)=>((acc[x.date]??=[]).push(x),acc),{});
  $('#agendaList').innerHTML=Object.entries(groups).map(([date,items])=>`<section class="agenda-day"><h3>${dateFmt(date)}</h3>${items.map(x=>`<div class="agenda-item"><div class="agenda-time">${escapeHTML(x.time||'—')}</div><div><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.type)}${x.location?` · ${escapeHTML(x.location)}`:''}</small></div><div class="actions"><button class="mini" onclick="editItem('agenda','${x.id}')">Editar</button><button class="mini danger" onclick="deleteItem('agenda','${x.id}')">Apagar</button></div></div>`).join('')}</section>`).join('');
}
function renderCommissions(){
  const expected=state.commissions.reduce((s,x)=>s+Number(x.amount||0),0);
  const received=state.commissions.filter(x=>x.status==='Recebida').reduce((s,x)=>s+Number(x.amount||0),0);
  $('#commissionExpected').textContent=euro(expected);
  $('#commissionReceived').textContent=euro(received);
  $('#commissionPending').textContent=euro(expected-received);
  $('#commissionsTable').innerHTML=state.commissions.length?state.commissions.map(x=>`<tr>
    <td data-label="Negócio"><strong>${escapeHTML(x.deal)}</strong></td>
    <td data-label="Valor">${euro(x.amount)}</td>
    <td data-label="Estado">${statusBadge(x.status)}</td>
    <td data-label="Data prevista">${dateFmt(x.date)}</td>
    <td data-label="Ações"><div class="actions"><button class="mini" onclick="editItem('commission','${x.id}')">Editar</button><button class="mini danger" onclick="deleteItem('commission','${x.id}')">Apagar</button></div></td>
  </tr>`).join(''):emptyRow(5);
}
function renderDashboard(){
  const today=new Date(); today.setHours(0,0,0,0);
  const in7=new Date(today); in7.setDate(in7.getDate()+7);
  const scheduled=[
    ...state.agenda.map(x=>x.date),
    ...state.properties.map(x=>x.nextAction),
    ...state.processes.filter(x=>x.stage!=='Concluído').map(x=>x.date)
  ].filter(Boolean);
  const upcoming=scheduled.filter(value=>{const d=new Date(`${value}T12:00:00`); return d>=today&&d<=in7}).length;
  $('#statActiveProperties').textContent=state.properties.filter(x=>x.status==='Ativo').length;
  $('#statUpcoming').textContent=upcoming;
  $('#statProcesses').textContent=state.processes.filter(x=>x.stage!=='Concluído').length;
  $('#statCommission').textContent=euro(state.commissions.filter(x=>x.status!=='Recebida').reduce((s,x)=>s+Number(x.amount||0),0));

  const priorities=[
    ...state.agenda.map(x=>({date:x.date,title:x.title,detail:`${x.type}${x.time?` · ${x.time}`:''}${x.location?` · ${x.location}`:''}`})),
    ...state.properties.filter(x=>x.nextAction).map(x=>({date:x.nextAction,title:x.title,detail:`${x.nextActionType||'Próxima ação'}${x.nextActionTime?` · ${x.nextActionTime}`:''}${x.nextActionDetail?` · ${x.nextActionDetail}`:''}`})),
    ...state.processes.filter(x=>x.date&&x.stage!=='Concluído').map(x=>({date:x.date,title:x.title,detail:`${x.stage}${x.client?` · ${x.client}`:''}`}))
  ].filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
  $('#priorityList').innerHTML=priorities.length?priorities.map(x=>`<div class="list-item"><div class="list-main"><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.detail)}</small></div><span class="badge">${dateFmt(x.date)}</span></div>`).join(''):'<div class="empty">Sem prioridades marcadas. Adiciona uma data a um imóvel, processo ou compromisso.</div>';

  const counts=stages.map(stage=>[stage,state.processes.filter(x=>x.stage===stage).length]);
  const max=Math.max(1,...counts.map(x=>x[1]));
  $('#pipelineList').innerHTML=counts.map(([stage,count])=>`<div class="pipeline-row"><strong>${stage}</strong><span>${count}</span><div class="bar"><div class="fill" style="width:${Math.round(count/max*100)}%"></div></div></div>`).join('');
}
function renderAll(){ renderDashboard(); renderProperties(); renderClients(); renderProcesses(); renderAgenda(); renderCommissions(); }
$('#propertySearch').addEventListener('input',renderProperties);
$('#clientSearch').addEventListener('input',renderClients);

$('#exportBtn').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`gestor-imobiliario-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(a.href); showToast('Dados exportados');
});
$('#importInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{ const parsed=JSON.parse(await file.text()); state={...emptyState,...parsed}; saveState(); showToast('Dados importados'); }
  catch{ alert('O ficheiro não é um JSON válido do Gestor Imobiliário.'); }
  e.target.value='';
});

setView('dashboard');
renderAll();
