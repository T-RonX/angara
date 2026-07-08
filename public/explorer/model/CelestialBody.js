import { LayerModel } from './LayerModel.js';
import { LayerMaterialFactory } from '../material/LayerMaterialFactory.js';
import { CellGeometryFactory } from '../geometry/CellGeometryFactory.js';
import { CrossSectionFactory } from '../geometry/CrossSectionFactory.js';
import { BodyMesh } from '../world/BodyMesh.js';
import { ClipController } from '../slicing/ClipController.js';
import { createTopology } from '../topology/createTopology.js';
import { AtmosphereShell } from '../atmosphere/AtmosphereShell.js';
import { BodyGenService } from '../worker/BodyGenService.js';

// ----------------------------------------------------------------------
// CelestialBody — one self-contained, positionable body in the scene. It owns
// EVERYTHING that used to be spread across BodyExplorer for the single planet:
// its (serialisable) config, the derived LayerModel, the cell topology + grid,
// the render materials + geometry factories, the rendered BodyMesh, and the
// resource-mode slicing chain (clip plane, cross-section factory, slice
// builder). BodyExplorer is now just the scene orchestrator that wires the
// SHARED subsystems (camera, sky, lights, hud, input) to whichever body is
// active.
//
// A body positions all its meshes under BodyMesh's own group, so multiple
// bodies (companions / moons) can be offset independently by an orbit system.
//
// SINGLE RESPONSIBILITY: "be one body and expose the handles the shared
// subsystems need"; OPEN/CLOSED: swapping topology, materials or slice builder
// is a data / factory change, never an edit here.
// ----------------------------------------------------------------------
export class CelestialBody
{
    #physical;
    #behaviour;
    #planet;
    #config;

    #layerModel;
    #topology;
    #cellGrid;

    #materials;
    #cellGeometry;
    #crossSection;

    #bodyMesh;
    #clip;
    #sliceBuilder;

    #atmosphere;        // AtmosphereShell | null (per-body haze)
    #atmosphereConfig;  // resolved per-body atmosphere config (always an object)

    // `focus` is the shared resource-mode focus state (only the ACTIVE body
    // ever enters resource mode, so it is safe to share). Each body derives its
    // OWN atmosphere (radius + shell) from its OWN config, so a companion no
    // longer inherits the primary's haze.
    //
    // `bodyConfig` is this specific body's planet-like spec (the primary is
    // `physical.planet`; a companion is one entry of `planet.companions[]`).
    // Everything downstream still reads `physical.planet` / `physical.atmosphere`,
    // so a per-body `physicalView` is threaded through with THIS body's config +
    // resolved atmosphere swapped in — the topology / material / cross-section
    // chain is untouched and every body (primary or moon) is built by the exact
    // same code path.
    //
    // `isPrimary` is retained for the API but no longer affects the atmosphere:
    // every body (primary or companion) owns its OWN inline `atmosphere` block,
    // and a body with no block simply has no atmosphere.
    constructor(scene, physical, bodyConfig, behaviour, focus, starCount, isPrimary, generated = null)
    {
        this.#config = bodyConfig;
        this.#planet = bodyConfig;
        this.#behaviour = behaviour;

        this.#atmosphereConfig = this.#resolveAtmosphere(physical, bodyConfig, isPrimary);
        const atmosphereRadius = bodyConfig.radius * (1 + this.#atmosphereConfig.thickness);

        const physicalView = { ...physical, planet: bodyConfig, atmosphere: this.#atmosphereConfig };
        this.#physical = physicalView;

        this.#layerModel = new LayerModel(this.#planet);

        this.#topology = createTopology(
            physicalView, this.#layerModel, behaviour, atmosphereRadius, generated?.faces ?? null,
        );
        this.#cellGrid = this.#topology.grid;

        this.#materials = new LayerMaterialFactory(this.#planet, this.#layerModel);
        this.#cellGeometry = new CellGeometryFactory(this.#planet.polarCapRings);

        this.#bodyMesh = new BodyMesh(
            scene, this.#cellGrid, this.#cellGeometry, this.#materials, this.#layerModel, generated?.surface ?? null,
        );
        this.#bodyMesh.add(this.#topology.buildGridLines());

        this.#clip = new ClipController(focus, this.#topology.cutStrategy);

        this.#crossSection = new CrossSectionFactory(
            this.#clip.plane, focus, this.#planet.radius, this.#planet.polarCapRings,
        );

