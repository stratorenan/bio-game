import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Procedural low-poly **radar dish**: a concrete base + blue accent ring, a metal pedestal and a
 * rotating head carrying a parabolic dish (rim + tripod feed struts + feed horn) and a red indicator
 * light. The head slowly sweeps in azimuth like a real radar. Replaces the old "Time Machine" TV set
 * on its little island. Procedural for now; swap for a dedicated .glb later. Tweak position /
 * rotation / scale via the "📡 Radar Dish" debug panel when the URL has #debug.
 */
export class RadarDish
{
    constructor(position = new THREE.Vector3(), options = {})
    {
        this.game = Game.getInstance()

        this.position = position.clone()
        this.rotationY = options.rotationY ?? 0
        this.scale = options.scale ?? 1
        this.sweepSpeed = options.sweepSpeed ?? 0.3 // radians / second
        this.tilt = options.tilt ?? 0.62 // dish elevation tilt (radians from vertical)

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.setDebug()
    }

    setMaterials()
    {
        // Concrete base
        this.concreteMaterial = new MeshDefaultMaterial({ colorNode: color('#3a3f47'), hasWater: false, hasLightBounce: false })
        // Light metal (pedestal, yoke)
        this.metalMaterial = new MeshDefaultMaterial({ colorNode: color('#8a9099'), hasWater: false, hasLightBounce: false })
        // Dark metal (caps, struts, counterweight)
        this.darkMetalMaterial = new MeshDefaultMaterial({ colorNode: color('#54585f'), hasWater: false, hasLightBounce: false })
        // Dish face (light, double sided so the concave reads as a bowl)
        this.dishMaterial = new MeshDefaultMaterial({ colorNode: color('#e2e7ec'), hasWater: false, hasLightBounce: false, side: THREE.DoubleSide })
        // Blue accent (brand continuity)
        this.blueMaterial = new MeshDefaultMaterial({ colorNode: color('#1f3fc4'), hasWater: false, hasLightBounce: false })
        // Red indicator light (kept bright, no shadowing)
        this.lightMaterial = new MeshDefaultMaterial({ colorNode: color('#ff3b30').mul(3), hasWater: false, hasLightBounce: false, hasCoreShadows: false, hasDropShadows: false })
    }

    setMesh()
    {
        this.group = new THREE.Group()
        this.group.scale.setScalar(this.scale)

        const add = (parent, geometry, material, y = 0) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.y = y
            parent.add(mesh)
            return mesh
        }

        // Concrete base
        add(this.group, new THREE.CylinderGeometry(0.6, 0.82, 0.24, 20), this.concreteMaterial, 0.12)
        // Blue accent ring around the base
        const ring = add(this.group, new THREE.TorusGeometry(0.62, 0.05, 8, 24), this.blueMaterial, 0.26)
        ring.rotation.x = Math.PI * 0.5

        // Pedestal
        const pedestalHeight = 1.45
        add(this.group, new THREE.CylinderGeometry(0.28, 0.36, pedestalHeight, 16), this.metalMaterial, 0.24 + pedestalHeight * 0.5)
        const pedestalTop = 0.24 + pedestalHeight
        // Pedestal cap (bearing)
        add(this.group, new THREE.CylinderGeometry(0.4, 0.4, 0.14, 16), this.darkMetalMaterial, pedestalTop + 0.07)

        // Rotating head (sweeps in azimuth)
        this.head = new THREE.Group()
        this.head.position.y = pedestalTop + 0.14
        this.head.rotation.y = this.rotationY
        this.group.add(this.head)

        // Yoke base
        add(this.head, new THREE.BoxGeometry(0.5, 0.2, 0.5), this.metalMaterial, 0.1)
        // Counterweight at the back
        const counterweight = add(this.head, new THREE.BoxGeometry(0.26, 0.26, 0.32), this.darkMetalMaterial, 0.3)
        counterweight.position.z = -0.42
        // Red indicator light on top of the counterweight
        const light = add(this.head, new THREE.BoxGeometry(0.1, 0.12, 0.1), this.lightMaterial, 0.5)
        light.position.z = -0.42

