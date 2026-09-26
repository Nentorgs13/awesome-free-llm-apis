const canvas = document.getElementById('brainCanvas');
const ctx = canvas.getContext('2d');
const neonBlue = '#238cff';
const brightBlue = '#79c9ff';
const ui = {
  mode: document.getElementById('modeLabel'), panel: document.getElementById('sidePanel'),
  title: document.getElementById('nodeTitle'), desc: document.getElementById('nodeDescription'), connections: document.getElementById('connectionCount'),
  tasks: document.getElementById('taskCount'), note: document.getElementById('assistantNote'), project: document.getElementById('taskProject'),
  input: document.getElementById('taskInput'), dock: document.getElementById('dockText'), sidebar: document.getElementById('chatSidebar'), name: document.getElementById('nodeName'), accountMenu: document.getElementById('accountMenu'), coreMenu: document.getElementById('coreMenu'), activeCore: document.getElementById('activeCoreName'), miniSelect: document.getElementById('miniKernelSelect'), miniLog: document.getElementById('miniChatLog'), miniInput: document.getElementById('miniChatInput')
};

const sectionSeeds = [
  ['strategy', 'Strategy'], ['work', 'Work'], ['money', 'Finance'], ['health', 'Health'], ['personal', 'Personal'],
  ['study', 'Learning'], ['content', 'Content'], ['ideas', 'Ideas'], ['home', 'Home'], ['people', 'People']
];
function createSections(seed) {
  const random = randomGenerator(seed); const sections = []; let attempts = 0;
  while (sections.length < 1000 && attempts < 120000) {
    attempts += 1;
    const x = random() * 720 - 360, y = random() * 570 - 235, z = random() * 520 - 260;
    if (!insideBrainVolume(x, y, z) || x * x + y * y + z * z < 54 * 54 || sections.some(section => Math.hypot(section.x - x, section.y - y, (section.z || 0) - z) < 22)) continue;
    const number = sections.length + 1, seed = sectionSeeds[sections.length];
    sections.push({ id: seed?.[0] || `neuron-${number}`, label: seed?.[1] || `Neuron ${number}`, x, y, z, description: `Neuron ${seed?.[1] || number} in your map.` });
  }
  return sections;
}
const neuronTitles = ['Task', 'Thought', 'Goal', 'Idea', 'Plan', 'Process', 'Question', 'Contact'];
let customNames = {};
try { customNames = JSON.parse(localStorage.getItem('ai-brain-names') || '{}'); } catch { customNames = {}; }
let folders = [];
let taskPairs = [];
let brainNeurons = [];
let brainLinks = [];
let logicalLinks = { sectionLinks: [], coreLinks: [] };
let activeKernel = 'Main core';
const brains = new Map();
const defaultScale = innerWidth > 680 ? 1.38 : .78;
const view = { x: innerWidth > 680 ? 130 : 0, y: 35, scale: defaultScale, rotationY: .35, rotationX: -.18, rotateMode: true, dragging: false, moved: false, lastX: 0, lastY: 0, pinch: 0 };
const pointers = new Map();
let selected = { id: 'ai', type: 'ai' };
let visibleNodes = [];

