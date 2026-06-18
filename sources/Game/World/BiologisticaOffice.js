import * as THREE from 'three/webgpu'
import { color, Fn, max, mix, positionWorld, vec3 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Low-poly "Biologistica" office: two white window-banded blocks flanking a blue glass entrance
 * atrium, with an entrance canopy, a red logo sign and a red flag on a pole. This is a separate,
 * additional building (the placeholder glass tower next to the race lives in Building.js). Built
 * procedurally for now; swap for a dedicated .glb later. Position / rotation are easy to tweak
 * below, or dragged live via the "🏥 Biologistica Office" debug panel when the URL has #debug.
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

        // Blue reflective glass with a world-space window grid (entrance atrium + doors)
        const glassColorNode = Fn(() =>
        {
            const glass = color('#1f3a6e')
            const frameColor = color('#9fb0d2')

            const floors = lineMask(positionWorld.y, 1.1)
            const mullionsX = lineMask(positionWorld.x, 1)
            const mullionsZ = lineMask(positionWorld.z, 1)
            const frame = max(floors, max(mullionsX, mullionsZ))

            return vec3(mix(glass, frameColor, frame.mul(0.55)))
        })()

        this.glassMaterial = new MeshDefaultMaterial({
            colorNode: glassColorNode,
            hasWater: false,
            hasLightBounce: false,
        })

        // White facade with blue horizontal ribbon windows (the office blocks)
        const officeColorNode = Fn(() =>
        {
            const wall = color('#eceef3')
            const glass = color('#2f4f86')

            // One window band in the middle of each ~1.25-unit floor
            const floor = positionWorld.y.mul(1 / 1.25).fract()
            const windowMask = floor.smoothstep(0.24, 0.32).mul(floor.smoothstep(0.80, 0.88).oneMinus())

            // Faint vertical mullions splitting the ribbon into panes
            const mullion = lineMask(positionWorld.x.add(positionWorld.z), 1.15, 0.9)
            const windowColor = mix(glass, wall, mullion.mul(0.5))

            return vec3(mix(wall, windowColor, windowMask))
        })()

        this.officeMaterial = new MeshDefaultMaterial({
            colorNode: officeColorNode,
            hasWater: false,
            hasLightBounce: false,
        })

        // Solid light concrete (plinth, roof caps, canopy, rooftop units)
        this.concreteMaterial = new MeshDefaultMaterial({
            colorNode: color('#dfe3ea'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Red brand accent (logo sign + flag) — matches the Biologistica logo red
        this.accentMaterial = new MeshDefaultMaterial({
            colorNode: color('#be1e2d'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Dark metal (flagpole)
        this.metalMaterial = new MeshDefaultMaterial({
            colorNode: color('#3a3f4a'),
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

        const add = (geometry, material, x, y, z) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            this.group.add(mesh)
        }

        const base = 0.4 // plinth top — everything sits on this

        // Ground plinth / plaza slab
        add(new THREE.BoxGeometry(12, base, 9), this.concreteMaterial, 0, base * 0.5, 0)

        // Left office block (white, ribbon windows)
        add(new THREE.BoxGeometry(5.4, 7.6, 5), this.officeMaterial, -3, base + 3.8, 0)

        // Right office block (white, ribbon windows, taller — the back tower)
        add(new THREE.BoxGeometry(4.6, 9.2, 4.6), this.officeMaterial, 3.6, base + 4.6, -0.5)

        // Glass entrance atrium (blue glass), brought forward between the two blocks
        add(new THREE.BoxGeometry(4, 6.2, 4), this.glassMaterial, 0.4, base + 3.1, 1)

        // Roof caps
        add(new THREE.BoxGeometry(5.6, 0.4, 5.2), this.concreteMaterial, -3, base + 7.8, 0)
        add(new THREE.BoxGeometry(4.8, 0.4, 4.8), this.concreteMaterial, 3.6, base + 9.4, -0.5)

        // Rooftop skylight cylinder (left block) — the round roof feature
        add(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16), this.concreteMaterial, -3, base + 8.25, 0)

        // Rooftop unit (right block) — AC / satellite housing
        add(new THREE.BoxGeometry(1.4, 0.7, 1.2), this.concreteMaterial, 3.6, base + 9.95, -0.5)

        // Entrance canopy over the doors
        add(new THREE.BoxGeometry(4.4, 0.25, 1.4), this.concreteMaterial, 0.4, base + 2.3, 3.3)

        // Entrance doors (dark glass)
        add(new THREE.BoxGeometry(2.4, 2.1, 0.2), this.glassMaterial, 0.4, base + 1.05, 3.05)

        // Red logo sign on the left block facade
        add(new THREE.BoxGeometry(2.4, 0.8, 0.18), this.accentMaterial, -3, base + 2.4, 2.55)

        // Entrance planters (greenery)
        add(new THREE.BoxGeometry(0.9, 0.6, 0.9), this.plantMaterial, -1.6, base + 0.3, 3.4)
        add(new THREE.BoxGeometry(0.9, 0.6, 0.9), this.plantMaterial, 2.4, base + 0.3, 3.4)

        // Flagpole + red flag near the entrance
        const poleHeight = 8
        add(new THREE.CylinderGeometry(0.06, 0.06, poleHeight, 8), this.metalMaterial, 2, base + poleHeight * 0.5, 3.2)
        add(new THREE.BoxGeometry(1.4, 0.85, 0.06), this.accentMaterial, 2.75, base + poleHeight - 0.9, 3.2)
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 8), this.metalMaterial, 2, base + poleHeight + 0.05, 3.2)
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
                    { shape: 'cuboid', parameters: [ 6 * this.scale, 5.2 * this.scale, 4.5 * this.scale ], position: { x: 0, y: 5.2 * this.scale, z: 0 }, category: 'object' },
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

        const panel = this.game.debug.panel.addFolder({ title: '🏥 Biologistica Office', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'y', { min: -2, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationY', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', onChange)
    }
}
