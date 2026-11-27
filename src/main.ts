import './style.css';
import { FurnitureScene, type RenderMode } from './scene';
import { buildParts, clone, columnHeight, columnOf, cutGroups, csvFor, dimensions, makeProject, moduleOf, parseProject, serialize, uid, validateProject, type Column, type Module, type ModuleKind, type Project } from './model';

const app = document.querySelector<HTMLDivElement>('#app')!;
const KEY = 'madera-local-workshop-v1';
const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const mm = (v: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(v);
const paths: Record<string, string> = {
  back: '<path d="m14 7-5 5 5 5M9 12h11"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5ZM13 5H5a2 2 0 0 0-2 2v13h14v-8"/>',
  cube: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 9v9M3 8l9 4 9-4M7.5 5.5l9 5"/>',
  door: '<path d="M4 21h16M6 21V4l11-2v19M10 12h1"/>', explode: '<path d="m12 2 4 2-4 2-4-2 4-2Zm0 4v4M3 11l4-2 4 2-4 2-4-2Zm0 0v5l4 2 4-2v-5m-4 2v5m6-7 4-2 4 2-4 2-4-2Zm0 0v5l4 2 4-2v-5m-4 2v5M12 17v5"/>',
  pen: '<path d="m5 19 7-16 7 16M7 14h10M3 21h18"/>', palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="8" r="1"/><circle cx="14" cy="6" r="1"/><circle cx="17" cy="11" r="1"/><path d="M7 18c4 0 5-3 3-5"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v4"/>', redo: '<path d="m16 4 5 5-5 5M21 9H11a7 7 0 0 0-7 7v4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>', upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>', trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>', check: '<path d="m5 12 4 4L19 6"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3v.1"/>',
  settings: '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
  ruler: '<path d="m3 17 14-14 4 4L7 21l-4-4Zm5-5 2 2m2-6 2 2m2-6 2 2"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  file: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8m-8 4h8"/>', print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v8H6v-8Z"/>',
};
const icon = (name: string, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.cube}</svg>`;
const button = (action: string, label: string, glyph: string, active = false, extra = '') => `<button class="icon-button ${active ? 'active' : ''}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${active ? 'aria-pressed="true"' : ''} ${extra}>${icon(glyph)}</button>`;
const logo = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7 24V9l9 7 9-7v15" fill="none" stroke="currentColor" stroke-width="3.5"/></svg></span>`;
const labels: Record<ModuleKind, string> = { shelf: 'Open shelf', drawers: 'Drawers', doors: 'Double doors', 'left-door': 'Left door', 'right-door': 'Right door' };
let projects: Project[] = [];
let current: Project | undefined;
let selected: string | undefined;
let scene: FurnitureScene | undefined;
let tab: 'design' | 'cutlist' = 'design';
let mode: RenderMode = 'color';
let assembly: 'closed' | 'open' | 'explode' = 'closed';
let full3d = false;
let cutSelection: string | undefined;
let undo: Project[] = [], redo: Project[] = [];
let storageError = '';
let shelfView: 'projects' | 'templates' = 'projects';
const presets = [{ key: 'wardrobe', name: 'Wardrobe', detail: 'Shelves, storage & three drawers' }, { key: 'chest', name: 'Chest', detail: 'Two columns · ten drawers' }, { key: 'side', name: 'Side Table', detail: 'A little space for everything' }, { key: 'bookcase', name: 'Bookcase', detail: 'Three columns · open shelving' }];
const templates = presets.map(p => ({ ...p, project: makeProject(p.name, p.key) }));

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const data = JSON.parse(raw); if (!Array.isArray(data)) throw Error('Invalid library'); projects = data.map(validateProject) }
    else { projects = presets.slice(0, 3).map(p => makeProject(p.name, p.key)); persist() }
  } catch (e) { storageError = `Could not read saved projects. Your stored data has been left untouched. ${e instanceof Error ? e.message : ''}`; projects = [] }
}
function persist() {
  if (storageError) return false;
  try { localStorage.setItem(KEY, JSON.stringify(projects)); return true }
  catch { storageError = 'Storage is unavailable. Export your project to keep a copy.'; toast(storageError); return false }
}
function toast(text: string) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = text; document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
function commit(change: (project: Project) => void, message?: string) {
  if (!current) return;
  const before = clone(current), next = clone(current);
  try { change(next); validateProject(next) } catch (e) { toast((e as Error).message); refresh(); return }
  undo.push(before); if (undo.length > 50) undo.shift(); redo = [];
  next.updated = new Date().toISOString(); current = next;
  projects = projects.map(p => p.id === next.id ? next : p); persist(); refresh();
  if (message) toast(message);
}
function selection(p = current): { column: Column; module: Module; index: number } | undefined {
  if (!p || !selected) return;
  for (const column of p.columns) { const index = column.modules.findIndex(m => m.id === selected); if (index >= 0) return { column, module: column.modules[index], index } }
}

