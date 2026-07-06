import { Star } from './Star.js';

// ----------------------------------------------------------------------
// StarSystem — the collection of suns. It builds one `Star` per entry in
// `physical.stars`, updates them all each frame, and exposes their
// directions so the atmosphere shader can scatter light from every sun.
//
// This is the heart of the "multiple suns" capability: nothing downstream
// assumes a single sun — it all works off this list.
// ----------------------------------------------------------------------
export class StarSystem
{
    stars = [];
    directions = [];
    colors = [];

    constructor(scene, skyAnchor, starConfigs, { planetRadius, skyDistance })
    {
        for (const cfg of starConfigs)
        {
            const star = new Star(scene, skyAnchor, cfg, { planetRadius, skyDistance });
            this.stars.push(star);
            this.directions.push(star.direction);
            this.colors.push(star.colorRGB);
        }
    }

    get count()
    {
        return this.stars.length;
    }

    // Per-sun energy (own intensity), for the atmosphere scattering pass.
    energies()
    {
        return this.stars.map((star) => star.intensity);
    }

    update(now, camera)
    {
        for (const star of this.stars)
        {
            star.update(now, camera);
        }
    }
}
