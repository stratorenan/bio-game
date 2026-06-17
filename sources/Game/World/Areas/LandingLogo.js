import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import logoSvg from './biologistica-logo.svg?raw'
import { Game } from '../../Game.js'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

/**
 * Replaces the original "BRUNO SIMON" landing letter blocks with the Biologistica
 * logo, extruded from its SVG into a solid 3D sign. Placeholder for a future .glb.
 * The original letter objects are removed (visual + physics) so they no longer show.
 * Position / rotation / size are tweakable below and live via the "🅱️ Logo" debug panel.
 */
export class LandingLogo
{
    constructor(letterReferences = [])
    {
        this.game = Game.getInstance()
        this.letterReferences = letterReferences

        // Tweakables
        this.targetWidth = 13      // world units across
        this.worldDepth = 0.6      // extrusion thickness
        this.rotationOffset = 0    // extra yaw if the sign faces the wrong way
        this.yOffset = 0           // lift/sink to sit on the ground

        this.computePlacement()
        this.removeOriginalLetters()
        this.setMaterial()
        this.build()
        this.setPhysics()
        this.applyTransform()
        this.setDebug()
    }

    computePlacement()
    {
        // Anchor at the average of the original letters (their positions are world-space
        // after the Area added them); face the sign along the letters' row direction.
        const anchor = new THREE.Vector3()
        let groundY = Infinity
        const refs = this.letterReferences

        if(refs.length >= 2)
        {
            for(const ref of refs)
            {
                anchor.add(ref.position)
                groundY = Math.min(groundY, ref.position.y)
            }
            anchor.divideScalar(refs.length)

            const rowDir = new THREE.Vector3().subVectors(
                refs[refs.length - 1].position,
                refs[0].position,
            )
            // + PI so the front face (readable text) points toward the spawn/camera
            this.baseYaw = Math.atan2(-rowDir.z, rowDir.x) + Math.PI
            this.groundY = groundY - 0.72 // letters' position is their center; drop to ~ground
        }
        else
        {
            anchor.set(44, 0.74, 41.6)
            this.baseYaw = -2.7 + Math.PI
            this.groundY = 0
        }

        this.anchor = anchor
    }

    removeOriginalLetters()
    {
        // Hide the original letters. Use objects.disable() (keeps the rigid-body handle
        // valid) rather than removing the body — a freed handle would crash Rapier when
        // Objects.update() reads its translation. Also drop them from the registry.
        const toRemove = new Set()

        for(const ref of this.letterReferences)
        {
            const object = ref.userData.object
            if(!object)
                continue

            toRemove.add(object)
            this.game.objects.disable(object)
        }

        this.game.objects.list.forEach((object, key) =>
        {
            if(toRemove.has(object))
                this.game.objects.list.delete(key)
        })
    }

    setMaterial()
    {
        this.material = new MeshDefaultMaterial({
            colorNode: color('#be1e2d'),
            side: THREE.DoubleSide,
            hasWater: false,
            hasLightBounce: false,
        })
    }

    build()
    {
        const paths = new SVGLoader().parse(logoSvg).paths

        const shapes = []
        const box2 = new THREE.Box2()
        for(const path of paths)
        {
            for(const shape of SVGLoader.createShapes(path))
            {
                shapes.push(shape)
                for(const point of shape.getPoints())
                    box2.expandByPoint(point)
            }
        }

        const rawWidth = box2.max.x - box2.min.x
        const rawHeight = box2.max.y - box2.min.y
        const scale = this.targetWidth / rawWidth
        this.scaledHeight = rawHeight * scale
        const center = box2.getCenter(new THREE.Vector2())

        // Extrude depth in SVG units so that, once scaled, it equals worldDepth
        const depth = this.worldDepth / scale

        const inner = new THREE.Group()
        for(const shape of shapes)
        {
            const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
            geometry.translate(-center.x, -center.y, -depth * 0.5)
            const mesh = new THREE.Mesh(geometry, this.material)
            mesh.castShadow = true
            mesh.receiveShadow = true
            inner.add(mesh)
        }

        // SVG is Y-down → flip Y (negative scale; DoubleSide keeps lighting correct)
        inner.scale.set(scale, -scale, scale)

        this.group = new THREE.Group()
        this.group.add(inner)
        this.game.scene.add(this.group)
    }

    setPhysics()
    {
        this.object = this.game.objects.add(
            {
                model: this.group,
                updateMaterials: false,
                castShadow: true,
                receiveShadow: true,
                parent: null, // already added to the scene in build()
            },
            {
                type: 'fixed',
                position: this.anchor,
                colliders: [
                    {
                        shape: 'cuboid',
                        parameters: [ this.targetWidth * 0.5, this.scaledHeight * 0.5, this.worldDepth * 0.5 ],
                        category: 'object',
                    },
                ],
            }
        )
    }

    applyTransform()
    {
        const yaw = this.baseYaw + this.rotationOffset
        const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))

        this.position = this.anchor.clone()
        this.position.y = this.groundY + this.scaledHeight * 0.5 + this.yOffset

        this.object.physical.body.setTranslation(this.position, true)
        this.object.physical.body.setRotation(quaternion, true)
        this.group.position.copy(this.position)
        this.group.quaternion.copy(quaternion)
    }

    setDebug()
    {
        if(!this.game.debug.active)
            return

        const panel = this.game.debug.panel.addFolder({ title: '🅱️ Logo', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.anchor, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.anchor, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'groundY', { min: -5, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'yOffset', { min: -5, max: 5, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationOffset', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', onChange)
    }
}
