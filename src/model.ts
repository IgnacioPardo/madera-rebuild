export type ModuleKind = 'shelf' | 'drawers' | 'doors' | 'left-door' | 'right-door';
export type Finish = 'color' | 'oak' | 'walnut' | 'white';
export interface Module { id: string; kind: ModuleKind; height: number; drawers: number }
export interface Column { id: string; width: number; modules: Module[] }
export interface Project {
  id: string; name: string; updated: string; columns: Column[];
  depth: number; thickness: number; back: number; overhang: number; finish: Finish;
}
export interface Part {
  id: string; role: 'side' | 'deck' | 'back' | 'front' | 'drawer'; name: string;
  width: number; height: number; thickness: number;
  size: [number, number, number]; position: [number, number, number];
  column: string; module?: string; move?: string;
  hinge?: { x: number; z: number; direction: number };
  holes?: [number, number][];
}
export interface CutGroup { code: string; name: string; width: number; height: number; thickness: number; parts: Part[] }
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => structuredClone(value);
export const moduleOf = (kind: ModuleKind = 'shelf', height = 300, drawers = 1): Module => ({ id: uid(), kind, height, drawers });
export const columnOf = (width = 450, modules = [moduleOf()]): Column => ({ id: uid(), width, modules });
export const columnHeight = (p: Project, c: Column) => c.modules.reduce((s, m) => s + m.height, 0) + (c.modules.length + 1) * p.thickness;
export const dimensions = (p: Project) => ({ width: p.columns.reduce((s, c) => s + c.width, 0), height: Math.max(...p.columns.map(c => columnHeight(p, c))) + p.overhang, depth: p.depth });
export function makeProject(name = 'Untitled', preset = 'blank'): Project {
  const p: Project = { id: uid(), name, updated: new Date().toISOString(), columns: [columnOf()], depth: 450, thickness: 18, back: 6, overhang: 20, finish: 'color' };
  if (preset === 'chest') p.columns = [0, 1].map(() => columnOf(800, [moduleOf('drawers', 764, 5)]));
  if (preset === 'side') p.columns = [columnOf(420, [moduleOf('doors', 400), moduleOf('drawers', 160), moduleOf('shelf', 800)])];
  if (preset === 'bookcase') p.columns = [0, 1, 2].map(() => columnOf(420, [0, 1, 2, 3, 4].map(() => moduleOf('shelf', 290))));
  if (preset === 'wardrobe') p.columns = [
    columnOf(430, [moduleOf('left-door', 650), moduleOf('shelf', 350), moduleOf('shelf', 600), moduleOf('shelf', 330)]),
    columnOf(950, [moduleOf('drawers', 600, 3), moduleOf('shelf', 1366)]),
    columnOf(430, [moduleOf('shelf', 310), moduleOf('shelf', 330), moduleOf('shelf', 450), moduleOf('shelf', 350), moduleOf('left-door', 472)]),
    columnOf(430, [moduleOf('shelf', 310), moduleOf('shelf', 330), moduleOf('shelf', 450), moduleOf('shelf', 350), moduleOf('right-door', 472)]),
  ];
  return p;
}

