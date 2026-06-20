# About — Biologistica Driving Game

This document is the onboarding/reference guide for this repository. Read it before making
changes. It explains what the project is, how it is built, how the game works, and where to
make the most common changes.

---

## 1. What this project is

A browser-based 3D driving game built for a company called **Biologistica**. The player drives
a vehicle around a small open world (an island) and can enter a **race** on a dedicated circuit.

It is a **fork of Bruno Simon's open-source `folio-2025`** (his interactive Three.js portfolio,
MIT-licensed). We are adapting that engine into the Biologistica game.

> ⚠️ **Branding is not done yet.** As of now the running game still shows Bruno Simon's original
> content (title "Bruno's", his projects, social links, console message, several portfolio
> areas). Re-skinning this for Biologistica is future work — see §13.

### The two modes
There is no separate "mode selector" screen. The two modes coexist in one continuous world and
are distinguished internally by the **input category** that is currently active:

| Mode | Internal name | What it is |
|---|---|---|
| **Free roam** | `wandering` | Default. Drive freely around the open island, explore areas, respawn with `R`. |
| **Race** | `racing` | Entering the **Circuit** area starts a timed race: countdown lights → checkpoints → finish, with timer and (optional) online leaderboard. |

Other input categories used by the engine: `intro` (loading/landing) and `cinematic`
(scripted camera moments). The race is implemented as one of the world's interactive **areas**
(`CircuitArea`), not as a globally separate game build.

---

## 2. Tech stack

| Concern | Technology |
|---|---|
| Rendering | **Three.js r0.183**, `WebGPURenderer` (WebGPU first, **WebGL2 fallback**), shaders written in **TSL** (Three.js Shading Language) |
| Physics | **Rapier 3D** (`@dimforge/rapier3d`, WASM) — vehicle, colliders, raycast suspension |
| Build/dev | **Vite 7** (+ `vite-plugin-wasm`, `vite-plugin-top-level-await`, `vite-plugin-node-polyfills`, `vite-plugin-restart`) |
| Animation | **GSAP** |
| Audio | **Howler** |
| Debug UI | **Tweakpane** (+ essentials & camerakit plugins) |
| Multiplayer/leaderboard | WebSocket + **msgpack-lite** + **uuid** (optional, off by default) |
| Asset pipeline | **@gltf-transform/cli**, **sharp**, KTX/Basis compression |
| Misc | `seedrandom` (deterministic randomness), `camera-controls`, `stats-gl` (monitoring) |

Hosting target: **Netlify** (`netlify.toml`; builds `npm run build`, publishes `dist/`,
sets `VITE_COMPRESSED=1`, serves `.wasm` with the correct MIME type).

---

## 3. Getting started

```bash
cp .env.example .env      # REQUIRED — the game breaks without it (see §14)
npm install --force       # --force is needed due to peer-dependency ranges
npm run dev               # dev server on http://localhost:1234 (auto-opens)
npm run build             # production build → dist/
npm run preview           # preview the production build
npm run compress          # (re)compress assets in static/ — see §11
```

Requires a recent Node (Netlify uses **Node 20**) and a **WebGPU- or WebGL2-capable browser**
(Chrome/Edge 113+ recommended).

### Environment variables (`.env`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | *(empty)* | WebSocket server for multiplayer/leaderboard. Empty = offline. |
| `VITE_ANALYTICS_TAG` | *(empty)* | Google Analytics tag. |
| `VITE_GAME_PUBLIC` | *(empty)* | If set, exposes the game instance as `window.game`. |
| `VITE_COMPRESSED` | *(empty)* | If set, loads compressed assets (`.ktx`, `-compressed.glb`) instead of `.png`/`.glb`. |
| `VITE_DAY_CYCLE_PROGRESS` | *(empty)* | Force time-of-day (0–1). |
| `VITE_YEAR_CYCLE_PROGRESS` | *(empty)* | Force season (0–1). |
| `VITE_WHISPERS_COUNT` | `30` | Number of "whisper" flame particles. |
| `VITE_MUSIC` | `1` | Enable background music autoplay. |
| `VITE_LOG` | `1` | Print the console banner on startup. |
| `VITE_PLAYER_SPAWN` | *(empty)* | Override spawn point by name, e.g. `landing`, `circuit`. |

