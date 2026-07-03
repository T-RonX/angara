import * as THREE from 'three';
import { hsvToRgb, parseRgbString } from './ColorUtils.js';

// ----------------------------------------------------------------------
// TextureFactory — builds the procedural canvas textures the suns and
// their lens flares are painted from. Everything is generated on a
// <canvas> with additive blending in mind: cheap, no external assets, and
// the tints are supplied by the caller (per-sun) so every sun can have its
// own palette.
//
// Each sun owns its own set of these textures, which is what lets several
// suns coexist with independent colours.
// ----------------------------------------------------------------------

function finishTexture(canvas)
{
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    return tex;
}

// A simple centre-out radial gradient. `stops` is [[pos, cssColor], …].
export function radialGradientTexture(stops, size = 256)
{
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

    for (const [pos, color] of stops)
    {
        g.addColorStop(pos, color);
    }

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    return finishTexture(c);
}

// The hot sun core: white-yellow centre fading through warm to a red rim.
export function sunCoreTexture(tints)
{
    return radialGradientTexture([
        [0.00, `rgba(${tints.coreColor}, 1.0)`],
        [0.40, `rgba(${tints.coreColor}, 1.0)`],
        [0.55, `rgba(${tints.warmColor}, 0.85)`],
        [0.80, `rgba(${tints.rimColor}, 0.18)`],
        [1.00, `rgba(${tints.rimColor}, 0.0)`],
    ]);
}

// The soft outer corona — large, subtle bloom.
export function sunHaloTexture(tints)
{
    return radialGradientTexture([
        [0.00, `rgba(${tints.coreColor}, 0.40)`],
        [0.15, `rgba(${tints.warmColor}, 0.18)`],
        [0.40, `rgba(${tints.rimColor}, 0.05)`],
        [1.00, `rgba(${tints.rimColor}, 0.0)`],
    ]);
}