function blueprint(p: Project, interactive = false) {
  const dim = dimensions(p), pad = interactive ? 160 : 65, bottomPad = interactive ? 200 : 65;
  let left = 0;
  const lines: string[] = [];
  const stroke = Math.max(dim.width, dim.height) / (interactive ? 250 : 180);
  const pattern = `hatch-${p.id}`;
  p.columns.forEach((c, ci) => {
    const h = columnHeight(p, c), y0 = dim.height - h;
    const muted = interactive && selected && !c.modules.some(m => m.id === selected);
    lines.push(`<g class="${muted ? 'blueprint-muted' : ''}" stroke-width="${stroke}">`);
    lines.push(`<path d="M${left} ${y0 - p.overhang}v${h + p.overhang}M${left + c.width} ${y0 - p.overhang}v${h + p.overhang}" fill="none" stroke="currentColor"/>`);
    let y = dim.height - p.thickness;
    c.modules.forEach((m, mi) => {
      y -= m.height;
      const x = left + p.thickness, w = c.width - 2 * p.thickness, isSelected = selected === m.id;
      lines.push(`<g ${interactive ? `data-module="${m.id}" role="button" tabindex="0" aria-label="Column ${ci + 1}, ${esc(labels[m.kind])}, module ${mi + 1}" aria-pressed="${isSelected}"` : ''} class="module-shape ${isSelected && interactive ? 'selected' : ''}">`);
      const fill = isSelected && interactive ? `url(#${pattern})` : m.kind === 'shelf' ? 'transparent' : 'currentColor';
      lines.push(`<rect x="${x}" y="${y + 3}" width="${w}" height="${m.height - 6}" fill="${fill}" stroke="currentColor"/>`);
      if (m.kind === 'drawers') for (let n = 0; n < m.drawers; n++) {
        const dy = y + n * m.height / m.drawers;
        if (n) lines.push(`<path d="M${x} ${dy}h${w}" stroke="#1b1917"/>`);
        lines.push(`<circle cx="${x + w / 2 - 15}" cy="${dy + 22}" r="6" fill="#1b1917" stroke="none"/><circle cx="${x + w / 2 + 15}" cy="${dy + 22}" r="6" fill="#1b1917" stroke="none"/>`);
      }
      if (m.kind.includes('door')) {
        const center = x + w / 2;
        if (m.kind === 'doors') lines.push(`<path d="M${center} ${y}v${m.height}" stroke="#1b1917"/><circle cx="${center - 20}" cy="${y + 30}" r="7" fill="#1b1917" stroke="none"/><circle cx="${center + 20}" cy="${y + 30}" r="7" fill="#1b1917" stroke="none"/>`);
        else lines.push(`<circle cx="${m.kind === 'left-door' ? x + w - 24 : x + 24}" cy="${y + 30}" r="7" fill="#1b1917" stroke="none"/>`);
      }
      lines.push('</g>');
      lines.push(`<path d="M${x} ${y - p.thickness / 2}h${w}" stroke="currentColor" fill="none"/>`);
      y -= p.thickness;
    });
    lines.push(`<path d="M${left + p.thickness} ${dim.height - p.thickness / 2}h${c.width - 2 * p.thickness}" fill="none" stroke="currentColor"/></g>`);
    if (interactive) {
      const radius = Math.max(dim.width, dim.height) / 56;
      lines.push(`<g data-action="add-module" data-column="${c.id}" role="button" tabindex="0" aria-label="Add module to column ${ci + 1}" class="svg-add"><circle cx="${left + c.width / 2}" cy="${y0 - p.overhang - radius * 1.7}" r="${radius}" fill="currentColor"/><path d="M${left + c.width / 2 - radius / 3} ${y0 - p.overhang - radius * 1.7}h${radius * 2 / 3}m${-radius / 3} ${-radius / 3}v${radius * 2 / 3}" stroke="#1b1917" stroke-width="${stroke}"/></g>`);
      lines.push(`<text x="${left + c.width / 2}" y="${dim.height + 85}" text-anchor="middle" fill="#c7c0b4" font-size="${Math.max(dim.width, dim.height) / 48}">${String.fromCharCode(65 + ci)}</text><text x="${left + c.width / 2}" y="${dim.height + 145}" text-anchor="middle" fill="#817a71" font-size="${Math.max(dim.width, dim.height) / 60}">${c.width} mm</text>`);
    }
    left += c.width;
  });
  return `<svg class="blueprint-svg" viewBox="${-pad} ${-pad} ${dim.width + pad * 2} ${dim.height + pad + bottomPad}" xmlns="http://www.w3.org/2000/svg" ${interactive ? 'aria-label="Furniture front elevation"' : 'aria-hidden="true"'}><defs><pattern id="${pattern}" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(45)"><rect width="26" height="26" fill="#1b1917"/><rect width="13" height="26" fill="#ffc21a"/></pattern></defs>${lines.join('')}</svg>`;
}

