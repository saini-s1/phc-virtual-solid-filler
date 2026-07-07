// the 3d gummies inside the bottle. this is the fancy bit: a tiny live packing
// sim so the pile looks like real product poured into a bottle, not a static
// blob. detailed notes below. it's the heaviest thing on screen — if you ever
// need to make the app lighter, start here.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * GummyFill3D
 * ───────────
 * Renders the bottle contents as REAL 3D vitamin gummies using a LIVE
 * granular-packing simulation — not a pre-baked pile. Gummies stream in from
 * the neck, fall under gravity, tumble, collide against the floor, the bottle
 * wall and one another, and settle into a random loose pack, exactly the way
 * product pours into a real bottle on the line.
 *
 * Physics — position-based dynamics (Verlet + constraint projection), a
 * lightweight DEM/PBD relaxation that runs every frame:
 *   1. Integrate each gummy with Verlet (velocity is implicit in the previous
 *      position), applying gravity.
 *   2. Project contact constraints several times per frame: floor, cylindrical
 *      wall, and pairwise non-penetration (resolved with a uniform spatial
 *      hash so neighbour lookups stay cheap).
 * Flat gummies are treated as oblate ellipsoids via the standard scaled-space
 * trick: collisions are solved in a vertically-stretched space (y / FLAT) where
 * each oblate piece behaves like a sphere of radius `rf`.
 *
 * Sizing — each gummy's footprint radius is derived from its TRUE volume and
 * the predicted fill, so `count` gummies settling at the real ~62% poured
 * packing fraction naturally reach the predicted fill line. No vertical
 * stretching is applied, so the pack never looks gappy or crushed.
 *
 * Real packing references: random close packing ≈ 0.64 for spheres and ≈ 0.68
 * for flat M&M-like candies; poured (un-tapped) beds settle around 0.60.
 *
 * Everything draws from one InstancedMesh (a single draw call) so hundreds of
 * gummies stay smooth, inside a transparent <Canvas> the parent clips to the
 * bottle interior.
 */

type Props = {
  /** Number of gummies — the sim pours and settles exactly this many. */
  count: number;
  /** Predicted fill (0..~1.2) — sizes pieces so the settled top hits the line. */
  fillFraction: number;
  /** Interior aspect ratio (width / height) of the clipped fill region. */
  aspect: number;
  /** Real gummy footprint as a fraction of the bottle half-width (hint only). */
  gummyScale: number;
  /** Re-trigger the pour animation. */
  runId: number;
};

// ──────────────────────────────────────────────────────────────────────────
// World + simulation constants
// ──────────────────────────────────────────────────────────────────────────
const HX = 1; // fill region half-width (region spans -HX..HX in X and Z)
const WALL = 0.93; // collision wall radius — slightly inside HX so gummies
//                    sit *within* the glass instead of being sliced by the clip
const FLAT = 0.6; // gummy height ≈ FLAT × footprint diameter (oblate aspect)
const NMAX = 250; // hard cap on simulated gummies (matches the slider maximum)
const PHI = 0.62; // assumed poured packing fraction (matches the surrogate model)
// Per-gummy oval/size/flatness variation adds ≈6% bulk over a uniform pack, so
// shrink the fit radius by ∛(1/1.06) ≈ 0.98 to keep the settled top on the
// predicted fill line. Applied identically in every bottle.
const PACK_TUNE = 0.98;

// Verlet / contact-solver tuning.
const GRAV = 0.014; // gravity per frame² (scaled space)
const DAMP = 0.86; // velocity damping (energy loss on contact → settles, no jitter)
const ITERS = 5; // constraint-projection passes per frame
const SPAWN_RATE = 6; // gummies activated per frame while pouring
const FALL_V0 = 0.05; // initial downward speed at the chute
const GROW_K = 0.22; // grow-in easing when a gummy appears
const SHRINK_K = 0.22; // shrink-out easing when a gummy is removed
const RF_K = 0.1; // radius easing (smooth morph on preset/bottle change)
const SPIN_DAMP = 0.9; // tumble decay

