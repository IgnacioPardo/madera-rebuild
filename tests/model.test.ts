import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParts, clone, columnHeight, cutGroups, dimensions, makeProject, parseProject, serialize, validateProject, csvFor } from '../src/model.ts';

for (const preset of ['blank', 'wardrobe', 'chest', 'side', 'bookcase']) {
  test(`${preset}: every cut-list panel corresponds to positive, in-bounds geometry`, () => {
    const p = makeProject('Test', preset);
    validateProject(p);
    const parts = buildParts(p), d = dimensions(p);
    assert.equal(new Set(parts.map(p => p.id)).size, parts.length);
    assert.equal(cutGroups(parts).reduce((n, g) => n + g.parts.length, 0), parts.length);
    for (const part of parts) {
      for (const v of [...part.size, part.width, part.height, part.thickness]) assert.ok(Number.isFinite(v) && v > 0, `${part.name}: ${v}`);
      assert.deepEqual([...part.size].sort((a,b) => a-b), [part.width, part.height, part.thickness].sort((a,b) => a-b));
      for (let axis = 0; axis < 3; axis++) {
        const min = part.position[axis] - part.size[axis] / 2, max = part.position[axis] + part.size[axis] / 2;
        const lo = axis === 0 ? -d.width / 2 : axis === 1 ? 0 : -d.depth / 2;
        const hi = axis === 0 ? d.width / 2 : axis === 1 ? d.height : d.depth / 2;
        assert.ok(min >= lo - .01 && max <= hi + .01, `${part.name} exceeds axis ${axis}`);
      }
    }
  });
}
test('blank cabinet uses two full-height sides and shelves that fit between them', () => {
  const p = makeProject(), parts = buildParts(p), col = p.columns[0];
  assert.equal(parts.length, 5);
  assert.equal(parts.filter(p => p.role === 'side').length, 2);
  assert.equal(parts.find(p => p.role === 'side')!.height, columnHeight(p, col) + p.overhang);
  assert.equal(parts.find(p => p.role === 'deck')!.width, col.width - 2 * p.thickness);
});
test('chest has ten complete drawer boxes and all exported quantities agree', () => {
  const p = makeProject('Chest', 'chest'), parts = buildParts(p);
  assert.equal(parts.filter(p => p.name === 'Drawer front').length, 10);
  assert.equal(parts.filter(p => p.name === 'Drawer bottom').length, 10);
  assert.equal(parts.filter(p => p.name === 'Drawer side').length, 20);
  assert.equal(csvFor(p).split('\r\n').length - 1, cutGroups(parts).length);
});
test('export/import round-trips all design data without losing module IDs', () => {
  const p = makeProject('A personal piece', 'wardrobe'); p.finish = 'walnut'; p.depth = 510;
  assert.deepEqual(parseProject(serialize(p)), p);
});
test('rejects unsupported original binaries, invalid dimensions and duplicate IDs', () => {
  assert.throws(() => parseProject('{"version":1}'), /different format/);
  const p = makeProject('Chest', 'chest');
  const cases: ((p: typeof p) => void)[] = [
    p => p.depth = NaN, p => p.columns = [], p => p.columns[0].width = -1,
    p => p.columns[0].modules[0].drawers = 8.5,
    p => p.columns[0].modules[0].height = 100,
    p => p.columns[1].id = p.columns[0].id,
  ];
  for (const mutate of cases) { const invalid = clone(p); mutate(invalid); assert.throws(() => validateProject(invalid)) }
});
