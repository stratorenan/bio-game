import * as THREE from 'three/webgpu'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import { RadarDish } from '../RadarDish.js'

/**
 * Formerly the "Time Machine" retro-TV area. The old TV / console / controllers / stool / cups are
 * removed and replaced by a procedural {@link RadarDish}. The underlying GLB node is still named
 * "timeMachine", so the area key stays `timeMachine`, but everything the player sees here is now the
 * radar dish.
 */
export class TimeMachineArea extends Area
{
    constructor(model)
    {
        super(model)

        // Anchor the dish + label on the old cluster centre before the props are removed
        this.anchorPosition = this.references.items.get('interactivePoint')[0].position.clone()

        this.removeProps()
        this.setRadarDish()
        this.setInteractivePoint()
        this.setAchievement()
    }

    // Remove every auto-added prop from the old time-machine set (TV, console, controllers, stool,
    // cups, boxes…). The invisible zone / interactive-point markers are disabled too; the bounding /
    // frustum zones themselves are already registered from the reference positions in the base Area.
    removeProps()
    {
        for(const object of this.objects.items)
            this.game.objects.disable(object)

        this.objects.hideable = []
    }

    setRadarDish()
    {
        const position = new THREE.Vector3(this.anchorPosition.x, 0, this.anchorPosition.z - 0.5)

        this.radarDish = new RadarDish(position, { rotationY: Math.PI * 0.15, tilt: 0.62, sweepSpeed: 0.3 })
    }

    setInteractivePoint()
    {
        // Label-only point (no external link now that the time machine is gone)
        this.interactivePoint = this.game.interactivePoints.create(
            this.anchorPosition,
            'Radar',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED
        )
    }

    update()
    {
        if(this.radarDish)
            this.radarDish.update()
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'timeMachine')
        })
    }
}