function dashboard() {
  scene?.destroy(); scene = undefined; current = undefined;
  document.body.classList.remove('in-editor');
  const list = shelfView === 'templates' ? templates.map(t => t.project) : projects;
  app.innerHTML = `<div class="dashboard"><header class="home-header"><a href="#/" class="brand">${logo}<strong>Madera</strong><span class="local-badge">LOCAL WORKSHOP</span></a><button class="text-button" data-action="help">${icon('help')} About & shortcuts</button></header>
    <main class="library"><div class="library-heading"><div><p class="eyebrow">A SPACE TO MAKE SOMETHING</p><h1>Your next piece starts here.</h1><p class="subheading">A few panels. A little imagination. Made to fit your space.</p></div><span class="local-status"><i></i> Saved on this device</span></div>
    <div class="library-toolbar"><div class="library-tabs"><button data-action="projects" class="${shelfView === 'projects' ? 'current' : ''}">Projects <span>${projects.length}</span></button><button data-action="templates" class="${shelfView === 'templates' ? 'current' : ''}">Templates</button></div><div class="row"><button class="secondary" data-action="import">${icon('upload')} Import</button><button class="primary" data-action="new">${icon('plus')} New project</button></div></div>
    ${storageError ? `<p class="error" role="alert">${esc(storageError)}</p>` : ''}
    <div class="project-grid">${list.map((p, i) => `<article class="project-card"><button class="project-preview" aria-label="Open ${esc(p.name)}" data-action="${shelfView === 'templates' ? 'use-template' : 'open-project'}" data-id="${p.id}"><span class="preview-number">${String(i + 1).padStart(2, '0')}</span>${blueprint(p)}<span class="open-project">${icon('arrow')}</span></button><div class="project-meta"><div><button class="project-name" data-action="${shelfView === 'templates' ? 'use-template' : 'open-project'}" data-id="${p.id}">${esc(p.name)}</button><p>${mm(dimensions(p).width)} × ${mm(dimensions(p).height)} × ${p.depth} mm</p></div>${shelfView === 'projects' ? button('project-menu', `Options for ${p.name}`, 'more', false, `data-id="${p.id}"`) : '<span class="template-tag">STARTER</span>'}</div></article>`).join('')}
    <button class="new-project-card" data-action="new"><span>${icon('plus', 26)}</span><strong>Start from scratch</strong><small>Something only you could make.</small></button></div>
    <footer class="library-footer"><span>Independent rebuild inspired by <a href="https://x.com/KMkota0/status/2049574141171241064" target="_blank" rel="noopener">Madera by Xavier (Jack) ↗</a></span><span>No account. Just your ideas.</span></footer></main></div><input id="import-file" type="file" accept=".json,.madera" hidden>`;
}