// A multi-layer chromatic halo around the sun: warm core bloom, a primary
// hue-cycling halo ring, a thinner phase-shifted secondary diffraction
// ring, and scattered dust speckles. Depth-tested so the planet hides it.
export function rainbowHaloTexture(tints, size = 1024)
{
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;
    const img = ctx.createImageData(size, size);

    const core = parseRgbString(tints.coreColor);
    const warm = parseRgbString(tints.warmColor);

    const R_BLOOM_OUT   = 0.30;
    const R_PRIMARY_IN  = 0.30;
    const R_PRIMARY_OUT = 0.46;
    const R_SECOND_IN   = 0.47;
    const R_SECOND_OUT  = 0.50;

    for (let y = 0; y < size; y++)
    {
        for (let x = 0; x < size; x++)
        {
            const dx = (x - half) / half;
            const dy = (y - half) / half;
            const r = Math.hypot(dx, dy);

            if (r > R_SECOND_OUT) continue;

            const theta = Math.atan2(dy, dx);
            const i = (y * size + x) * 4;
            let R = 0, G = 0, B = 0, A = 0;

            // --- Inner warm bloom --------------------------------------
            if (r < R_BLOOM_OUT)
            {
                const t = r / R_BLOOM_OUT;
                const tw = Math.min(1, t * 1.15);
                const cR = core[0] * (1 - tw) + warm[0] * tw;
                const cG = core[1] * (1 - tw) + warm[1] * tw;
                const cB = core[2] * (1 - tw) + warm[2] * tw;
                const fall = (1 - t) ** 2;
                const bloomA = fall * 0.40;
                R = cR * bloomA;
                G = cG * bloomA;
                B = cB * bloomA;
                A = bloomA;
            }

            // --- Primary halo ring -------------------------------------
            if (r > R_PRIMARY_IN && r < R_PRIMARY_OUT)
            {
                const t = (r - R_PRIMARY_IN) / (R_PRIMARY_OUT - R_PRIMARY_IN);
                const ringMask = Math.sin(t * Math.PI) ** 1.4;
                const hue = (theta / (2 * Math.PI) + 0.5) * 360;
                const [hR, hG, hB] = hsvToRgb(hue, 0.45, 1);
                const azMod = 0.78 + 0.22 * Math.sin(theta * 7 + 1.3)
                                   + 0.10 * Math.sin(theta * 23 + 4.7);
                const radMod = 0.88 + 0.12 * Math.sin(r * 120);
                const blend = 0.55;
                const rR = ((warm[0] / 255) * (1 - blend) + hR * blend) * 255;
                const rG = ((warm[1] / 255) * (1 - blend) + hG * blend) * 255;
                const rB = ((warm[2] / 255) * (1 - blend) + hB * blend) * 255;
                const ringA = ringMask * 0.55 * azMod * radMod;
                R = R + rR * ringA;
                G = G + rG * ringA;
                B = B + rB * ringA;
                A = Math.max(A, ringA);
            }

            // --- Secondary diffraction ring (thin, hue-shifted) --------
            if (r > R_SECOND_IN && r < R_SECOND_OUT)
            {
                const t = (r - R_SECOND_IN) / (R_SECOND_OUT - R_SECOND_IN);
                const ringMask = Math.sin(t * Math.PI) ** 2;
                const hue = (theta / (2 * Math.PI) + 0.5) * 360 + 60;
                const [hR, hG, hB] = hsvToRgb(hue, 0.75, 1);
                const azMod = 0.7 + 0.3 * Math.sin(theta * 11 + 0.8);
                const ringA = ringMask * 0.35 * azMod;
                R = R + hR * 255 * ringA;
                G = G + hG * 255 * ringA;
                B = B + hB * 255 * ringA;
                A = Math.max(A, ringA);
            }

            img.data[i]     = Math.min(255, R);
            img.data[i + 1] = Math.min(255, G);
            img.data[i + 2] = Math.min(255, B);
            img.data[i + 3] = Math.min(255, A * 255);
        }
    }

    ctx.putImageData(img, 0, 0);

    // --- Dust speckle / sub-aperture diffraction motes ---------------
    ctx.globalCompositeOperation = 'lighter';
    let s = 1337;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    for (let k = 0; k < 140; k++)
    {
        const a = rand() * Math.PI * 2;
        const rr = (R_PRIMARY_IN + 0.02 + rand() * (R_PRIMARY_OUT - R_PRIMARY_IN - 0.04)) * half;
        const x = half + Math.cos(a) * rr;
        const y = half + Math.sin(a) * rr;
        let hue;

        if (rand() < 0.35) hue = ((a / (Math.PI * 2)) + 0.5) * 360;
        else               hue = 25 + rand() * 35;

        const [hR, hG, hB] = hsvToRgb(hue, 0.45, 1);
        const big = rand() < 0.15;
        const radius = big ? 2.2 + rand() * 1.5 : 0.8 + rand() * 0.9;
        const alpha  = big ? 0.55 + rand() * 0.35 : 0.25 + rand() * 0.35;
        ctx.fillStyle = `rgba(${Math.round(hR * 255)}, ${Math.round(hG * 255)}, ${Math.round(hB * 255)}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    return finishTexture(c);
}

// A hexagonal iris-aperture ghost in a single hue — the staple lens flare.
export function hexGhostTexture(hue, size = 256, saturation = 0.55)
{
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const [rC, gC, bC] = hsvToRgb(hue, saturation, 1);
    const col = `${Math.round(rC * 255)}, ${Math.round(gC * 255)}, ${Math.round(bC * 255)}`;
    const cx = size / 2, cy = size / 2;
    const R = size * 0.46;

    ctx.save();
    ctx.beginPath();

    for (let i = 0; i < 6; i++)
    {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = cx + R * Math.cos(a);
        const py = cy + R * Math.sin(a);

        if (i === 0) ctx.moveTo(px, py);
        else         ctx.lineTo(px, py);
    }

    ctx.closePath();
    ctx.clip();

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0.00, `rgba(${col}, 0.95)`);
    g.addColorStop(0.55, `rgba(${col}, 0.38)`);
    g.addColorStop(1.00, `rgba(${col}, 0.0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = `rgba(${col}, 0.55)`;
    ctx.lineWidth = Math.max(1, size / 256);
    ctx.stroke();
    ctx.restore();

    return finishTexture(c);
}

// A soft circular ghost in a single colour ("r, g, b" string).
export function softGhostTexture(rgb, peakAlpha = 0.6, size = 256)
{
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2;
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0.00, `rgba(${rgb}, ${peakAlpha})`);
    g.addColorStop(0.55, `rgba(${rgb}, ${peakAlpha * 0.22})`);
    g.addColorStop(1.00, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    return finishTexture(c);
}

// The anamorphic starburst: two superimposed ray sets plus micro-rays, with
// faint per-ray hue shifts so it doesn't read as a sterile cross.
export function starburstTexture(tints, size = 1024, primaryRays = 6, secondaryRays = 8)
{
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2;

    const core = parseRgbString(tints.coreColor);
    const warm = parseRgbString(tints.warmColor);
    const coreStr = `${core[0]}, ${core[1]}, ${core[2]}`;
    const warmStr = `${warm[0]}, ${warm[1]}, ${warm[2]}`;

    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, size * 0.34);
    g.addColorStop(0.00, `rgba(${coreStr}, 0.55)`);
    g.addColorStop(0.55, `rgba(${warmStr}, 0.10)`);
    g.addColorStop(1.00, `rgba(${warmStr}, 0.0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    const drawRays = (count, baseAngle, lenScale, widthA, widthB, alphaBase, hueShift) => {
        for (let i = 0; i < count; i++)
        {
            const jitter = Math.sin(i * 12.9898 + baseAngle * 78.233) * 0.5 + 0.5;
            const lenJ   = lenScale * (0.78 + 0.22 * jitter);
            const alphaJ = alphaBase * (0.65 + 0.55 * jitter);
            const a = baseAngle + (i / count) * Math.PI * 2;
            const ex = cx + Math.cos(a) * size * lenJ;
            const ey = cx + Math.sin(a) * size * lenJ;
            const hue = (35 + hueShift + jitter * 50) % 360;
            const [hR, hG, hB] = hsvToRgb(hue, 0.30 + jitter * 0.15, 1);
            const tint = `${Math.round(hR * 255)}, ${Math.round(hG * 255)}, ${Math.round(hB * 255)}`;
            const grad = ctx.createLinearGradient(cx, cx, ex, ey);
            grad.addColorStop(0.00, `rgba(${coreStr}, ${alphaJ})`);
            grad.addColorStop(0.12, `rgba(${tint}, ${alphaJ * 0.7})`);
            grad.addColorStop(0.45, `rgba(${tint}, ${alphaJ * 0.20})`);
            grad.addColorStop(1.00, `rgba(${tint}, 0)`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = (i % 2 === 0 ? widthA : widthB) * (size / 512);
            ctx.beginPath();
            ctx.moveTo(cx, cx);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }
    };

    drawRays(primaryRays, 0, 0.48, 2.8, 1.4, 0.55, 0);
    drawRays(secondaryRays, Math.PI / 7, 0.40, 1.4, 0.7, 0.38, 130);

    ctx.globalAlpha = 0.45;

    for (let i = 0; i < 36; i++)
    {
        const a   = (i / 36) * Math.PI * 2 + 0.13;
        const len = size * (0.10 + 0.10 * Math.sin(i * 3.1));
        const ex  = cx + Math.cos(a) * len;
        const ey  = cx + Math.sin(a) * len;
        const hue = (25 + (i * 13) % 60);
        const [hR, hG, hB] = hsvToRgb(hue, 0.45, 1);
        const tint = `${Math.round(hR * 255)}, ${Math.round(hG * 255)}, ${Math.round(hB * 255)}`;
        ctx.strokeStyle = `rgba(${tint}, 0.45)`;
        ctx.lineWidth = 0.8 * (size / 512);
        ctx.beginPath();
        ctx.moveTo(cx, cx);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;

    return finishTexture(c);
}

// Build an additive sprite from a texture (the shared sun/flare primitive).
export function additiveSprite(texture, opacity, depthTest)
{
    const mat = new THREE.SpriteMaterial({
        map: texture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest,
        depthWrite: false,
        opacity,
    });

    return new THREE.Sprite(mat);
}

