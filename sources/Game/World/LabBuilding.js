import * as THREE from 'three/webgpu'
import { color, Fn, max, mix, positionWorld, vec3 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Low-poly research **laboratory** placed right next to the office (BiologisticaOffice.js) and
 * modelled on it: the same campus material language (white ribbon-window blocks + blue curtain-wall
 * glass with a sky-reflection gradient + concrete copings + recessed glass doors + canopy on posts +
 * warm wooden deck + planters) and the same massing (two white blocks flanking a forward full-height
 * glass volume). It is distinguished as a lab by a glass **clean-room tower crowned with a glass
 * dome**, a grouped rooftop **equipment deck** (two exhaust stacks + a chemical/water tank + an HVAC
 * unit + vents), and **teal** science branding with a white **lab flask** emblem (the regular lab
 * icon) plus a medical cross. This is the experiments lab — it carries no company branding.
 * Procedural for now; swap for a dedicated .glb later. Tweak position / rotation / scale via the
 * "🧪 Lab Building" panel.
 */
export class LabBuilding
{
    constructor()
    {
        this.game = Game.getInstance()

        // Beside the Biologistica office (33.4, 0, 14) along its local +X (tweak via the panel with #debug).
        this.position = new THREE.Vector3(35.2, 0, 7.1)
        this.rotationY = 1.31
        this.scale = 0.5 // half size, matching the neighbouring office

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
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

        // Blue reflective curtain-wall glass: a vertical sky-reflection gradient crossed by a fine
        // mullion grid (matches the office atrium). Used for the clean-room tower, dome + doors.
        const glassColorNode = Fn(() =>
        {
            const deep = color('#16315f') // deep blue low down
            const sky = color('#5d86c4')  // lighter sky reflection up high
            const frameColor = color('#aebdd6')

            const reflection = positionWorld.y.smoothstep(0.4, 5.2)
            const glass = mix(deep, sky, reflection)

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

        // Darker entrance-door glass (deep blue, barely reflective)
        this.darkGlassMaterial = new MeshDefaultMaterial({
            colorNode: color('#10223f'),
            hasWater: false,
            hasLightBounce: false,
        })

        // White facade with crisp blue horizontal ribbon windows (the lab blocks)
        const labColorNode = Fn(() =>
        {
            const wall = color('#eef0f5')
            const glass = color('#2f5290')

            // One crisp window band per ~1.15-unit floor
            const floor = positionWorld.y.mul(1 / 1.15).fract()
            const windowMask = floor.smoothstep(0.22, 0.30).mul(floor.smoothstep(0.78, 0.86).oneMinus())

            // Faint vertical mullions splitting the ribbon into panes
            const mullion = lineMask(positionWorld.x.add(positionWorld.z), 1, 0.9)
            const windowColor = mix(glass, wall, mullion.mul(0.5))

            return vec3(mix(wall, windowColor, windowMask))
        })()

        this.labMaterial = new MeshDefaultMaterial({
            colorNode: labColorNode,
            hasWater: false,
            hasLightBounce: false,
        })

        // Solid light concrete (plinth, roof copings, canopy, rooftop housings, rings)
        this.concreteMaterial = new MeshDefaultMaterial({
            colorNode: color('#dfe3ea'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Teal lab accent (flask plaque, canopy trim, cross panel)
        this.tealMaterial = new MeshDefaultMaterial({
            colorNode: color('#1fae9c'),
            hasWater: false,
            hasLightBounce: false,
        })

        // White (lab flask emblem + medical cross)
        this.whiteMaterial = new MeshDefaultMaterial({
            colorNode: color('#ffffff'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Dark metal (exhaust stacks, tank, canopy posts, vents, door divider)
        this.metalMaterial = new MeshDefaultMaterial({
            colorNode: color('#3a3f4a'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Warm wood (entrance deck)
        this.woodMaterial = new MeshDefaultMaterial({
            colorNode: color('#9c6b3f'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Greenery (entrance planters)
        this.plantMaterial = new MeshDefaultMaterial({
            colorNode: color('#5c8f3a'),
            hasWater: false,
            hasLightBounce: false,
        })
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

        // ----- Left white lab block (ribbon windows) -----
        const LW = 5, LH = 7.5, LD = 5, lx = -3.8, lz = -1.2
        add(new THREE.BoxGeometry(LW, LH, LD), this.labMaterial, lx, base + LH * 0.5, lz)
        add(new THREE.BoxGeometry(LW + 0.3, 0.3, LD + 0.3), this.concreteMaterial, lx, base + LH + 0.15, lz) // roof coping
        const leftFront = lz + LD * 0.5

        // ----- Right white lab block (lower, wider — massing variation) -----
        const RW = 4.8, RH = 6.2, RD = 4.8, rx = 4, rz = -1.5
        add(new THREE.BoxGeometry(RW, RH, RD), this.labMaterial, rx, base + RH * 0.5, rz)
        add(new THREE.BoxGeometry(RW + 0.3, 0.3, RD + 0.3), this.concreteMaterial, rx, base + RH + 0.15, rz) // roof coping
        const rightFront = rz + RD * 0.5

        // ----- Central glass clean-room tower (the hero volume, pushed forward) -----
        const AW = 4.6, AH = 9, AD = 4.2, ax = 0.3, az = 0.8
        add(new THREE.BoxGeometry(AW, AH, AD), this.glassMaterial, ax, base + AH * 0.5, az)
        add(new THREE.BoxGeometry(AW + 0.25, 0.3, AD + 0.25), this.concreteMaterial, ax, base + AH + 0.15, az) // coping
        const atriumFront = az + AD * 0.5

        // Vertical white curtain-wall fins on the tower front face
        for(const fx of [ -1.5, -0.5, 0.5, 1.5 ])
            add(new THREE.BoxGeometry(0.14, AH * 0.96, 0.1), this.concreteMaterial, ax + fx, base + AH * 0.5, atriumFront + 0.04)

        // ----- Clean-room glass dome crowning the tower (the lab landmark) -----
        add(new THREE.CylinderGeometry(1.75, 1.85, 0.3, 24), this.concreteMaterial, ax, base + AH + 0.4, az) // dome base ring
        add(new THREE.SphereGeometry(1.65, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), this.glassMaterial, ax, base + AH + 0.5, az) // glass dome
        add(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), this.metalMaterial, ax, base + AH + 0.5 + 1.65, az) // finial

        // ----- Entrance: recessed glass doors + central divider under the tower -----
        add(new THREE.BoxGeometry(2.8, 2.6, 0.2), this.darkGlassMaterial, ax, base + 1.3, atriumFront + 0.02)
        add(new THREE.BoxGeometry(0.1, 2.6, 0.24), this.metalMaterial, ax, base + 1.3, atriumFront + 0.05)

        // ----- Entrance canopy (slab + teal underside trim + two posts) -----
        add(new THREE.BoxGeometry(5, 0.3, 1.8), this.concreteMaterial, ax, base + 2.95, atriumFront + 0.9)
        add(new THREE.BoxGeometry(5, 0.12, 0.12), this.tealMaterial, ax, base + 2.78, atriumFront + 1.78)
        add(new THREE.CylinderGeometry(0.07, 0.07, 2.95, 8), this.metalMaterial, ax - 2.1, base + 1.47, atriumFront + 1.6)
        add(new THREE.CylinderGeometry(0.07, 0.07, 2.95, 8), this.metalMaterial, ax + 2.1, base + 1.47, atriumFront + 1.6)

        // ----- Warm wooden entrance deck -----
        add(new THREE.BoxGeometry(4.2, 0.16, 2.2), this.woodMaterial, ax, base + 0.08, atriumFront + 1.4)

        // ----- Lab flask emblem (the regular lab icon) on a teal plaque (left block facade) -----
        add(new THREE.BoxGeometry(1.6, 1.6, 0.16), this.tealMaterial, lx, base + 4.6, leftFront + 0.08)
        const flask = (geometry, y) =>
        {
            const mesh = add(geometry, this.whiteMaterial, lx, base + y, leftFront + 0.18)
            mesh.scale.z = 0.28 // flatten the round flask into a wall relief
            return mesh
        }
        flask(new THREE.CylinderGeometry(0.17, 0.48, 0.72, 20), 4.3)  // conical body
        flask(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 16), 4.78)  // neck
        flask(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 16), 5.06)  // mouth lip

        // ----- White medical cross emblem on the right block facade -----
        add(new THREE.BoxGeometry(1.5, 1.5, 0.14), this.tealMaterial, rx, base + 3.6, rightFront + 0.08)
        add(new THREE.BoxGeometry(0.95, 0.28, 0.06), this.whiteMaterial, rx, base + 3.6, rightFront + 0.17)
        add(new THREE.BoxGeometry(0.28, 0.95, 0.06), this.whiteMaterial, rx, base + 3.6, rightFront + 0.18)

        // ----- Entrance planters (greenery) flanking the deck -----
        for(const px of [ -2.6, 2.6 ])
        {
            add(new THREE.BoxGeometry(0.9, 0.55, 0.9), this.concreteMaterial, ax + px, base + 0.27, atriumFront + 1.4)
            add(new THREE.BoxGeometry(0.8, 0.5, 0.8), this.plantMaterial, ax + px, base + 0.77, atriumFront + 1.4)
        }

        // ----- Rooftop skylight ring + glass disc (left block) -----
        add(new THREE.TorusGeometry(0.85, 0.16, 12, 24), this.concreteMaterial, lx + 1, base + LH + 0.32, lz - 0.8, Math.PI * 0.5)
        add(new THREE.CylinderGeometry(0.74, 0.74, 0.12, 18), this.glassMaterial, lx + 1, base + LH + 0.32, lz - 0.8)

        // ----- Rooftop equipment deck (right block) — the lab signature, grouped on a pad -----
        const roof = base + RH
        add(new THREE.BoxGeometry(3.4, 0.25, 3.2), this.concreteMaterial, rx, roof + 0.12, rz) // equipment pad
        // Two exhaust stacks with caps
        add(new THREE.CylinderGeometry(0.24, 0.24, 2.6, 12), this.metalMaterial, rx - 1, roof + 1.4, rz - 0.7)
        add(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12), this.metalMaterial, rx - 1, roof + 2.77, rz - 0.7)
        add(new THREE.CylinderGeometry(0.19, 0.19, 2, 12), this.metalMaterial, rx - 0.3, roof + 1.1, rz - 0.7)
        add(new THREE.CylinderGeometry(0.23, 0.23, 0.12, 12), this.metalMaterial, rx - 0.3, roof + 2.16, rz - 0.7)
        // Chemical / water tank + cap
        add(new THREE.CylinderGeometry(0.72, 0.72, 1.5, 16), this.metalMaterial, rx + 1, roof + 0.95, rz + 0.4)
        add(new THREE.CylinderGeometry(0.75, 0.75, 0.18, 16), this.concreteMaterial, rx + 1, roof + 1.8, rz + 0.4)
        // HVAC unit + vent
        add(new THREE.BoxGeometry(1.4, 0.6, 1.1), this.concreteMaterial, rx + 0.2, roof + 0.55, rz + 1)
        add(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 10), this.metalMaterial, rx + 1.1, roof + 0.5, rz + 1.1)
    }

    setPhysics()
    {
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
                colliders: [
                    { shape: 'cuboid', parameters: [ 6.4 * this.scale, 4.8 * this.scale, 3.8 * this.scale ], position: { x: 0, y: 4.8 * this.scale, z: -0.4 * this.scale }, category: 'object' },
                ],
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

        const panel = this.game.debug.panel.addFolder({ title: '🧪 Lab Building', expanded: false })
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
