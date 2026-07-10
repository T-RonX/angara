// ----------------------------------------------------------------------
// ZoomModel -- centralized adaptive zoom formula for resource-mode camera
// distance. All zoom calculations (initial distance, body-switch, wheel
// limits) use this ONE source.
//
// The formula: distance = baseline × adaptiveZoom × crustZoom
//   adaptiveZoom = (crustThickness / referenceThickness) ^ exponent
// so thinner bodies zoom out more and thicker ones zoom in more, all
// anchored to a single tuning reference.
// ----------------------------------------------------------------------
export class ZoomModel
{
    #baseline;
    #referenceThickness;
    #exponent;
    #cameraCfg;
    #adaptiveZoom = 1;

    constructor(cameraCfg)
    {
        this.#cameraCfg = cameraCfg;
        this.#baseline = cameraCfg.zoomBaseline;
        this.#referenceThickness = cameraCfg.zoomReferenceThickness;
        this.#exponent = cameraCfg.zoomExponent;
    }

    // Recompute the adaptive factor for a body's crust stack.
    recalculate(layerModel, shapeField)
    {
        const maxR = shapeField.maxRadius;
        const coreR = layerModel.coreRadius;
        const thickness = maxR - coreR;
        this.#adaptiveZoom = Math.pow(
            thickness / this.#referenceThickness,
            this.#exponent,
        );

        return this;
    }

    get distance() { return this.#baseline * this.#adaptiveZoom * this.#cameraCfg.crustZoom; }
    get min()      { return this.#baseline * this.#adaptiveZoom * this.#cameraCfg.crustZoomMin; }
    get max()      { return this.#baseline * this.#adaptiveZoom * this.#cameraCfg.crustZoomMax; }

    clamp(dist)
    {
        return Math.max(this.min, Math.min(this.max, dist));
    }
}