---

## 4. Repository layout

```
folio-2025/
├── about.md                 # this file
├── readme.md                # original folio readme (setup, game-loop order, Blender export notes)
├── netlify.toml             # deploy config
├── vite.config.js           # root = sources/, publicDir = ../static/, outDir = ../dist
├── .env / .env.example      # runtime config (see §3)
├── scripts/compress.js      # asset compression pipeline (npm run compress)
├── handoff-van-design/      # design brief + assets for replacing the vehicle (see §11)
├── handoff-map-design/      # design brief + assets for trimming the map (see §11)
├── _designer-drop/          # drop zone for designer-provided model files
├── static/                  # served as-is: GLB models, textures (png/ktx), sounds, fonts, ui…
├── dist/                    # build output (generated)
└── sources/
    ├── index.html           # HTML shell: all overlay UI, menus, modals, intro markup (~57 KB)
    ├── index.js             # entry point → new Game()
    ├── threejs-override.js  # patches THREE.Object3D.copy to NOT clone userData (perf/physics flags)
    ├── style/               # Stylus stylesheets (.styl), compiled by Vite
    ├── data/                # content data: projects.js, lab.js, social.js, achievements.js, consoleLog.js, countries.js
    └── Game/                # all game code (see §5)
```

---

## 5. Architecture overview

### Singleton + access pattern
`Game` (`sources/Game/Game.js`) is a **singleton**. Almost every class starts with
`this.game = Game.getInstance()` and reaches siblings via `this.game.<system>` (e.g.
`this.game.player`, `this.game.physics`, `this.game.world.areas.circuit`). There is no DI
framework — wiring is by direct reference through the singleton.

### Boot sequence (`Game.init()`, async)
1. Create scene + early systems (debug, resources loader, quality, server, ticker, time, day/year cycles, inputs, audio, viewport, menu).
2. `await rendering.setRenderer()` (WebGPU/WebGL2).
3. Load **first** resource batch (respawn refs, palette, intro textures).
4. `world.step(0)` → grid + intro loading circle.
5. Load **second** resource batch **and** Rapier WASM in parallel (progress drives the intro circle).
6. Build physics, vehicle, zones, player, areas, interactive points, achievements, tornado, map, title.
7. `world.step(1)`, then overlay; `Reveal` plays the intro→play transition on first user click.

### The game loop (tick priority system)
`Ticker` runs systems every frame **in a fixed priority order** (lower number runs first). The
canonical ordering is documented in `readme.md` under **"Game loop"**. The important slots:

| Priority | Runs |
|---|---|
| 0 | Time, Inputs |
| 1 | Player **pre-physics** (reads inputs) |
| 2 | PhysicsVehicle pre-physics |
| 3 | **Physics step** (Rapier) |
| 4 | Physics wireframe, Objects sync |
| 5–6 | Vehicle/Player **post-physics** |
| 7 | View / camera |
| 8+ | Cycles, weather, zones, visual vehicle, world FX (grass, trails, water, foliage…) |
| 998 / 999 | Rendering / Monitoring |

When adding per-frame logic, subscribe with the right priority:
`this.game.ticker.events.on('tick', () => {…}, <priority>)`.

### World construction in stages
`World.step(n)` builds the world in phases: `step(0)` grid + intro; `step(1)` the vehicle visual,
terrain FX, props, and **all interactive `Areas`**; `step(2)` whispers. Visual props (trees,
flowers, fences, benches, bricks, lanterns…) are **instanced**.

---

## 6. Key systems reference (`sources/Game/`)