function randomGenerator(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}
function insideBrain(x, y) {
  const cerebrum = ((x + 12) / 335) ** 2 + ((y + 28) / 220) ** 2 < 1;
  const cerebellum = ((x - 190) / 145) ** 2 + ((y - 165) / 92) ** 2 < 1;
  const stem = x > 38 && x < 120 && y > 148 && y < 335 && Math.abs(x - 78) < 75 - (y - 148) * .14;
  return cerebrum || cerebellum || stem;
}
function insideBrainVolume(x, y, z) {
  const cerebrum = (x / 360) ** 2 + ((y + 22) / 215) ** 2 + (z / 265) ** 2 < 1;
  const cerebellum = ((x - 172) / 158) ** 2 + ((y - 150) / 88) ** 2 + ((z + 8) / 165) ** 2 < 1;
  const stem = ((x - 54) / 48) ** 2 + ((y - 258) / 112) ** 2 + (z / 72) ** 2 < 1;
  return cerebrum || cerebellum || stem;
}
function createBrainNeurons(seed, currentFolders) {
  const random = randomGenerator(seed); const points = [];
  while (points.length < 2500) {
    const x = random() * 760 - 380, y = random() * 620 - 260, z = random() * 580 - 290;
    const nearMainNode = x * x + y * y + z * z < 48 * 48 || currentFolders.some(folder => Math.hypot(folder.x - x, folder.y - y, (folder.z || 0) - z) < 24);
    if (!insideBrainVolume(x, y, z) || nearMainNode || points.some(p => Math.hypot(p.x - x, p.y - y, p.z - z) < 10)) continue;
    points.push({ id: `synapse-${points.length}`, type: 'neuron', label: '', x, y, z, r: 1.5, description: 'A free synapse in your map.' });
  }
  return points;
}
function createNetworkLinks(points, maxDistance, maxNeighbors) {
  const cellSize = maxDistance, grid = new Map(), links = [], seen = new Set();
  points.forEach((point, index) => { const key = `${Math.floor(point.x/cellSize)}:${Math.floor(point.y/cellSize)}:${Math.floor((point.z||0)/cellSize)}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push([point, index]); });
  points.forEach((point, index) => {
    const gx=Math.floor(point.x/cellSize), gy=Math.floor(point.y/cellSize), gz=Math.floor((point.z||0)/cellSize), candidates=[];
    for(let dx=-1;dx<=1;dx+=1) for(let dy=-1;dy<=1;dy+=1) for(let dz=-1;dz<=1;dz+=1) (grid.get(`${gx+dx}:${gy+dy}:${gz+dz}`)||[]).forEach(([other,otherIndex])=>{if(otherIndex!==index){const distance=Math.hypot(point.x-other.x,point.y-other.y,(point.z||0)-(other.z||0));if(distance<maxDistance)candidates.push([other,otherIndex,distance]);}});
    candidates.sort((a,b)=>a[2]-b[2]).slice(0,maxNeighbors).forEach(([other,otherIndex])=>{const key=index<otherIndex?`${index}-${otherIndex}`:`${otherIndex}-${index}`;if(!seen.has(key)){seen.add(key);links.push([point,other]);}});
  });
  return links;
}
function seedFromKernel(kernel) { return [...kernel].reduce((seed, char) => ((seed * 31) + char.charCodeAt(0)) >>> 0, 20260923); }
function defaultTasks(currentFolders) { let number=0; return currentFolders.flatMap((folder, index) => Array.from({length:index<500?3:2},()=>{number+=1;return [folder.id,`${neuronTitles[number%neuronTitles.length]} ${number}`];})); }
function createLogicalLinks(currentFolders) { return { sectionLinks:createNetworkLinks(currentFolders,58,1).map(([a,b])=>[a.id,b.id]), coreLinks:[...currentFolders].sort((a,b)=>Math.hypot(a.x,a.y,a.z||0)-Math.hypot(b.x,b.y,b.z||0)).slice(0,12).map(folder=>folder.id) }; }
function getBrain(kernel) {
  if (brains.has(kernel)) return brains.get(kernel);
  const seed = seedFromKernel(kernel), currentFolders = createSections(seed), storageKey = `cerebnation-brain:${kernel}`;
  let savedTasks = [], hasSavedTasks = false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved)) { savedTasks = saved; hasSavedTasks = saved.length > 0; }
    if (saved && Array.isArray(saved.tasks)) { savedTasks = saved.tasks; hasSavedTasks = true; }
  } catch { savedTasks = []; }
  const points = createBrainNeurons(seed + 7919, currentFolders);
  const brain = { folders: currentFolders, taskPairs: hasSavedTasks ? savedTasks : defaultTasks(currentFolders), brainNeurons: points, brainLinks: createNetworkLinks(points,46,2), logicalLinks:createLogicalLinks(currentFolders) };
  brains.set(kernel, brain); return brain;
}
function populateProjectSelect() { ui.project.replaceChildren(); folders.forEach(folder => ui.project.add(new Option(folder.label, folder.id))); }
function useBrain(kernel) { const brain = getBrain(kernel); activeKernel = kernel; folders = brain.folders; taskPairs = brain.taskPairs; brainNeurons = brain.brainNeurons; brainLinks = brain.brainLinks; logicalLinks = brain.logicalLinks; populateProjectSelect(); updateDock(); draw(); }

function taskPosition(folder, index, total) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + Math.atan2(folder.y, folder.x) + .35;
  const distance = 17 + ((index % 2) * 7);
  return { x: folder.x + Math.cos(angle) * distance, y: folder.y + Math.sin(angle) * distance * .75 };
}
function displayName(id, fallback) { return customNames[id] || fallback; }
function separateNodes(nodes) {
  for (let pass = 0; pass < 10; pass += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
        const padding = a.type === 'task' && b.type === 'task' ? 11 : 16;
        const minimum = a.r + b.r + padding;
        if (distance >= minimum) continue;
        const moveA = a.type === 'task', moveB = b.type === 'task';
        if (!moveA && !moveB) continue;
        const shift = (minimum - distance) / (moveA && moveB ? 2 : 1);
        const ux = dx / distance, uy = dy / distance;
        if (moveA) { a.x -= ux * shift; a.y -= uy * shift; }
        if (moveB) { b.x += ux * shift; b.y += uy * shift; }
      }
    }
  }
  return nodes;
}
function keepInsideBrain(node) {
  for (let step = 0; step < 18 && !insideBrainVolume(node.x, node.y, node.z || 0); step += 1) { node.x *= .94; node.y *= .94; node.z = (node.z || 0) * .94; }
  return node;
}
function makeNodes() {
  const items = [{ id: 'ai', type: 'ai', label: displayName('ai', 'Cerebnation'), x: 0, y: 0, z: 0, r: 19, description: 'The central intelligence that holds connections between all neurons.' }];
  folders.forEach(folder => {
    items.push({ ...folder, label: displayName(folder.id, folder.label), type: 'folder', r: 7.5 });
    const tasks = taskPairs.filter(([id]) => id === folder.id);
    tasks.forEach(([, label], index) => {
      const p = taskPosition(folder, index, tasks.length);
      const id = `${folder.id}-${index}-${label}`;
      items.push({ id, parent: folder.id, type: 'task', label: displayName(id, label), z: (folder.z || 0) + (index ? 13 : -13), r: 2.8, ...p, description: `Synapse in the ${folder.label} neuron.` });
    });
  });
  const logicalNodes = items.map(node => node.type === 'task' ? keepInsideBrain(node) : node);
  return [...logicalNodes, ...brainNeurons.map(node => ({ ...node, label: displayName(node.id, '') }))];
}
function projectNode(node) {
  const yawCos = Math.cos(view.rotationY), yawSin = Math.sin(view.rotationY), pitchCos = Math.cos(view.rotationX), pitchSin = Math.sin(view.rotationX), z = node.z || 0;
  const yawX = node.x * yawCos + z * yawSin;
  const yawZ = z * yawCos - node.x * yawSin;
  const tiltY = node.y * pitchCos - yawZ * pitchSin;
  const depth = node.y * pitchSin + yawZ * pitchCos;
  const perspective = 820 / (820 - depth);
  return { x: innerWidth / 2 + view.x + yawX * view.scale * perspective, y: innerHeight / 2 + view.y + tiltY * view.scale * perspective, depth, perspective };
}
function resize() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); draw(); }
function links(nodes) {
  const byId = new Map(nodes.map(node=>[node.id,node]));
  const result = logicalLinks.sectionLinks.map(([a,b])=>[byId.get(a),byId.get(b)]).filter(pair=>pair[0]&&pair[1]);
  logicalLinks.coreLinks.forEach(id=>{const node=byId.get(id);if(node)result.push([byId.get('ai'),node]);});
  nodes.forEach(node=>{if(node.type==='task'){const parent=byId.get(node.parent);if(parent)result.push([node,parent]);}});
  return result;
}
function curveBetween(a, b, bend) {
  const pa = projectNode(a), pb = projectNode(b);
  const dx = pb.x - pa.x, dy = pb.y - pa.y, length = Math.hypot(dx, dy) || 1;
  const cx = (pa.x + pb.x) / 2 - (dy / length) * bend * view.scale;
  const cy = (pa.y + pb.y) / 2 + (dx / length) * bend * view.scale;
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.quadraticCurveTo(cx, cy, pb.x, pb.y); ctx.stroke();
}
function getVisibleNodes(nodes) {
  // Keep one deterministic set of nodes on every frame. This prevents dots
  // from being replaced by neighboring dots while the brain is stationary.
  return [...nodes].sort((a, b) => {
    const depthDelta = projectNode(a).depth - projectNode(b).depth;
    return depthDelta || a.id.localeCompare(b.id);
  });
}
function draw() {
  ctx.clearRect(0, 0, innerWidth, innerHeight); ctx.fillStyle = '#07090b'; ctx.fillRect(0, 0, innerWidth, innerHeight);
  const nodes = makeNodes();
  ctx.save(); ctx.globalAlpha = .62; ctx.strokeStyle = neonBlue; ctx.lineWidth = .62;
  brainLinks.forEach(([a,b], index) => curveBetween(a, b, ((index % 5) - 2) * 2));
  ctx.restore();
  ctx.save(); ctx.globalAlpha = .78; ctx.strokeStyle = brightBlue; ctx.lineWidth = 1;
  links(nodes).forEach(([a,b], index) => curveBetween(a, b, ((index % 5) - 2) * 4));
  ctx.restore();
  visibleNodes = getVisibleNodes(nodes);
  [...visibleNodes.filter(node=>node.type!=='ai'), ...visibleNodes.filter(node=>node.type==='ai')].forEach(node => {
    const p=projectNode(node), radius=node.r*Math.max(.62,view.scale)*p.perspective, isSelected=selected.id===node.id;
    ctx.save(); ctx.shadowColor=brightBlue; ctx.shadowBlur=node.type === 'ai' ? 22 : (isSelected ? 13 : node.type === 'folder' ? 4 : 0);
    ctx.fillStyle=node.type==='task' || node.type==='neuron' ? brightBlue : '#071426'; ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.strokeStyle=isSelected ? brightBlue : neonBlue; ctx.globalAlpha=node.type==='task' ? .94 : node.type==='neuron' ? .86 : 1; ctx.lineWidth=isSelected ? 2 : 1; ctx.stroke();
    ctx.restore();
  });
  ui.mode.textContent = view.scale < .58 ? 'Brain form' : 'Task map';
}
function selectNode(node) {
  selected=node; const nodes=makeNodes(); const count=node.type==='folder' ? taskPairs.filter(([id])=>id===node.id).length : node.type==='ai' ? taskPairs.length : 1;
  const connectionCount=node.type==='neuron' ? brainLinks.filter(([a,b])=>a.id===node.id||b.id===node.id).length : links(nodes).filter(([a,b])=>a.id===node.id||b.id===node.id).length;
  ui.title.textContent=node.type==='ai' ? 'Cerebnation' : node.label || 'Synapse'; ui.name.value=node.label; ui.desc.textContent=node.description; ui.connections.textContent=connectionCount; ui.tasks.textContent=count; ui.panel.classList.add('visible'); draw();
}
function hitTest(x,y) { const nodes=makeNodes(), ai=nodes.find(node=>node.type==='ai'), aiPoint=projectNode(ai); if(Math.hypot(x-aiPoint.x,y-aiPoint.y)<Math.max(34,ai.r*view.scale*aiPoint.perspective+15))return ai; const candidates=visibleNodes.length?visibleNodes:nodes; for(let i=candidates.length-1;i>=0;i--){const p=projectNode(candidates[i]),r=Math.max(12,candidates[i].r*Math.max(.8,view.scale)*p.perspective+8);if(Math.hypot(x-p.x,y-p.y)<r)return candidates[i];}return null; }
function clampScale(value) { return Math.min(2.15,Math.max(.42,value)); }
function updateDock() { ui.dock.textContent=`${folders.length} neurons · ${brainNeurons.length + taskPairs.length} synapses`; }
function resetView() { view.x=innerWidth>680?130:0; view.y=35; view.scale=innerWidth>680?1.38:.78; view.rotationY=.35; view.rotationX=-.18; selectNode(makeNodes()[0]); }

canvas.addEventListener('wheel', e=>{ e.preventDefault(); view.scale=clampScale(view.scale*(e.deltaY>0?.9:1.1)); draw(); },{passive:false});
canvas.addEventListener('pointerdown', e=>{ canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); view.dragging=true; view.moved=false; view.lastX=e.clientX; view.lastY=e.clientY; if(pointers.size===2){const [a,b]=[...pointers.values()];view.pinch=Math.hypot(a.x-b.x,a.y-b.y);} });
canvas.addEventListener('pointermove', e=>{ if(!pointers.has(e.pointerId))return; pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(pointers.size===2){const[a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(view.pinch)view.scale=clampScale(view.scale*(d/view.pinch));view.pinch=d;view.moved=true;draw();return;} const dx=e.clientX-view.lastX,dy=e.clientY-view.lastY;if(Math.abs(dx)+Math.abs(dy)>2)view.moved=true;if(view.rotateMode){view.rotationY+=dx*.012;view.rotationX=Math.max(-1.15,Math.min(1.15,view.rotationX+dy*.009));}else{view.x+=dx;view.y+=dy;}view.lastX=e.clientX;view.lastY=e.clientY;draw(); });
function finishPointer(e){pointers.delete(e.pointerId);if(pointers.size<2)view.pinch=0;if(!pointers.size){view.dragging=false;if(!view.moved){const hit=hitTest(e.clientX,e.clientY);if(hit)selectNode(hit);}}}
canvas.addEventListener('pointerup',finishPointer);canvas.addEventListener('pointercancel',finishPointer);
document.getElementById('zoomIn').onclick=()=>{view.scale=clampScale(view.scale*1.18);draw();}; document.getElementById('zoomOut').onclick=()=>{view.scale=clampScale(view.scale*.82);draw();}; document.getElementById('resetView').onclick=resetView;
document.getElementById('rotateToggle').onclick=()=>{view.rotateMode=!view.rotateMode;document.getElementById('rotateToggle').classList.toggle('active',view.rotateMode);document.getElementById('rotateToggle').setAttribute('aria-label',view.rotateMode?'Rotation mode':'Move mode');ui.mode.textContent=view.rotateMode?'3D rotation':'Move map';};
document.getElementById('closePanel').onclick=()=>ui.panel.classList.remove('visible');
document.getElementById('askAi').onclick=()=>{const focus=folders.map(f=>({f,n:taskPairs.filter(([id])=>id===f.id).length})).sort((a,b)=>b.n-a.n)[0];ui.note.textContent=`The ${focus.f.label} neuron has the most active synapses. Select a blue synapse nearby and make it your next step.`;};
document.getElementById('taskForm').addEventListener('submit',e=>{e.preventDefault();const text=ui.input.value.trim();if(!text)return;taskPairs.push([ui.project.value,text]);localStorage.setItem(`cerebnation-brain:${activeKernel}`,JSON.stringify(taskPairs));ui.input.value='';updateDock();selectNode(folders.find(f=>f.id===ui.project.value));});
document.getElementById('nodeNameForm').addEventListener('submit', event=>{event.preventDefault();const value=ui.name.value.trim();if(!value)return;customNames[selected.id]=value;localStorage.setItem('ai-brain-names',JSON.stringify(customNames));selectNode(makeNodes().find(node=>node.id===selected.id));});
function appendMiniMessage(text, role) { const message=document.createElement('p');message.className=`mini-message ${role}`;message.textContent=text;ui.miniLog.append(message);ui.miniLog.scrollTop=ui.miniLog.scrollHeight; }
function activateKernel(button) { document.querySelectorAll('.kernel-item').forEach(item=>item.classList.remove('active')); button.classList.add('active'); if (![...ui.miniSelect.options].some(option=>option.value===button.dataset.kernel)) ui.miniSelect.add(new Option(button.dataset.kernel, button.dataset.kernel)); ui.miniSelect.value=button.dataset.kernel; useBrain(button.dataset.kernel); ui.note.textContent=`${button.dataset.kernel} is open. The map context has switched.`; ui.sidebar.classList.remove('open'); }
document.querySelectorAll('.kernel-item').forEach(button=>button.addEventListener('click',()=>activateKernel(button)));
document.getElementById('newChat').onclick=()=>{const number=document.querySelectorAll('.kernel-item').length+1;const button=document.createElement('button');button.className='kernel-item';button.dataset.kernel=`New core ${number}`;button.innerHTML=`<span>${button.dataset.kernel}</span><i class="kernel-icon icon-main"></i>`;button.addEventListener('click',()=>activateKernel(button));document.querySelector('.kernels-list').prepend(button);activateKernel(button);appendMiniMessage('A new core is ready. Where should we begin?', 'bot');resetView();};
document.getElementById('coreSwitcher').onclick=()=>{const open=ui.coreMenu.classList.toggle('open');ui.coreMenu.setAttribute('aria-hidden',String(!open));document.getElementById('coreSwitcher').setAttribute('aria-expanded',String(open));};
document.querySelectorAll('.core-option').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.core-option').forEach(item=>item.classList.remove('active'));button.classList.add('active');ui.activeCore.textContent=button.dataset.core;ui.coreMenu.classList.remove('open');ui.coreMenu.setAttribute('aria-hidden','true');document.getElementById('coreSwitcher').setAttribute('aria-expanded','false');ui.note.textContent=`${button.dataset.core} is active for this core.`;appendMiniMessage(`${button.dataset.core} is connected.`, 'bot');}));
document.querySelectorAll('[data-empty-action]').forEach(button=>button.addEventListener('click',()=>{ui.note.textContent='This control is ready for a future action.';}));
document.getElementById('miniChatForm').addEventListener('submit',event=>{event.preventDefault();const text=ui.miniInput.value.trim();if(!text)return;appendMiniMessage(text,'user');ui.miniInput.value='';appendMiniMessage('Noted. I added this to the current core context.','bot');});
document.getElementById('focusChat').onclick=()=>ui.miniInput.focus();
ui.miniSelect.addEventListener('change',()=>{const target=[...document.querySelectorAll('.kernel-item')].find(item=>item.dataset.kernel===ui.miniSelect.value);if(target)activateKernel(target);});
document.getElementById('accountButton').onclick=()=>{const open=ui.accountMenu.classList.toggle('open');ui.accountMenu.setAttribute('aria-hidden',String(!open));};
document.getElementById('clearCore').onclick=()=>{if(!window.confirm(`Clear all synapses in ${activeKernel}?`))return;taskPairs=[];brains.get(activeKernel).taskPairs=taskPairs;localStorage.setItem(`cerebnation-brain:${activeKernel}`,JSON.stringify({tasks:[]}));ui.panel.classList.remove('visible');updateDock();draw();appendMiniMessage('All synapses in this core have been cleared.','bot');};
document.querySelectorAll('[data-account-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.accountAction;ui.accountMenu.classList.remove('open');ui.accountMenu.setAttribute('aria-hidden','true');ui.note.textContent=action==='subscription'?'Subscription settings are ready.':action==='settings'?'Account settings are available on the next screen.':'Sign out is ready. Your map remains saved on this device.';}));
document.getElementById('mobileMenu').onclick=()=>ui.sidebar.classList.toggle('open');
useBrain(activeKernel); window.addEventListener('resize',resize);updateDock();resize();
