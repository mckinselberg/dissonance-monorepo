// Standalone proof-of-concept for the instanced-material pipeline
// (docs/dissonance/instanced-material-pipeline-prompt-v1.md) — exercises
// createScatterMaterial + ScatterVariationMaterialPlugin at >=100 thin
// instances, and EmissiveDataPatternMaterial on two demo planes. Not part
// of any shipped app; nothing here is wired into apps/world or DTA.
import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  Scene,
  Vector3,
} from '@babylonjs/core';
import {
  createScatterMaterial,
  setScatterVariationBuffer,
  DEFAULT_SCATTER_VARIATION_PROFILE,
  EmissiveDataPatternMaterial,
  createScrollingTexture,
} from '@dissonance/materials';

const INSTANCE_COUNT = 144; // >= 100 per the pipeline doc's acceptance criteria
const GRID_SPACING = 1.4;

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const readout = document.getElementById('readout') as HTMLDivElement;

const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor.set(0.04, 0.04, 0.05, 1);

const camera = new ArcRotateCamera('camera', Math.PI / 3, Math.PI / 3, 22, Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 4;
camera.upperRadiusLimit = 60;

const light = new HemisphericLight('light', new Vector3(0.3, 1, 0.2), scene);
light.intensity = 0.9;

// --- Scatter props: >=100 thin instances sharing one material, hue/value
// jittered per-instance so they don't read as visibly cloned. ---
const scatter = createScatterMaterial('echo17-worn-leather-wrap', scene, {
  albedoPath: '/textures/echo17-worn-leather-wrap/echo17_worn_leather_wrap_diff_512.jpg',
  roughnessPath: '/textures/echo17-worn-leather-wrap/echo17_worn_leather_wrap_rough_512.png',
  normalPath: '/textures/echo17-worn-leather-wrap/echo17_worn_leather_wrap_nor_gl_512.png',
});

const propBase = MeshBuilder.CreateBox('scatterPropBase', { size: 1 }, scene);
propBase.material = scatter.material;
propBase.isVisible = true;

const gridSide = Math.ceil(Math.sqrt(INSTANCE_COUNT));
let placed = 0;
for (let ix = 0; ix < gridSide && placed < INSTANCE_COUNT; ix++) {
  for (let iz = 0; iz < gridSide && placed < INSTANCE_COUNT; iz++) {
    const x = (ix - gridSide / 2) * GRID_SPACING;
    const z = (iz - gridSide / 2) * GRID_SPACING;
    const rotY = (Math.sin(ix * 12.9898 + iz * 78.233) * 43758.5453) % (Math.PI * 2);
    const scale = 0.8 + ((ix * 7 + iz * 13) % 5) * 0.08;
    const matrix = Matrix.Compose(
      new Vector3(scale, scale, scale),
      Quaternion.RotationYawPitchRoll(rotY, 0, 0),
      new Vector3(x, 0, z),
    );
    propBase.thinInstanceAdd(matrix);
    placed++;
  }
}
propBase.thinInstanceRefreshBoundingInfo();
setScatterVariationBuffer(propBase, placed, DEFAULT_SCATTER_VARIATION_PROFILE, 7);

// --- Emissive data-pattern planes: UV-scrolled, standalone (no device
// logic wired in, per the pipeline doc's scope). ---
const scramblePlane = MeshBuilder.CreatePlane('scrambleScreenDemo', { size: 4 }, scene);
scramblePlane.position.set(-gridSide * GRID_SPACING * 0.6, 3, 0);
const scrambleMat = new EmissiveDataPatternMaterial(
  'scrambleScreenMat',
  scene,
  '/textures/echo17-scramble-screen/echo17_scramble_screen_emissive_512.jpg',
  { scrollSpeedV: 0.4, tint: new Color3(0.9, 0.95, 1.0), intensity: 1.4 },
);
scramblePlane.material = scrambleMat.material;

const palettePlane = MeshBuilder.CreatePlane(
  'signalPaletteDemo',
  { width: 6, height: 1 },
  scene,
);
palettePlane.position.set(gridSide * GRID_SPACING * 0.6, 3, 0);
const paletteMat = new EmissiveDataPatternMaterial(
  'signalPaletteMat',
  scene,
  '/textures/echo17-signal-palette/echo17_signal_palette_emissive_512.jpg',
  { scrollSpeedU: 0.6, scrollSpeedV: 0, tint: new Color3(1, 1, 1), intensity: 1.6 },
);
palettePlane.material = paletteMat.material;

// --- Lineglass parts preview: the exact material recipe just wired into
// apps/world/src/world/LineglassParts.ts (lit PBR gem + scrolling
// signal-palette emissiveTexture as a tint, not EmissiveDataPatternMaterial's
// unlit standalone-screen look) — one shared texture across all of them,
// same as the real loader. Scaled up ~4x from the real PART_RADIUS (0.22)
// purely so it reads at this demo's camera distance. ---
const LINEGLASS_PART_RADIUS = 0.9;
const LINEGLASS_COUNT = 5;
const lineglassBodyTexture = createScrollingTexture(
  scene,
  '/textures/echo17-signal-palette/echo17_signal_palette_emissive_512.jpg',
  { scrollSpeedU: 0.5 },
);

for (let i = 0; i < LINEGLASS_COUNT; i++) {
  const name = `lineglassPreview_${i}`;
  const mat = new PBRMaterial(`${name}_mat`, scene);
  mat.albedoColor = new Color3(0.55, 0.85, 0.9);
  mat.emissiveColor = new Color3(0.6, 1.15, 1.3);
  mat.emissiveTexture = lineglassBodyTexture.texture;
  mat.roughness = 0.25;
  mat.metallic = 0.6;

  const body = MeshBuilder.CreatePolyhedron(name, { type: 2, size: LINEGLASS_PART_RADIUS }, scene);
  body.material = mat;
  body.position.set((i - (LINEGLASS_COUNT - 1) / 2) * 2.6, 7.5, -6);

  const accentMat = new PBRMaterial(`${name}_accent_mat`, scene);
  accentMat.albedoColor = new Color3(0.95, 0.65, 0.25);
  accentMat.emissiveColor = new Color3(0.95, 0.65, 0.25);
  accentMat.roughness = 0.3;
  accentMat.metallic = 0.4;
  const accent = MeshBuilder.CreateSphere(`${name}_accent`, { diameter: LINEGLASS_PART_RADIUS * 0.5 }, scene);
  accent.material = accentMat;
  accent.parent = body;
}

engine.runRenderLoop(() => {
  scene.render();
  scene.meshes.forEach((mesh) => {
    if (mesh.name.startsWith('lineglassPreview_') && !mesh.name.includes('accent')) {
      mesh.rotation.y += 0.008;
    }
  });
  readout.textContent =
    `instances: ${placed}\n` +
    `fps: ${engine.getFps().toFixed(0)}\n` +
    `drag to orbit, scroll to zoom`;
});

window.addEventListener('resize', () => engine.resize());
