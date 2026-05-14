# Map Design Brief — Road-Only Map

You are simplifying the world so that **only the road remains visible**, with a minimal flat base underneath it. The runtime engine (Three.js + Rapier) loads several `.glb` files and wires meshes to code **by name**. This brief tells you exactly what to strip, what to keep, and what to deliver so that the game keeps running.

---

## 1. Goal

- Keep: **the road** (exact current layout) + a **minimal flat base** beneath it so the player doesn't see the void.
- Remove (visually): all props (trees, fences, benches, lanterns, bushes, flowers, pole lights, bricks, explosive crates, etc.), terrain/grass/water, buildings and scenery decoration.
- Do **not** redesign the road. Geometry, position, scale and orientation must stay identical.
- Do **not** touch interactive areas (projects, career, lab, bowling, playground, circuit, tornado, etc.). These live in a separate file — leave them untouched.
- Do **not** touch physics bodies / collision geometry. Only visual meshes change.

---

## 2. Deliverables

For every file you modify, deliver **both**:

1. The updated Blender source `.blend`.
2. The exported `.glb` (glTF 2.0 Binary) placed at the **same path and filename** as the current one (see table §3).

Export settings:
- Format: glTF 2.0 Binary (`.glb`)
- Y-up, 1 unit = 1 m
- Apply transforms (location/rotation/scale) before export
- Include custom properties (**"Custom Properties" must be enabled in the glTF exporter**) — the engine reads `userData` flags like `prevent`, `mass`, etc.
- Do **not** rename any object.
- Do **not** change object hierarchy for objects that remain.

After export, the compressed versions (`*-compressed.glb`) are rebuilt by the project's own `scripts/compress.js` — you do not need to produce them.

---

## 3. Files to Modify

| File | What to do |
|---|---|
| `resources/folio-2025.blend1` (master scene) | Apply the cleanup here first. |
| `static/scenery/scenery.glb` | **Edit heavily.** Remove all decorative scenery. Keep the `road` reference mesh (see §4). |
| `static/terrain/terrain.glb` | **Replace with a minimal flat base.** A single flat plane mesh covering the road footprint. One object, still at the root of the scene (Three.js reads `scene.children[0].geometry`). |

## 4. Files to LEAVE UNTOUCHED

Do **not** open, re-export, or modify:

- `static/areas/areas.glb` — interactive areas (projects, career, lab, bowling, playground, circuit, etc.).
- `static/vehicle/*.glb` — the van.
- `static/respawns/*.glb` — respawn points.
- `static/tornado/*.glb` — tornado path.
- Any of the instanced prop sources: `birchTrees/`, `oakTrees/`, `cherryTrees/`, `bushes/`, `flowers/`, `bricks/`, `fences/`, `benches/`, `explosiveCrates/`, `lanterns/`, `poleLights/`, `playground/`.

If a prop is physically present in `scenery.glb` you delete it from `scenery.glb`. The instanced prop files listed above still ship; the code will just place nothing because their reference meshes live inside files you are not modifying.

---

## 5. Critical Name to Preserve

Inside `scenery.glb`, the road mesh is found in code with:

```js
this.references.items.get('road')[0]
```

This comes from any object whose name starts with `ref` or `reference` followed by a capitalized token. So the road object **must** be named **`refRoad`** or **`referenceRoad`** (a `.001` suffix is tolerated, a different spelling is not). Do not rename it.

Any other `ref*` / `reference*` named objects that you encounter inside `scenery.glb` **must stay** with their exact names and world transforms — code elsewhere may resolve them.

---

## 6. Physics / Collisions — Do Not Touch

The project uses a custom Blender → Rapier pipeline. Collision shapes, masses, and body kinds are stored in each object's **custom properties** (`userData`) such as:

- `prevent` (skip object)
- `mass`
- and other physics flags the engine reads at runtime.

Rules:
- Do not delete physics-only objects (objects flagged as physical colliders even if they have no visible mesh).
- Do not clear custom properties on any object you keep.
- Do not change the transform of any object you keep.
- When in doubt, **keep the object and hide its visual**, rather than delete it.

A safe way to "remove" a visual without risk: delete only the visible child mesh of a group, keeping the parent empty/collider and its custom properties intact.

---

## 7. Markers / Empties / Spawn Points — Keep All

Preserve **every** Empty, named Empty, and marker at its current world coordinates. This includes (non-exhaustive):
- start position / spawn,
- respawn markers,
- interactive point locations,
- any `ref*` / `reference*` named node.

Rule of thumb: if it's an Empty, **do not delete it and do not move it**.

---

## 8. Minimal Flat Base (replacing terrain)

In `terrain.glb`:

- Replace the current terrain with a **single flat plane** (one mesh, at the root of the scene).
- Large enough to sit under the road with a small margin (e.g. road bounding box + ~10 m on each side).
- Y-position: just slightly **below** the road surface (e.g. road Y − 0.05 m) to avoid z-fighting.
- Simple material (single flat color is fine — the runtime may assign its own material).
- No UV tricks, no multi-material, no vertex colors required.
- Keep the mesh as `scene.children[0]` (first root child) — the engine reads exactly that.

---

## 9. Checklist Before Sending

- [ ] `scenery.glb`: only the road mesh + any `ref*`/`reference*` empties remain; all decorative meshes removed.
- [ ] The road mesh is still named `refRoad` (or `referenceRoad`).
- [ ] `terrain.glb`: a single flat plane at the root, sized to cover the road.
- [ ] All Empties and markers kept at original transforms.
- [ ] All kept objects still have their original custom properties (`userData`).
- [ ] No renames, no re-parenting, no transform changes to anything kept.
- [ ] Exported with **Custom Properties** enabled, Y-up, applied transforms.
- [ ] `areas.glb`, vehicle, respawns, tornado, and instanced prop files are untouched.
- [ ] Delivered: updated `.blend` source + updated `.glb` files at their original paths.

---

## 10. How to Verify Locally (optional)

1. Drop the new `.glb` files into their paths.
2. `npm install` then `npm run dev`.
3. The car should spawn, the road should render with its glitter shader, and you should be able to drive the full current circuit. Interactive areas should still be reachable at the same coordinates.
4. If the car falls through the world or the road is invisible: the `refRoad` name was lost, a physics body was deleted, or the terrain plane is above the road.
