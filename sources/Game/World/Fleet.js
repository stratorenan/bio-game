import * as THREE from 'three/webgpu'
import { color, texture } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Procedural **Biologística fleet depot** — a circular paved lot with eight on-brand delivery vans
 * arranged in a **radial sunburst** (noses converging at the centre, tails fanned out). The van is a
 * real CC-BY cargo-van model (`static/fleetVan/fleetVan.glb`, "FedEx van" by **memoov** /
 * sketchfab.com/movartD, CC-BY-4.0) that we **rebrand to Biologística**: all textures are stripped
 * offline (removing the FedEx livery + logos and shrinking the file), every material is re-coloured to
 * the flat game palette (white body, dark glass, black trim, silver wheels) at runtime, the leftover
 * FedEx logo meshes are hidden, and both flanks carry the full Biologística **side livery** (wordmark
 * + "Transportando Vidas" + "TRANSPORTAMOS" service list + heartbeat sweep; `static/areas/fleetVanDecal.png`
 * plus a second readable layout `fleetVanDecalMirror.png` for the 180°-rotated flank — both authored
 * readable so the wordmark points nose-forward and never appears backwards on either side). The model is lazily loaded so it never
 * blocks boot, then cloned into every bay. Placed where the original game's bowling area used to sit.
 * Tweak position / rotation / scale via the "🚐 Fleet" debug panel (#debug).
 */
export class Fleet
{
    constructor()
    {
        this.game = Game.getInstance()

        // Original bowling-area location (tweak via the "🚐 Fleet" panel with #debug).
        this.position = new THREE.Vector3(2.3, 0, 68.9)
        this.rotationY = 0
        this.scale = 1

        // Eight vans on a ring, each nose pointing at the centre (radial sunburst).
        this.ringRadius = 5.3
        this.vanCount = 8
        this.vanPlacements = []
        for(let i = 0; i < this.vanCount; i++)
        {
            const a = (i / this.vanCount) * Math.PI * 2
            const x = Math.cos(a) * this.ringRadius
            const z = Math.sin(a) * this.ringRadius
            const ry = Math.atan2(Math.sin(a), - Math.cos(a)) // local +X (nose) points toward the centre
            this.vanPlacements.push({ x, z, ry })
        }

        this.vanHalfWidth = 1.02     // model half-width (Z, after the +90° orientation fix)
        this.decalX = -0.52          // livery placement on the flank (tweak via the "🚐 Fleet" panel)
        this.decalY = 1.03
        this.decalScale = 0.87
        this.vanGroups = []
        this.leftDecals = []
        this.rightDecals = []
        this.decalLeftMaterial = null
        this.decalRightMaterial = null

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.loadVanModel()
        this.setDecalTexture()
        this.setDebug()
    }

    setMaterials()
    {
        this.asphaltMaterial = new MeshDefaultMaterial({ colorNode: color('#34383f'), hasWater: false, hasLightBounce: false })
        this.lineMaterial = new MeshDefaultMaterial({ colorNode: color('#e8ebef'), hasWater: false, hasLightBounce: false })
        this.curbMaterial = new MeshDefaultMaterial({ colorNode: color('#b9bdc2'), hasWater: false, hasLightBounce: false })

        // Van palette (the GLB's materials are re-assigned to these flat colours at runtime).
        this.bodyMaterial = new MeshDefaultMaterial({ colorNode: color('#f5f7fa'), hasWater: false, hasLightBounce: false })
        this.glassMaterial = new MeshDefaultMaterial({ colorNode: color('#14171b'), hasWater: false, hasLightBounce: false, side: THREE.DoubleSide })
        this.darkMaterial = new MeshDefaultMaterial({ colorNode: color('#1b1d22'), hasWater: false, hasLightBounce: false })
        this.hubMaterial = new MeshDefaultMaterial({ colorNode: color('#9aa0a8'), hasWater: false, hasLightBounce: false })
        this.lightMaterial = new MeshDefaultMaterial({ colorNode: color('#eef1f5'), hasWater: false, hasLightBounce: false })
        this.redMaterial = new MeshDefaultMaterial({ colorNode: color('#be1e2d'), hasWater: false, hasLightBounce: false })

        // Placeholder side-decal colour (white body) until the texture loads
        this.decalMaterial = new MeshDefaultMaterial({ colorNode: color('#f5f7fa'), hasWater: false, hasLightBounce: false })
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

        // ----- Circular paved lot + perimeter curb ring -----
        const padR = 9.2
        add(new THREE.CylinderGeometry(padR, padR, 0.08, 56), this.asphaltMaterial, 0, 0.04, 0)
        add(new THREE.TorusGeometry(padR, 0.13, 8, 60), this.curbMaterial, 0, 0.1, 0, Math.PI * 0.5)

        // ----- Radial bay lines between the vans -----
        const rm = 5.5, lineLen = 5.8
        for(let i = 0; i < this.vanCount; i++)
        {
            const phi = ((i + 0.5) / this.vanCount) * Math.PI * 2
            add(new THREE.BoxGeometry(lineLen, 0.02, 0.12), this.lineMaterial, Math.cos(phi) * rm, 0.09, Math.sin(phi) * rm, 0, - phi, 0)
        }

        // ----- One subgroup per bay (nose toward centre); the van model is cloned in later -----
        for(const placement of this.vanPlacements)
        {
            const van = new THREE.Group()
            van.position.set(placement.x, 0, placement.z)
            van.rotation.y = placement.ry
            this.group.add(van)
            this.vanGroups.push(van)
            this.addVanDecals(van)
        }
    }

    addVanDecals(van)
    {
        const z = this.vanHalfWidth + 0.03 // just proud of the body's flank
        const geometry = new THREE.PlaneGeometry(3.3, 0.74) // matches the 2400×540 livery ratio

        // The +Z flank shows the mirrored artwork and the -Z flank (rotated 180°) shows the base
        // artwork, so the wordmark reads correctly AND points toward the nose on BOTH sides.
        const left = new THREE.Mesh(geometry, this.decalLeftMaterial ?? this.decalMaterial)
        left.position.set(this.decalX, this.decalY, z)
        left.scale.setScalar(this.decalScale)
        left.castShadow = false

        const right = new THREE.Mesh(geometry, this.decalRightMaterial ?? this.decalMaterial)
        right.position.set(this.decalX, this.decalY, - z)
        right.rotation.y = Math.PI
        right.scale.setScalar(this.decalScale)
        right.castShadow = false

        van.add(left, right)
        this.leftDecals.push(left)
        this.rightDecals.push(right)
    }

    updateDecals()
    {
        const z = this.vanHalfWidth + 0.03
        for(const mesh of this.leftDecals)
        {
            mesh.position.set(this.decalX, this.decalY, z)
            mesh.scale.setScalar(this.decalScale)
        }
        for(const mesh of this.rightDecals)
        {
            mesh.position.set(this.decalX, this.decalY, - z)
            mesh.scale.setScalar(this.decalScale)
        }
    }

    loadVanModel()
    {
        const compressed = !!import.meta.env.VITE_COMPRESSED
        const suffix = compressed ? '-compressed' : ''
        const loader = this.game.resourcesLoader.getLoader('gltf')

        loader.load(
            `fleetVan/fleetVan${suffix}.glb?cb=1`,
            (gltf) =>
            {
                const base = gltf.scene
                this.applyVanMaterials(base)

                for(const van of this.vanGroups)
                {
                    const model = base.clone()
                    model.rotation.y = Math.PI * 0.5 // model front (+Z) → van local +X (toward the centre)
                    model.position.y = 0.17          // drop the wheels onto the pad
                    van.add(model)
                }
            },
            undefined,
            () => console.warn('Fleet > Could not load van model'),
        )
    }

    applyVanMaterials(root)
    {
        // Re-skin the FedEx model into the flat Biologística palette and hide the leftover logo meshes.
        const white = new Set([ 'Material.014', 'cajuela', 'cofre', 'puertas', 'puertas_tras' ])
        const glass = new Set([ 'Material.006', 'cristlaatixq', 'critastras', 'crist_der' ])
        const light = new Set([ 'Material.009' ])
        const silver = new Set([ 'Stainless_Steel' ])

        root.traverse((child) =>
        {
            if(!child.isMesh)
                return

            const meshName = child.name || ''
            if(/^Text/.test(meshName) || meshName.includes('3d-model.002'))
            {
                child.visible = false // FedEx rear wordmark / badge
                return
            }

            const materialName = child.material?.name || ''
            if(white.has(materialName)) child.material = this.bodyMaterial
            else if(glass.has(materialName)) child.material = this.glassMaterial
            else if(light.has(materialName)) child.material = this.lightMaterial
            else if(silver.has(materialName)) child.material = this.hubMaterial
            else child.material = this.darkMaterial // bumpers, trim, grille, tyres, frames, underbody

            child.castShadow = true
            child.receiveShadow = true
        })
    }

    setDecalTexture()
    {
        // Lazily load the Biologística livery (wordmark + "TRANSPORTAMOS" list + heartbeat sweep) and
        // swap it onto the van flanks. Two textures (base + horizontal mirror) keep the artwork facing
        // the nose and reading correctly on both sides. Loaded at runtime so it never blocks boot.
        const loader = this.game.resourcesLoader.getLoader('texture')

        const makeMaterial = (decalTexture) =>
        {
            decalTexture.colorSpace = THREE.SRGBColorSpace
            decalTexture.anisotropy = 4
            return new MeshDefaultMaterial({
                colorNode: texture(decalTexture).rgb,
                alphaNode: texture(decalTexture).a,
                transparent: true,
                hasWater: false,
                hasLightBounce: false,
                hasCoreShadows: false,
                hasDropShadows: false,
            })
        }

        // +Z flank (non-rotated plane) and -Z flank (180°-rotated plane) each get a *readable* layout
        // (wordmark-right vs wordmark-left). A 180° turn keeps text readable, so the rotated side must NOT
        // use a mirrored/flipped image — both are authored readable, with the wordmark toward the nose.
        loader.load(
            'areas/fleetVanDecal.png?cb=4',
            (tex) =>
            {
                this.decalLeftMaterial = makeMaterial(tex)
                for(const mesh of this.leftDecals)
                    mesh.material = this.decalLeftMaterial
            },
            undefined,
            () => console.warn('Fleet > Could not load van livery texture'),
        )

        loader.load(
            'areas/fleetVanDecalMirror.png?cb=4',
            (tex) =>
            {
                this.decalRightMaterial = makeMaterial(tex)
                for(const mesh of this.rightDecals)
                    mesh.material = this.decalRightMaterial
            },
            undefined,
            () => console.warn('Fleet > Could not load van livery mirror texture'),
        )
    }

    setPhysics()
    {
        const s = this.scale

        // One rotated box per van so the car can't drive through the parked fleet.
        const colliders = []
        for(const van of this.vanPlacements)
        {
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, van.ry, 0))
            colliders.push({
                shape: 'cuboid',
                parameters: [ 2.2 * s, 0.95 * s, 1.0 * s ], // half-extents: length(X) × height(Y) × width(Z)
                position: { x: van.x * s, y: 0.95 * s, z: van.z * s },
                quaternion: { x: q.x, y: q.y, z: q.z, w: q.w },
                category: 'object',
            })
        }

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

        const panel = this.game.debug.panel.addFolder({ title: '🚐 Fleet', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'y', { min: -2, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationY', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', onChange)
        panel.addBinding(this, 'scale', { min: 0.3, max: 2, step: 0.05 }).on('change', () =>
        {
            this.group.scale.setScalar(this.scale)
        })

        // Livery placement on the van flanks
        const decalChange = () => this.updateDecals()
        panel.addBinding(this, 'decalX', { min: -2, max: 2, step: 0.01, label: 'livery x' }).on('change', decalChange)
        panel.addBinding(this, 'decalY', { min: 0, max: 2, step: 0.01, label: 'livery y' }).on('change', decalChange)
        panel.addBinding(this, 'decalScale', { min: 0.4, max: 1.6, step: 0.01, label: 'livery scale' }).on('change', decalChange)
    }
}