// ──────────────────────────────────────────────────────────────────────────
// Gummy mesh — a multivitamin / Metamucil-style gummy built with LatheGeometry:
// a flat-ish base with a softly rounded edge that swells into a smooth domed
// top. Footprint radius 0.5, total height 1.0, centered on its own origin so
// the instanced scaling (footprint 2·rf, height 2·rf·FLAT) is unchanged — the
// packing simulation is untouched, only the silhouette differs.
// ──────────────────────────────────────────────────────────────────────────
function buildGummyGeometry(): THREE.LatheGeometry {
  const R = 0.5; // footprint radius
  const H = 1.0; // total height (flat base → dome apex)
  const pts: THREE.Vector2[] = [];
  // Profile runs bottom → top; the lathe revolves it 360°.
  const edge = 0.16 * H; // height of the rounded bottom-edge fillet

  // 1) Flat base — from the center out toward the start of the edge fillet.
  pts.push(new THREE.Vector2(0.0008, 0));
  pts.push(new THREE.Vector2(R - edge, 0));

  // 2) Rounded bottom edge — quarter arc from the flat base up to full radius,
  //    ending with a vertical tangent so it blends into the dome.
  const edgeSteps = 6;
  for (let i = 1; i <= edgeSteps; i++) {
    const a = (Math.PI / 2) * (i / edgeSteps);
    pts.push(
      new THREE.Vector2(R - edge + edge * Math.sin(a), edge * (1 - Math.cos(a)))
    );
  }

  // 3) Domed top — quarter-ellipse from the rim (R, edge) to the apex (0, H).
  //    Vertical tangent at the rim blends with the edge fillet; horizontal
  //    tangent at the apex gives a soft, rounded dome rather than a point.
  const domeSteps = 22;
  for (let i = 1; i <= domeSteps; i++) {
    const th = (Math.PI / 2) * (i / domeSteps);
    const rr = R * Math.cos(th);
    const yy = edge + (H - edge) * Math.sin(th);
    pts.push(new THREE.Vector2(Math.max(rr, 0.0008), yy));
  }

  const geo = new THREE.LatheGeometry(pts, 36);
  geo.computeVertexNormals();
  geo.translate(0, -H / 2, 0); // center vertically
  return geo;
}

const GUMMY_GEOMETRY = buildGummyGeometry();

// Blue vitamin-gummy shades (subtle variation gives the pile depth).
const GUMMY_HEX = ["#4f8ef7", "#3c72e8", "#5b9bff", "#2f63dd", "#6aa6ff"];

// ──────────────────────────────────────────────────────────────────────────
// Deterministic RNG
// ──────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Live simulation state — persistent buffers (one slot per possible gummy).
// Physics runs in scaled space: positions are (x, sy, z) where sy = worldY/FLAT,
// so each oblate gummy collides as a sphere of radius rf.
// ──────────────────────────────────────────────────────────────────────────
type Sim = {
  x: Float32Array;
  z: Float32Array;
  sy: Float32Array; // scaled vertical position (collision space)
  px: Float32Array; // previous positions (Verlet → implicit velocity)
  pz: Float32Array;
  psy: Float32Array;
  rf: Float32Array; // current collision radius
  varR: Float32Array; // per-gummy size multiplier
  ovalX: Float32Array; // footprint ovalness
  ovalZ: Float32Array;
  flatV: Float32Array; // per-gummy flatness multiplier (render only)
  rx: Float32Array; // orientation
  ry: Float32Array;
  rz: Float32Array;
  ax: Float32Array; // angular velocity (tumble)
  ay: Float32Array;
  az: Float32Array;
  grow: Float32Array; // 0..1 visual scale (spawn-in / remove-out)
  active: Uint8Array; // 1 = part of the pour, 0 = retired / unused
  alive: Uint8Array; // 1 = still drawn (active OR shrinking out)
  color: Uint8Array;
};

