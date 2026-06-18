import * as THREE from 'three/webgpu'
import { color, Fn, max, mix, positionWorld, vec3 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Placeholder low-poly glass office tower placed in the circuit, centered between the two
 * THREE.JS flag banners (refBanners / refBanners.001). Built procedurally for now; meant to be
 * swapped for a dedicated .glb model later. Position / rotation are easy to tweak below (or
 * dragged live via the "🏢 Building" debug panel when the URL has #debug).
 */
export class Building
{
    constructor()
    {
        this.game = Game.getInstance()

        // Midpoint between the two THREE.JS flag banners (refBanners @ z≈0.04, refBanners.001 @ z≈11.63).
        this.position = new THREE.Vector3(-20.3, 0, 5.8)
        this.rotationY = 0

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.setDebug()
    }

    setMaterials()
    {
        // Blue glass with a world-space window grid (floor bands + vertical mullions)
        const glassColorNode = Fn(() =>
        {
            const glass = color('#21386e')
            const frameColor = color('#aebbd6')

            const lineMask = (coord, cellSize) =>
            {
                const cell = coord.mod(cellSize).mul(1 / cellSize) // 0..1 inside each cell
                const edge = cell.sub(0.5).abs().mul(2)            // 0 at center, 1 at boundary
                return edge.smoothstep(0.82, 1)                    // bright near the boundary
            }

            const floors = lineMask(positionWorld.y, 1.15)
            const mullionsX = lineMask(positionWorld.x, 1)
            const mullionsZ = lineMask(positionWorld.z, 1)
            const frame = max(floors, max(mullionsX, mullionsZ))

            return vec3(mix(glass, frameColor, frame.mul(0.6)))
        })()

        this.glassMaterial = new MeshDefaultMaterial({
            colorNode: glassColorNode,
            hasWater: false,
            hasLightBounce: false,
        })

        this.frameMaterial = new MeshDefaultMaterial({
            colorNode: color('#aab4c8'),
            hasWater: false,
            hasLightBounce: false,
        })
    }

    setMesh()
    {
        this.group = new THREE.Group()

        const add = (geometry, material, x, y, z) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            this.group.add(mesh)
        }

        // Podium / entrance base
        add(new THREE.BoxGeometry(8, 0.7, 7), this.frameMaterial, 0, 0.35, 0)

        // Main tower
        add(new THREE.BoxGeometry(4.6, 9.2, 4), this.glassMaterial, -0.7, 5.3, 0)

        // Shorter side wing
        add(new THREE.BoxGeometry(2.8, 6, 3), this.glassMaterial, 2.2, 3.7, -0.3)

        // Roof caps
        add(new THREE.BoxGeometry(4.9, 0.5, 4.3), this.frameMaterial, -0.7, 10.15, 0)
        add(new THREE.BoxGeometry(3.1, 0.4, 3.3), this.frameMaterial, 2.2, 6.9, -0.3)

        // Rooftop detail
        add(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 16), this.frameMaterial, -0.7, 10.7, 0)
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
                    { shape: 'cuboid', parameters: [ 4, 5.2, 3.5 ], position: { x: 0, y: 5.2, z: 0 }, category: 'object' },
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

        const panel = this.game.debug.panel.addFolder({ title: '🏢 Building', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'y', { min: -2, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationY', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', onChange)
    }
}