        this.#sliceBuilder = this.#topology.createSliceBuilder({
            scene,
            clip: this.#clip,
            cellGrid: this.#cellGrid,
            crossSection: this.#crossSection,
            materials: this.#materials,
            layerModel: this.#layerModel,
            focus,
            geometryFactory: this.#cellGeometry,
            bodyMesh: this.#bodyMesh,
        });

        this.#clip.setSliceBuilder(this.#sliceBuilder);

        // The haze is a self-contained offscreen-cached shell (its own private
        // scene + render target); the AtmosphereSystem positions + composites
        // it. Only built when this body actually has an atmosphere.
        this.#atmosphere = this.#atmosphereConfig.show
            ? new AtmosphereShell(this.#planet, this.#atmosphereConfig, starCount)
            : null;
    }

    // Resolve the atmosphere config for this body. Every body owns its OWN
    // inline `atmosphere` block; there is no shared/global default. A body with
    // no block simply has no atmosphere.
    #resolveAtmosphere(physical, bodyConfig, isPrimary)
    {
        return bodyConfig.atmosphere ?? { show: false, thickness: 0 };
    }

    // Shared body-generation worker client (one worker serves every body).
    static #service = null;

    // Async factory: precompute the body off the main thread (when the worker
    // is enabled + supported) so a high-hexFrequency body no longer freezes the
    // UI, then build synchronously from the ready payload. Any worker failure
    // transparently falls back to full synchronous generation, so the worker is
    // an accelerator, never a hard dependency.
    static async create(scene, physical, bodyConfig, behaviour, focus, starCount, isPrimary)
    {
        const useWorker = behaviour?.generation?.useWorker ?? true;
        let generated = null;

        if (useWorker)
        {
            try
            {
                CelestialBody.#service ??= new BodyGenService();

                if (CelestialBody.#service.isSupported)
                {
                    generated = await CelestialBody.#service.generate(CelestialBody.#specFor(bodyConfig));
                }
            }
            catch (err)
            {
                console.warn('[explorer] worker body generation failed; falling back to synchronous', err);
                generated = null;
            }
        }

        return new CelestialBody(scene, physical, bodyConfig, behaviour, focus, starCount, isPrimary, generated);
    }

    // Serialisable worker request describing this body's geometry. Mirrors the
    // radii maths in GoldbergGrid (core-relative layer fractions + the
    // anti-inversion minimum surface clamp).
    static #specFor(planet)
    {
        const layerModel = new LayerModel(planet);
        const coreRadius = layerModel.coreRadius;
        const nominalCrust = planet.radius - coreRadius;

        return {
            frequency: planet.hexFrequency ?? 16,
            layerFrac: layerModel.layerFrac,
            coreRadius,
            minSurface: coreRadius + 0.2 * nominalCrust,
            shape: planet.shape ?? { type: 'sphere' },
            size: planet.radius,
        };
    }

    get id()            { return this.#config.id ?? null; }
    get name()          { return this.#config.name ?? this.#config.id ?? 'body'; }
    get orbit()         { return this.#config.orbit ?? null; }
    get config()        { return this.#config; }
    get group()         { return this.#bodyMesh.group; }
    get planet()        { return this.#planet; }
    get layerModel()    { return this.#layerModel; }
    get topology()      { return this.#topology; }
    get cellGrid()      { return this.#cellGrid; }
    get materials()     { return this.#materials; }
    get cellGeometry()  { return this.#cellGeometry; }
    get crossSection()  { return this.#crossSection; }
    get bodyMesh()      { return this.#bodyMesh; }
    get clip()          { return this.#clip; }
    get sliceBuilder()      { return this.#sliceBuilder; }
    get atmosphere()        { return this.#atmosphere; }
    get atmosphereConfig()  { return this.#atmosphereConfig; }
    get shapeField()        { return this.#topology.shapeField; }
}
