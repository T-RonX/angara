// ----------------------------------------------------------------------
// OrbitPanel — a HUD panel that exposes the ORBIT parameters of the currently
// selected body as live sliders (semi-major axis, eccentricity, period, phase,
// inclination, ascending node). Editing a slider mutates the body's orbit
// config in place and reconfigures its live OrbitModel, so the motion updates
// immediately with no rebuild.
//
// It owns only its own DOM and stays hidden for bodies that do not orbit (the
// primary). SINGLE RESPONSIBILITY: "let the player tune the selected body's
// orbit". The selection re-point is driven by BodyExplorer via retarget().
// ----------------------------------------------------------------------
export class OrbitPanel
{
    #root;
    #body = null;
    #model = null;

    // Each field: [label, key, min, max, step, formatter].
    static #FIELDS = [
        ['Semi-major axis', 'semiMajorAxis',  0,   4000, 10,   v => v.toFixed(0)],
        ['Eccentricity',    'eccentricity',   0,    0.9, 0.01, v => v.toFixed(2)],
        ['Period (s)',      'periodSec',      2,    600, 1,    v => v.toFixed(0)],
        ['Phase',           'phaseDeg',       0,    360, 1,    v => `${Math.round(v)}°`],
        ['Inclination',     'inclinationDeg', -90,   90, 1,    v => `${Math.round(v)}°`],
        ['Ascending node',  'ascendingNodeDeg', 0,  360, 1,    v => `${Math.round(v)}°`],
    ];

    constructor(rootElement)
    {
        this.#root = document.createElement('div');
        this.#root.className = 'orbit-panel';
        this.#root.style.cssText = [
            'position:absolute', 'top:64px', 'right:16px', 'z-index:30',
            'display:flex', 'flex-direction:column', 'gap:4px', 'width:180px',
            'padding:8px 10px', 'border-radius:8px',
            'background:rgba(10,16,26,0.7)', 'border:1px solid rgba(255,255,255,0.14)',
            'color:#cfe0f5', 'font:11px/1.4 system-ui,sans-serif', 'user-select:none',
        ].join(';');
        this.#root.hidden = true;

        const title = document.createElement('div');
        title.textContent = 'Orbit';
        title.style.cssText = 'font-weight:600;letter-spacing:0.03em;margin-bottom:2px;';
        this.#root.appendChild(title);

        this.#fields = new Map();

        for (const [label, key, min, max, step, format] of OrbitPanel.#FIELDS)
        {
            this.#fields.set(key, this.#slider(label, key, min, max, step, format));
        }

        rootElement.appendChild(this.#root);
    }

    #fields;

    // Point the panel at a body + its live OrbitModel. Bodies with no orbit
    // (the primary) hide the panel entirely.
    retarget(body, model)
    {
        this.#body = body ?? null;
        this.#model = model ?? null;

        const orbit = body?.orbit ?? null;

        if (!orbit || !model)
        {
            this.#root.hidden = true;

            return;
        }

        this.#root.hidden = false;

        for (const [key, { input, readout, format }] of this.#fields)
        {
            const v = orbit[key] ?? 0;
            input.value = v;
            readout.textContent = format(v);
        }
    }

    #slider(label, key, min, max, step, format)
    {
        const wrap = document.createElement('label');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;justify-content:space-between;';

        const text = document.createElement('span');
        text.textContent = label;

        const readout = document.createElement('span');
        readout.className = 'v';
        readout.style.cssText = 'color:#8fb8ee;';

        head.appendChild(text);
        head.appendChild(readout);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;

        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            readout.textContent = format(v);

            if (this.#body?.orbit && this.#model)
            {
                this.#body.orbit[key] = v;
                this.#model.configure(this.#body.orbit);
            }
        });

        wrap.appendChild(head);
        wrap.appendChild(input);
        this.#root.appendChild(wrap);

        return { input, readout, format };
    }
}