function createSim(): Sim {
  const f = () => new Float32Array(NMAX);
  return {
    x: f(),
    z: f(),
    sy: f(),
    px: f(),
    pz: f(),
    psy: f(),
    rf: f(),
    varR: f(),
    ovalX: f(),
    ovalZ: f(),
    flatV: f(),
    rx: f(),
    ry: f(),
    rz: f(),
    ax: f(),
    ay: f(),
    az: f(),
    grow: f(),
    active: new Uint8Array(NMAX),
    alive: new Uint8Array(NMAX),
    color: new Uint8Array(NMAX),
  };
}

// Per-gummy invariants (shape, colour, tilt) — fixed by a deterministic seed
// so each gummy keeps its identity across re-renders.
function initShapes(sim: Sim) {
  const rng = mulberry32(0x9e3779b1);
  for (let i = 0; i < NMAX; i++) {
    sim.varR[i] = 0.86 + rng() * 0.28;
    sim.ovalX[i] = 0.94 + rng() * 0.16;
    sim.ovalZ[i] = 0.94 + rng() * 0.16;
    sim.flatV[i] = 0.9 + rng() * 0.22;
    sim.color[i] = Math.floor(rng() * GUMMY_HEX.length);
  }
}

// Place a gummy at the pour chute (just above the visible neck) with a small
// random offset and a downward kick + a little tumble.
function spawn(sim: Sim, i: number, fullHeight: number, baseR: number) {
  const rng = mulberry32((i * 2654435761) ^ 0x85ebca6b);
  const ang = rng() * Math.PI * 2;
  const rad = rng() * WALL * 0.5; // pour near the centre of the neck
  sim.x[i] = Math.cos(ang) * rad;
  sim.z[i] = Math.sin(ang) * rad;
  const topScaled = fullHeight / FLAT + 1.5 + rng() * 1.2; // above the view
  sim.sy[i] = topScaled;
  // Implicit velocity: previous position above → moving downward.
  sim.px[i] = sim.x[i] + (rng() - 0.5) * 0.02;
  sim.pz[i] = sim.z[i] + (rng() - 0.5) * 0.02;
  sim.psy[i] = sim.sy[i] + FALL_V0;
  sim.rf[i] = baseR * sim.varR[i] * 0.4; // grows to full as it pours
  sim.rx[i] = (rng() - 0.5) * 1.0;
  sim.ry[i] = rng() * Math.PI * 2;
  sim.rz[i] = (rng() - 0.5) * 1.0;
  sim.ax[i] = (rng() - 0.5) * 0.4;
  sim.ay[i] = (rng() - 0.5) * 0.5;
  sim.az[i] = (rng() - 0.5) * 0.4;
  sim.grow[i] = 0.0001;
  sim.active[i] = 1;
  sim.alive[i] = 1;
}

// ──────────────────────────────────────────────────────────────────────────
// Camera — orthographic, straight-on, floor pinned to the bottom edge.
// View spans x ∈ [-HX, HX], y ∈ [0, fullHeight].
//
// IMPORTANT: <Canvas> ships an automatic resize handler that, for orthographic
// cameras, rewrites left/right/top/bottom every time the canvas resizes
// (default: ±width/2, ±height/2 in *pixels*). Inside the SVG <foreignObject>,
// picking a different bottle resizes the canvas, which would clobber our
// world-unit frustum and shove every gummy off-screen — and because nothing
// later puts our values back, swapping bottles again would not recover them.
// We mark the camera `manual` so R3F leaves it alone, then re-assert the
// frustum every frame as a belt-and-braces safety net.
// ──────────────────────────────────────────────────────────────────────────
function applyCameraBounds(cam: THREE.OrthographicCamera, fullHeight: number) {
  cam.left = -HX;
  cam.right = HX;
  cam.top = fullHeight;
  cam.bottom = 0;
  cam.near = -50;
  cam.far = 50;
  cam.zoom = 1;
  cam.updateProjectionMatrix();
}