        // Dish assembly (built pointing +Y, then tilted up for elevation)
        this.dishAssembly = new THREE.Group()
        this.dishAssembly.position.set(0, 0.28, 0.12)
        this.dishAssembly.rotation.x = this.tilt
        this.head.add(this.dishAssembly)

        this.buildDish(this.dishAssembly)
    }

    // Build a bowl-shaped dish whose concave opening faces +Y, plus rim, feed struts and feed horn.
    buildDish(parent)
    {
        const radius = 1.25
        const thetaLength = Math.PI * 0.36

        // Dish: bottom spherical cap (concave up), lifted so the vertex sits at y = 0
        const dish = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 30, 16, 0, Math.PI * 2, Math.PI - thetaLength, thetaLength),
            this.dishMaterial
        )
        dish.position.y = radius
        parent.add(dish)

        // Opening geometry
        const rimY = radius + radius * Math.cos(Math.PI - thetaLength) // rim plane height
        const openingRadius = radius * Math.sin(thetaLength)

        // Rim
        const rim = new THREE.Mesh(new THREE.TorusGeometry(openingRadius, 0.04, 8, 32), this.darkMetalMaterial)
        rim.rotation.x = Math.PI * 0.5
        rim.position.y = rimY
        parent.add(rim)

        // Feed horn at the focal point, pointing back down into the dish
        const focalY = radius * 0.62
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 12), this.darkMetalMaterial)
        horn.rotation.x = Math.PI // apex points down toward the dish
        horn.position.y = focalY
        parent.add(horn)
        const hornBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10), this.darkMetalMaterial)
        hornBase.position.y = focalY + 0.16
        parent.add(hornBase)

        // Tripod feed struts from the rim to the feed horn
        const focal = new THREE.Vector3(0, focalY, 0)
        for(let i = 0; i < 3; i++)
        {
            const angle = (i / 3) * Math.PI * 2
            const from = new THREE.Vector3(Math.cos(angle) * openingRadius * 0.92, rimY, Math.sin(angle) * openingRadius * 0.92)
            parent.add(this.createStrut(from, focal, 0.025, this.darkMetalMaterial))
        }
    }

    // A thin cylinder connecting two points
    createStrut(from, to, radius, material)
    {
        const direction = new THREE.Vector3().subVectors(to, from)
        const length = direction.length()
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 6), material)
        strut.position.copy(from).add(to).multiplyScalar(0.5)
        strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
        return strut
    }

    setPhysics()
    {
        const s = this.scale
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
                    { shape: 'cylinder', parameters: [ 0.95 * s, 0.5 * s ], position: { x: 0, y: 0.95 * s, z: 0 }, category: 'object' },
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

    // Slowly sweep the head in azimuth. Called from the owning area's (frustum-gated) update.
    update()
    {
        if(this.head)
            this.head.rotation.y += this.sweepSpeed * this.game.ticker.deltaScaled
    }

    setDebug()
    {
        if(!this.game.debug.active)
            return

        const panel = this.game.debug.panel.addFolder({ title: '📡 Radar Dish', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'y', { min: -2, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationY', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', () =>
        {
            if(this.head)
                this.head.rotation.y = this.rotationY
        })
        panel.addBinding(this, 'tilt', { min: 0, max: Math.PI * 0.5, step: 0.01 }).on('change', () =>
        {
            if(this.dishAssembly)
                this.dishAssembly.rotation.x = this.tilt
        })
        panel.addBinding(this, 'sweepSpeed', { min: 0, max: 2, step: 0.01 })
        panel.addBinding(this, 'scale', { min: 0.3, max: 3, step: 0.05 }).on('change', () =>
        {
            this.group.scale.setScalar(this.scale)
        })
    }
}
