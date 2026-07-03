// ----------------------------------------------------------------------
// PolarCapModel — describes how the top/bottom rows of the latitude grid
// collapse into a single round "cap" cell per pole, per depth. Cells very
// close to a pole degenerate into slivers (cos(lat) → 0), so we replace
// them with one cap and keep the rest of the grid uniform.
// ----------------------------------------------------------------------
export class PolarCapModel
{
    rowDegLat;
    capRows;
    capBoundaryLatN;
    capBoundaryLatS;
    capFan;
    capCenterLatN;
    capCenterLatS;

    constructor(planet)
    {
        this.rowDegLat = 180 / planet.latCells;

        this.capRows = planet.polarCapLat >= 90
            ? 0
            : Math.min(
                Math.floor(planet.latCells / 2),
                Math.ceil((90 - planet.polarCapLat) / this.rowDegLat),
            );

        this.capBoundaryLatN =  90 - this.capRows * this.rowDegLat;
        this.capBoundaryLatS = -90 + this.capRows * this.rowDegLat;
        this.capFan = planet.polarCapFan ?? planet.lonCells;

        // Latitude of each polar cap's CENTRE — the focus the crust view
        // settles on when you stroll onto a pole in latitude-traversal mode.
        this.capCenterLatN =  90 - this.capRows * this.rowDegLat / 2;
        this.capCenterLatS = -90 + this.capRows * this.rowDegLat / 2;
    }

    get hasCaps()
    {
        return this.capRows > 0;
    }
}