/** Board geometry and the cut list share this single millimetre-based source. */
export function buildParts(p: Project): Part[] {
  const parts: Part[] = [], t = p.thickness, d = p.depth, gap = 3;
  const total = dimensions(p).width;
  let left = -total / 2;
  for (const c of p.columns) {
    const h = columnHeight(p, c), x = left + c.width / 2, inner = c.width - 2 * t;
    const add = (id: string, role: Part['role'], name: string, width: number, height: number, thick: number, size: Part['size'], position: Part['position'], extra: Partial<Part> = {}) => {
      parts.push({ id: `${c.id}-${id}`, column: c.id, role, name, width, height, thickness: thick, size, position, ...extra });
    };
    add('left', 'side', 'Side panel', d, h + p.overhang, t, [t, h + p.overhang, d], [left + t / 2, (h + p.overhang) / 2, 0]);
    add('right', 'side', 'Side panel', d, h + p.overhang, t, [t, h + p.overhang, d], [left + c.width - t / 2, (h + p.overhang) / 2, 0]);
    add('back', 'back', 'Back panel', inner, h - 2 * t, p.back, [inner, h - 2 * t, p.back], [x, h / 2, -d / 2 + p.back / 2]);
    let bottom = t;
    add('bottom', 'deck', 'Bottom / top', inner, d, t, [inner, t, d], [x, t / 2, 0]);
    c.modules.forEach((m, mi) => {
      const frontZ = d / 2 - t / 2;
      if (m.kind === 'drawers') {
        const count = m.drawers, unit = m.height / count;
        for (let n = 0; n < count; n++) {
          const y = bottom + n * unit + unit / 2, fH = unit - 2 * gap;
          const move = `${m.id}-${n}`, pre = `${m.id}-${n}`, boxW = inner - 26, boxD = d - t - p.back - 25, boxH = Math.max(40, fH - 35);
          add(`${pre}-front`, 'front', 'Drawer front', inner - 2 * gap, fH, t, [inner - 2 * gap, fH, t], [x, y, frontZ], { module: m.id, move, holes: [[-16, fH / 2 - 22], [16, fH / 2 - 22]] });
          for (const side of [-1, 1]) add(`${pre}-side${side}`, 'drawer', 'Drawer side', boxD, boxH, t, [t, boxH, boxD], [x + side * (boxW - t) / 2, y - 8, frontZ - t / 2 - boxD / 2], { module: m.id, move });
          add(`${pre}-rear`, 'drawer', 'Drawer back', boxW - 2 * t, boxH, t, [boxW - 2 * t, boxH, t], [x, y - 8, frontZ - t / 2 - boxD + t / 2], { module: m.id, move });
          add(`${pre}-base`, 'drawer', 'Drawer bottom', boxW - 2 * t, boxD - t, p.back, [boxW - 2 * t, p.back, boxD - t], [x, y - 8 - boxH / 2 + p.back / 2, frontZ - t / 2 - (boxD - t) / 2], { module: m.id, move });
        }
      } else if (m.kind !== 'shelf') {
        const double = m.kind === 'doors', doorW = (inner - (double ? 3 : 2) * gap) / (double ? 2 : 1), doorH = m.height - 2 * gap;
        const sides = double ? [-1, 1] : [m.kind === 'right-door' ? 1 : -1];
        sides.forEach(side => {
          const dx = double ? side * (doorW + gap) / 2 : 0;
          const pivot = x + dx + side * doorW / 2;
          add(`${m.id}-door${side}`, 'front', double ? 'Double door' : 'Door', doorW, doorH, t, [doorW, doorH, t], [x + dx, bottom + m.height / 2, frontZ], { module: m.id, move: `${m.id}-${side}`, hinge: { x: pivot, z: frontZ, direction: side }, holes: [[-side * (doorW / 2 - 22), doorH / 2 - 30]] });
        });
      }
      bottom += m.height;
      add(`${m.id}-deck`, 'deck', mi === c.modules.length - 1 ? 'Bottom / top' : 'Shelf', inner, d - p.back, t, [inner, t, d - p.back], [x, bottom + t / 2, p.back / 2], { module: m.id });
      bottom += t;
    });
    left += c.width;
  }
  return parts;
}

export function cutGroups(parts: Part[]): CutGroup[] {
  const groups = new Map<string, CutGroup>();
  parts.forEach(part => {
    const key = [part.name, part.width.toFixed(2), part.height.toFixed(2), part.thickness].join('/');
    if (!groups.has(key)) groups.set(key, { code: `P${String(groups.size + 1).padStart(2, '0')}`, name: part.name, width: part.width, height: part.height, thickness: part.thickness, parts: [] });
    groups.get(key)!.parts.push(part);
  });
  return [...groups.values()];
}
export function csvFor(p: Project): string {
  const rows = cutGroups(buildParts(p));
  return 'Part,Description,Length (mm),Width (mm),Thickness (mm),Quantity\r\n' + rows.map(r => `${r.code},${r.name},${r.width.toFixed(1)},${r.height.toFixed(1)},${r.thickness},${r.parts.length}`).join('\r\n');
}
export function serialize(p: Project): string { return JSON.stringify({ format: 'madera-local', version: 1, project: p }, null, 2) }
export function parseProject(text: string): Project {
  const data = JSON.parse(text);
  if (data?.format !== 'madera-local' || data.version !== 1) throw new Error('Choose a .madera.json file exported by this local rebuild. Original Madera binary files use a different format.');
  return validateProject(data.project);
}
export function validateProject(value: unknown): Project {
  const p = value as Project;
  if (!p || typeof p !== 'object') throw new Error('The project is missing.');
  const number = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) || typeof p.name !== 'string' || p.name.length > 100 || !p.name.trim()) throw new Error('The project name is invalid.');
  if (!number(p.depth, 200, 1200) || !number(p.thickness, 12, 30) || !number(p.back, 3, 18) || !number(p.overhang, 0, 100)) throw new Error('The panel dimensions are outside the supported range.');
  if (!['color', 'oak', 'walnut', 'white'].includes(p.finish)) throw new Error('Unknown material.');
  if (!Array.isArray(p.columns) || !p.columns.length || p.columns.length > 8) throw new Error('A project needs 1–8 columns.');
  const ids = new Set<string>();
  const checkId = (id: string) => { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new Error('The project contains invalid or duplicate part IDs.'); ids.add(id) };
  for (const c of p.columns) {
    checkId(c.id);
    if (!number(c.width, 180, 1500) || !Array.isArray(c.modules) || !c.modules.length || c.modules.length > 12) throw new Error('Invalid column dimensions or module count.');
    for (const m of c.modules) {
      checkId(m.id);
      if (!['shelf', 'drawers', 'doors', 'left-door', 'right-door'].includes(m.kind) || !number(m.height, 100, 2000) || !Number.isInteger(m.drawers) || !number(m.drawers, 1, 8)) throw new Error('Invalid module.');
      if (m.kind === 'drawers' && m.height / m.drawers < 80) throw new Error('Each drawer needs at least 80 mm of height.');
    }
    if (columnHeight(p, c) + p.overhang > 4000) throw new Error('Columns must be no taller than 4,000 mm.');
  }
  return clone(p);
}
