import * as THREE from 'three/webgpu'
import { color, Fn, hash, max, mix, positionLocal, positionWorld, sin, texture, vec3 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { InteractivePoints } from '../InteractivePoints.js'

/**
 * Low-poly "Biologística" office, modelled after the brand HQ render: two white ribbon-window blocks
 * (a medium left block and a taller back tower) flanking a forward, full-height blue glass
 * curtain-wall entrance atrium. Detailed with white curtain-wall fins + corner pilasters, a red
 * brand fascia, recessed glass doors + a dark lobby, a canopy on posts, a warm wooden entrance deck
 * with steps, a rooftop skylight ring, rooftop units + parapet railings, planters/shrubs/bollards, a
 * paved forecourt with two on-brand delivery vans, and a rooftop red flag that waves (vertex
 * animation driven by the elapsed-time uniform). Window panes vary per-pane and light up warm at
 * night (toggled off the day/night cycle). The red facade sign carries the real Biologística
 * wordmark (`static/areas/biologisticaLogo.png`, loaded at runtime so it never blocks boot, then
 * swapped onto the sign plane as an alpha decal). An interactive "Biologística" point in front of the
 * entrance opens the "Sobre" modal. This is a separate, additional building (the placeholder glass
 * tower next to the race lives in Building.js). Built procedurally for now; swap for a dedicated .glb
 * later. Position / rotation / scale are easy to tweak below, or dragged live via the
 * "🏥 Biologistica Office" debug panel when the URL has #debug.
 */
export class BiologisticaOffice
{
    constructor()
    {
        this.game = Game.getInstance()

        // Positioned onto the intended section (tweak live via the "🏥 Biologistica Office" panel with #debug).
        this.position = new THREE.Vector3(33.4, 0, 14)
        this.rotationY = 1.31
        this.scale = 0.5 // half size

        this.flagWidth = 1.6

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.setSignTexture()
        this.setNightLights()
        this.setInteractivePoint()
        this.setDebug()
    }

    setMaterials()
    {
        // Bright lines near each cell boundary (used for window grids / mullions)
        const lineMask = (coord, cellSize, sharpness = 0.82) =>
        {
            const cell = coord.mod(cellSize).mul(1 / cellSize) // 0..1 inside each cell
            const edge = cell.sub(0.5).abs().mul(2)            // 0 at center, 1 at boundary
            return edge.smoothstep(sharpness, 1)               // bright near the boundary
        }

        // Pseudo-random 0..1 per window pane, from a world-space grid cell (breaks up flat glass)
        const paneRandom = (coordA, coordB, sizeA, sizeB) =>
        {
            const a = coordA.mul(1 / sizeA).floor()
            const b = coordB.mul(1 / sizeB).floor()
            return hash(a.mul(37.3).add(b.mul(71.7)).abs())
        }

        // Blue reflective curtain-wall glass: a vertical sky-reflection gradient (lighter up high),
        // subtle per-pane variation, crossed by a fine mullion grid. Hero atrium + skylight disc.
        const glassColorNode = Fn(() =>
        {
            const deep = color('#16315f') // deep blue low down
            const sky = color('#5d86c4')  // lighter sky reflection up high
            const frameColor = color('#aebdd6')

            const reflection = positionWorld.y.smoothstep(0.4, 5.2)
            const variation = paneRandom(positionWorld.x.add(positionWorld.z), positionWorld.y, 0.9, 1)
            const glass = mix(deep, sky, reflection).mul(mix(0.82, 1.18, variation))

            const floors = lineMask(positionWorld.y, 1)
            const mullionsX = lineMask(positionWorld.x, 0.9)
            const mullionsZ = lineMask(positionWorld.z, 0.9)
            const frame = max(floors, max(mullionsX, mullionsZ))

            return vec3(mix(glass, frameColor, frame.mul(0.5)))
        })()

        this.glassMaterial = new MeshDefaultMaterial({
            colorNode: glassColorNode,
            hasWater: false,
            hasLightBounce: false,
        })

        // Darker entrance-door / lobby glass (deep blue, barely reflective)
        this.darkGlassMaterial = new MeshDefaultMaterial({
            colorNode: color('#10223f'),
            hasWater: false,
            hasLightBounce: false,
        })

        // White facade with crisp blue ribbon windows: per-pane variation + a faint recess shadow
        const officeColorNode = Fn(() =>
        {
            const wall = color('#eef0f5')
            const glassDark = color('#243f72')
            const glassLite = color('#5277b4')

            const floorPeriod = 0.9
            const floor = positionWorld.y.mul(1 / floorPeriod).fract()
            const band = floor.smoothstep(0.22, 0.30).mul(floor.smoothstep(0.78, 0.86).oneMinus())

            // Fake inset shadow toward the top of each window band
            const recess = floor.smoothstep(0.30, 0.5).oneMinus().mul(0.3)

            const variation = paneRandom(positionWorld.x.add(positionWorld.z), positionWorld.y, 1, floorPeriod)
            const pane = mix(glassDark, glassLite, variation).mul(recess.oneMinus())

            const mullion = lineMask(positionWorld.x.add(positionWorld.z), 1, 0.88)
            const windowColor = mix(pane, wall, mullion.mul(0.55))

            return vec3(mix(wall, windowColor, band))
        })()

        this.officeMaterial = new MeshDefaultMaterial({
            colorNode: officeColorNode,
            hasWater: false,
            hasLightBounce: false,
        })

        // Solid light concrete (plinth, copings, canopy, rooftop units, skylight ring, pilasters)
        this.concreteMaterial = new MeshDefaultMaterial({
            colorNode: color('#dfe3ea'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Dark asphalt (forecourt)
        this.asphaltMaterial = new MeshDefaultMaterial({
            colorNode: color('#3c4048'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Red brand accent (logo sign backing, fascia, canopy trim, flag, van stripe)
        this.accentMaterial = new MeshDefaultMaterial({
            colorNode: color('#be1e2d'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Dark metal (flagpole, canopy posts, vents, door divider, railings, wheels, bumpers)
        this.metalMaterial = new MeshDefaultMaterial({
            colorNode: color('#3a3f4a'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Near-black detail (wheels, bumpers)
        this.darkMaterial = new MeshDefaultMaterial({
            colorNode: color('#1b1d22'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Warm wood (entrance deck + steps)
        this.woodMaterial = new MeshDefaultMaterial({
            colorNode: color('#9c6b3f'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Clean white (delivery van body)
        this.vanMaterial = new MeshDefaultMaterial({
            colorNode: color('#f4f6f9'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Greenery (planters + shrubs)
        this.plantMaterial = new MeshDefaultMaterial({
            colorNode: color('#5c8f3a'),
            hasWater: false,
            hasLightBounce: false,
        })
        this.plantDarkMaterial = new MeshDefaultMaterial({
            colorNode: color('#3f6f29'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Waving red flag — vertex animation driven by the elapsed-time uniform. The wave amplitude
        // grows from the pole (left edge) toward the free (right) edge of the flag plane.
        this.flagMaterial = new MeshDefaultMaterial({
            colorNode: color('#be1e2d'),
            hasWater: false,
            hasLightBounce: false,
            side: THREE.DoubleSide,
        })

        const flagW = this.flagWidth
        this.flagMaterial.positionNode = Fn(() =>
        {
            const t = this.game.ticker.elapsedScaledUniform
            const amp = positionLocal.x.add(flagW * 0.5).div(flagW).clamp(0, 1)
            const z = positionLocal.z.add(sin(positionLocal.x.mul(6).add(t.mul(5))).mul(0.14).mul(amp))
            const y = positionLocal.y.add(sin(positionLocal.x.mul(4).add(t.mul(4.3))).mul(0.05).mul(amp))
            return vec3(positionLocal.x, y, z)
        })()
    }

    setMesh()
    {
        this.group = new THREE.Group()
        this.group.scale.setScalar(this.scale)

        const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            if(rx !== 0 || ry !== 0 || rz !== 0)
                mesh.rotation.set(rx, ry, rz)
            this.group.add(mesh)
            return mesh
        }

        const base = 0.5 // plinth top — everything sits on this

        // Ground plinth / plaza slab
        add(new THREE.BoxGeometry(13, base, 11), this.concreteMaterial, 0, base * 0.5, 0)

        // ----- Left white office block (ribbon windows, corner pilasters) -----
        const LW = 5, LH = 8, LD = 5, lx = -3.7, lz = -1.2
        add(new THREE.BoxGeometry(LW, LH, LD), this.officeMaterial, lx, base + LH * 0.5, lz)
        add(new THREE.BoxGeometry(LW + 0.3, 0.3, LD + 0.3), this.concreteMaterial, lx, base + LH + 0.15, lz)
        const leftFront = lz + LD * 0.5
        for(const px of [ -LW * 0.5 + 0.12, -1.2, 0.6, LW * 0.5 - 0.12 ])
            add(new THREE.BoxGeometry(0.16, LH, 0.12), this.concreteMaterial, lx + px, base + LH * 0.5, leftFront + 0.02)

        // ----- Right white office block (taller back tower, corner pilasters) -----
        const RW = 4.6, RH = 10.6, RD = 4.6, rx = 3.9, rz = -1.6
        add(new THREE.BoxGeometry(RW, RH, RD), this.officeMaterial, rx, base + RH * 0.5, rz)
        add(new THREE.BoxGeometry(RW + 0.3, 0.3, RD + 0.3), this.concreteMaterial, rx, base + RH + 0.15, rz)
        const rightFront = rz + RD * 0.5
        for(const px of [ -RW * 0.5 + 0.12, -0.7, 0.7, RW * 0.5 - 0.12 ])
            add(new THREE.BoxGeometry(0.16, RH, 0.12), this.concreteMaterial, rx + px, base + RH * 0.5, rightFront + 0.02)

        // ----- Central glass entrance atrium (the hero volume, pushed forward) -----
        const AW = 4.6, AH = 9.4, AD = 4.2, ax = 0.6, az = 0.6
        add(new THREE.BoxGeometry(AW, AH, AD), this.glassMaterial, ax, base + AH * 0.5, az)
        add(new THREE.BoxGeometry(AW + 0.25, 0.3, AD + 0.25), this.concreteMaterial, ax, base + AH + 0.15, az)
        const atriumFront = az + AD * 0.5

        // Vertical white curtain-wall fins on the atrium front face
        for(const fx of [ -1.5, -0.5, 0.5, 1.5 ])
            add(new THREE.BoxGeometry(0.14, AH * 0.96, 0.1), this.concreteMaterial, ax + fx, base + AH * 0.5, atriumFront + 0.04)

        // Red brand fascia stripe across the atrium top
        add(new THREE.BoxGeometry(AW + 0.26, 0.24, 0.12), this.accentMaterial, ax, base + AH - 0.35, atriumFront + 0.06)

        // Dark recessed ground-floor lobby (reads transparent)
        add(new THREE.BoxGeometry(AW - 0.4, 1.6, 0.25), this.darkGlassMaterial, ax, base + 0.8, atriumFront - 0.02)

        // ----- Entrance: recessed glass doors + central divider -----
        add(new THREE.BoxGeometry(2.8, 2.6, 0.2), this.darkGlassMaterial, ax, base + 1.3, atriumFront + 0.04)
        add(new THREE.BoxGeometry(0.1, 2.6, 0.24), this.metalMaterial, ax, base + 1.3, atriumFront + 0.07)

        // ----- Entrance canopy (slab + red underside trim + two posts) -----
        add(new THREE.BoxGeometry(5, 0.3, 1.8), this.concreteMaterial, ax, base + 2.95, atriumFront + 0.9)
        add(new THREE.BoxGeometry(5, 0.12, 0.12), this.accentMaterial, ax, base + 2.78, atriumFront + 1.78)
        add(new THREE.CylinderGeometry(0.07, 0.07, 2.95, 8), this.metalMaterial, ax - 2.1, base + 1.47, atriumFront + 1.6)
        add(new THREE.CylinderGeometry(0.07, 0.07, 2.95, 8), this.metalMaterial, ax + 2.1, base + 1.47, atriumFront + 1.6)

        // ----- Warm wooden entrance deck + two steps down to the forecourt -----
        add(new THREE.BoxGeometry(3.6, 0.16, 1.3), this.woodMaterial, ax, base + 0.08, atriumFront + 0.65)
        add(new THREE.BoxGeometry(4, 0.16, 0.45), this.woodMaterial, ax, base - 0.04, atriumFront + 1.1)
        add(new THREE.BoxGeometry(4.4, 0.16, 0.45), this.concreteMaterial, ax, base - 0.16, atriumFront + 1.5)

        // ----- Rooftop skylight ring + glass disc (left block) -----
        add(new THREE.TorusGeometry(0.9, 0.17, 12, 24), this.concreteMaterial, lx, base + LH + 0.34, lz, Math.PI * 0.5)
        add(new THREE.CylinderGeometry(0.78, 0.78, 0.12, 18), this.glassMaterial, lx, base + LH + 0.34, lz)

        // ----- Rooftop units (right block) -----
        add(new THREE.BoxGeometry(1.4, 0.7, 1.2), this.concreteMaterial, rx - 0.6, base + RH + 0.65, rz)
        add(new THREE.BoxGeometry(0.9, 0.5, 0.9), this.concreteMaterial, rx + 0.9, base + RH + 0.55, rz - 0.6)
        add(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 10), this.metalMaterial, rx + 0.3, base + RH + 0.65, rz + 0.9)

        // ----- Parapet railing on the left block roof -----
        this.addRailing(add, lx, base + LH + 0.3, lz, LW + 0.2, LD + 0.2)

        // ----- Red Biologística logo sign on the left block facade -----
        add(new THREE.BoxGeometry(3.3, 1.15, 0.16), this.accentMaterial, lx, base + 4.7, leftFront + 0.1)
        this.signMesh = add(new THREE.PlaneGeometry(3.05, 0.78), this.accentMaterial, lx, base + 4.7, leftFront + 0.2)

        // ----- Entrance planters (greenery) flanking the deck -----
        for(const px of [ -2.4, 2.4 ])
        {
            add(new THREE.BoxGeometry(0.9, 0.55, 0.9), this.concreteMaterial, ax + px, base + 0.27, atriumFront + 0.7)
            add(new THREE.IcosahedronGeometry(0.55, 0), this.plantMaterial, ax + px, base + 0.95, atriumFront + 0.7)
        }

        // ----- Low-poly shrubs at the corners + bollards by the entrance -----
        for(const [ sx, sz, s ] of [ [ -5.7, atriumFront + 0.6, 0.6 ], [ 5.7, atriumFront + 0.2, 0.7 ], [ -5.9, atriumFront + 2.6, 0.5 ], [ 5.9, atriumFront + 2.4, 0.55 ] ])
            add(new THREE.IcosahedronGeometry(s, 0), this.plantDarkMaterial, sx, base + s * 0.7, sz)
        for(const bx of [ -2.1, 2.1 ])
            add(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), this.metalMaterial, ax + bx, base + 0.25, atriumFront + 1.7)

        // ----- Paved forecourt + parking markings + two on-brand delivery vans -----
        add(new THREE.BoxGeometry(11, 0.06, 2), this.asphaltMaterial, 0, base + 0.02, atriumFront + 1.8)
        for(const mx of [ -3.3, 3.3 ])
            add(new THREE.BoxGeometry(2.2, 0.02, 0.08), this.concreteMaterial, mx, base + 0.06, atriumFront + 1.8)
        this.vanPlacements = [
            { x: -3.3, z: atriumFront + 1.8, ry: 0.06 },
            { x: 3.3, z: atriumFront + 2, ry: -0.06 },
        ]
        for(const van of this.vanPlacements)
            this.addVan(van.x, van.z, van.ry)

        // ----- Rooftop flagpole + waving red flag at the apex -----
        const poleBaseY = base + AH + 0.3, poleHeight = 4.5, fx = ax + 1.7, fz = az + 1.6
        add(new THREE.CylinderGeometry(0.07, 0.07, poleHeight, 8), this.metalMaterial, fx, poleBaseY + poleHeight * 0.5, fz)
        add(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 8), this.metalMaterial, fx, poleBaseY + poleHeight + 0.05, fz)
        add(new THREE.PlaneGeometry(this.flagWidth, 0.95, 16, 8), this.flagMaterial, fx + this.flagWidth * 0.5, poleBaseY + poleHeight - 0.9, fz)

        // ----- Warm window glow that switches on at night (toggled in setNightLights) -----
        this.nightGroup = new THREE.Group()
        this.group.add(this.nightGroup)
        const emissive = this.game.materials.getFromName('emissiveOrangeRadialGradient')
        const litQuad = (w, h, x, y, z, ry = 0) =>
        {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), emissive)
            mesh.position.set(x, y, z)
            if(ry !== 0)
                mesh.rotation.y = ry
            this.nightGroup.add(mesh)
        }
        for(const [ wx, wy ] of [ [ -5, 3.2 ], [ -2.6, 4.4 ], [ -4.2, 5.6 ], [ -3, 2.4 ], [ -5.2, 6.4 ] ])
            litQuad(0.7, 0.5, lx + wx + 3.7, base + wy, leftFront + 0.07)
        for(const [ wx, wy ] of [ [ 3.4, 3 ], [ 4.6, 4.8 ], [ 3.8, 6.4 ], [ 5, 8 ] ])
            litQuad(0.6, 0.45, wx, base + wy, rightFront + 0.07)
        litQuad(4.4, 0.5, ax, base + 0.45, atriumFront + 0.2)
    }

    addRailing(add, cx, cy, cz, width, depth)
    {
        const railHeight = 0.5
        const t = 0.05
        const hw = width * 0.5, hd = depth * 0.5

        add(new THREE.BoxGeometry(width, t, t), this.metalMaterial, cx, cy + railHeight, cz + hd)
        add(new THREE.BoxGeometry(width, t, t), this.metalMaterial, cx, cy + railHeight, cz - hd)
        add(new THREE.BoxGeometry(t, t, depth), this.metalMaterial, cx + hw, cy + railHeight, cz)
        add(new THREE.BoxGeometry(t, t, depth), this.metalMaterial, cx - hw, cy + railHeight, cz)

        for(const [ px, pz ] of [ [ -hw, -hd ], [ hw, -hd ], [ -hw, hd ], [ hw, hd ], [ 0, hd ], [ 0, -hd ] ])
            add(new THREE.CylinderGeometry(t * 0.6, t * 0.6, railHeight, 6), this.metalMaterial, cx + px, cy + railHeight * 0.5, cz + pz)
    }

    addVan(x, z, ry)
    {
        // Small box delivery van (white body + red brand stripe). Length runs along local X; place a
        // group so it can be rotated as a unit. Sits on the forecourt at the plaza top.
        const van = new THREE.Group()
        van.position.set(x, 0.53, z)
        van.rotation.y = ry

        const part = (geometry, material, px, py, pz, rx = 0, pry = 0, rz = 0) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(px, py, pz)
            if(rx !== 0 || pry !== 0 || rz !== 0)
                mesh.rotation.set(rx, pry, rz)
            van.add(mesh)
        }

        for(const wx of [ 1.3, -1.1 ])
            for(const wz of [ 0.85, -0.85 ])
                part(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12), this.darkMaterial, wx, 0.36, wz, Math.PI * 0.5)

        part(new THREE.BoxGeometry(2.6, 1.4, 1.8), this.vanMaterial, -0.3, 1.06, 0)        // cargo box
        part(new THREE.BoxGeometry(1.3, 1.05, 1.7), this.vanMaterial, 1.25, 0.885, 0)      // cab
        part(new THREE.BoxGeometry(0.1, 0.6, 1.5), this.darkGlassMaterial, 1.9, 1.05, 0)   // windshield
        part(new THREE.BoxGeometry(1, 0.45, 1.74), this.darkGlassMaterial, 1.3, 1.18, 0)   // cab side windows
        part(new THREE.BoxGeometry(3, 0.26, 1.84), this.accentMaterial, 0, 0.78, 0)        // red brand stripe
        part(new THREE.BoxGeometry(0.25, 0.3, 1.7), this.darkMaterial, 1.97, 0.5, 0)       // front bumper
        part(new THREE.BoxGeometry(0.2, 0.3, 1.8), this.darkMaterial, -1.62, 0.5, 0)       // rear bumper

        this.group.add(van)
    }

    setSignTexture()
    {
        // Lazily load the Biologística wordmark and swap it onto the sign plane, so the texture can
        // never block boot (same proven pattern as Laptop/CircuitArea). It's a transparent decal
        // (white wordmark, alpha-driven) sitting just in front of the red sign backing panel.
        const loader = this.game.resourcesLoader.getLoader('texture')
        loader.load(
            'areas/biologisticaLogo.png?cb=1',
            (logoTexture) =>
            {
                logoTexture.colorSpace = THREE.SRGBColorSpace
                logoTexture.anisotropy = 4

                this.signMesh.material = new MeshDefaultMaterial({
                    colorNode: texture(logoTexture).rgb,
                    alphaNode: texture(logoTexture).a,
                    transparent: true,
                    hasWater: false,
                    hasLightBounce: false,
                    hasCoreShadows: false,
                    hasDropShadows: false,
                })
            },
            undefined,
            () => console.warn('BiologisticaOffice > Could not load logo texture'),
        )
    }

    setNightLights()
    {
        // Switch the warm window glow on during the night interval of the day/night cycle.
        if(!this.game.dayCycles || !this.nightGroup)
            return

        const apply = (inNight) =>
        {
            this.nightGroup.visible = inNight
        }

        this.game.dayCycles.events.on('night', apply)
        apply(this.game.dayCycles.intervalEvents.get('night')?.inInterval ?? false)
    }

    setInteractivePoint()
    {
        // Floating "Biologística" point in front of the entrance. The anchor is derived from the
        // building transform (forward = local +Z rotated by rotationY) so it tracks the building.
        // Pressing interact (Enter) opens the "Sobre" (About Biologística) modal.
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY)
        const pointPosition = this.position.clone().addScaledVector(forward, 3)
        pointPosition.y = 2.4

        this.interactivePoint = this.game.interactivePoints.create(
            pointPosition,
            'Biologística',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                const sound = this.game.audio.groups.get('click')
                if(sound)
                    sound.play(true)

                this.game.modals.open('sobre')
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
        )
    }

    setPhysics()
    {
        const s = this.scale

        const colliders = [
            { shape: 'cuboid', parameters: [ 6.4 * s, 5.3 * s, 3.8 * s ], position: { x: 0, y: 5.3 * s, z: -0.4 * s }, category: 'object' },
        ]

        // Solid delivery vans so the car can't drive through them
        for(const van of this.vanPlacements)
            colliders.push({ shape: 'cuboid', parameters: [ 2.2 * s, 1 * s, 1.4 * s ], position: { x: van.x * s, y: 1.2 * s, z: van.z * s }, category: 'object' })

        this.object = this.game.objects.add(
            {
                model: this.group,
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true,
            },
            {
                type: 'fixed',
                position: this.position,
                colliders,
            }
        )
    }

    applyTransform()
    {
        const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.rotationY, 0))

        this.object.physical.body.setTranslation(this.position, true)
        this.object.physical.body.setRotation(quaternion, true)
        this.object.visual.object3D.position.copy(this.position)
        this.object.visual.object3D.quaternion.copy(quaternion)
    }

    setDebug()
    {
        if(!this.game.debug.active)
            return

        const panel = this.game.debug.panel.addFolder({ title: '🏥 Biologistica Office', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'y', { min: -2, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationY', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', onChange)
        panel.addBinding(this, 'scale', { min: 0.2, max: 2, step: 0.05 }).on('change', () =>
        {
            this.group.scale.setScalar(this.scale)
        })
    }
}