| File / folder | Responsibility |
|---|---|
| `Game.js` | Singleton, boot sequence, resource manifest, global `reset()`. |
| `Player.js` | Reads inputs, drives the vehicle, defines the **action map** (§8), respawn, **fall reset** (y < −5), distance/time stats. |
| `Physics/Physics.js` | Rapier world, collision categories/handling. |
| `Physics/PhysicsVehicle.js` | Vehicle controller: chassis body, 4 raycast wheels, steering/engine/brake/boost, **driving tuning constants** (§7). |
| `Physics/PhysicsWireframe.js` | Debug collider wireframes. |
| `Inputs/` | `Inputs.js` (action system + categories), `Keyboard.js`, `Gamepad.js`, `Pointer.js`, `Wheel.js`, `Nipple.js` (touch joystick), `InteractiveButtons.js`. |
| `World/World.js` | Staged world build, instanced props, FX. |
| `World/Areas/` | The interactive areas, incl. **`CircuitArea.js`** (the race). See §9. |
| `World/Building.js` | **"Biologistica Tower"** — a deliberately non-generic landmark tower in the circuit, centered between the two flag banners (`refBanners` @ z≈0.04 / `refBanners.001` @ z≈11.63). Shares the campus material language (blue curtain-wall glass with a tall sky-reflection gradient + white fins + concrete copings + red brand accent) but has a dynamic silhouette: a glass **podium** (corner pilasters, recessed entrance + canopy + wooden deck + planters), a three-tier **stepped/setback** tower with full-height vertical white fins, a **cantilevered sky-deck**, a **vertical red brand blade**, and a glass **crown** topped by a **spire + glowing red beacon**. The podium sign carries the real **Biologística wordmark** (`static/areas/biologisticaLogo.png`, loaded at runtime so it never blocks boot). Instantiated in `World.step(1)`; placed at `(-19.7, -0.2, 5.8)`, `rotationY ≈ 1.56`, `scale = 0.67` — adjust live (incl. scale) via the `🏢 Building` debug panel. Solid (fixed `object` collider), procedural; swap for a `.glb` later. |
| `World/BiologisticaOffice.js` | Separate, additional **Biologistica office**, modelled after the brand HQ render: two white **ribbon-window** blocks (medium left block + taller back tower, corner pilasters) flanking a forward, full-height **blue glass curtain-wall atrium** (white fins, sky-reflection gradient, **per-pane variation**, red brand fascia), with recessed glass doors + a dark lobby, a canopy on posts, a **wooden entrance deck + steps**, a **rooftop skylight ring**, rooftop units + **parapet railings**, planters/shrubs/bollards, and a paved **forecourt with two on-brand delivery vans** (solid colliders). The rooftop **red flag waves** (vertex animation off `ticker.elapsedScaledUniform`), and warm **windows light up at night** (`emissiveOrangeRadialGradient`, toggled off `dayCycles` `night`). The red facade sign carries the real **Biologística wordmark** (`static/areas/biologisticaLogo.png`, white-on-transparent decal loaded at runtime so it never blocks boot). An **interactive "Biologística" point** in front of the entrance (`game.interactivePoints.create`) opens the **"Sobre"** modal (`game.modals.open('sobre')`, markup in `index.html`). Instantiated in `World.step(1)`; placed at `(33.4, 0, 14)`, `rotationY ≈ 1.31`, half size (`scale = 0.5`) — adjust live (incl. scale) via the `🏥 Biologistica Office` debug panel. Procedural; swap for a `.glb` later. |
| `World/LabBuilding.js` | Low-poly research **laboratory** placed right next to the office and modelled on it: the same campus material language (white ribbon-window blocks + blue curtain-wall glass with sky-reflection gradient + concrete copings + recessed glass doors + canopy on posts + wooden deck + planters), the same massing (two white blocks flanking a forward full-height glass volume), and a rooftop skylight ring. It is the **experiments lab — no company branding**: identity comes from a glass **clean-room tower crowned with a glass dome + finial**, a grouped rooftop **equipment deck** (two exhaust stacks + chemical/water tank + HVAC + vents), and **teal** science accents with a white **lab flask emblem** (the regular lab icon) + a **medical cross**. Instantiated in `World.step(1)`; placed at `(35.2, 0, 7.1)`, `rotationY ≈ 1.31`, `scale = 0.5` (matching the office) — adjust live (incl. scale) via the `🧪 Lab Building` debug panel. Solid (fixed `object` collider), procedural; swap for a `.glb` later. |
| `World/Laptop.js` | Procedural **laptop prop** near the race track (aluminium MacBook-style deck + hinged lid). The screen shows the Biologistica logistics-tracking UI (`static/areas/laptopScreenBiologistica.png`, loaded at runtime so it never blocks boot, then swapped onto the screen mesh). Also spawns a **"Sistema" interactive point** (`game.interactivePoints.create`) in front of the screen, anchored off the laptop transform; pressing interact (Enter) opens the **"Biologística Software"** modal (`game.modals.open('sistema')`, markup in `index.html`, styles in `style/sistema.styl` — mocked placeholder content). Instantiated in `World.step(1)`; placed at `(26.3, 0, -19.2)`, `rotationY = 0.56`, `scale = 1.4` — adjust live (incl. scale) via the `💻 Laptop` debug panel. Solid (fixed `object` collider), procedural; swap for a `.glb` later. |
| `World/TransportBox.js` | Procedural **UN3373 biological-substance transport box** (a "friobox"-style blue cooler crate with a grey clip-on lid, white latches, reinforcement ribs + flared foot) placed near the circuit tower. The front carries the **UN3373 placard + "Biological substance category B"** label (`static/areas/transportBoxLabel.png`, a white-on-transparent decal generated with PIL, loaded at runtime so it never blocks boot). It is **removed from the world while a race is running and restored when the race ends** (`hide()`/`show()` via `game.objects.disable/enable`, called from `CircuitArea.restart()` / `finish()`). Clicking **"Coletar amostra!"** plays a **collect animation** (`collectInto()`, gsap) — the box arcs and shrinks into the vehicle (player locked) before the race starts. Instantiated in `World.step(1)`; placed at `(-14.5, 0, 5.9)`, `rotationY ≈ 0.89`, `scale = 1` — adjust live (incl. scale) via the `📦 Transport Box` debug panel. Solid (fixed `object` collider), procedural; swap for a `.glb` later. |
| `World/Fleet.js` | **Biologística fleet depot** — a circular paved lot (asphalt disc + perimeter curb ring + radial bay lines) with **eight on-brand delivery vans in a radial sunburst** (noses converging at the centre, tails fanned out, à la a fleet hero shot). The van is a real **CC-BY-4.0 cargo-van model** (`static/fleetVan/fleetVan.glb` — *"FedEx van" by memoov*, see credits) that we **rebrand to Biologística**: textures are stripped offline (removing the FedEx livery/logos + shrinking 26 MB → 0.56 MB Draco), geometry simplified (~293 k tris/van), then every material is re-coloured at runtime to the flat game palette (**white body, dark glass, black trim, silver wheels**), leftover FedEx logo meshes are hidden, and both flanks get the full **Biologística side livery** (wordmark + "Transportando Vidas" + "TRANSPORTAMOS" service list + heartbeat sweep — `static/areas/fleetVanDecal.png` + a second readable layout (`fleetVanDecalMirror.png`, wordmark on the other end) for the 180°-rotated flank, so it reads correctly and points nose-forward on both sides, loaded at runtime). The model is **lazily loaded** (`gltf` loader, `-compressed` in prod) so it never blocks boot, then **cloned into each bay** (front +Z rotated +90° → nose toward centre). Placed where the **original game's bowling area** used to sit — instantiated in `World.step(1)` at `(2.3, 0, 68.9)`, `rotationY = 0`, `scale = 1` — adjust live via the `🚐 Fleet` debug panel. Each van is a **rotation-aware** fixed `object` collider (per-collider `quaternion`) so the car can't drive through; colliders are built from `vanPlacements` independently of the async model. |
| `World/Areas/LandingLogo.js` | Replaces the original "BRUNO SIMON" landing letter blocks with the **Biologistica logo**, extruded from `biologistica-logo.svg` (raw import) via `SVGLoader` into a solid 3D sign. Removes the original letter objects (visual + physics). Placeholder for a future `.glb`; adjust live via the `🅱️ Logo` debug panel. Instantiated from `LandingArea.setLogo()`. |
| `References.js` | Resolves Blender meshes named `ref*`/`reference*` into a lookup Map (§10). |
| `Respawns.js` | Spawn points from `respawnsReferences.glb` (§10). |
| `Rendering.js` | WebGPU renderer + post-processing (bloom, DOF) in `Passes/`. |
| `Materials.js` / `Materials/` | TSL node materials (palette-based look). |
| `Cycles/` | `DayCycles.js`, `YearCycles.js` (time of day / seasons drive lighting & weather). |
| `Weather.js`, `Wind.js`, `Lighting`, `Fog.js`, `Water.js`, `Tornado.js` | Environment & atmosphere. |
| `Audio.js` | Howler-based registry; `audio.register({ path, volume, loop, … })`. |
| `Server.js` + `Events.js` | Optional WebSocket multiplayer/leaderboard (§12). |
| `Menu.js`, `Modals.js`, `Overlay.js`, `Title.js`, `Notifications.js`, `Tabs.js`, `Map.js` | UI layer (driven from `index.html`). |
| `Achievements.js`, `KonamiCode.js`, `Easter.js`, `BlackFriday/` | Extras / easter eggs (candidates for removal in the Biologistica build). |
| `Debug.js`, `Monitoring.js`, `Quality.js` | Tooling: Tweakpane panel, stats, quality tiers. |
| `ResourcesLoader.js` | GLB/texture loader used by the manifest in `Game.js`. |