function editor(p: Project) {
  current = p; selected = undefined; tab = 'design'; undo = []; redo = []; full3d = false; cutSelection = undefined; assembly = 'closed';
  mode = p.finish === 'color' ? 'color' : 'material';
  document.body.classList.add('in-editor');
  app.innerHTML = `<div class="editor"><header class="editor-header"><div class="row header-left"><div class="pill project-pill">${button('home', 'Back to projects', 'back')}<button id="project-title" data-action="rename">${esc(p.name)}</button>${button('rename', 'Rename project', 'edit')}</div><div class="pill segment" id="view-tabs"></div></div><div class="row header-right"><div class="pill history" id="history"></div><span class="save-state" id="save-state"></span>${button('help', 'Help and keyboard shortcuts', 'help')}<button class="pill export-button" data-action="export">${icon('download')} <span>Export</span></button></div></header>
    <div class="workspace"><section class="design-pane" aria-label="Design controls"><div class="pane-caption"><span id="pane-label">FRONT ELEVATION</span><button class="text-button" data-action="settings">${icon('settings', 15)} Construction</button></div><div id="design-area"></div><div id="inspector"></div></section><div class="split-handle" role="separator" aria-label="Resize design and preview" aria-orientation="vertical" tabindex="0"></div><section class="preview-pane" aria-label="3D preview"><div id="scene"></div><div id="scene-toolbar" class="scene-toolbar"></div><div class="scene-label"><span class="status-dot"></span><span id="scene-label-text">3D ASSEMBLY</span></div><div id="part-caption"></div><div class="camera-controls pill">${button('view-front', 'Front view', 'grid')}${button('view-perspective', 'Perspective view', 'cube')}${button('view-top', 'Top view', 'ruler')}<span></span>${button('fit', 'Fit model to view (F)', 'fit')}</div><div class="orbit-hint">Drag to orbit <span>·</span> Scroll to zoom</div></section></div>
    <footer class="editor-footer"><a href="#/" class="brand-mini">${logo}<span>Madera <i>/ local</i></span></a><span id="dimensions-summary"></span><button class="text-button" data-action="toggle-full">${icon('cube', 14)} <span id="full-label">Focus 3D</span></button></footer></div><input id="import-file" type="file" accept=".json,.madera" hidden>`;
  try { scene = new FurnitureScene(document.querySelector('#scene')!, id => { selected = id; refresh() }); scene.mode = mode; scene.update(p, true) }
  catch (e) { document.querySelector('#scene')!.innerHTML = `<div class="webgl-error"><strong>3D preview unavailable</strong><p>Your browser could not start WebGL. The front view and cut list still work.</p></div>`; console.error(e) }
  const split = document.querySelector<HTMLElement>('.split-handle')!;
  split.addEventListener('pointerdown', e => { split.setPointerCapture(e.pointerId); split.classList.add('dragging') });
  split.addEventListener('pointermove', e => { if (split.hasPointerCapture(e.pointerId)) document.querySelector<HTMLElement>('.workspace')!.style.setProperty('--split', `${Math.min(65, Math.max(30, e.clientX / innerWidth * 100))}%`) });
  split.addEventListener('pointerup', e => { split.releasePointerCapture(e.pointerId); split.classList.remove('dragging') });
  split.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const ws = document.querySelector<HTMLElement>('.workspace')!; const v = parseFloat(ws.style.getPropertyValue('--split')) || 43; ws.style.setProperty('--split', `${Math.min(65, Math.max(30, v + (e.key === 'ArrowLeft' ? -2 : 2)))}%`) } });
  refresh();
}

