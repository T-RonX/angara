import * as THREE from 'three';
import { sphere } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// GridLines — the faint lon/lat lines drawn just above the surface. Kept
// hidden by default (the per-cell hover highlight reveals structure on
// demand), but built once and handy for debugging.
// ----------------------------------------------------------------------
export class GridLines
{
    lines;

    constructor(planet, capModel)
    {
        this.lines = this.#build(planet, capModel);
        this.lines.visible = false;
    }

    #build(planet, capModel)
    {
        const { lonCells, latCells, radius, gridColor } = planet;
        const { capRows, rowDegLat } = capModel;
        const pts = [];
        const STEP = 4;
        const rr = radius + 0.05;

        const latMin = -90 + capRows * rowDegLat;
        const latMax =  90 - capRows * rowDegLat;

        // Longitude lines (stop at the cap boundary, not the pole tangle).
        for (let i = 0; i < lonCells; i++)
        {
            const lon = (i / lonCells) * 360;

            for (let lat = latMin; lat < latMax; lat += STEP)
            {
                const lat2 = Math.min(lat + STEP, latMax);
                pts.push(sphere(lon, lat, rr), sphere(lon, lat2, rr));
            }
        }

        // Latitude rings within the non-cap band (incl. the cap boundaries).
        for (let j = capRows; j <= latCells - capRows; j++)
        {
            const lat = -90 + j * rowDegLat;

            for (let lon = 0; lon < 360; lon += STEP)
            {
                pts.push(sphere(lon, lat, rr), sphere(lon + STEP, lat, rr));
            }
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.55 });

        return new THREE.LineSegments(geo, mat);
    }
}