---

## 7. Driving & vehicle tuning

The "feel" of the car lives in **`Physics/PhysicsVehicle.js`** (constructor). Current values:

| Property | Value | Meaning |
|---|---|---|
| `steeringAmplitude` | `0.5` | Max steering angle (rad). |
| `engineForceAmplitude` | `300` | Acceleration force. |
| `boostMultiplier` | `2` | Force multiplier while boosting. |
| `topSpeed` | `5` | Normal top speed. |
| `topSpeedBoost` | `40` | Top speed while boosting. |
| `brakeAmplitude` | `35` | Braking force. |
| `idleBrake` | `0.06` | Auto-brake when coasting. |
| `reverseBrake` | `0.4` | Brake before reversing. |
| `suspensionsHeights` | `{low:0.88, mid:1.23, high:1.63}` | Ride-height presets (player can switch). |
| `suspensionsStiffness` | `{low:20, mid:30, high:40}` | Spring stiffness presets. |

All of these are exposed as live sliders in the **debug panel** (§4 of tooling). The collider
shape is hard-coded in the physics setup — if the vehicle model changes, match the dimensions in
the **van design brief** (`handoff-van-design/DESIGN_BRIEF.md`, §3).

**Fall safety:** `Player.updatePostPhysics()` teleports the car back to `basePosition` when
`position.y < -5`. Removing this check causes a Rapier WASM crash when the car falls off the map.

