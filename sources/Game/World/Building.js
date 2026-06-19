import * as THREE from 'three/webgpu'
import { color, Fn, max, mix, positionWorld, texture, vec3 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * "Biologistica Tower" — a low-poly but deliberately non-generic landmark tower placed in the
 * circuit, centered between the two flag banners (refBanners @ z≈0.04 / refBanners.001 @ z≈11.63).
 * It shares the campus material language (blue curtain-wall glass with a sky-reflection gradient +
 * white fins + concrete copings + red brand accent) but has a dynamic silhouette: a glass podium,
 * a three-tier **stepped/setback** tower with full-height vertical fins, a **cantilevered sky-deck**,
 * a **vertical red brand blade**, the real Biologística wordmark on a podium sign (loaded at runtime
 * so it never blocks boot), and a glass crown topped by a **spire + glowing red beacon**. Procedural
 * for now; swap for a dedicated .glb later. Tweak position / rotation / scale via the "🏢 Building"
 * debug panel when the URL has #debug.
 */
export class Building
{
    constructor()
    {
        this.game = Game.getInstance()

        // Centered between the two flag banners on the circuit (tweak via the "🏢 Building" panel).
        this.position = new THREE.Vector3(-19.7, -0.2, 5.8)
        this.rotationY = 1.56
        this.scale = 0.67

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.setSignTexture()
        this.setDebug()
    }

    setMaterials()
    {
        // Bright lines near each cell boundary (window grids / mullions)
        const lineMask = (coord, cellSize, sharpness = 0.82) =>
        {
            const cell = coord.mod(cellSize).mul(1 / cellSize)
            const edge = cell.sub(0.5).abs().mul(2)
            return edge.smoothstep(sharpness, 1)
        }

        // Blue reflective curtain-wall glass with a tall sky-reflection gradient + mullion grid.
        const glassColorNode = Fn(() =>
        {
            const deep = color('#16315f')
            const sky = color('#6f97d2')
            const frameColor = color('#aebdd6')

            const reflection = positionWorld.y.smoothstep(0.4, 9) // taller gradient for a tall tower
            const glass = mix(deep, sky, reflection)

            const floors = lineMask(positionWorld.y, 1)
            const mullionsX = lineMask(positionWorld.x, 0.85)
            const mullionsZ = lineMask(positionWorld.z, 0.85)
            const frame = max(floors, max(mullionsX, mullionsZ))

            return vec3(mix(glass, frameColor, frame.mul(0.5)))
        })()

        this.glassMaterial = new MeshDefaultMaterial({
            colorNode: glassColorNode,
            hasWater: false,
            hasLightBounce: false,
        })

        // Darker entrance-door glass
        this.darkGlassMaterial = new MeshDefaultMaterial({
            colorNode: color('#10223f'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Crisp white (vertical fins, corner pilasters, sky-deck)
        this.whiteMaterial = new MeshDefaultMaterial({
            colorNode: color('#eef0f5'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Solid light concrete (plinth, copings, canopy, spire base)
        this.concreteMaterial = new MeshDefaultMaterial({
            colorNode: color('#dfe3ea'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Red brand accent (vertical blade, canopy trim, sign backing) — Biologística red
        this.accentMaterial = new MeshDefaultMaterial({
            colorNode: color('#be1e2d'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Glowing red beacon (kept bright by dropping shading)
        this.beaconMaterial = new MeshDefaultMaterial({
            colorNode: color('#ff5a4d'),
            hasWater: false,
            hasLightBounce: false,
            hasCoreShadows: false,
            hasDropShadows: false,
            hasFog: false,
        })

        // Dark metal (spire, canopy posts, door divider)
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

        const add = (geometry, material, x, y, z) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            this.group.add(mesh)
            return mesh
        }

        const base = 0.5

        // ----- Plinth / plaza -----
        add(new THREE.BoxGeometry(9, base, 8), this.concreteMaterial, 0, base * 0.5, 0)

        // ----- Glass podium (two-storey base) -----
        const PW = 7, PH = 2.4, PD = 6
        add(new THREE.BoxGeometry(PW, PH, PD), this.glassMaterial, 0, base + PH * 0.5, 0)
        add(new THREE.BoxGeometry(PW + 0.3, 0.3, PD + 0.3), this.concreteMaterial, 0, base + PH + 0.15, 0)
        const podiumFront = PD * 0.5
        const podiumTop = base + PH
        // White corner pilasters
        for(const sx of [ -1, 1 ])
            for(const sz of [ -1, 1 ])
                add(new THREE.BoxGeometry(0.3, PH, 0.3), this.whiteMaterial, sx * (PW * 0.5 - 0.15), base + PH * 0.5, sz * (PD * 0.5 - 0.15))

        // ----- Entrance: recessed doors + divider, canopy on posts, wood deck, planters -----
        add(new THREE.BoxGeometry(2.6, 2, 0.2), this.darkGlassMaterial, 0, base + 1, podiumFront + 0.02)
        add(new THREE.BoxGeometry(0.1, 2, 0.24), this.metalMaterial, 0, base + 1, podiumFront + 0.05)
        add(new THREE.BoxGeometry(4, 0.25, 1.4), this.concreteMaterial, 0, base + 2.2, podiumFront + 0.6)
        add(new THREE.BoxGeometry(4, 0.1, 0.1), this.accentMaterial, 0, base + 2.05, podiumFront + 1.28)
        add(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), this.metalMaterial, -1.7, base + 1.1, podiumFront + 1.1)
        add(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), this.metalMaterial, 1.7, base + 1.1, podiumFront + 1.1)
        add(new THREE.BoxGeometry(4.4, 0.16, 2), this.woodMaterial, 0, base + 0.08, podiumFront + 1.2)
        for(const px of [ -2.6, 2.6 ])
        {
            add(new THREE.BoxGeometry(0.8, 0.5, 0.8), this.concreteMaterial, px, base + 0.25, podiumFront + 1.2)
            add(new THREE.BoxGeometry(0.7, 0.45, 0.7), this.plantMaterial, px, base + 0.7, podiumFront + 1.2)
        }
        // Biologística wordmark sign above the entrance
        add(new THREE.BoxGeometry(3, 0.7, 0.14), this.accentMaterial, 0, base + 2.0, podiumFront + 0.06)
        this.signMesh = add(new THREE.PlaneGeometry(2.7, 0.5), this.whiteMaterial, 0, base + 2.0, podiumFront + 0.15)

        // ----- Tier 1 (widest) -----
        const T1W = 5.2, T1H = 3.4, T1D = 4.4
        add(new THREE.BoxGeometry(T1W, T1H, T1D), this.glassMaterial, 0, podiumTop + T1H * 0.5, 0)
        add(new THREE.BoxGeometry(T1W + 0.3, 0.3, T1D + 0.3), this.concreteMaterial, 0, podiumTop + T1H + 0.15, 0)
        const t1Front = T1D * 0.5
        const t1Top = podiumTop + T1H
        // Full-height vertical white fins on the front face
        for(const fx of [ -1.8, -0.9, 0, 0.9, 1.8 ])
            add(new THREE.BoxGeometry(0.16, T1H * 0.95, 0.12), this.whiteMaterial, fx, podiumTop + T1H * 0.5, t1Front + 0.04)

        // ----- Tier 2 (setback) + cantilevered sky-deck -----
        const T2W = 4, T2H = 3, T2D = 3.4
        const t2Base = t1Top + 0.3
        add(new THREE.BoxGeometry(T2W, T2H, T2D), this.glassMaterial, 0, t2Base + T2H * 0.5, 0)
        add(new THREE.BoxGeometry(T2W + 0.3, 0.3, T2D + 0.3), this.concreteMaterial, 0, t2Base + T2H + 0.15, 0)
        const t2Top = t2Base + T2H
        // Cantilevered sky-deck slab projecting over tier 1, with a thin railing
        add(new THREE.BoxGeometry(3, 0.18, 1.3), this.whiteMaterial, 0, t2Base + 0.4, t1Front + 0.1)
        add(new THREE.BoxGeometry(3, 0.4, 0.06), this.metalMaterial, 0, t2Base + 0.6, t1Front + 0.72)

        // ----- Tier 3 (narrowest) -----
        const T3W = 2.8, T3H = 2.6, T3D = 2.4
        const t3Base = t2Top + 0.3
        add(new THREE.BoxGeometry(T3W, T3H, T3D), this.glassMaterial, 0, t3Base + T3H * 0.5, 0)
        add(new THREE.BoxGeometry(T3W + 0.3, 0.3, T3D + 0.3), this.concreteMaterial, 0, t3Base + T3H + 0.15, 0)
        const t3Top = t3Base + T3H

        // ----- Vertical red brand blade running up the front (a freestanding fin) -----
        add(new THREE.BoxGeometry(0.4, 6, 0.3), this.accentMaterial, -2.2, podiumTop + 3, t1Front + 0.1)

        // ----- Glass crown + spire + glowing beacon -----
        const crownBase = t3Top + 0.3
        add(new THREE.BoxGeometry(1.8, 1.2, 1.5), this.glassMaterial, 0, crownBase + 0.6, 0)
        add(new THREE.BoxGeometry(2, 0.25, 1.7), this.concreteMaterial, 0, crownBase + 1.2 + 0.12, 0)
        const crownTop = crownBase + 1.2
        add(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 12), this.concreteMaterial, 0, crownTop + 0.2, 0)
        add(new THREE.CylinderGeometry(0.05, 0.2, 3.2, 8), this.metalMaterial, 0, crownTop + 0.3 + 1.6, 0)
        add(new THREE.IcosahedronGeometry(0.22, 0), this.beaconMaterial, 0, crownTop + 0.3 + 3.3, 0)
    }

    setSignTexture()
    {
        // Lazily load the Biologística wordmark and swap it onto the podium sign plane (same proven
        // runtime pattern as the office / lab), so the texture can never block boot.
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
            () => console.warn('Building > Could not load logo texture'),
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
                    { shape: 'cuboid', parameters: [ 3.6 * this.scale, 5 * this.scale, 3 * this.scale ], position: { x: 0, y: 5 * this.scale, z: 0 }, category: 'object' },
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
        panel.addBinding(this, 'scale', { min: 0.2, max: 2, step: 0.01 }).on('change', () =>
        {
            this.group.scale.setScalar(this.scale)
        })
    }
}
