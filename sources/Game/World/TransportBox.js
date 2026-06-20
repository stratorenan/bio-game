import * as THREE from 'three/webgpu'
import gsap from 'gsap'
import { color, texture } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Procedural **UN3373 biological-substance transport box** (a "friobox"-style blue cooler crate with
 * a grey clip-on lid) placed near the circuit tower. The blue body has
 * reinforcement ribs + a flared foot; the front carries the UN3373 placard + "Biological substance
 * category B" label (`static/areas/transportBoxLabel.png`, a white-on-transparent decal loaded at
 * runtime so it never blocks boot). Procedural for now; swap for a dedicated .glb later. Tweak
 * position / rotation / scale via the "📦 Transport Box" debug panel when the URL has #debug.
 */
export class TransportBox
{
    constructor()
    {
        this.game = Game.getInstance()

        // Placed near the circuit tower (tweak via the "📦 Transport Box" panel with #debug).
        this.position = new THREE.Vector3(-14.5, 0, 5.9)
        this.rotationY = 0.89
        this.scale = 1

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.setLabelTexture()
        this.setDebug()
    }

    setMaterials()
    {
        // Vivid blue plastic (body, ribs, foot, rim)
        this.blueMaterial = new MeshDefaultMaterial({
            colorNode: color('#1f3fc4'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Grey lid
        this.greyMaterial = new MeshDefaultMaterial({
            colorNode: color('#6b6f77'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Darker grey (recessed lid top panel)
        this.darkGreyMaterial = new MeshDefaultMaterial({
            colorNode: color('#54585f'),
            hasWater: false,
            hasLightBounce: false,
        })

        // White (lid latch clips)
        this.whiteMaterial = new MeshDefaultMaterial({
            colorNode: color('#eef0f2'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Placeholder front-face colour until the label decal loads
        this.labelMaterial = new MeshDefaultMaterial({
            colorNode: color('#1f3fc4'),
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
            return mesh
        }

        const W = 2.4, D = 1.6, bodyH = 1
        const front = D * 0.5

        // Flared foot
        add(new THREE.BoxGeometry(W + 0.1, 0.2, D + 0.1), this.blueMaterial, 0, 0.1, 0)
        // Main body
        add(new THREE.BoxGeometry(W, bodyH, D), this.blueMaterial, 0, 0.2 + bodyH * 0.5, 0)
        // Top rim
        const bodyTop = 0.2 + bodyH
        add(new THREE.BoxGeometry(W + 0.1, 0.14, D + 0.1), this.blueMaterial, 0, bodyTop + 0.07, 0)

        // Reinforcement ribs — front (framing the label), sides and back
        for(const rx of [ -1, 1 ])
            add(new THREE.BoxGeometry(0.14, bodyH, 0.08), this.blueMaterial, rx, 0.2 + bodyH * 0.5, front + 0.02)
        for(const sx of [ -1, 1 ])
            for(const sz of [ -0.45, 0.45 ])
                add(new THREE.BoxGeometry(0.08, bodyH, 0.14), this.blueMaterial, sx * (W * 0.5 + 0.02), 0.2 + bodyH * 0.5, sz)
        for(const bx of [ -0.7, 0, 0.7 ])
            add(new THREE.BoxGeometry(0.14, bodyH, 0.08), this.blueMaterial, bx, 0.2 + bodyH * 0.5, - front - 0.02)

        // Grey lid (overhangs the body slightly)
        const lidBottom = bodyTop + 0.14
        add(new THREE.BoxGeometry(W + 0.15, 0.28, D + 0.12), this.greyMaterial, 0, lidBottom + 0.14, 0)
        add(new THREE.BoxGeometry(W - 0.2, 0.06, D - 0.2), this.darkGreyMaterial, 0, lidBottom + 0.28 + 0.03, 0)

        // White latch clips bridging the lid/body seam (front + back)
        for(const lz of [ front, - front ])
            for(const lx of [ -0.55, 0.55 ])
                add(new THREE.BoxGeometry(0.3, 0.34, 0.14), this.whiteMaterial, lx, bodyTop + 0.1, lz)

        // Front label decal (UN3373 + biological-substance text)
        this.labelMesh = add(new THREE.PlaneGeometry(2, 0.85), this.labelMaterial, 0, 0.62, front + 0.03)
    }

    setLabelTexture()
    {
        // Lazily load the UN3373 label and swap it onto the front-face plane (same runtime pattern as
        // the building/office signs), so the texture can never block boot. Transparent white decal.
        const loader = this.game.resourcesLoader.getLoader('texture')
        loader.load(
            'areas/transportBoxLabel.png?cb=1',
            (labelTexture) =>
            {
                labelTexture.colorSpace = THREE.SRGBColorSpace
                labelTexture.anisotropy = 4

                this.labelMesh.material = new MeshDefaultMaterial({
                    colorNode: texture(labelTexture).rgb,
                    alphaNode: texture(labelTexture).a,
                    transparent: true,
                    hasWater: false,
                    hasLightBounce: false,
                    hasCoreShadows: false,
                    hasDropShadows: false,
                })
            },
            undefined,
            () => console.warn('TransportBox > Could not load label texture'),
        )
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
                    { shape: 'cuboid', parameters: [ 1.27 * this.scale, 0.82 * this.scale, 0.87 * this.scale ], position: { x: 0, y: 0.82 * this.scale, z: 0 }, category: 'object' },
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

    // Remove the box from the world (visual + physics). Used while a race is running.
    hide()
    {
        if(this.collectTimeline)
        {
            this.collectTimeline.kill()
            this.collectTimeline = null
        }
        this.game.objects.disable(this.object)
    }

    // Bring the box back into the world, reset to its placed transform. Used once a race ends.
    show()
    {
        const object3D = this.object.visual.object3D
        object3D.position.copy(this.position)
        object3D.rotation.set(0, this.rotationY, 0)
        object3D.scale.setScalar(this.scale)
        this.game.objects.enable(this.object)
    }

    // Animate the box arcing into the vehicle (a "collect the sample" pickup), then remove it from
    // the world and run onComplete. The physics body is disabled up front so the box no longer
    // collides and the per-frame Objects sync stops overwriting the tweened visual.
    collectInto(targetPosition, onComplete = null)
    {
        if(this.collectTimeline)
            this.collectTimeline.kill()

        this.object.physical.body.setEnabled(false)

        const object3D = this.object.visual.object3D
        const start = object3D.position.clone()
        const target = targetPosition.clone()
        const peakY = Math.max(start.y, target.y) + 3
        const duration = 0.9

        this.collectTimeline = gsap.timeline({
            onComplete: () =>
            {
                this.collectTimeline = null
                this.game.objects.disable(this.object)
                if(onComplete)
                    onComplete()
            }
        })

        // Tumble + travel horizontally to the vehicle
        this.collectTimeline.to(object3D.rotation, { x: Math.PI * 0.6, y: object3D.rotation.y + Math.PI * 2, duration, ease: 'power1.in' }, 0)
        this.collectTimeline.to(object3D.position, { x: target.x, z: target.z, duration, ease: 'power2.in' }, 0)
        // Arc up then down into the vehicle
        this.collectTimeline.to(object3D.position, { y: peakY, duration: duration * 0.5, ease: 'power2.out' }, 0)
        this.collectTimeline.to(object3D.position, { y: target.y + 0.5, duration: duration * 0.5, ease: 'power2.in' }, duration * 0.5)
        // Shrink into the vehicle at the end
        this.collectTimeline.to(object3D.scale, { x: 0.01, y: 0.01, z: 0.01, duration: duration * 0.45, ease: 'power2.in' }, duration * 0.55)
    }

    setDebug()
    {
        if(!this.game.debug.active)
            return

        const panel = this.game.debug.panel.addFolder({ title: '📦 Transport Box', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'y', { min: -2, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationY', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', onChange)
        panel.addBinding(this, 'scale', { min: 0.3, max: 3, step: 0.05 }).on('change', () =>
        {
            this.group.scale.setScalar(this.scale)
        })
    }
}
