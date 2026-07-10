import { ORBIT_FIELD_DEFS } from './OrbitPanel.js';

// ----------------------------------------------------------------------
// BodyPicker — a minimal HUD panel that lists every body in the system (the
// primary and its companions / moons) and lets the player make one the ACTIVE
// body with a click. Each row also exposes a compact body-properties drawer so
// rotation and orbit values can be edited without switching the active body first.
//
// It owns only its own DOM and nothing about the scene, so it stays a pure,
// swappable view. When the system has a single body it stays hidden.
// ----------------------------------------------------------------------
export class BodyPicker
{
    #root;
    #buttons = [];
    #rows = [];
    #expandedIndex = -1;

    constructor(rootElement, bodies, activeIndex, onSelect, orbitSystem, rotationSystem)
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

        bodies.forEach((body, i) =>
        {
            const row = document.createElement('div');
            row.style.cssText = [
                'display:flex', 'flex-direction:column', 'gap:4px',
                'width:100%', 'box-sizing:border-box',
            ].join(';');

            const header = document.createElement('div');
            header.style.cssText = 'display:flex; gap:6px; align-items:center; width:100%;';

            const btn = document.createElement('button');
            btn.textContent = body.name;
            btn.style.cssText = [
                'flex:1', 'min-width:0', 'padding:5px 10px', 'border-radius:6px', 'cursor:pointer',
                'border:1px solid rgba(255,255,255,0.18)', 'text-align:left',
                'background:rgba(10,16,26,0.7)', 'color:#cfe0f5',
                'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
            ].join(';');
            btn.addEventListener('click', () => onSelect(i));
            this.#buttons.push(btn);

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.textContent = '▸';
            toggle.title = 'Edit body properties';
            toggle.style.cssText = [
                'width:24px', 'height:24px', 'padding:0', 'border-radius:6px', 'cursor:pointer',
                'border:1px solid rgba(255,255,255,0.18)', 'background:rgba(10,16,26,0.7)',
                'color:#cfe0f5', 'font-size:12px', 'line-height:1',
            ].join(';');
            toggle.addEventListener('click', event =>
            {
                event.stopPropagation();
                this.#togglePanel(i);
            });

            header.appendChild(btn);
            header.appendChild(toggle);
            row.appendChild(header);

            const panel = document.createElement('div');
            panel.style.cssText = [
                'display:none', 'flex-direction:column', 'gap:6px',
                'padding:6px 8px', 'border-radius:6px',
                'background:rgba(6,10,18,0.64)', 'border:1px solid rgba(255,255,255,0.12)',
            ].join(';');

            const orbit = body?.orbit ?? null;
            const orbitModel = orbitSystem?.modelFor(body) ?? null;
            const rotModel = rotationSystem?.modelFor(body) ?? null;

            // ---- Rotation section (always present) -------------------------
            const rotTitle = document.createElement('div');
            rotTitle.textContent = 'Rotation';
            rotTitle.style.cssText = 'font-size:10px; font-weight:600; color:#a8c4e8; letter-spacing:0.04em; padding-top:2px;';
            panel.appendChild(rotTitle);

            const ROTATION_FIELD_DEFS = [
                ['Axial tilt', 'axialTiltDeg', 0, 180, 1, v => `${Math.round(v)}°`],
                ['Rotation period', 'rotationPeriodSec', 0, 1200, 1, v => v === 0 ? 'stationary' : `${v.toFixed(0)}s`],
            ];

            for (const [label, key, min, max, step, format] of ROTATION_FIELD_DEFS)
            {
                const wrap = document.createElement('label');
                wrap.style.cssText = [
                    'display:flex', 'flex-direction:column', 'gap:2px',
                    'width:100%', 'color:#cfe0f5', 'font-size:10px',
                ].join(';');

                const head = document.createElement('div');
                head.style.cssText = 'display:flex; justify-content:space-between; gap:6px; width:100%;';

                const text = document.createElement('span');
                text.textContent = label;
                text.style.cssText = 'display:block; color:#cfe0f5; white-space:nowrap;';

                const readout = document.createElement('span');
                readout.className = 'v';
                readout.style.cssText = 'color:#8fb8ee; font-size:10px;';

                head.appendChild(text);
                head.appendChild(readout);

                const input = document.createElement('input');
                input.type = 'range';
                input.min = min;
                input.max = max;
                input.step = step;
                input.value = body.config?.[key] ?? 0;
                input.style.cssText = 'width:100%; accent-color:#4f8bff; margin:0;';
                readout.textContent = format(body.config?.[key] ?? 0);

                input.addEventListener('input', () =>
                {
                    const v = parseFloat(input.value);
                    readout.textContent = format(v);

                    if (body.config && rotModel)
                    {
                        body.config[key] = v;
                        rotModel.configure(body.config);
                    }
                });

                wrap.appendChild(head);
                wrap.appendChild(input);
                panel.appendChild(wrap);
            }

            // ---- Orbit section (only for orbiting bodies) ------------------
            if (!orbit || !orbitModel)
            {
                const note = document.createElement('div');
                note.textContent = 'No orbit config';
                note.style.cssText = 'font-size:10px; color:#8fb8ee; opacity:0.8;';
                panel.appendChild(note);
            }
            else
            {
                const orbTitle = document.createElement('div');
                orbTitle.textContent = 'Orbit';
                orbTitle.style.cssText = 'font-size:10px; font-weight:600; color:#a8c4e8; letter-spacing:0.04em; padding-top:4px;';
                panel.appendChild(orbTitle);

                for (const [label, key, min, max, step, format] of ORBIT_FIELD_DEFS)
                {
                    const wrap = document.createElement('label');
                    wrap.style.cssText = [
                        'display:flex', 'flex-direction:column', 'gap:2px',
                        'width:100%', 'color:#cfe0f5', 'font-size:10px',
                    ].join(';');

                    const head = document.createElement('div');
                    head.style.cssText = 'display:flex; justify-content:space-between; gap:6px; width:100%;';

                    const text = document.createElement('span');
                    text.textContent = label;
                    text.style.cssText = 'display:block; color:#cfe0f5; white-space:nowrap;';

                    const readout = document.createElement('span');
                    readout.className = 'v';
                    readout.style.cssText = 'color:#8fb8ee; font-size:10px;';

                    head.appendChild(text);
                    head.appendChild(readout);

                    const input = document.createElement('input');
                    input.type = 'range';
                    input.min = min;
                    input.max = max;
                    input.step = step;
                    input.value = orbit[key] ?? 0;
                    input.style.cssText = 'width:100%; accent-color:#4f8bff; margin:0;';
                    readout.textContent = format(orbit[key] ?? 0);

                    input.addEventListener('input', () =>
                    {
                        const v = parseFloat(input.value);
                        readout.textContent = format(v);

                        if (body?.orbit && orbitModel)
                        {
                            body.orbit[key] = v;
                            orbitModel.configure(body.orbit);
                        }
                    });

                    wrap.appendChild(head);
                    wrap.appendChild(input);
                    panel.appendChild(wrap);
                }
            }

            row.appendChild(panel);
            this.#rows.push({ index: i, panel, toggle });
            this.#root.appendChild(row);
        });

        rootElement.appendChild(this.#root);
        this.setActive(activeIndex);
    }

    #togglePanel(index)
    {
        this.#expandedIndex = this.#expandedIndex === index ? -1 : index;
        this.#syncExpandedState();
    }

    #syncExpandedState()
    {
        this.#rows.forEach(item =>
        {
            const open = item.index === this.#expandedIndex;
            item.panel.style.display = open ? 'flex' : 'none';
            item.toggle.textContent = open ? '▾' : '▸';
            item.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    setActive(index)
    {
        this.#buttons.forEach((btn, i) =>
        {
            const active = i === index;
            btn.style.borderColor = active ? '#6fb0ff' : 'rgba(255,255,255,0.18)';
            btn.style.background = active ? 'rgba(38,74,120,0.85)' : 'rgba(10,16,26,0.7)';
            btn.style.color = active ? '#eaf3ff' : '#cfe0f5';
        });
    }
}
