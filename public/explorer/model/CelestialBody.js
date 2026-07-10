import { LayerModel } from './LayerModel.js';
import { LayerMaterialFactory } from '../material/LayerMaterialFactory.js';
import { CellGeometryFactory } from '../geometry/CellGeometryFactory.js';
import { BodyMesh } from '../world/BodyMesh.js';
import { ClipController } from '../slicing/ClipController.js';
import { GoldbergTopology } from '../topology/GoldbergTopology.js';
import { AtmosphereShell } from '../atmosphere/AtmosphereShell.js';

// ----------------------------------------------------------------------
// CelestialBody -- one self-contained, positionable body in the scene. Owns
// its config, the LayerModel, the cell topology + grid, render materials +
// geometry factories, the rendered BodyMesh, and the resource-mode slicing
// chain (clip plane, slice builder). The scene orchestrator wires SHARED
// subsystems (camera, sky, lights, hud, input) to whichever body is active.
//
// A body positions all its meshes under BodyMesh's group, so multiple
// bodies (companions / moons) can be offset independently by an orbit system.
//
// SINGLE RESPONSIBILITY: "be one body and expose the handles the shared
// subsystems need"; OPEN/CLOSED: swapping topology, materials or slice builder
// is a data / factory change, never an edit here.
// ----------------------------------------------------------------------
export class CelestialBody
{
    #body;
    #config;

    #layerModel;
    #topology;
    #cellGrid;

    #materials;
    #cellGeometry;

    #bodyMesh;
    #clip;
    #sliceBuilder;
    #gridLines;

    #atmosphere;        // AtmosphereShell | null (per-body haze)
    #atmosphereConfig;  // resolved per-body atmosphere config (always an object)
    #disposed = false;

    // `focus` is the shared resource-mode focus state (only the ACTIVE body
    // ever enters resource mode, so it is safe to share). Each body derives its
    // OWN atmosphere (radius + shell) from its OWN config, so a companion no
    // longer inherits the primary's haze.
    //
    // `bodyConfig` is this specific body's config (the primary is the root
    // body entry; a companion is one entry of `body.companions[]`).
    constructor(scene, bodyConfig, behaviour, focus, starCount, generated = null)
    {
        this.#config = bodyConfig;
        this.#body = bodyConfig;
        this.#atmosphereConfig = this.#resolveAtmosphere(bodyConfig);
        const atmosphereRadius = bodyConfig.radius * (1 + this.#atmosphereConfig.thickness);

        this.#layerModel = new LayerModel(this.#body);

        this.#topology = new GoldbergTopology(
            this.#body, this.#layerModel, this.#atmosphereConfig, atmosphereRadius, behaviour,
            generated?.faces ?? null,
        );
        this.#cellGrid = this.#topology.grid;

        this.#materials = new LayerMaterialFactory(
            this.#body,
            this.#layerModel,
            behaviour.materials,
        );
        this.#cellGeometry = new CellGeometryFactory();

        this.#bodyMesh = new BodyMesh(
            scene, this.#cellGrid, this.#cellGeometry, this.#materials, this.#layerModel, generated?.surface ?? null,
        );
        this.#gridLines = this.#topology.buildGridLines();
        this.#bodyMesh.add(this.#gridLines);

        this.#clip = new ClipController(focus, this.#topology.cutStrategy, this.#bodyMesh.group, behaviour.slice.rebuildIntervalMs);

        this.#sliceBuilder = this.#topology.createSliceBuilder({
            clip: this.#clip,
            cellGrid: this.#cellGrid,
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
            ? new AtmosphereShell(this.#body, this.#atmosphereConfig, starCount, behaviour.atmosphere.fidelity)
            : null;
    }

    // Resolve the atmosphere config for this body. Every body owns its OWN
    // inline `atmosphere` block; there is no shared/global default. A body with
    // no block simply has no atmosphere.
    #resolveAtmosphere(bodyConfig)
    {
        return {
            show: false,
            thickness: 0,
            ...bodyConfig.atmosphere,
        };
    }

    // Async factory: precompute the body off the main thread when a
    // BodyGenService is provided and functional, then build synchronously
    // from the ready payload. Any worker failure transparently falls back to
    // full synchronous generation. The caller (ExplorerApplication) owns and
    // disposes the shared service.
    static async create(scene, bodyConfig, behaviour, focus, starCount, service = null)
    {
        let generated = null;

        if (service)
        {
            try
            {
                if (service.isSupported)
                {
                    generated = await service.generate(CelestialBody.#specFor(bodyConfig));
                }
            }
            catch (err)
            {
                console.warn('[explorer] worker body generation failed; falling back to synchronous', err);
                generated = null;
            }
        }

        return new CelestialBody(scene, bodyConfig, behaviour, focus, starCount, generated);
    }

    // Serialisable worker request describing this body's geometry. Mirrors the
    // radii maths in GoldbergGrid (surface-relative layer thicknesses).
    static #specFor(body)
    {
        const layerModel = new LayerModel(body);
        const coreRadius = layerModel.coreRadius;
        const nominalCrust = body.radius - coreRadius;

        return {
            frequency: body.hexFrequency ?? 16,
            layerThicknesses: layerModel.layerThicknesses,
            coreRadius,
            minSurface: coreRadius + 0.2 * nominalCrust,
            shape: body.shape ?? { type: 'sphere' },
            size: body.radius,
        };
    }

    get id()            { return this.#config.id ?? null; }
    get name()          { return this.#config.name ?? this.#config.id ?? 'body'; }
    get orbit()         { return this.#config.orbit ?? null; }
    get config()        { return this.#config; }
    get group()         { return this.#bodyMesh.group; }
    get radius()        { return this.#body.radius; }
    get body()          { return this.#body; }
    get layerModel()    { return this.#layerModel; }
    get topology()      { return this.#topology; }
    get cellGrid()      { return this.#cellGrid; }
    get materials()     { return this.#materials; }
    get cellGeometry()  { return this.#cellGeometry; }
    get bodyMesh()      { return this.#bodyMesh; }
    get clip()          { return this.#clip; }
    get sliceBuilder()      { return this.#sliceBuilder; }
    get atmosphere()        { return this.#atmosphere; }
    get atmosphereConfig()  { return this.#atmosphereConfig; }
    get shapeField()        { return this.#topology.shapeField; }
    get surfaceMesh()       { return this.#bodyMesh.surfaceMeshes[0] ?? null; }

    // Release all GPU resources owned by this body. Idempotent.
    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        this.#clip.onCutChanged = null;

        this.#sliceBuilder?.dispose();
        this.#atmosphere?.dispose();
        this.#gridLines?.geometry.dispose();
        this.#gridLines?.material.dispose();
        this.#bodyMesh?.dispose();
        this.#materials?.dispose();

        // Dispose cached cell geometries / edges / resource edges.
        for (const depthCells of this.#cellGrid.cellsByDepth)
        {
            for (const cell of depthCells)
            {
                cell.geom?.dispose();
                cell.edges?.dispose();
                cell.resourceGeometry?.dispose();
                cell.resourceEdges?.dispose();
                cell.geoCache = null;
            }
        }

        for (const cell of this.#cellGrid.atmosphereCells ?? [])
        {
            cell.geom?.dispose();
            cell.edges?.dispose();
            cell.resourceGeometry?.dispose();
            cell.resourceEdges?.dispose();
            cell.geoCache = null;
        }
    }
}
