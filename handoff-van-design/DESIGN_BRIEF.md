# Van Design Brief — Folio 2025

You are designing a **new van model** to replace the current car in this project. The engine (Three.js + Rapier physics) loads the model at runtime and wires specific meshes to code by **name**. This document explains exactly what the engine expects.

---

## 1. What to Deliver

A single `.glb` file (glTF 2.0 binary) named `default.glb`, plus an optional separate `defaultAntenna.glb` if the van has a removable antenna accessory.

Export settings:
- **Format:** glTF 2.0 Binary (`.glb`)
- **Up axis:** Y-up (Blender default on export)
- **Scale:** 1 unit = 1 meter
- **Apply transforms** before export (location, rotation, scale)
- Do NOT pack textures you don't need — most parts get materials replaced at runtime

---

## 2. Required Mesh Names (CRITICAL)

The code traverses the glTF scene and finds parts by matching mesh names. **If names don't match, parts won't work.** Names are case-sensitive (a `.001` suffix is OK).

| Mesh Name | Purpose | Notes |
|---|---|---|
| `bodyPainted` | Main van body shell | Gets painted at runtime (color replaced by shader). UV/material here is ignored. |
| `chassis` | Frame / underbody / fixed structural parts | Keeps its own material. |
| `wheelContainer` | Single wheel assembly | **Model ONE wheel only** — code clones it 4× and positions them. |
| &nbsp;&nbsp;└ `wheelSuspension` | Child of wheelContainer — suspension/spring visual | Optional. |
| &nbsp;&nbsp;└ `wheelCylinder` | Child of wheelContainer — hub/cylinder | Optional. |
| &nbsp;&nbsp;└ `wheelPainted` | Child of wheelContainer — rim/painted portion | Gets painted at runtime. |
| `blinkerLeft` | Left turn signal light mesh | Small, emissive-style. |
| `blinkerRight` | Right turn signal light mesh | |
| `stopLights` | Brake lights (rear) | |
| `backLights` | Reverse/tail lights (rear) | |
| `antenna` | Antenna base (optional — can live in separate `defaultAntenna.glb`) | |
| `antennaHead` | Tip of antenna (animated) | |
| `cell1`, `cell2`, `cell3` | Boost/energy cells (3 small meshes) | |
| `energy` | Energy core mesh | |

**Keep the hierarchy:** `wheelContainer` must be a parent with `wheelSuspension`, `wheelCylinder`, and `wheelPainted` as children so they rotate together.

---

## 3. Dimensions (Match the Physics Collider)

The physics engine uses a hardcoded collider shape. Keep the van's body roughly within these half-extents (meters):

- **Main body:** 1.3 × 0.4 × 0.85 half-extents (full size ~2.6 × 0.8 × 1.7 m)
- **Top section** (cab/roof): 0.5 × 0.15 × 0.65 half-extents, offset +0.4m up
- **Bumper:** 1.5 × 0.5 × 0.9 half-extents, offset +0.1m forward
- **Wheels:** radius 0.4 m
- **Wheel positions:** (±0.90, 0, ±0.75) — wheelbase ~1.8m, track ~1.5m

The van can be slightly larger than a car — the developer can tune collider values later. Aim for the ballpark above so driving feel stays similar.

**Orientation:** Forward is +X, up is +Y, right is +Z. Confirm by opening `default.glb` in Blender.

---

## 4. Style Reference

- **Low-poly, flat-shaded** — match the look of the existing `default.glb` and the terrain inside `folio-2025.blend`.
- Keep poly count reasonable (a few thousand tris for the whole vehicle).
- Simple, bold shapes — no fine detail; it reads from a distance.
- Colors on `bodyPainted` and `wheelPainted` are overridden at runtime (red, orange, white, black, flames, abyssal, etc.), so base material there doesn't matter — just keep clean UVs.
- For `chassis`, lights, and other non-painted parts, use whatever materials/colors you like — those are preserved.

---

## 5. Files Included

- `resources/folio-2025.blend` — **Main Blender project.** Contains the existing car, terrain, and full scenery. Open this to understand the style and see the original car setup.
- `resources/models/bruno-sudo.blend` — Character model (extra style reference).
- `static/vehicle/default.glb` — Current car, exported (reference for naming/hierarchy/scale).
- `static/vehicle/defaultAntenna.glb` — Current antenna accessory.
- `static/vehicle/oldSchool.glb` — Alternate car variant (extra style reference).
- `*-compressed.glb` — Draco-compressed production builds (same content, don't edit).

---

## 6. Checklist Before Delivery

- [ ] File exported as `default.glb` (glTF 2.0 Binary)
- [ ] All required mesh names present and correctly spelled
- [ ] `wheelContainer` contains only ONE wheel
- [ ] `wheelContainer` hierarchy has `wheelSuspension` / `wheelCylinder` / `wheelPainted` as children
- [ ] Transforms applied (Ctrl+A → All Transforms)
- [ ] Scale in meters, Y-up, forward = +X
- [ ] Body fits roughly within dimensions in section 3
- [ ] Open the GLB in https://gltf-viewer.donmccurdy.com/ to verify it loads cleanly

---

## 7. Questions?

If anything about naming, hierarchy, or dimensions is unclear, ask before starting modeling — getting the structure right up front saves rework.
