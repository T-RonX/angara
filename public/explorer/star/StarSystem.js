import { Star } from './Star.js';

// StarSystem ? the collection of suns. It builds one `Star` per entry in
// `physical.stars`, updates them all each frame, and exposes their
// directions so the atmosphere shader can scatter light from every sun.
//
// This is the heart of the "multiple suns" capability: nothing downstream
// assumes a single sun ? it all works off this list.
export class StarSystem
{
    stars = [];
    directions = [];
    colors = [];

    // Stable pre-allocated array ? updated in place each frame so
    // AtmosphereSystem.update never allocates to read energies.
    #energies = [];
    #disposed = false;

    constructor(scene, skyAnchor, starConfigs, { skyDistance })
    {
        for (const cfg of starConfigs)
        {
            const star = new Star(scene, skyAnchor, cfg, { skyDistance });
            this.stars.push(star);
            this.directions.push(star.direction);
            this.colors.push(star.colorRGB);
            this.#energies.push(star.intensity);
        }
    }

    get count()
    {
        return this.stars.length;
    }

    setOcclusionBodies(bodies)
    {
        for (const star of this.stars)
        {
            star.setOcclusionBodies(bodies);
        }
    }

    // Per-sun energy (own intensity), for the atmosphere scattering pass.
    // Returns the same array reference every call; values are current as of
    // the last update().
    energies()
    {
        return this.#energies;
    }

    update(now, camera)
    {
        for (let i = 0; i < this.stars.length; i++)
        {
            this.stars[i].update(now, camera);
            this.#energies[i] = this.stars[i].intensity;
        }
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        for (const star of this.stars)
        {
            star.dispose();
        }

        this.stars = [];
        this.directions = [];
        this.colors = [];
        this.#energies = [];
    }
}