---

## 8. Controls (action map)

Defined in `Player.js` (`inputs.addActions([...])`). Each action lists the input categories it is
active in (`wandering` = free roam, `racing` = race) and its bindings:

| Action | Keyboard | Gamepad | Active in |
|---|---|---|---|
| forward | `↑` / `W` | dpad-up / R2 | wandering, racing, cinematic |
| backward | `↓` / `S` | dpad-down / L2 | wandering, racing, cinematic |
| left | `←` / `A` | dpad-left | wandering, racing, cinematic |
| right | `→` / `D` | dpad-right | wandering, racing, cinematic |
| boost | `Shift` | ○ (circle) | wandering, racing |
| brake | `B` / `Ctrl` | □ (square) | wandering, racing |
| respawn | `R` | Select | wandering only |
| suspensions | `Space` / `Numpad5` | △ (triangle) | wandering, racing |
| suspensionsFront | `Numpad8` | — | wandering, racing |

Touch devices use the on-screen **nipple** joystick (`Inputs/Nipple.js`) and interactive buttons.

---

## 9. The race (CircuitArea)

`sources/Game/World/Areas/CircuitArea.js` implements the race as a state machine:

```
STATE_PENDING → STATE_STARTING → STATE_RUNNING → STATE_ENDING
```

Pieces it sets up: sounds (countdown / checkpoint / finish / applause), start position &
starting lights, **timer**, **checkpoints** (reached in order; last one = finish line),
obstacles, rails/bounds, the road, banners/air-dancers, an interactive "Coletar amostra!" prompt,
an **end modal**, a **leaderboard**, and a **podium**. Geometry/positions are read from the
map by **reference name** (e.g. `start`, `startingLights`, `checkpoint…`, `road`).

