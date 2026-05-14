# Map Design Brief — Race-Focused Map (v3)

## Overview

This is a car-racing game built with Three.js + Rapier. The main event is the **circuit race**. The current map is 192 × 192 units and contains many interactive areas that are being removed to focus on the race. We need to **trim the map** — remove unused areas, cut excess terrain on the east side, and create a clean island surrounded by water.

The runtime engine loads several `.glb` files and wires meshes to code **by name**. This brief explains exactly what to keep, what to remove, and what to deliver.

---

## 1. What to Keep vs. Remove

### Areas to KEEP (3 of 12)

Only these three interactive areas remain. Everything about them — geometry, position, physics, references — must stay untouched.

| Area | Position (X, Z) | Notes |
|---|---|---|
| **Landing** | (49.3, 38.5) | Default spawn point. Players start here. |
| **Circuit** | (−17.7, 7.1) | The race track — core of the game. |
| **Time Machine** | (−54.5, −67.4) | Keep as-is. |

### Areas to REMOVE (9 of 12)

Delete these from `areas.glb`. Remove their geometry, physics bodies, references, and all child objects.

| Area | Position (X, Z) |
|---|---|
| Career | (25.8, −0.9) |
| Projects | (35.8, 13.4) |
| Lab | (13.1, 17.7) |
| Social | (28.9, −21.8) |
| Achievements | (70.6, 9.9) |
| Bowling | (2.3, 68.9) |
| Behind the Scene | (52.5, −12.0) |
| Altar | (75.3, −27.9) |
| Cookie | (12.3, 35.3) |

Also remove any `toilet` or `easter` sub-areas that belong to removed areas.

### The Road

**Keep the full road loop exactly as-is** — geometry, position, scale, orientation, name (`refRoad`). Do not trim, reshape, or modify it in any way. The road's world-space bounding box spans roughly:

- X: −84 → +62
- Z: −88 → +76

---

## 2. Terrain Trimming

### What to cut

Trim the terrain mesh so it **follows the road shape** with a generous buffer (~15–25 m around the road footprint). Use your judgement for pleasant framing.

Additionally, **cut excess terrain on the east side of the map** — roughly everything past **X ≈ +50**. The Landing area is at X ≈ 49, so ensure there is enough terrain around it, but beyond that it can be cut.

### Edge treatment

Surround the remaining landmass with **water** — a clean island look. The terrain should end and give way to water at the edges. Handle the transition however looks best (cliff into water, gentle slope, etc.).

### Rules

- The terrain must remain **a single mesh at the scene root** — the engine reads `scene.children[0].geometry`.
- Do not raise terrain above the road surface.
- Do not change terrain height where the road sits on it.
- Keep terrain, grass, and water style inside the kept region.

---

## 3. Scenery & Props

### Inside the kept region

Keep all scenery objects (bridges, rocks, slabs, cubes) and prop reference meshes that fall **within the road footprint + buffer** or within ~10 m of the road.

### Outside the kept region

Remove scenery props, decorations, and reference meshes that fall outside the kept region. When reference meshes for instanced props (trees, fences, bushes, etc.) are removed from `scenery.glb`, the instancer automatically stops placing them — you do not need to edit individual prop files.

### Critical: keep `refRoad`

The road reference mesh must remain named `refRoad` (or `referenceRoad`). Code resolves it via:

```js
this.references.items.get('road')[0]
```

Any `ref*` / `reference*` named object **inside the kept region** must stay with its exact name and world transform.

---

## 4. Files to Modify

| File | What to do |
|---|---|
| `resources/folio-2025.blend` | Master scene — apply all changes here first. (Note: `.blend1` is just a Blender auto-backup. Ask if you only received `.blend1`.) |
| `static/scenery/scenery.glb` | Remove scenery/props outside the kept region. Keep `refRoad` and everything near the road. |
| `static/terrain/terrain.glb` | Trim terrain to the kept region. Single mesh at scene root. |
| `static/areas/areas.glb` | Remove the 9 areas listed in §1. Keep Landing, Circuit, Time Machine intact. |

### Current scenery.glb root nodes (for reference)

These are the 24 root-level objects currently in `scenery.glb`. Keep or remove based on position relative to the road:

```
bridgePhysicalFixed, bridgePhysicalFixed.001, Cube.157,
basaltRocksPhysicalStatic (×5), slabes, Cube.001, Cube.002,
refRoad [KEEP], Cuboid (×6), Cube.003 (×7)
```