function refresh() {
  if (!current) return;
  const p = current, dim = dimensions(p), sel = selection();
  document.querySelector('#project-title')!.textContent = p.name;
  document.querySelector('#view-tabs')!.innerHTML = `<button data-action="design" class="${tab === 'design' ? 'active' : ''}">Design</button><button data-action="cutlist" class="${tab === 'cutlist' ? 'active' : ''}">Cut list <span>${buildParts(p).length}</span></button>`;
  document.querySelector('#history')!.innerHTML = button('undo', 'Undo (⌘Z)', 'undo', false, undo.length ? '' : 'disabled') + button('redo', 'Redo (⇧⌘Z)', 'redo', false, redo.length ? '' : 'disabled');
  document.querySelector('#save-state')!.innerHTML = `${icon(storageError ? 'file' : 'check', 13)} ${storageError ? 'Export to save' : 'Saved locally'}`;
  document.querySelector('#dimensions-summary')!.innerHTML = `<span>${mm(dim.width)} <i>W</i></span><b>×</b><span>${mm(dim.height)} <i>H</i></span><b>×</b><span>${mm(dim.depth)} <i>D</i></span><small>mm</small>`;
  document.querySelector('#pane-label')!.textContent = tab === 'design' ? 'FRONT ELEVATION' : 'PANEL CUT LIST';
  document.querySelector('.workspace')!.classList.toggle('full-preview', full3d);
  document.querySelector('#full-label')!.textContent = full3d ? 'Show editor' : 'Focus 3D';
  document.querySelector('#scene-toolbar')!.innerHTML = `<div class="pill">${button('mode-technical', 'Technical outlines', 'pen', mode === 'technical')}${button('mode-color', 'Color by part', 'palette', mode === 'color')}<button class="icon-button material-button ${mode === 'material' ? 'active' : ''}" data-action="materials" title="Wood & materials" aria-label="Wood and materials"><span class="wood-swatch"></span></button></div><div class="pill">${button('assembled', 'Assembled', 'cube', assembly === 'closed')}${button('opened', 'Open doors and drawers', 'door', assembly === 'open')}${button('exploded', 'Exploded view', 'explode', assembly === 'explode')}</div>`;
  document.querySelector('#design-area')!.className = tab === 'design' ? 'drawing-area' : 'cutlist-area';
  if (tab === 'design') {
    document.querySelector('#design-area')!.innerHTML = `<div class="drawing-meta"><span>${p.columns.length} COLUMNS</span><span>${p.columns.reduce((s, c) => s + c.modules.length, 0)} MODULES</span></div><div class="drawing">${blueprint(p, true)}</div><div class="drawing-actions"><button class="text-button" data-action="add-column">${icon('plus', 14)} Add column</button><select id="module-picker" aria-label="Select a module"><option value="">Select a module…</option>${p.columns.map((c, ci) => c.modules.map((m, mi) => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${String.fromCharCode(65 + ci)}${mi + 1} · ${labels[m.kind]}</option>`).join('')).join('')}</select></div>`;
    document.querySelector('#inspector')!.innerHTML = sel ? `<div class="selection-inspector"><div class="inspector-heading"><span><i></i> ${esc(labels[sel.module.kind])} <small>· Column ${String.fromCharCode(65 + p.columns.indexOf(sel.column))}</small></span>${button('deselect', 'Deselect module', 'close')}</div><div class="field-row"><label class="wide">Module type<select data-field="kind" aria-label="Module type">${Object.entries(labels).map(([key, label]) => `<option value="${key}" ${sel.module.kind === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Column width<div class="input-unit"><input type="number" data-field="width" aria-label="Column width" value="${sel.column.width}" min="180" max="1500" step="10"><span>mm</span></div></label><label>Opening height<div class="input-unit"><input type="number" data-field="height" aria-label="Opening height" value="${sel.module.height}" min="100" max="2000" step="10"><span>mm</span></div></label>${sel.module.kind === 'drawers' ? `<label>Drawers<input type="number" data-field="drawers" aria-label="Number of drawers" value="${sel.module.drawers}" min="1" max="8"></label>` : ''}</div><div class="selection-actions"><button class="text-button" data-action="duplicate-module">${icon('copy', 14)} Duplicate</button><button class="text-button" data-action="add-module" data-column="${sel.column.id}" data-after="${sel.module.id}">${icon('plus', 14)} Add above</button><button class="text-button" data-action="move-up" aria-label="Move module up">↑</button><button class="text-button danger" data-action="delete-module">${icon('trash', 14)} Delete</button></div></div>` : `<div class="global-inspector">${[['depth', 'Depth', p.depth], ['thickness', 'Thickness', p.thickness], ['overhang', 'Overhang', p.overhang]].map(([field, label, value]) => `<label><span>${label} <small>mm</small></span><input aria-label="${label}" type="number" data-field="${field}" value="${value}" min="${field === 'depth' ? 200 : field === 'thickness' ? 12 : 0}" max="${field === 'depth' ? 1200 : field === 'thickness' ? 30 : 100}" step="${field === 'depth' ? 10 : 1}"></label>`).join('')}</div>`;
    cutSelection = undefined;
    if (scene) scene.isolated = undefined;
    document.querySelector('#part-caption')!.innerHTML = '';
  } else {
    const groups = cutGroups(buildParts(p)), count = groups.reduce((s, g) => s + g.parts.length, 0), area = groups.reduce((s, g) => s + g.width * g.height * g.parts.length, 0) / 1e6;
    document.querySelector('#design-area')!.innerHTML = `<div class="cutlist-heading"><h2>Every piece, accounted for.</h2><p>Select a row to inspect the board in 3D.</p></div><div class="cutlist-stats"><div><strong>${count}</strong><span>panels</span></div><div><strong>${groups.length}</strong><span>unique sizes</span></div><div><strong>${area.toFixed(2)}</strong><span>m² of material</span></div></div><div class="table-scroll"><table><thead><tr><th>Part</th><th>Panel</th><th>L <small>mm</small></th><th>W <small>mm</small></th><th>T <small>mm</small></th><th>Qty</th></tr></thead><tbody>${groups.map(g => `<tr class="${cutSelection === g.code ? 'selected' : ''}" data-action="select-part" data-code="${g.code}" tabindex="0" role="button" aria-label="${g.code} ${g.name}, ${mm(g.width)} by ${mm(g.height)} by ${g.thickness} millimetres, quantity ${g.parts.length}"><td><span class="part-code">${g.code}</span></td><td>${g.name}</td><td>${mm(g.width)}</td><td>${mm(g.height)}</td><td>${g.thickness}</td><td>${g.parts.length}</td></tr>`).join('')}</tbody></table></div><p class="cutlist-note">Finished panel sizes · square butt joints · saw kerf excluded</p>`;
    document.querySelector('#inspector')!.innerHTML = `<div class="cutlist-actions"><button class="secondary" data-action="all-parts">${icon('cube')} Show assembly</button><button class="primary" data-action="csv">${icon('download')} Export CSV</button></div>`;
    const g = groups.find(g => g.code === cutSelection);
    if (scene) scene.isolated = g?.parts.map(part => part.id);
    document.querySelector('#part-caption')!.innerHTML = g ? `<div class="part-detail"><span class="part-code">${g.code}</span><div><strong>${g.name}</strong><p>${mm(g.width)} × ${mm(g.height)} × ${g.thickness} mm</p></div><span>×${g.parts.length}</span></div>` : '';
  }
  if (scene) { scene.selected = selected; scene.opened = assembly === 'open'; scene.exploded = assembly === 'explode'; scene.update(p) }
  document.querySelector('#scene-label-text')!.textContent = cutSelection ? 'PANEL DETAIL' : assembly === 'explode' ? 'EXPLODED ASSEMBLY' : mode === 'technical' ? 'TECHNICAL VIEW' : '3D ASSEMBLY';
}