- Race spawn point is named **`circuit`** (`respawns.getByName('circuit')`).
- On finish, if the server is connected, results post to the leaderboard and the `circuit-end`
  modal opens.
- Times are formatted via `utilities/time.js` (`timeToRaceString`).
- The two sponsor **tents** (the WebGL / WebGPU canopies) are rebranded to **Biologistica** at
  runtime by `setTentLogos()`. Rather than editing the GLB, it swaps the *image* of the textures
  the `circuitWebgl` / `circuitWebgpu` materials sample (`static/circuit/tent-logo-webgl.png` /
  `tent-logo-webgpu.png`, brand-red logo on the canopy's `#463f35` background). The canopy uses a
  **planar UV unwrap**: only the road-facing front slope samples the full texture, while the other
  roof slopes sample just the lower texture band (V < ~0.40). A centered logo therefore smears its
  lower edge onto the side slopes as **"stripes"**. To avoid this, each PNG composites the logo into
  the **front-only band** (V ≈ 0.48–0.93; i.e. the lower portion of the image), horizontally centred
  with margins so the clamped texture edges stay background. The WebGPU logo is authored ~1.5× wider
  in texture space (its canopy tiles ~1.5× more) so both tents read at a matching on-screen size — no
  runtime UV scaling is used. To re-skin: replace those two PNGs (keep dims 256×128 / 128×128, the
  `#463f35` background, and the logo within the V ≈ 0.48–0.93 band).

To tune the race, edit checkpoint handling, timer, and `finish()` in this file; to move the
track, edit the corresponding reference meshes in `static/areas/areas.glb` (§10–11).

---

## 10. Content wiring conventions (IMPORTANT)

Geometry is authored in Blender and **wired to code by mesh name**. Three conventions matter:

### a) Areas
`World/Areas/Areas.js` holds a list mapping a **name prefix → Area class**. At load it walks the
children of `areasModel` (`static/areas/areas.glb`) and instantiates the matching class for any
child whose name `startsWith` a registered prefix. Current areas: `achievements`, `altar`,
`behindTheScene`, `bowling`, `career`, **`circuit`**, `cookie`, `lab`, **`landing`** (default
spawn), `projects`, `social`, `toilet`, `timeMachine`.
*To add/remove an area: edit this list **and** the `areas.glb` model.*

### b) References (`References.js`)
Any mesh named `ref*` or `reference*` is parsed into a Map. Example: a road mesh named `refRoad`
is fetched with `this.references.items.get('road')[0]`. The trailing capitalization/number rules
are in `References.js`. **Renaming a `ref*` mesh in Blender will break the code that looks it up.**

### c) Respawns (`Respawns.js`)
Children of `static/respawns/respawnsReferences.glb` named `respawn*` become spawn points
(`landing`, `circuit`, …). Default is `landing`; override with `VITE_PLAYER_SPAWN`.

---

## 11. Asset pipeline & Blender conventions

- `static/` is served verbatim (Vite `publicDir`). Models are **GLB**; textures are **PNG** (dev)
  or **KTX/Basis** + `-compressed.glb` (production, gated by `VITE_COMPRESSED`).
- **`npm run compress`** (`scripts/compress.js`) traverses `static/`, compresses GLB textures and
  PNG/JPG to GPU-friendly KTX (and UI images to WebP), writing **new** files so originals are kept.
  Designers deliver uncompressed; the pipeline produces the compressed variants.
- Blender export notes (originals) are in `readme.md` ("Blender" section): mute the palette
  texture node, use export presets, no compression on export, **enable Custom Properties** (the
  engine reads `userData` flags such as `prevent`, `mass`).

### Design handoff briefs (read these before changing models)
- **`handoff-van-design/DESIGN_BRIEF.md`** — replacing the vehicle. Lists the **required mesh
  names** (`bodyPainted`, `chassis`, `wheelContainer` + children `wheelSuspension`/`wheelCylinder`/
  `wheelPainted`, `blinkerLeft/Right`, `stopLights`, `backLights`, `antenna`/`antennaHead`,
  `cell1..3`, `energy`) and **collider dimensions** to match. Output: `static/vehicle/default.glb`.
- **`handoff-map-design/MAP_BRIEF.md`** — trimming the map. Explains the 192×192 world, which
  areas to keep/remove, the `refRoad` rule, terrain-as-single-mesh-at-root requirement, and that
  **materials are generated at runtime via TSL shaders** (missing/pink textures in Blender are
  expected). Files: `static/areas/areas.glb`, `static/terrain/terrain.glb`, `static/scenery/scenery.glb`.

---

## 12. Multiplayer / leaderboard server (optional)

`Server.js` opens a WebSocket to `VITE_SERVER_URL` (binary, msgpack-lite) and assigns a
`localStorage` UUID per visitor. It powers other players' ghosts and the circuit leaderboard.
**It is off by default** — with no `VITE_SERVER_URL` the game runs fully offline and the document
gets the `is-server-offline` class. The original folio's server code is not public; you would
provide your own endpoint for Biologistica.

---

## 13. Branding: current state & where to change it

The game is **not yet rebranded**. To convert it from "Bruno Simon's folio" to "Biologistica":

| What | Where |
|---|---|
| Page title, meta/OG/Twitter tags, favicon name | `sources/index.html` (top `<head>`) |
| In-world UI copy, overlay panels, credits, modals | `sources/index.html` (large body section) |
| Dynamic document title | `sources/Game/Title.js` |
| Projects / lab / social / console content | `sources/data/projects.js`, `lab.js`, `social.js`, `consoleLog.js` |
| Favicons & social share image | `static/favicons/`, `static/social/` |
| Vehicle model | `static/vehicle/` (see van brief) |
| Map / areas | `static/areas/`, `static/terrain/`, `static/scenery/` (see map brief) |
| Portfolio-specific areas to drop | `World/Areas/` + `Areas.js` list (e.g. career, projects, lab, behindTheScene, altar, bowling, cookie, achievements) |

> The original work is **MIT-licensed (Copyright © 2025 Bruno Simon, `license.md`)**. Keep the
> attribution/notice as required by the MIT license when redistributing.
>
> **Third-party asset:** the fleet-depot van (`static/fleetVan/fleetVan.glb`) is derived from
> **"FedEx van" by memoov** (https://sketchfab.com/3d-models/fedex-van-554a6a4d30d342f2aca8735aaa69f954),
> licensed **CC-BY-4.0** (https://creativecommons.org/licenses/by/4.0/). We modified it (stripped all
> textures incl. the FedEx livery/logos, re-coloured to the Biologística palette, simplified geometry).
> Per CC-BY, **keep this credit** when redistributing.

---

## 14. Common gotchas / troubleshooting

- **Blank screen / `NaN` errors on boot** → missing `.env`. Run `cp .env.example .env`.
- **Dev server on wrong port** → a stale Vite process holds `1234`; find with `lsof -i :1234 -t`
  and `kill <PID>`. Port is set in `vite.config.js`.
- **Tab crashes after falling off the map** → don't remove the `position.y < -5` reset in
  `Player.js`; Rapier WASM panics on extreme values.
- **Renderer init errors (`getSupportedExtensions` null)** → no WebGPU/WebGL2 (e.g. headless).
  `Game.init()` is async with no try/catch, so failures surface as unhandled rejections.
- **A kept Blender object stopped working** → a `ref*`/area-prefix/`respawn*` name was changed,
  or Custom Properties weren't exported. Names are the contract (§10–11).
- **`npm install` fails** → use `npm install --force` (peer-dependency ranges).

---

## 15. Branches & upstream

| Remote / branch | Meaning |
|---|---|
| `origin` = `stratorenan/bio-game` | This project's repo. |
| `upstream` = `brunosimon/folio-2025` | The original open-source folio we forked (MIT). Pull engine improvements from here. |
| **`main`** | **Canonical branch / source of truth.** Full engine + all 12 original areas (Circuit = the race embedded in free roam). |
| `Race` | Experimental, stripped-down race-only build (most non-race areas/systems removed, island + water, troubleshooting/architecture notes). Useful reference for "what a trimmed Biologistica build looks like", but **not** the source of truth. |

---

## 16. "How do I…" quick map

- **Change how the car drives** → `Physics/PhysicsVehicle.js` constants (§7); test with `#debug`.
- **Change controls** → action map in `Player.js` (§8).
- **Edit the race (checkpoints/timer/finish)** → `World/Areas/CircuitArea.js` (§9).
- **Move the spawn / set default mode location** → `Respawns.js` + `respawnsReferences.glb`, or `VITE_PLAYER_SPAWN`.
- **Add/remove an interactive area** → `World/Areas/Areas.js` list + `static/areas/areas.glb`.
- **Swap the vehicle model** → follow `handoff-van-design/DESIGN_BRIEF.md`, drop `static/vehicle/default.glb`.
- **Reshape the map** → follow `handoff-map-design/MAP_BRIEF.md`.
- **Add / move a campus building** → `World/Building.js`, `World/BiologisticaOffice.js` or `World/LabBuilding.js` (transform constants near the top, or drag live via their debug panels). Swap the procedural meshes for loaded `.glb`s when ready.
- **Add / move the fleet depot** → `World/Fleet.js` (transform constants near the top, or drag live via the `🚐 Fleet` panel; van bay layout is the `vanPlacements` loop). It sits at the original bowling-area location `(2.3, 0, 68.9)`; the map redesign removed the bowling area but the terrain there is still solid flat ground. The van is a CC-BY GLB (`static/fleetVan/`, credit *memoov* — see §licensing); to re-skin it, edit the material sets in `applyVanMaterials()`. To swap the model, drop a new `fleetVan.glb` + run `npm run compress static/` (or `gltf-transform draco`) to regenerate `fleetVan-compressed.glb`.
- **Change the landing logo / its placement** → `World/Areas/LandingLogo.js` (tweakables near the top, or the `🅱️ Logo` debug panel). Replace `biologistica-logo.svg` to change the artwork.
- **Re-skin the race sponsor tents** → replace `static/circuit/tent-logo-webgl.png` / `tent-logo-webgpu.png` (keep 256×128 / 128×128, the `#463f35` background, and the logo inside the V ≈ 0.48–0.93 front-only band to avoid roof "stripes"); logic in `CircuitArea.setTentLogos()` (§9).
- **Change the THREE.JS flag-banner logo** → the flags are `refBanners` / `refBanners.001` (`Plane.129` / `Plane.133`), whose baked art is the `circuitBrand` texture in `areas.glb`. **Do not edit that texture in `areas.glb`** — re-serializing this boot-critical model hangs the loading ring in the browser (the model loads in `Game.init`'s second batch). Instead it's re-skinned **at runtime** in `CircuitArea.setBanners()`: it lazily `TextureLoader`-loads `static/areas/circuitBannerBiologistica.png` (512×128, `flipY=false`, sRGB) and swaps the flag meshes' material. The current art is the **CBRA "30 anos"** logo (source `resources/textures/cbra30.svg`), recolored to white (knockout) on the `#463f35` band. To change it, regenerate that PNG and bump the `?cb=N` query in `setBanners()` so the browser refetches. **Banner art must use the same `side: THREE.DoubleSide` the baked material uses, and keep the logo within roughly the left ~72 % of the texture (U ≲ 0.72, ≈ x < 370 px on the 512-wide image).** The flag mesh has a curled top tip whose UVs fold back over texture region U ≈ 0.75–1.0; any logo content placed there is re-displayed by the curl and shows up as ghosted/doubled letters in-game.
- **Rebrand to Biologistica** → §13.
- **Open the debug panel** → add `#debug` to the URL; press `H` to show/hide.
- **Add per-frame logic** → `ticker.events.on('tick', fn, <priority>)` with the right slot (§5).