---

## 5. Files to LEAVE UNTOUCHED

- `static/vehicle/*.glb` — the van
- `static/tornado/*.glb` — tornado path
- Individual prop source files under `static/birchTrees/`, `oakTrees/`, `cherryTrees/`, `bushes/`, `flowers/`, `bricks/`, `fences/`, `benches/`, `explosiveCrates/`, `lanterns/`, `poleLights/`, `playground/`
- `static/respawns/respawnsReferences.glb` — respawn points (code handles missing areas gracefully)

---

## 6. Export Settings

For every file you modify, deliver **both** the updated `.blend` source and the exported `.glb`.

- Format: glTF 2.0 Binary (`.glb`)
- Y-up, 1 unit = 1 m
- Apply transforms (location / rotation / scale) before export
- **"Custom Properties" must be enabled** in the glTF exporter — the engine reads `userData` flags like `prevent`, `mass`, etc.
- Do **not** rename any object you keep
- Do **not** change the hierarchy of objects you keep

After export, compressed versions (`*-compressed.glb`) are rebuilt by the project's own `scripts/compress.js` — you do not need to produce them.

---

## 7. Textures — Good News

Materials are **generated at runtime by shaders** (Three.js TSL nodes), not baked textures. So:

- Pink/missing textures in Blender viewport = **expected and harmless**
- You do **not** need to author, restore, or replace textures
- You do **not** need to recolor anything — shaders handle terrain, water, grass, and road appearance

Optional viewport preview textures (not required for delivery):

- `resources/textures/terrainGrass.exr`
- `resources/textures/terrainWater.exr`
- `resources/textures/terrainFurniture.exr`
- `resources/textures/slabs.png`
- `resources/textures/stylized-map.png`
- `static/terrain/terrain.png`
- `static/floor/slabs.png`

---

## 8. Physics / Collisions

Collision shapes, masses, and body kinds are stored in each object's **custom properties** (`userData`).

- Do **not** delete physics-only objects inside the kept region
- Do **not** clear custom properties on any kept object
- Do **not** change the transform of any kept object
- Objects outside the kept region can be deleted with their colliders
- When in doubt, **keep it**

---

## 9. Markers / Empties / Spawn Points

- **Inside the kept region:** preserve every Empty, named Empty, and marker at its current world coordinates
- **Outside the kept region:** safe to delete
- If an Empty is near the road — **do not delete it and do not move it**
- If unsure whether a marker is referenced elsewhere, flag it rather than delete it

---

## 10. Coordinate Reference Map

```
          Z = -96 (south)
              |
              |
  X = -96 ----+---- X = +96
  (west)      |      (east)
              |
          Z = +96 (north)

  World: 192 × 192 units, center at (0, 0, 0)

  KEPT AREAS:
    ★ Circuit ........... (-17.7,  7.1)
    ★ Landing ........... ( 49.3, 38.5)
    ★ Time Machine ...... (-54.5,-67.4)

  ROAD BBOX:
    X: -84 → +62
    Z: -88 → +76

  CUT LINE: ~X = +50 (trim east beyond this)
```

---

## 11. Checklist Before Sending

- [ ] Road mesh untouched: same geometry, same transform, still named `refRoad`
- [ ] `areas.glb`: only Landing, Circuit, Time Machine remain; 9 other areas removed
- [ ] `scenery.glb`: objects outside kept region removed; objects near road kept with original names, transforms, and `userData`
- [ ] `terrain.glb`: trimmed to kept region, single mesh at scene root, surrounded by water
- [ ] East side cut around X ≈ +50 (with buffer for Landing area)
- [ ] Props within ~10 m of the road kept regardless of cut zone
- [ ] Empties and markers inside kept region preserved
- [ ] Exported with **Custom Properties** enabled, Y-up, applied transforms
- [ ] Vehicle, tornado, respawns, and individual prop source files untouched
- [ ] Delivered: updated `.blend` source + updated `.glb` files at their original paths

---

## 12. How to Verify Locally

1. Drop the new `.glb` files into their paths.
2. `npm install` then `npm run dev`.
3. The car should spawn at Landing, the road should render with its glitter shader, and the circuit race should be fully drivable.
4. The map should appear as an island surrounded by water.
5. Landing, Circuit, and Time Machine areas should still be reachable.
6. If the car falls through the world or the road is invisible: the `refRoad` name was lost, a physics body was deleted, or terrain geometry is above the road.