function dialog(title: string, content: string, options?: { submit?: string; onSubmit?: (form: FormData) => void }) {
  document.querySelector('dialog')?.remove();
  const dlg = document.createElement('dialog'); dlg.className = 'modal';
  dlg.innerHTML = `<form><div class="modal-header"><h2>${esc(title)}</h2><button type="button" class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></div>${content}${options?.submit ? `<div class="modal-footer"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">${esc(options.submit)}</button></div>` : ''}</form>`;
  document.body.append(dlg); dlg.showModal();
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', e => { if (e.target === dlg) { const r = dlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close() } });
  dlg.querySelector('form')!.addEventListener('submit', e => { e.preventDefault(); options?.onSubmit?.(new FormData(e.target as HTMLFormElement)); dlg.close() });
  dlg.addEventListener('close', () => dlg.remove());
  setTimeout(() => { const input = dlg.querySelector<HTMLInputElement>('input'); input?.focus(); if (input?.type === 'text') input.select() }, 0);
  return dlg;
}
function exportFile(filename: string, data: Blob | string, type = 'application/json') {
  const a = document.createElement('a'); a.href = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const safeName = (p: Project) => p.name.replace(/[^a-z0-9 -]/gi, '').trim().replace(/\s+/g, '-') || 'furniture';

async function action(name: string, el?: HTMLElement) {
  const p = current;
  if (name === 'home') { location.hash = '/'; return }
  if (name === 'projects' || name === 'templates') { shelfView = name; dashboard(); return }
  if (name === 'open-project') { location.hash = `/project/${el!.dataset.id}`; return }
  if (name === 'use-template') { const source = templates.find(t => t.project.id === el!.dataset.id)!; const next = makeProject(source.name, source.key); projects.unshift(next); persist(); location.hash = `/project/${next.id}`; return }
  if (name === 'new') { dialog('A new beginning.', '<p class="modal-intro">Give your next piece a name.</p><label class="modal-field">Project name<input name="name" type="text" value="Untitled" maxlength="100" required></label>', { submit: 'Create project', onSubmit: form => { const next = makeProject(String(form.get('name')).trim() || 'Untitled'); projects.unshift(next); persist(); location.hash = `/project/${next.id}` } }); return }
  if (name === 'import') { document.querySelector<HTMLInputElement>('#import-file')?.click(); return }
  if (name === 'project-menu') {
    const target = projects.find(pr => pr.id === el!.dataset.id)!;
    const dlg = dialog(target.name, `<div class="menu-list"><button type="button" data-menu="duplicate">${icon('copy')} Duplicate project</button><button type="button" data-menu="download">${icon('download')} Export project</button><button type="button" data-menu="delete" class="danger">${icon('trash')} Delete project</button></div>`);
    dlg.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach(b => b.onclick = () => {
      dlg.close();
      if (b.dataset.menu === 'download') exportFile(`${safeName(target)}.madera.json`, serialize(target));
      if (b.dataset.menu === 'duplicate') { const dup = clone(target); dup.id = uid(); dup.name = `${target.name.slice(0, 90)} (copy)`; projects.unshift(dup); persist(); dashboard() }
      if (b.dataset.menu === 'delete') dialog('Delete this project?', `<p class="modal-intro">“${esc(target.name)}” will be removed from this browser. Export a copy first if you want to keep it.</p>`, { submit: 'Delete project', onSubmit: () => { projects = projects.filter(pr => pr.id !== target.id); persist(); dashboard() } });
    }); return;
  }
  if (name === 'help') { dialog('A little help in the workshop.', `<p class="modal-intro">Select a module in the drawing to change its type, width or height. Use the + above a column to build upward.</p><div class="shortcut-list"><span>Orbit / zoom</span><kbd>Drag / scroll</kbd><span>Fit model</span><kbd>F</kbd><span>Undo</span><kbd>⌘ Z</kbd><span>Redo</span><kbd>⌘ ⇧ Z</kbd><span>Duplicate selected module</span><kbd>⌘ D</kbd><span>Deselect</span><kbd>Esc</kbd></div><div class="about-note"><strong>An independent local rebuild.</strong><p>Inspired by <a href="https://x.com/KMkota0/status/2049574141171241064" target="_blank" rel="noopener">Madera, created by Xavier (Jack)</a>. Built from public video references. Your projects stay in this browser; export a .madera.json file to move or back them up.</p><p>Cut lists describe this rebuild’s square butt-joint geometry. Original Madera binary files and cloud accounts are not compatible.</p></div>`); return }
  if (!p) return;
  if (name === 'rename') { dialog('Name your piece.', `<label class="modal-field">Project name<input name="name" type="text" value="${esc(p.name)}" maxlength="100" required></label>`, { submit: 'Save name', onSubmit: form => commit(pr => pr.name = String(form.get('name')).trim() || 'Untitled') }); return }
  if (name === 'design' || name === 'cutlist') { tab = name; full3d = false; selected = undefined; cutSelection = undefined; if (scene) scene.isolated = undefined; refresh(); scene?.fit(); return }
  if (name === 'undo' || name === 'redo') {
    const from = name === 'undo' ? undo : redo, to = name === 'undo' ? redo : undo;
    const next = from.pop(); if (!next) return; to.push(clone(p)); current = next; projects = projects.map(pr => pr.id === next.id ? next : pr); persist(); refresh(); return;
  }
  if (name === 'deselect') { selected = undefined; refresh(); return }
  if (name === 'add-column') { commit(pr => { if (pr.columns.length >= 8) throw Error('You can use up to eight columns.'); const c = columnOf(); pr.columns.push(c); selected = c.modules[0].id }, 'Column added'); scene?.fit(); return }
  if (name === 'add-module') { commit(pr => { const c = pr.columns.find(c => c.id === el!.dataset.column)!; const m = moduleOf(); const after = el!.dataset.after; const index = after ? c.modules.findIndex(m => m.id === after) + 1 : c.modules.length; c.modules.splice(index, 0, m); selected = m.id }, 'Shelf added'); return }
  if (name === 'duplicate-module') { commit(pr => { const s = selection(pr); if (!s) return; const m = { ...s.module, id: uid() }; s.column.modules.splice(s.index + 1, 0, m); selected = m.id }); return }
  if (name === 'move-up') { commit(pr => { const s = selection(pr); if (!s || s.index === s.column.modules.length - 1) return; [s.column.modules[s.index], s.column.modules[s.index + 1]] = [s.column.modules[s.index + 1], s.column.modules[s.index]] }); return }
  if (name === 'delete-module') { commit(pr => { const s = selection(pr); if (!s) return; if (s.column.modules.length === 1) { if (pr.columns.length === 1) throw Error('Keep at least one module in the project.'); pr.columns = pr.columns.filter(c => c.id !== s.column.id) } else s.column.modules.splice(s.index, 1); selected = undefined }); return }
  if (name === 'mode-technical' || name === 'mode-color') { mode = name === 'mode-technical' ? 'technical' : 'color'; scene?.setMode(mode); refresh(); return }
  if (name === 'materials') {
    const dlg = dialog('A different finish.', `<p class="modal-intro">The same design, a different feel.</p><div class="material-options">${[['color', 'Color by part'], ['oak', 'Natural oak'], ['walnut', 'Warm walnut'], ['white', 'Chalk white']].map(([finish, label]) => `<button type="button" data-finish="${finish}" class="${p.finish === finish ? 'chosen' : ''}"><span class="material-sample ${finish}"></span><strong>${label}</strong></button>`).join('')}</div>`);
    dlg.querySelectorAll<HTMLButtonElement>('[data-finish]').forEach(b => b.onclick = () => { const finish = b.dataset.finish as Project['finish']; mode = finish === 'color' ? 'color' : 'material'; if (scene) scene.mode = mode; commit(pr => pr.finish = finish); dlg.close() }); return;
  }
  if (name === 'assembled' || name === 'opened' || name === 'exploded') { assembly = name === 'assembled' ? 'closed' : name === 'opened' ? 'open' : 'explode'; refresh(); return }
  if (name === 'fit') { scene?.fit(); return }
  if (name.startsWith('view-')) { scene?.fit(name.slice(5) as 'front' | 'top' | 'perspective'); return }
  if (name === 'toggle-full') { full3d = !full3d; refresh(); setTimeout(() => scene?.fit(), 100); return }
  if (name === 'select-part') { cutSelection = el!.dataset.code; refresh(); scene?.fit(); return }
  if (name === 'all-parts') { cutSelection = undefined; refresh(); scene?.fit(); return }
  if (name === 'csv') { exportFile(`${safeName(p)}-cutlist.csv`, csvFor(p), 'text/csv;charset=utf-8'); toast('Cut list exported'); return }
  if (name === 'settings') { dialog('Construction details.', `<p class="modal-intro">All dimensions are in millimetres. Column widths include the two side panels; module heights are clear openings.</p><div class="construction-fields">${[['depth', 'Depth', p.depth, 200, 1200], ['thickness', 'Panel thickness', p.thickness, 12, 30], ['back', 'Back / drawer bottom', p.back, 3, 18], ['overhang', 'Side overhang', p.overhang, 0, 100]].map(([key, label, value, min, max]) => `<label class="modal-field">${label}<div class="input-unit"><input name="${key}" type="number" min="${min}" max="${max}" value="${value}" required><span>mm</span></div></label>`).join('')}</div>`, { submit: 'Apply dimensions', onSubmit: f => commit(pr => { pr.depth = Number(f.get('depth')); pr.thickness = Number(f.get('thickness')); pr.back = Number(f.get('back')); pr.overhang = Number(f.get('overhang')) }) }); return }
  if (name === 'export') {
    const dlg = dialog('From idea to something real.', `<p class="modal-intro">Save your design, share a view, or take the cut list to your workshop.</p><div class="export-options">${[['project', 'file', 'Project file', '.madera.json · edit again later'], ['csv', 'ruler', 'Panel cut list', '.csv · dimensions & quantities'], ['png', 'image', 'Preview image', '.png · current 3D view'], ['glb', 'cube', '3D model', '.glb · open in Blender or other 3D tools'], ['print', 'print', 'Print cut list', 'Print or save as PDF']].map(([key, glyph, label, hint]) => `<button type="button" data-export="${key}">${icon(glyph, 24)}<span><strong>${label}</strong><small>${hint}</small></span>${icon('arrow', 16)}</button>`).join('')}</div>`);
    dlg.querySelectorAll<HTMLButtonElement>('[data-export]').forEach(b => b.onclick = async () => {
      const type = b.dataset.export; b.disabled = true;
      try {
        if (type === 'project') exportFile(`${safeName(p)}.madera.json`, serialize(p));
        if (type === 'csv') exportFile(`${safeName(p)}-cutlist.csv`, csvFor(p), 'text/csv;charset=utf-8');
        if (type === 'png') { if (!scene) throw Error('3D preview is not available.'); exportFile(`${safeName(p)}.png`, scene.screenshot()) }
        if (type === 'glb') { if (!scene) throw Error('3D preview is not available.'); exportFile(`${safeName(p)}.glb`, new Blob([await scene.exportGLB()], { type: 'model/gltf-binary' })) }
        if (type === 'print') { dlg.close(); tab = 'cutlist'; cutSelection = undefined; full3d = false; refresh(); setTimeout(() => window.print(), 100); return }
        toast('Export ready'); dlg.close();
      } catch (e) { toast((e as Error).message); b.disabled = false }
    }); return;
  }
}

document.addEventListener('click', e => {
  const target = e.target as Element;
  const module = target.closest<HTMLElement>('[data-module]');
  if (module) { selected = selected === module.dataset.module ? undefined : module.dataset.module; refresh(); return }
  const el = target.closest<HTMLElement>('[data-action]'); if (el) void action(el.dataset.action!, el);
});
document.addEventListener('change', async e => {
  const input = e.target as HTMLInputElement;
  if (input.id === 'import-file') {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    try { if (file.size > 2_000_000) throw Error('Choose a project file under 2 MB.'); const p = parseProject(await file.text()); p.id = uid(); p.updated = new Date().toISOString(); projects.unshift(p); persist(); location.hash = `/project/${p.id}`; toast('Project imported') }
    catch (e) { toast((e as Error).message) } return;
  }
  if (input.id === 'module-picker') { selected = input.value || undefined; refresh(); return }
  const field = input.dataset.field; if (!field || !current) return;
  commit(p => {
    const s = selection(p);
    if (field === 'kind' && s) { s.module.kind = input.value as ModuleKind; if (s.module.kind === 'drawers') s.module.drawers = Math.min(s.module.drawers, Math.floor(s.module.height / 80)) }
    if (field === 'width' && s) s.column.width = Number(input.value);
    if (field === 'height' && s) s.module.height = Number(input.value);
    if (field === 'drawers' && s) s.module.drawers = Number(input.value);
    if (field === 'depth' || field === 'thickness' || field === 'overhang') p[field] = Number(input.value);
  });
});
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]')) return;
  const target = e.target as HTMLElement;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) { if (e.key === 'Enter') target.blur(); return }
  if ((e.key === 'Enter' || e.key === ' ') && target.matches('[data-module],tr[data-action],g[data-action]')) { e.preventDefault(); target.dispatchEvent(new MouseEvent('click', { bubbles: true })); return }
  if (!current) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); void action(e.shiftKey ? 'redo' : 'undo') }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selected) { e.preventDefault(); void action('duplicate-module') }
  if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) scene?.fit();
  if (e.key === 'Escape') { selected = undefined; refresh() }
});
function route() {
  scene?.destroy(); scene = undefined;
  const id = location.hash.match(/^#\/project\/([^/]+)$/)?.[1];
  const p = projects.find(p => p.id === id);
  if (p) editor(p); else { dashboard(); if (id) toast('That project is not saved in this browser.') }
}
window.addEventListener('hashchange', route);
load(); route();
