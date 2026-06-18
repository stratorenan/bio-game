import { Game } from './Game.js'

export class Options
{
    constructor()
    {
        this.game = Game.getInstance()
        this.element = this.game.menu.items.get('options').contentElement

        this.setSound()
        this.setQuality()
        this.setRespawn()
        this.setReset()
        this.setRenderer()
        this.setServer()
    }

    setSound()
    {
        const element = this.element.querySelector('.js-audio-toggle')

        element.addEventListener('click', this.game.audio.mute.toggle)
    }

    setQuality()
    {
        const element = this.element.querySelector('.js-quality-toggle')
        const text = element.querySelector('span')
        text.textContent = this.game.quality.level === 0 ? 'Alta' : 'Baixa'

        element.addEventListener('click', () =>
        {
            this.game.quality.changeLevel(this.game.quality.level === 0 ? 1 : 0)
        })

        this.game.quality.events.on('change', () =>
        {
            text.textContent = this.game.quality.level === 0 ? 'Alta' : 'Baixa'
        })
    }

    setRespawn()
    {
        const element = this.element.querySelector('.js-respawn')

        element.addEventListener('click', () =>
        {
            this.game.player.respawn()
            this.game.menu.close()
        })
    }

    setReset()
    {
        const element = this.element.querySelector('.js-reset')

        element.addEventListener('click', () =>
        {
            this.game.reset()
            this.game.menu.close()
        })
    }

    setRenderer()
    {        
        if(this.game.rendering.renderer.backend.isWebGLBackend)
        {
            const element = this.element.querySelector('.js-renderer')
            element.classList.remove('is-success')
            element.classList.add('is-danger')

            const text = element.querySelector('span')
            text.textContent = 'WebGL'

            const tooltip = element.querySelector('.js-tooltip')
            tooltip.innerHTML = /* html */`Seu navegador <strong>não é compatível</strong> com WebGPU, resultando em perda de desempenho`
        }
    }

    setServer()
    {
        const element = this.element.querySelector('.js-server')
        const text = element.querySelector('span')
        const tooltip = element.querySelector('.js-tooltip')
        
        const update = (connected) =>
        {
            if(connected)
            {
                element.classList.add('is-success')
                element.classList.remove('is-danger')
                
                text.textContent = 'Online'

                tooltip.innerHTML = /* html */`Aproveite os recursos <strong>multijogador</strong>`
            }
            else
            {
                element.classList.remove('is-success')
                element.classList.add('is-danger')
                text.textContent = 'Offline'

                tooltip.innerHTML = /* html */`Deve voltar em breve`
            }
        }

        update(this.game.server.connected)

        this.game.server.events.on('connected', () =>
        {
            update(true)
        })
        this.game.server.events.on('disconnected', () =>
        {
            update(false)
        })
    }
}