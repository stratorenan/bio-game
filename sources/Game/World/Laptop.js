import * as THREE from 'three/webgpu'
import { color, texture } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { InteractivePoints } from '../InteractivePoints.js'

/**
 * Procedural laptop prop placed near the race track. It is an aluminium MacBook-style body (deck +
 * hinged lid) whose screen shows the Biologistica logistics-tracking UI (static texture
 * `static/areas/laptopScreenBiologistica.png`, loaded at runtime so it never blocks boot). Built
 * procedurally for now; swap for a dedicated .glb later. Position / rotation / scale are easy to
 * tweak below, or dragged live via the "💻 Laptop" debug panel when the URL has #debug.
 */
export class Laptop
{
    constructor()
    {
        this.game = Game.getInstance()

        // Starting spot near the circuit (tweak live via the "💻 Laptop" panel with #debug).
        this.position = new THREE.Vector3(26.3, 0, -19.2)
        this.rotationY = 0.56
        this.scale = 1.4

        // Body dimensions (model space, before this.scale).
        this.width = 4
        this.depth = 2.8
        this.deckThickness = 0.16
        this.lidHeight = 2.7
        this.lidThickness = 0.12
        this.lidLean = -0.3 // radians the open lid leans back from vertical

        this.setMaterials()
        this.setMesh()
        this.setPhysics()
        this.applyTransform()
        this.setScreenTexture()
        this.setInteractivePoint()
        this.setDebug()
    }

    setMaterials()
    {
        // Brushed aluminium body
        this.aluminiumMaterial = new MeshDefaultMaterial({
            colorNode: color('#c9ccd1'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Dark screen bezel / keyboard well
        this.darkMaterial = new MeshDefaultMaterial({
            colorNode: color('#1b1b1d'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Trackpad (slightly lighter than the deck)
        this.trackpadMaterial = new MeshDefaultMaterial({
            colorNode: color('#d6d9de'),
            hasWater: false,
            hasLightBounce: false,
        })

        // Placeholder screen colour until the UI texture loads
        this.screenMaterial = new MeshDefaultMaterial({
            colorNode: color('#f0f0f0'),
            hasWater: false,
            hasLightBounce: false,
            hasCoreShadows: false,
            hasDropShadows: false,
        })
    }

    setMesh()
    {
        this.group = new THREE.Group()
        this.group.scale.setScalar(this.scale)

        const W = this.width
        const D = this.depth
        const deckT = this.deckThickness
        const lidH = this.lidHeight
        const lidT = this.lidThickness

        const add = (geometry, material, x, y, z, parent = this.group) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            parent.add(mesh)
            return mesh
        }

        // Keyboard deck (sits on the ground)
        add(new THREE.BoxGeometry(W, deckT, D), this.aluminiumMaterial, 0, deckT * 0.5, 0)

        // Keyboard well + trackpad on the deck top
        add(new THREE.BoxGeometry(W * 0.84, 0.03, D * 0.5), this.darkMaterial, 0, deckT + 0.015, -D * 0.12)
        add(new THREE.BoxGeometry(W * 0.3, 0.03, D * 0.28), this.trackpadMaterial, 0, deckT + 0.016, D * 0.26)

        // Hinged lid, pivoting at the back edge of the deck
        this.lidGroup = new THREE.Group()
        this.lidGroup.position.set(0, deckT, - D * 0.5 + lidT * 0.5)
        this.lidGroup.rotation.x = this.lidLean
        this.group.add(this.lidGroup)

        // Lid back panel
        add(new THREE.BoxGeometry(W, lidH, lidT), this.aluminiumMaterial, 0, lidH * 0.5, 0, this.lidGroup)

        // Dark bezel on the front face of the lid
        add(new THREE.BoxGeometry(W * 0.95, lidH * 0.9, lidT * 0.6), this.darkMaterial, 0, lidH * 0.5, lidT * 0.5 + 0.005, this.lidGroup)

        // Screen plane (carries the Biologistica tracking UI). 16:10 to match the texture.
        // Sits just in front of the bezel's front face (lidT*0.5 + bezelDepth*0.5) to avoid z-fighting.
        const screenW = 3.55
        const screenH = screenW * (640 / 1024)
        this.screenMesh = add(new THREE.PlaneGeometry(screenW, screenH), this.screenMaterial, 0, lidH * 0.5, lidT * 0.5 + 0.06, this.lidGroup)
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
                    { shape: 'cuboid', parameters: [ this.width * 0.5 * this.scale, 0.45 * this.scale, this.depth * 0.5 * this.scale ], position: { x: 0, y: 0.25 * this.scale, z: 0 }, category: 'object' },
                ],
            }
        )
    }

    setScreenTexture()
    {
        // Load the tracking-UI texture lazily so it can never block boot, then swap the screen
        // material (the node material's colorNode must be set at construction, so build it here).
        const loader = this.game.resourcesLoader.getLoader('texture')
        loader.load(
            'areas/laptopScreenBiologistica.png?cb=1',
            (screenTexture) =>
            {
                screenTexture.colorSpace = THREE.SRGBColorSpace
                screenTexture.anisotropy = 4

                this.screenMesh.material = new MeshDefaultMaterial({
                    colorNode: texture(screenTexture).rgb,
                    hasWater: false,
                    hasLightBounce: false,
                    hasCoreShadows: false,
                    hasDropShadows: false,
                })
            },
            undefined,
            () => console.warn('Laptop > Could not load laptop screen texture'),
        )
    }

    setInteractivePoint()
    {
        // Floating "Sistema" label in front of the laptop screen. The anchor is derived from the
        // laptop transform (forward = local +Z rotated by rotationY) so it tracks the prop, and
        // raised to ~2.2 so the label/diamond hover at a readable height. Pressing interact (Enter)
        // opens the "Biologistica Software" modal.
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY)
        const pointPosition = this.position.clone().addScaledVector(forward, 2.5 * this.scale)
        pointPosition.y = 2.2

        this.interactivePoint = this.game.interactivePoints.create(
            pointPosition,
            'Sistema',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                const sound = this.game.audio.groups.get('click')
                if(sound)
                    sound.play(true)

                this.game.modals.open('sistema')
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

        const panel = this.game.debug.panel.addFolder({ title: '💻 Laptop', expanded: false })
        const onChange = () => this.applyTransform()

        panel.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 }).on('change', onChange)
        panel.addBinding(this.position, 'y', { min: -2, max: 10, step: 0.1 }).on('change', onChange)
        panel.addBinding(this, 'rotationY', { min: -Math.PI, max: Math.PI, step: 0.01 }).on('change', onChange)
        panel.addBinding(this, 'scale', { min: 0.2, max: 4, step: 0.05 }).on('change', () =>
        {
            this.group.scale.setScalar(this.scale)
        })
    }
}