function CameraRig({ fullHeight }: { fullHeight: number }) {
  const { camera } = useThree();
  // Apply synchronously (before paint) so the very first render uses the
  // correct frustum, and mark `manual` so R3F's resize handler is a no-op.
  useLayoutEffect(() => {
    const cam = camera as THREE.OrthographicCamera & { manual?: boolean };
    cam.manual = true;
    cam.position.set(0, 0, 12);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    applyCameraBounds(cam, fullHeight);
  }, [camera, fullHeight]);

  // Re-assert each frame in case anything (R3F resize, devtools, etc.) tries
  // to overwrite the frustum after we set it. This is cheap (six assignments
  // and one matrix update) and guarantees gummies stay visible across every
  // bottle/preset swap.
  useFrame(() => {
    const cam = camera as THREE.OrthographicCamera;
    if (
      cam.left !== -HX ||
      cam.right !== HX ||
      cam.top !== fullHeight ||
      cam.bottom !== 0
    ) {
      applyCameraBounds(cam, fullHeight);
    }
  });

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// The live pile.
// ──────────────────────────────────────────────────────────────────────────
function Pile({
  count,
  baseR,
  fullHeight,
  runId,
}: {
  count: number;
  baseR: number;
  fullHeight: number;
  runId: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const palette = useMemo(() => GUMMY_HEX.map((h) => new THREE.Color(h)), []);

  const sim = useMemo(() => {
    const s = createSim();
    initShapes(s);
    return s;
  }, []);
  const lastRun = useRef(runId);

  // Spatial hash buckets reused each frame (avoids per-frame allocation).
  const grid = useMemo(() => new Map<number, number[]>(), []);

  // Stable instance colours.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < NMAX; i++) mesh.setColorAt(i, palette[sim.color[i]]);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = NMAX;
  }, [sim, palette]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const target = Math.max(0, Math.min(NMAX, Math.round(count)));

    // "Run prediction" → re-pour: retire everyone so the stream replays.
    if (lastRun.current !== runId) {
      lastRun.current = runId;
      for (let i = 0; i < NMAX; i++) {
        sim.active[i] = 0;
        sim.alive[i] = 0;
        sim.grow[i] = 0;
      }
    }

    // ── Population control ────────────────────────────────────────────────
    let nActive = 0;
    for (let i = 0; i < NMAX; i++) if (sim.active[i]) nActive++;

    if (nActive < target) {
      // Pour more in — a few per frame so it streams like a real fill.
      let toSpawn = Math.min(SPAWN_RATE, target - nActive);
      for (let i = 0; i < NMAX && toSpawn > 0; i++) {
        if (!sim.alive[i]) {
          spawn(sim, i, fullHeight, baseR);
          toSpawn--;
        }
      }
    } else if (nActive > target) {
      // Remove from the top down: retire the highest active gummies.
      let toRemove = nActive - target;
      while (toRemove > 0) {
        let hi = -1;
        let hiY = -Infinity;
        for (let i = 0; i < NMAX; i++) {
          if (sim.active[i] && sim.sy[i] > hiY) {
            hiY = sim.sy[i];
            hi = i;
          }
        }
        if (hi < 0) break;
        sim.active[hi] = 0; // keeps alive=1 → shrinks out, then frees its slot
        toRemove--;
      }
    }

    // ── Integrate (Verlet) ───────────────────────────────────────────────
    for (let i = 0; i < NMAX; i++) {
      if (!sim.active[i]) continue;
      // Ease the collision radius toward its live target (smooth resize).
      const rTarget = baseR * sim.varR[i];
      sim.rf[i] += (rTarget - sim.rf[i]) * RF_K;

      const nx = sim.x[i] + (sim.x[i] - sim.px[i]) * DAMP;
      const nz = sim.z[i] + (sim.z[i] - sim.pz[i]) * DAMP;
      const ny = sim.sy[i] + (sim.sy[i] - sim.psy[i]) * DAMP - GRAV;
      sim.px[i] = sim.x[i];
      sim.pz[i] = sim.z[i];
      sim.psy[i] = sim.sy[i];
      sim.x[i] = nx;
      sim.z[i] = nz;
      sim.sy[i] = ny;
    }

    // ── Resolve contacts (project constraints several times) ─────────────
    let maxR = baseR;
    for (let i = 0; i < NMAX; i++)
      if (sim.active[i] && sim.rf[i] > maxR) maxR = sim.rf[i];
    const cell = Math.max(2 * maxR, 0.05);
    const keyOf = (ix: number, iy: number, iz: number) =>
      ix * 73856093 + iy * 19349663 + iz * 83492791;

    for (let it = 0; it < ITERS; it++) {
      // Rebuild the spatial hash for current positions.
      grid.clear();
      for (let i = 0; i < NMAX; i++) {
        if (!sim.active[i]) continue;
        const k = keyOf(
          Math.floor(sim.x[i] / cell),
          Math.floor(sim.sy[i] / cell),
          Math.floor(sim.z[i] / cell)
        );
        const b = grid.get(k);
        if (b) b.push(i);
        else grid.set(k, [i]);
      }

      // Pairwise non-penetration.
      for (let i = 0; i < NMAX; i++) {
        if (!sim.active[i]) continue;
        const gx = Math.floor(sim.x[i] / cell);
        const gy = Math.floor(sim.sy[i] / cell);
        const gz = Math.floor(sim.z[i] / cell);
        for (let ox = -1; ox <= 1; ox++)
          for (let oy = -1; oy <= 1; oy++)
            for (let oz = -1; oz <= 1; oz++) {
              const b = grid.get(keyOf(gx + ox, gy + oy, gz + oz));
              if (!b) continue;
              for (const j of b) {
                if (j <= i) continue;
                let dx = sim.x[j] - sim.x[i];
                let dy = sim.sy[j] - sim.sy[i];
                let dz = sim.z[j] - sim.z[i];
                const sum = sim.rf[i] + sim.rf[j];
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 >= sum * sum) continue;
                let d = Math.sqrt(d2);
                if (d < 1e-6) {
                  dx = (((i * 7 + j) % 5) - 2) * 0.01;
                  dz = (((i * 3 + j) % 5) - 2) * 0.01;
                  dy = 0.02;
                  d = Math.hypot(dx, dy, dz) || 1;
                }
                const push = (sum - d) * 0.5;
                const nxp = (dx / d) * push;
                const nyp = (dy / d) * push;
                const nzp = (dz / d) * push;
                sim.x[i] -= nxp;
                sim.sy[i] -= nyp;
                sim.z[i] -= nzp;
                sim.x[j] += nxp;
                sim.sy[j] += nyp;
                sim.z[j] += nzp;
              }
            }
      }

      // Floor + cylindrical wall.
      for (let i = 0; i < NMAX; i++) {
        if (!sim.active[i]) continue;
        if (sim.sy[i] < sim.rf[i]) sim.sy[i] = sim.rf[i];
        const rad = Math.hypot(sim.x[i], sim.z[i]);
        const maxr = WALL - sim.rf[i];
        if (rad > maxr && rad > 1e-6) {
          const s = maxr / rad;
          sim.x[i] *= s;
          sim.z[i] *= s;
        }
      }
    }

    // ── Orientation: tumble while moving, ease to rest when settled ──────
    for (let i = 0; i < NMAX; i++) {
      if (!sim.alive[i]) continue;
      const vx = sim.x[i] - sim.px[i];
      const vy = sim.sy[i] - sim.psy[i];
      const vz = sim.z[i] - sim.pz[i];
      const speed = Math.hypot(vx, vy, vz);
      // Falling pieces keep spinning; settled pieces lose their spin.
      sim.ax[i] *= SPIN_DAMP;
      sim.ay[i] *= SPIN_DAMP;
      sim.az[i] *= SPIN_DAMP;
      if (speed > 0.012) {
        sim.ax[i] += vz * 0.4;
        sim.az[i] -= vx * 0.4;
      }
      sim.rx[i] += sim.ax[i];
      sim.ry[i] += sim.ay[i];
      sim.rz[i] += sim.az[i];
    }

    // ── Write instance transforms; free fully-shrunk retired slots ───────
    for (let i = 0; i < NMAX; i++) {
      if (sim.active[i]) {
        sim.grow[i] += (1 - sim.grow[i]) * GROW_K;
      } else if (sim.alive[i]) {
        sim.grow[i] += (0 - sim.grow[i]) * SHRINK_K;
        if (sim.grow[i] < 0.02) {
          sim.alive[i] = 0;
          sim.grow[i] = 0;
        }
      }

      const g = sim.grow[i];
      if (g <= 0.0001) {
        dummy.scale.set(0, 0, 0);
        dummy.position.set(0, -999, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const rf = sim.rf[i];
      dummy.position.set(sim.x[i], sim.sy[i] * FLAT, sim.z[i]);
      dummy.rotation.set(sim.rx[i], sim.ry[i], sim.rz[i]);
      dummy.scale.set(
        2 * rf * sim.ovalX[i] * g,
        2 * rf * FLAT * sim.flatV[i] * g,
        2 * rf * sim.ovalZ[i] * g
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = NMAX;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[GUMMY_GEOMETRY, undefined, NMAX]}
      frustumCulled={false}
    >
      <meshPhysicalMaterial
        roughness={0.38}
        metalness={0}
        clearcoat={0.7}
        clearcoatRoughness={0.32}
        sheen={0.45}
        sheenColor={"#bcd4ff"}
      />
    </instancedMesh>
  );
}

export default function GummyFill3D({
  count,
  fillFraction,
  aspect,
  runId,
}: Props) {
  // Visible world height that maps to the clipped fill region (width = 2·HX).
  const fullHeight = (2 * HX) / Math.max(0.2, aspect);

  // Size each gummy from its TRUE volume so that `count` pieces settling at the
  // poured packing fraction PHI fill exactly to the predicted line — no
  // stretching, no per-bottle fudging.
  //   pile bulk volume  = count · (4/3)π·rf³·FLAT / PHI = π·WALL² · targetHeight
  //   ⇒ rf = ∛( 3·PHI·WALL²·targetHeight / (4·count·FLAT) )
  // targetHeight = fillFraction · fullHeight, and the camera maps that height to
  // the same canvas fraction the fill marker uses, so the settled top lands on
  // the predicted-fill line in EVERY bottle. Because the surrogate model makes
  // fill height ∝ count, rf is ~constant as count changes (the pile just grows
  // taller) and only shifts with the gummy preset or bottle size.
  const baseR = useMemo(() => {
    const targetH = Math.max(0.06, Math.min(1.18, fillFraction)) * fullHeight;
    const n = Math.max(5, count);
    const rFit =
      Math.cbrt((3 * PHI * WALL * WALL * targetH) / (4 * n * FLAT)) * PACK_TUNE;
    return Math.max(0.055, Math.min(0.3, rFit));
  }, [fillFraction, fullHeight, count]);

  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      camera={{ position: [0, 0, 12], zoom: 1, near: -50, far: 50 }}
    >
      <CameraRig fullHeight={fullHeight} />
      {/* Soft, glossy candy lighting. */}
      <ambientLight intensity={0.82} />
      <directionalLight position={[-4, 8, 6]} intensity={1.45} />
      <directionalLight position={[5, 3, 4]} intensity={0.5} color="#cfe0ff" />
      <pointLight position={[0, -2, 6]} intensity={0.28} color="#ffffff" />
      <Pile
        count={count}
        baseR={baseR}
        fullHeight={fullHeight}
        runId={runId}
      />
    </Canvas>
  );
}
