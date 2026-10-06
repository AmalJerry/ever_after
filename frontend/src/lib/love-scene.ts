import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CakeColor } from "./types";

export interface SceneState {
  extinguished: boolean;
  energy: number;
}

interface SceneOptions {
  variant: "cake" | "heart";
  cakeColor: CakeColor;
  candleCount: number;
  accentColor: string;
  reducedMotion: boolean;
  onContextLost: () => void;
}

function heartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.35);
  shape.bezierCurveTo(-0.65, 0.94, -1.15, 0.06, 0, -0.78);
  shape.bezierCurveTo(1.15, 0.06, 0.65, 0.94, 0, 0.35);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelSegments: 8,
    steps: 1,
    bevelSize: 0.13,
    bevelThickness: 0.13,
    curveSegments: 40,
  });
  geometry.center();
  return geometry;
}

function material(color: string, roughness = 0.35, metalness = 0) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createCake(color: CakeColor, count: number) {
  const group = new THREE.Group();
  const palette = {
    rose: ["#f5a1b9", "#ffe5ea"],
    vanilla: ["#f6dca8", "#fff5de"],
    sage: ["#b3c9ac", "#e5edda"],
  }[color];
  const frosting = material(palette[1], 0.4);
  const fondant = material(palette[0], 0.5);
  const porcelain = material("#fff7ef", 0.18);
  const roseGold = material("#dbab77", 0.24, 0.75);
  const candleWax = material("#fff1d9", 0.37);
  const stripe = material("#d96588", 0.38);
  const heartSurface = material("#c95379", 0.28, 0.12);
  const heart = heartGeometry();

  addMesh(
    group,
    new THREE.CylinderGeometry(0.72, 0.89, 0.1, 80),
    porcelain,
    [0, -1.5, 0],
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.24, 0.38, 0.38, 64),
    porcelain,
    [0, -1.27, 0],
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(1.64, 1.56, 0.11, 96),
    porcelain,
    [0, -1.04, 0],
  );
  const plateRim = addMesh(
    group,
    new THREE.TorusGeometry(1.6, 0.022, 12, 96),
    roseGold,
    [0, -1, 0],
  );
  plateRim.rotation.x = Math.PI / 2;
  addMesh(
    group,
    new THREE.CylinderGeometry(1.29, 1.29, 1.04, 96),
    fondant,
    [0, -0.46, 0],
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(1.31, 1.29, 0.11, 96),
    frosting,
    [0, 0.095, 0],
  );
  const icingEdge = addMesh(
    group,
    new THREE.TorusGeometry(1.24, 0.078, 16, 96),
    frosting,
    [0, 0.13, 0],
  );
  icingEdge.rotation.x = Math.PI / 2;

  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    const length = index % 3 === 0 ? 0.21 : 0.1;
    addMesh(group, new THREE.CapsuleGeometry(0.085, length, 8, 12), frosting, [
      Math.sin(angle) * 1.24,
      0.045 - length / 2,
      Math.cos(angle) * 1.24,
    ]);
  }

  const pearlGeometry = new THREE.SphereGeometry(0.055, 12, 8);
  const pearls = new THREE.InstancedMesh(pearlGeometry, frosting, 54);
  const transform = new THREE.Object3D();
  for (let index = 0; index < 54; index += 1) {
    const angle = (index / 54) * Math.PI * 2;
    transform.position.set(
      Math.sin(angle) * 1.28,
      -0.91,
      Math.cos(angle) * 1.28,
    );
    transform.updateMatrix();
    pearls.setMatrixAt(index, transform.matrix);
  }
  pearls.castShadow = true;
  group.add(pearls);

  const piping = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.083, 12, 10),
    frosting,
    16 * 6,
  );
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    for (let petal = 0; petal < 6; petal += 1) {
      const petalAngle = (petal / 6) * Math.PI * 2;
      transform.position.set(
        Math.sin(angle) * 1.08 + Math.sin(petalAngle) * 0.065,
        0.19 + (petal % 2) * 0.022,
        Math.cos(angle) * 1.08 + Math.cos(petalAngle) * 0.065,
      );
      transform.scale.set(0.73, 0.92, 0.73);
      transform.updateMatrix();
      piping.setMatrixAt(index * 6 + petal, transform.matrix);
    }
  }
  piping.castShadow = true;
  group.add(piping);

  const applique = addMesh(group, heart, heartSurface, [0, -0.42, 1.285]);
  applique.scale.setScalar(0.22);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 + 0.24;
    const sprinkle = addMesh(
      group,
      heart,
      index % 2 ? roseGold : heartSurface,
      [Math.sin(angle) * 0.86, 0.177, Math.cos(angle) * 0.86],
    );
    sprinkle.scale.setScalar(0.066);
    sprinkle.rotation.set(-Math.PI / 2, 0, angle);
  }

  const flames: THREE.Group[] = [];
  const smoke = new THREE.Group();
  smoke.visible = false;
  group.add(smoke);
  const flameGeometry = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.055, 0.045),
      new THREE.Vector2(0.072, 0.13),
      new THREE.Vector2(0.049, 0.2),
      new THREE.Vector2(0.016, 0.29),
      new THREE.Vector2(0, 0.34),
    ],
    24,
  );
  const flameSurface = new THREE.MeshBasicMaterial({ color: "#ffb438" });
  const innerFlame = new THREE.MeshBasicMaterial({ color: "#fff9d4" });
  const smokeSurface = new THREE.MeshBasicMaterial({
    color: "#fef9fc",
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const wickSurface = material("#503d39", 1);

  for (let index = 0; index < count; index += 1) {
    const candle = new THREE.Group();
    const candleHeight = index === Math.floor(count / 2) ? 0.88 : 0.72;
    candle.position.set(
      (index - (count - 1) / 2) * 0.37,
      0.17,
      count === 1 ? 0 : index % 2 ? -0.18 : 0.05,
    );
    group.add(candle);
    addMesh(
      candle,
      new THREE.CylinderGeometry(0.048, 0.048, candleHeight, 24),
      candleWax,
      [0, candleHeight / 2, 0],
    );
    const spiralPoints = Array.from({ length: 80 }, (_, pointIndex) => {
      const progress = pointIndex / 79;
      const angle = progress * Math.PI * 6;
      return new THREE.Vector3(
        Math.cos(angle) * 0.049,
        progress * candleHeight,
        Math.sin(angle) * 0.049,
      );
    });
    addMesh(
      candle,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(spiralPoints),
        80,
        0.01,
        5,
        false,
      ),
      stripe,
    );
    addMesh(
      candle,
      new THREE.CylinderGeometry(0.007, 0.007, 0.055, 8),
      wickSurface,
      [0, candleHeight + 0.025, 0],
    );
    const flame = new THREE.Group();
    flame.position.y = candleHeight + 0.035;
    const outer = addMesh(flame, flameGeometry, flameSurface);
    outer.castShadow = false;
    const inner = addMesh(flame, flameGeometry, innerFlame, [0, 0.01, 0.027]);
    inner.scale.set(0.48, 0.68, 0.48);
    inner.castShadow = false;
    candle.add(flame);
    flames.push(flame);

    const smokePoints = Array.from(
      { length: 14 },
      (_, pointIndex) =>
        new THREE.Vector3(
          Math.sin(pointIndex * 0.6) * 0.045,
          pointIndex * 0.024,
          0,
        ),
    );
    const wisp = addMesh(
      smoke,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(smokePoints),
        24,
        0.018,
        6,
        false,
      ),
      smokeSurface,
      [candle.position.x, candleHeight + 0.26, candle.position.z],
    );
    wisp.castShadow = false;
  }
  const candleLight = new THREE.PointLight("#ffc27e", 2, 4, 2);
  candleLight.position.set(0, 1.4, 0.1);
  group.add(candleLight);
  return { group, flames, smoke, smokeSurface, candleLight };
}

