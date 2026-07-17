import * as THREE from 'three/webgpu'
import gsap from 'gsap'
import { color, texture } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Two procedural **MVE-style cryogenic sample transporters** (the "volta transportador criogênico"),
 * standing side by side near the circuit tower: a white cylindrical **VOLTA vapor shipper** (aluminium
 * body, blue base band + cap, tapered shoulder, capped neck, grab ring) and a navy-blue **domed dry
 * shipper** (wide conical body, hemispherical lid with side butterfly clasps + a front draw-latch).
 * They are the "amostra" (sample) the player collects to start a race. Each front face carries the
 * biological-substance decal (`static/areas/transportBoxLabel.png`, loaded at runtime so it never
 * blocks boot). Procedural for now; swap for a dedicated .glb later. Tweak position / rotation / scale
 * via the "📦 Transport Box" debug panel when the URL has #debug.
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

        // Local placement of the two transporters (relative to the group origin).
        this.units = [
            { x: -0.78, z: 0.14, rotationY: 0.3, type: 'white' },
            { x: 0.82, z: -0.12, rotationY: -0.5, type: 'blue' },
        ]
        this.labels = []

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.setLabelTexture()
        this.setDebug()
    }

    setMaterials()
    {
        // Brushed-aluminium body
        this.bodyMaterial = new MeshDefaultMaterial({
            colorNode: color('#c2ccd6'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Lighter aluminium (tapered shoulder)
        this.shoulderMaterial = new MeshDefaultMaterial({
            colorNode: color('#d6dee6'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Blue accents (base band + cap) — keeps the Biologistica blue for brand continuity
        this.blueMaterial = new MeshDefaultMaterial({
            colorNode: color('#1f3fc4'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Dark grey (foot, neck, cap knob, grab ring)
        this.greyMaterial = new MeshDefaultMaterial({
            colorNode: color('#54585f'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Navy blue (blue dry-shipper body)
        this.navyMaterial = new MeshDefaultMaterial({
            colorNode: color('#34489d'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Darker navy (dome, flange, base of the blue dry-shipper)
        this.darkNavyMaterial = new MeshDefaultMaterial({
            colorNode: color('#273a82'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Chrome / silver (butterfly clasps, vent knob)
        this.silverMaterial = new MeshDefaultMaterial({
            colorNode: color('#aab0ba'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Black plastic (front draw-latch)
        this.blackMaterial = new MeshDefaultMaterial({
            colorNode: color('#1b1d24'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Placeholder front-face colour until the label decal loads
        this.labelMaterial = new MeshDefaultMaterial({
            colorNode: color('#c2ccd6'),
            hasWater: false,
            hasLightBounce: false,
        })
    }

    setMesh()
    {
        this.group = new THREE.Group()
        this.group.scale.setScalar(this.scale)

        for(const unit of this.units)
            this.group.add(unit.type === 'blue' ? this.createBlueShipper(unit) : this.createTransporter(unit))
    }

    // Build one cylindrical cryogenic transporter (dewar) as a group placed at the given offset.
    createTransporter({ x = 0, z = 0, rotationY = 0 })
    {
        const transporter = new THREE.Group()
        transporter.position.set(x, 0, z)
        transporter.rotation.y = rotationY

        const radialSegments = 24

        const add = (geometry, material, y) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.y = y
            transporter.add(mesh)
            return mesh
        }

        // Foot / base
        add(new THREE.CylinderGeometry(0.5, 0.55, 0.14, radialSegments), this.greyMaterial, 0.07)
        // Blue base band
        add(new THREE.CylinderGeometry(0.5, 0.5, 0.2, radialSegments), this.blueMaterial, 0.24)
        // Main aluminium body
        add(new THREE.CylinderGeometry(0.48, 0.48, 1.15, radialSegments), this.bodyMaterial, 0.14 + 1.15 * 0.5)
        // Tapered shoulder
        const bodyTop = 0.14 + 1.15
        add(new THREE.CylinderGeometry(0.3, 0.48, 0.32, radialSegments), this.shoulderMaterial, bodyTop + 0.16)
        // Neck
        const shoulderTop = bodyTop + 0.32
        add(new THREE.CylinderGeometry(0.2, 0.22, 0.16, radialSegments), this.greyMaterial, shoulderTop + 0.08)
        // Grab ring around the neck
        const ring = add(new THREE.TorusGeometry(0.28, 0.045, 10, radialSegments), this.greyMaterial, shoulderTop + 0.08)
        ring.rotation.x = Math.PI * 0.5
        // Branded cap
        const neckTop = shoulderTop + 0.16
        add(new THREE.CylinderGeometry(0.24, 0.22, 0.14, radialSegments), this.blueMaterial, neckTop + 0.07)
        // Cap knob
        add(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), this.greyMaterial, neckTop + 0.14 + 0.03)

        // Front decal — the Biologística wordmark (loaded later), sized to the 4:1 logo aspect and
        // sitting just off the body front face
        const labelMesh = add(new THREE.PlaneGeometry(0.7, 0.175), this.labelMaterial, 0.85)
        labelMesh.position.z = 0.49
        this.labels.push({ mesh: labelMesh, path: 'areas/biologisticaLogo.png?cb=1' })

        return transporter
    }

    // Build the navy-blue domed "dry shipper": a wide conical body with a hemispherical lid, side
    // butterfly clasps, a front draw-latch and a front label panel.
    createBlueShipper({ x = 0, z = 0, rotationY = 0 })
    {
        const shipper = new THREE.Group()
        shipper.position.set(x, 0, z)
        shipper.rotation.y = rotationY

        const radialSegments = 28

        const add = (geometry, material, y) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.y = y
            shipper.add(mesh)
            return mesh
        }

        // Wide foot / base
        add(new THREE.CylinderGeometry(0.68, 0.74, 0.12, radialSegments), this.darkNavyMaterial, 0.06)
        // Conical body (wide at the bottom, tapering in toward the lid)
        const bodyHeight = 0.95
        add(new THREE.CylinderGeometry(0.52, 0.7, bodyHeight, radialSegments), this.navyMaterial, 0.12 + bodyHeight * 0.5)
        const bodyTop = 0.12 + bodyHeight
        // Lid seat / flange (overhangs the body top)
        add(new THREE.CylinderGeometry(0.62, 0.6, 0.12, radialSegments), this.darkNavyMaterial, bodyTop + 0.06)
        const flangeTop = bodyTop + 0.12

        // Hemispherical dome lid
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(0.63, radialSegments, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
            this.darkNavyMaterial
        )
        dome.position.y = flangeTop
        shipper.add(dome)
        // Vent knob on top of the dome
        add(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), this.silverMaterial, flangeTop + 0.63 + 0.02)

        // Two side butterfly clasps at the flange
        for(const sx of [ -1, 1 ])
        {
            const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), this.silverMaterial)
            pin.rotation.z = Math.PI * 0.5
            pin.position.set(sx * 0.66, flangeTop - 0.03, 0)
            shipper.add(pin)

            const wing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.09), this.silverMaterial)
            wing.position.set(sx * 0.78, flangeTop - 0.03, 0)
            shipper.add(wing)
        }

        // Front draw-latch (black)
        const latch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.34, 0.08), this.blackMaterial)
        latch.position.set(0, flangeTop - 0.08, 0.58)
        shipper.add(latch)
        const latchClip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.11), this.blackMaterial)
        latchClip.position.set(0, flangeTop + 0.05, 0.56)
        shipper.add(latchClip)

        // Front label panel (lower body) — tilted to follow the cone
        const labelMesh = add(new THREE.PlaneGeometry(0.58, 0.4), this.labelMaterial, 0.56)
        labelMesh.position.z = 0.66
        labelMesh.rotation.x = -0.16
        this.labels.push({ mesh: labelMesh, path: 'areas/transportBoxLabel.png?cb=1' })

        return shipper
    }

    setLabelTexture()
    {
        // Lazily load each container's front decal — the Biologística wordmark on the white shipper,
        // the biological-substance label on the blue one — and swap it onto its front-face plane
        // (same runtime pattern as the building/office signs), so a texture can never block boot.
        const loader = this.game.resourcesLoader.getLoader('texture')

        for(const label of this.labels)
        {
            loader.load(
                label.path,
                (labelTexture) =>
                {
                    labelTexture.colorSpace = THREE.SRGBColorSpace
                    labelTexture.anisotropy = 4

                    label.mesh.material = new MeshDefaultMaterial({
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
                () => console.warn(`TransportBox > Could not load label texture: ${label.path}`),
            )
        }
    }

    setPhysics()
    {
        const s = this.scale
        const colliders = this.units.map((unit) =>
        {
            const isBlue = unit.type === 'blue'
            const halfHeight = (isBlue ? 0.85 : 0.98) * s
            const radius = (isBlue ? 0.7 : 0.52) * s
            return {
                shape: 'cylinder',
                parameters: [ halfHeight, radius ],
                position: { x: unit.x * s, y: halfHeight, z: unit.z * s },
                category: 'object',
            }
        })

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
