// ----------------------------------------------------------------------
// SliderPanel — builds the HUD's light controls. Crucially it generates one
// azimuth / elevation / intensity group PER SUN, straight from the
// StarSystem, so adding or removing a sun in the config makes the UI grow
// or shrink automatically — no markup to touch. The night-darkness slider
// is a single global control.
// ----------------------------------------------------------------------
export class SliderPanel
{
    constructor(starSystem, lighting, onNightChange)
    {
        this.#buildSunControls(starSystem);
        this.#bindNightDarkness(lighting, onNightChange);
    }

    #buildSunControls(starSystem)
    {
        const host = document.getElementById('sunSliders');

        if (!host) return;

        host.innerHTML = '';

        starSystem.stars.forEach((star, i) => {
            const group = document.createElement('div');
            group.className = 'sun-group';

            const title = document.createElement('div');
            title.className = 'sun-title';
            title.textContent = star.name ?? `Sun ${i + 1}`;
            group.appendChild(title);

            group.appendChild(this.#slider(
                'Azimuth', star.azimuth, 0, 360, 1,
                v => `${Math.round(v)}°`,
                v => star.setAzimuth(v),
            ));
            group.appendChild(this.#slider(
                'Elevation', star.elevation, -90, 90, 1,
                v => `${Math.round(v)}°`,
                v => star.setElevation(v),
            ));
            group.appendChild(this.#slider(
                'Intensity', star.intensity, 0, 3, 0.05,
                v => v.toFixed(2),
                v => star.setIntensity(v),
            ));

            host.appendChild(group);
        });
    }

    // Build one labelled range slider with a live read-out.
    #slider(label, value, min, max, step, format, onInput)
    {
        const wrap = document.createElement('label');

        const text = document.createTextNode(`${label} `);
        const readout = document.createElement('span');
        readout.className = 'v';
        readout.textContent = format(value);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = value;

        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            readout.textContent = format(v);
            onInput(v);
        });

        wrap.appendChild(text);
        wrap.appendChild(readout);
        wrap.appendChild(input);

        return wrap;
    }

    #bindNightDarkness(lighting, onNightChange)
    {
        const input = document.getElementById('nightDark');
        const readout = document.getElementById('rNightDark');

        if (!input) return;

        input.value = lighting.nightDarkness;
        readout.textContent = lighting.nightDarkness.toFixed(2);

        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            readout.textContent = v.toFixed(2);
            onNightChange(v);
        });
    }
}

