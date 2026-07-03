// ----------------------------------------------------------------------
// Colour helpers — pure maths, no Three.js dependency.
// ----------------------------------------------------------------------

// HSV → RGB, each channel in 0..1. Hue is in degrees (wraps).
export function hsvToRgb(h, s, v)
{
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;

    if (h < 60)       [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else              [r, g, b] = [c, 0, x];

    return [r + m, g + m, b + m];
}

// Tanner Helland's blackbody approximation: colour temperature (Kelvin) →
// RGB in 0..1. Good enough for a starry backdrop.
export function blackbodyRgb(kelvin)
{
    const t = kelvin / 100;
    let r, g, b;

    if (t <= 66)
    {
        r = 255;
        g = 99.4708025861 * Math.log(t) - 161.1195681661;
    }
    else
    {
        r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
        g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    }

    if (t >= 66)      b = 255;
    else if (t <= 19) b = 0;
    else              b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;

    const clamp01 = v => Math.max(0, Math.min(255, v)) / 255;

    return [clamp01(r), clamp01(g), clamp01(b)];
}

// Parse a "r, g, b" 0-255 string (the format the sun tint fields use) into
// a numeric [r, g, b] triple.
export function parseRgbString(s)
{
    return s.split(',').map(v => parseInt(v.trim(), 10));
}


