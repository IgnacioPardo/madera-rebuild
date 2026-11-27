import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildParts, dimensions, type Part, type Project } from './model';

export type RenderMode = 'color' | 'technical' | 'material';
type Board = { node: THREE.Group; part: Part; base: THREE.Vector3; mesh: THREE.Mesh };
export class FurnitureScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 1, 50000);
  controls: OrbitControls;
  root = new THREE.Group();
  boards: Board[] = [];
  mode: RenderMode = 'color';
  opened = false;
  exploded = false;
  selected?: string;
  isolated?: string[];
  private openAmount = 0;
  private explodeAmount = 0;
  private project?: Project;
  private host: HTMLElement;
  private observer: ResizeObserver;
  private frame = 0;
  private clock = new THREE.Clock();
  private pointer = new THREE.Vector2();
  private ray = new THREE.Raycaster();
  private down = { x: 0, y: 0 };
  private onSelect: (module?: string) => void;
  private textures = new Map<string, THREE.CanvasTexture>();
  private grid: THREE.Points;
  private ground: THREE.Mesh;
  private light: THREE.DirectionalLight;

  constructor(host: HTMLElement, onSelect: (module?: string) => void) {
    this.host = host; this.onSelect = onSelect;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .9;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D furniture preview. Drag to orbit; scroll to zoom.');
    this.renderer.domElement.setAttribute('role', 'img');
    host.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .09;
    this.controls.minDistance = 100;
    this.controls.maxDistance = 20000;
    this.controls.maxPolarAngle = Math.PI * .92;
    this.scene.add(this.root);
    this.scene.add(new THREE.AmbientLight(0xffffff, .5));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5044, .7));
    this.light = new THREE.DirectionalLight(0xffffff, 2.8);
    this.light.position.set(-2500, 4500, 3500);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    Object.assign(this.light.shadow.camera, { left: -6000, right: 6000, top: 6000, bottom: -6000, near: 1, far: 14000 });
    this.light.shadow.normalBias = 1;
    this.light.shadow.bias = -.0002;
    this.scene.add(this.light);
    const fill = new THREE.DirectionalLight(0xc4daf0, .45); fill.position.set(3000, 2200, -1800); this.scene.add(fill);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.ShadowMaterial({ opacity: .17 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -3; this.ground.receiveShadow = true; this.scene.add(this.ground);
    const points: number[] = [];
    for (let x = -5000; x <= 5000; x += 150) for (let z = -5000; z <= 5000; z += 150) points.push(x, -1, z);
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32;
    const ctx = dot.getContext('2d')!; ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(16, 16, 12, 0, Math.PI * 2); ctx.fill();
    const dotTex = new THREE.CanvasTexture(dot);
    this.grid = new THREE.Points(geom, new THREE.PointsMaterial({ color: 0xb5aca1, size: 24, map: dotTex, alphaTest: .1, transparent: true, opacity: .38, sizeAttenuation: true }));
    this.scene.add(this.grid);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
    this.renderer.domElement.addEventListener('pointerdown', e => this.down = { x: e.clientX, y: e.clientY });
    this.renderer.domElement.addEventListener('pointerup', e => {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5 || this.isolated) return;
      const r = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      this.ray.setFromCamera(this.pointer, this.camera);
      const hit = this.ray.intersectObjects(this.boards.map(b => b.mesh), false)[0];
      this.onSelect(hit?.object.userData.module);
    });
    this.animate();
  }
  resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  private wood(finish: string) {
    if (this.textures.has(finish)) return this.textures.get(finish)!;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = finish === 'walnut' ? '#805339' : '#c7a474'; ctx.fillRect(0, 0, 512, 512);
    let seed = 18;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 };
    for (let i = 0; i < 1600; i++) {
      const x = random() * 512;
      ctx.strokeStyle = `rgba(${finish === 'walnut' ? '42,20,8' : '100,63,25'},${random() * .15})`;
      ctx.lineWidth = random() * 1.6;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + random() * 12, 150, x - random() * 14, 350, x + random() * 5, 512); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures.set(finish, texture); return texture;
  }
  private geometry(part: Part) {
    if (!part.holes?.length) return new THREE.BoxGeometry(...part.size);
    const [w, h, t] = part.size;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
    part.holes.forEach(([x, y]) => { const path = new THREE.Path(); path.absarc(x, y, 6, 0, Math.PI * 2, true); shape.holes.push(path) });
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 16 });
    geometry.translate(0, 0, -t / 2);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + .5, uv.getY(i) / h + .5);
    return geometry;
  }
  private clear() {
    for (const b of this.boards) b.node.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose());
      }
    });
    this.root.clear(); this.boards = [];
  }
  update(project: Project, resetCamera = false) {
    const first = !this.project; this.project = project; this.clear();
    const technical = this.mode === 'technical';
    this.scene.background = new THREE.Color(technical ? '#1c1917' : '#4a4644');
    this.ground.visible = !technical;
    (this.grid.material as THREE.PointsMaterial).opacity = technical ? .28 : .4;
    const parts = buildParts(project);
    const visibleParts = this.isolated ? parts.filter(p => this.isolated!.includes(p.id)).slice(0, 1) : parts;
    for (const part of visibleParts) {
      const colors = { side: '#218bc7', deck: '#19cb61', back: '#999895', front: '#ffc514', drawer: '#b9b6b0' };
      const isSelected = part.module && part.module === this.selected;
      const material = technical ? new THREE.MeshBasicMaterial({ color: '#1c1917', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }) : new THREE.MeshStandardMaterial({
        color: technical ? '#1c1917' : this.mode === 'material' ? project.finish === 'white' ? '#e8e5de' : '#ffffff' : colors[part.role],
        roughness: .8, metalness: 0,
        map: this.mode === 'material' && project.finish !== 'white' ? this.wood(project.finish === 'walnut' ? 'walnut' : 'oak') : null,
        emissive: isSelected ? '#4c3500' : '#000000', emissiveIntensity: isSelected ? .25 : 0,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
      const node = new THREE.Group(), mesh = new THREE.Mesh(this.geometry(part), material);
      mesh.castShadow = !technical; mesh.receiveShadow = !technical;
      mesh.userData = { module: part.module, part: part.id };
      const base = new THREE.Vector3(...part.position);
      if (this.isolated) base.set(0, part.size[1] / 2, 0);
      node.position.copy(base); node.add(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color: technical || isSelected ? '#ffc21a' : '#1c211f', transparent: !technical && !isSelected, opacity: technical || isSelected ? 1 : .2 }));
      node.add(edge); this.root.add(node); this.boards.push({ node, mesh, part, base });
    }
    if (first || resetCamera) this.fit();
  }
  setMode(mode: RenderMode) { this.mode = mode; if (this.project) this.update(this.project) }
  select(module?: string) { this.selected = module; if (this.project) this.update(this.project) }
  isolate(ids?: string[]) { this.isolated = ids; if (this.project) this.update(this.project, true) }
  fit(view: 'perspective' | 'front' | 'side' | 'top' = 'perspective') {
    if (!this.project) return;
    const dims = dimensions(this.project);
    const box = this.isolated && this.boards[0] ? { width: this.boards[0].part.size[0], height: this.boards[0].part.size[1], depth: this.boards[0].part.size[2] } : dims;
    const center = new THREE.Vector3(0, box.height * .48, 0);
    const aspect = this.camera.aspect || 1;
    const fit = Math.max(box.height, box.width / Math.max(aspect, .3), box.depth) * (this.isolated ? 2.6 : 2.9);
    const direction = view === 'front' ? new THREE.Vector3(0, 0, 1) : view === 'side' ? new THREE.Vector3(1, 0, 0) : view === 'top' ? new THREE.Vector3(0, 1, .001) : new THREE.Vector3(1.25, .8, 1.7).normalize();
    this.camera.position.copy(center).addScaledVector(direction, Math.max(fit, 700)); this.controls.target.copy(center);
    this.camera.lookAt(center); this.controls.update();
  }
  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), .05), lerp = 1 - Math.exp(-dt * 7);
    this.openAmount += ((this.opened ? 1 : 0) - this.openAmount) * lerp;
    this.explodeAmount += ((this.exploded ? 1 : 0) - this.explodeAmount) * lerp;
    if (this.project) for (const b of this.boards) {
      const { node, part, base } = b; node.position.copy(base); node.rotation.set(0, 0, 0);
      if (!this.isolated) {
        if (part.hinge) {
          const angle = part.hinge.direction * this.openAmount * Math.PI * .53;
          const dx = base.x - part.hinge.x;
          node.position.x = part.hinge.x + dx * Math.cos(angle);
          node.position.z = part.hinge.z - dx * Math.sin(angle);
          node.rotation.y = angle;
        } else if (part.move) node.position.z += this.openAmount * this.project.depth * .65;
        const e = this.explodeAmount;
        if (e > .001) {
          node.position.x += base.x * e * .4;
          node.position.y += base.y * e * .2 + (part.role === 'deck' ? 75 : 0) * e;
          node.position.z += (part.role === 'front' ? 550 : part.role === 'back' ? -420 : part.role === 'drawer' ? 220 : 0) * e;
        }
      }
    }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  };
  screenshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png') }
  async exportGLB(): Promise<ArrayBuffer> {
    const previous = this.isolated;
    try {
      // The export is always the complete assembled piece, even when inspecting a cut-list row.
      if (previous) { this.isolated = undefined; this.update(this.project!) }
      const exporter = new GLTFExporter();
      const model = this.root.clone(true); model.scale.setScalar(.001);
      model.children.forEach((node, i) => { node.position.set(...this.boards[i].part.position); node.rotation.set(0, 0, 0) });
      model.traverse(o => { if (o instanceof THREE.LineSegments) o.visible = false });
      return await exporter.parseAsync(model, { binary: true, onlyVisible: true }) as ArrayBuffer;
    } finally {
      if (previous) { this.isolated = previous; this.update(this.project!) }
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame); this.observer.disconnect(); this.controls.dispose(); this.clear();
    this.textures.forEach(t => t.dispose()); this.grid.geometry.dispose();
    (this.grid.material as THREE.PointsMaterial).map?.dispose(); (this.grid.material as THREE.Material).dispose();
    this.ground.geometry.dispose(); (this.ground.material as THREE.Material).dispose();
    this.light.shadow.map?.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
