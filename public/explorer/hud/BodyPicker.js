// ----------------------------------------------------------------------
// BodyPicker — a minimal HUD panel that lists every body in the system (the
// primary and its companions / moons) and lets the player make one the ACTIVE
// body with a click. It is the UI half of body selection; the actual re-point
// is BodyExplorer.#selectBody, injected here as `onSelect`.
//
// It owns only its own DOM and nothing about the scene, so it stays a pure,
// swappable view. When the system has a single body it stays hidden.
// ----------------------------------------------------------------------
export class BodyPicker
{
    #root;
    #buttons = [];

    constructor(rootElement, bodies, activeIndex, onSelect)
    {
        this.#root = document.createElement('div');
        this.#root.className = 'body-picker';
        this.#root.style.cssText = [
            'display:flex', 'flex-direction:column', 'gap:4px',
            'align-items:stretch', 'width:100%', 'max-width:100%',
            'font:12px/1.4 system-ui,sans-serif', 'user-select:none',
            'box-sizing:border-box',
        ].join(';');

        if (bodies.length < 2)
        {
            this.#root.hidden = true;
        }

        bodies.forEach((body, i) => {
            const btn = document.createElement('button');
            btn.textContent = body.name;
            btn.style.cssText = [
                'width:100%', 'max-width:100%', 'padding:5px 10px', 'border-radius:6px', 'cursor:pointer',
                'border:1px solid rgba(255,255,255,0.18)', 'text-align:left',
                'background:rgba(10,16,26,0.7)', 'color:#cfe0f5',
                'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
            ].join(';');
            btn.addEventListener('click', () => onSelect(i));
            this.#buttons.push(btn);
            this.#root.appendChild(btn);
        });

        rootElement.appendChild(this.#root);
        this.setActive(activeIndex);
    }

    setActive(index)
    {
        this.#buttons.forEach((btn, i) => {
            const active = i === index;
            btn.style.borderColor = active ? '#6fb0ff' : 'rgba(255,255,255,0.18)';
            btn.style.background = active ? 'rgba(38,74,120,0.85)' : 'rgba(10,16,26,0.7)';
            btn.style.color = active ? '#eaf3ff' : '#cfe0f5';
        });
    }
}
