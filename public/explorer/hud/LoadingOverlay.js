// ----------------------------------------------------------------------
// LoadingOverlay — a tiny, self-contained DOM overlay shown while a body is
// generated off the main thread. Single responsibility: present/hide a
// centred loading message over the scene root. It owns its own element + styles
// so nothing else needs to know it exists.
// ----------------------------------------------------------------------
export class LoadingOverlay
{
    #el;

    constructor(root)
    {
        this.#el = document.createElement('div');
        this.#el.className = 'explorer-loading-overlay';
        this.#el.innerHTML = '<div class="explorer-loading-spinner"></div><div class="explorer-loading-text"></div>';

        Object.assign(this.#el.style, {
            position: 'absolute',
            inset: '0',
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            background: 'rgba(4, 8, 16, 0.72)',
            color: '#cfe3ff',
            font: '600 14px/1.4 system-ui, sans-serif',
            letterSpacing: '0.04em',
            zIndex: '50',
            pointerEvents: 'none',
        });

        const spinner = this.#el.querySelector('.explorer-loading-spinner');

        Object.assign(spinner.style, {
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: '3px solid rgba(120, 170, 255, 0.25)',
            borderTopColor: '#78aaff',
            animation: 'explorer-spin 0.9s linear infinite',
        });

        if (!document.getElementById('explorer-loading-style'))
        {
            const style = document.createElement('style');
            style.id = 'explorer-loading-style';
            style.textContent = '@keyframes explorer-spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        const host = getComputedStyle(root).position === 'static' ? null : root;

        if (!host) root.style.position = 'relative';

        root.appendChild(this.#el);
    }

    show(message = 'Generating body…')
    {
        this.#el.querySelector('.explorer-loading-text').textContent = message;
        this.#el.style.display = 'flex';
    }

    hide()
    {
        this.#el.style.display = 'none';
    }
}
