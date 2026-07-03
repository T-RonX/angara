// ----------------------------------------------------------------------
// LatitudeStops — the ordered, discrete focus latitudes the crust view can
// settle on when stepping along the latitude axis: the south cap, every
// quad-row centre, then the north cap. Arrow keys and the pointer-release
// snap move between adjacent stops, so the poles are reachable (and
// exitable) one step at a time.
// ----------------------------------------------------------------------
export class LatitudeStops
{
    stops;

    constructor(planet, capModel)
    {
        this.stops = this.#build(planet, capModel);
    }

    #build(planet, capModel)
    {
        const { capRows, rowDegLat, capCenterLatS, capCenterLatN } = capModel;
        const stops = [];
        const quadMin = -90 + capRows * rowDegLat + rowDegLat / 2;
        const quadRows = planet.latCells - 2 * capRows;

        if (capRows > 0) stops.push(capCenterLatS);

        for (let i = 0; i < quadRows; i++)
        {
            stops.push(quadMin + i * rowDegLat);
        }

        if (capRows > 0) stops.push(capCenterLatN);

        return stops;
    }

    nearestIndex(lat)
    {
        let best = 0;
        let bestD = Infinity;

        for (let i = 0; i < this.stops.length; i++)
        {
            const d = Math.abs(this.stops[i] - lat);

            if (d < bestD) { bestD = d; best = i; }
        }

        return best;
    }

    at(index)
    {
        return this.stops[index];
    }

    get length()
    {
        return this.stops.length;
    }
}