function createHeart(accentColor: string) {
  const group = new THREE.Group();
  const geometry = heartGeometry();
  const centerpiece = addMesh(
    group,
    geometry,
    material(accentColor, 0.18, 0.12),
  );
  centerpiece.scale.setScalar(1.45);
  centerpiece.rotation.set(-0.04, -0.24, -0.1);
  const companion = addMesh(
    group,
    geometry,
    material("#c65478", 0.24, 0.22),
    [0.83, -0.52, 0.25],
  );
  companion.scale.setScalar(0.59);
  companion.rotation.set(0.07, 0.18, 0.2);
  const orbitSurface = material("#ceab79", 0.2, 0.85);
  const orbit = addMesh(
    group,
    new THREE.TorusGeometry(1.52, 0.015, 12, 140),
    orbitSurface,
  );
  orbit.rotation.set(1.17, 0.3, -0.27);
  const secondOrbit = addMesh(
    group,
    new THREE.TorusGeometry(1.71, 0.009, 10, 140),
    orbitSurface,
  );
  secondOrbit.rotation.set(1.15, -0.65, 0.5);
  return group;
}

export function createLoveScene(host: HTMLElement, options: SceneOptions) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: true,
  });
  const context = renderer.getContext();
  const debugInfo = context.getExtension("WEBGL_debug_renderer_info");
  const rendererName = debugInfo
    ? String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    : "";
  const softwareRendering = /swiftshader|llvmpipe|software|basic render/i.test(
    rendererName,
  );
  renderer.setPixelRatio(
    softwareRendering ? 0.85 : Math.min(window.devicePixelRatio || 1, 1.75),
  );
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = !softwareRendering;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  let environmentTarget: THREE.WebGLRenderTarget | null = null;
  if (!softwareRendering) {
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    environmentTarget = generator.fromScene(environment, 0.04);
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 0.6;
    environment.dispose();
    generator.dispose();
  }
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  const hemisphere = new THREE.HemisphereLight("#fff9ed", "#b8778b", 1.5);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight("#fff7ed", 2.7);
  keyLight.position.set(-3, 6, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -3;
  keyLight.shadow.camera.right = 3;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -3;
  keyLight.shadow.normalBias = 0.035;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight("#ffe3ed", 1.1);
  fillLight.position.set(4, 2, -2);
  scene.add(fillLight);

  const cake =
    options.variant === "cake"
      ? createCake(options.cakeColor, options.candleCount)
      : null;
  const object = cake?.group || createHeart(options.accentColor);
  scene.add(object);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.ShadowMaterial({ color: "#a34970", opacity: 0.16 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.57;
  shadow.receiveShadow = true;
  scene.add(shadow);

  let disposed = false;
  let frame = 0;
  let previousFrame = 0;
  let state: SceneState = { extinguished: false, energy: 0 };
  let extinguishedAt = 0;
  const pointer = new THREE.Vector2();
  const startedAt = performance.now();

  function draw() {
    if (disposed) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    if (!options.reducedMotion) {
      const drift = options.variant === "cake" ? 0.045 : 0.16;
      object.rotation.y +=
        (Math.sin(elapsed * 0.45) * drift +
          pointer.x * 0.12 -
          object.rotation.y) *
        0.07;
      object.rotation.x += (pointer.y * 0.025 - object.rotation.x) * 0.06;
      if (!cake) object.position.y = Math.sin(elapsed * 1.1) * 0.075;
    }
    if (cake) {
      cake.flames.forEach((flame, index) => {
        let fading = 1;
        if (state.extinguished)
          fading = options.reducedMotion
            ? 0
            : Math.max(0, 1 - (performance.now() - extinguishedAt) / 250);
        flame.visible = fading > 0;
        const flicker = options.reducedMotion
          ? 1
          : 1 + Math.sin(elapsed * 9 + index * 1.6) * 0.075;
        flame.scale.set(fading, fading * flicker, fading);
        flame.rotation.z = options.reducedMotion
          ? 0
          : Math.sin(elapsed * 7 + index) * 0.08 + state.energy * 0.32;
      });
      cake.candleLight.intensity = state.extinguished ? 0 : 1.8;
      const smokeProgress = state.extinguished
        ? Math.min(1, (performance.now() - extinguishedAt) / 1500)
        : 1;
      cake.smoke.visible = !options.reducedMotion && smokeProgress < 1;
      cake.smoke.position.y = smokeProgress * 0.55;
      cake.smoke.position.x = Math.sin(smokeProgress * 3) * 0.12;
      cake.smokeSurface.opacity = (1 - smokeProgress) * 0.45;
    }
    renderer.render(scene, camera);
  }

  function animate(now: number) {
    if (disposed || document.hidden) return;
    if (now - previousFrame >= 1000 / (softwareRendering ? 12 : 30)) {
      previousFrame = now;
      draw();
    }
    if (!options.reducedMotion) frame = requestAnimationFrame(animate);
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    const distance =
      Math.max(4.05, 3.95 / camera.aspect) /
      (2 * Math.tan(THREE.MathUtils.degToRad(17.5)));
    camera.position.set(0, distance * 0.38, distance);
    camera.lookAt(0, options.variant === "cake" ? -0.08 : 0, 0);
    camera.updateProjectionMatrix();
    draw();
  }

  function onPointerMove(event: PointerEvent) {
    if (options.reducedMotion) return;
    const bounds = host.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
    );
  }
  function onPointerLeave() {
    pointer.set(0, 0);
  }
  function onVisibilityChange() {
    cancelAnimationFrame(frame);
    if (!document.hidden) {
      draw();
      if (!options.reducedMotion) frame = requestAnimationFrame(animate);
    }
  }
  function onContextLost(event: Event) {
    event.preventDefault();
    cancelAnimationFrame(frame);
    options.onContextLost();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  document.addEventListener("visibilitychange", onVisibilityChange);
  resize();
  if (!options.reducedMotion) frame = requestAnimationFrame(animate);

  return {
    update(next: SceneState) {
      const changed = next.extinguished !== state.extinguished;
      if (next.extinguished && !state.extinguished)
        extinguishedAt = performance.now();
      state = next;
      if (changed || options.reducedMotion) draw();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        onContextLost,
      );
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          geometries.add(node.geometry);
          const surfaces = Array.isArray(node.material)
            ? node.material
            : [node.material];
          surfaces.forEach((surface) => materials.add(surface));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((surface) => surface.dispose());
      keyLight.shadow.map?.dispose();
      environmentTarget?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
