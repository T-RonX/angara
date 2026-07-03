import * as THREE from 'three';

// ----------------------------------------------------------------------
// Small geometric helpers shared across the whole renderer. Pure maths,
// no scene state — safe to import anywhere.
// ----------------------------------------------------------------------

// Degrees → radians (alias of Three's helper so call sites read nicely).
export const deg2rad = THREE.MathUtils.degToRad;

export const RAD2DEG = 180 / Math.PI;

// A point on a sphere of radius `r` at the given longitude / latitude
// (both in degrees). Longitude winds around +Y; latitude is measured from
// the equator (+90 = north pole).
export function sphere(lonDeg, latDeg, r)
{
    const lon = deg2rad(lonDeg);
    const lat = deg2rad(latDeg);
    const cl = Math.cos(lat);

    return new THREE.Vector3(
        r * cl * Math.cos(lon),
        r * Math.sin(lat),
        r * cl * Math.sin(lon),
    );
}

// A unit direction pointing FROM the planet TO a light source placed at the
// given azimuth / elevation (degrees).
export function azElDirection(azDeg, elDeg)
{
    const az = deg2rad(azDeg);
    const el = deg2rad(elDeg);
    const ce = Math.cos(el);

    return new THREE.Vector3(ce * Math.cos(az), Math.sin(el), ce * Math.sin(az));
}

// Area of intersection of two circles of radii r1, r2 whose centres are `d`
// apart. Standard closed-form — used by the analytical sun-occlusion test.
export function discOverlapArea(r1, r2, d)
{
    if (d >= r1 + r2)           return 0;
    if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;

    const r1sq = r1 * r1;
    const r2sq = r2 * r2;
    const a1 = r1sq * Math.acos((d * d + r1sq - r2sq) / (2 * d * r1));
    const a2 = r2sq * Math.acos((d * d + r2sq - r1sq) / (2 * d * r2));
    const a3 = 0.5 * Math.sqrt(
        Math.max(0,
            (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2),
        ),
    );

    return a1 + a2 - a3;
}

// Cubic ease-in-out on 0..1.
export function easeInOut(x)
{
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

