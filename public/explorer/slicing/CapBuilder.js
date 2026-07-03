import * as THREE from 'three';
import { deg2rad } from '../core/MathUtils.js';

// ----------------------------------------------------------------------
// CapBuilder — closes every sliced cell with a flat polygon ON the clip
// plane so the cut reads as solid (the cells are really cut, not hidden).
// One merged cap mesh per depth (cheap draw calls), each carrying a
// faceIndex → cell map so the cliff stays clickable. Also caps the core and
// emits a near-invisible atmosphere cross-section strip.
//
// To stay fast it never tests every cell: a broad-phase narrows the work to
// the ~2 columns (meridian cut) or ~1 row per column (tilted great-circle
// cut) the plane can actually cross, or a bounding-sphere test during the
// off-centre open-slice transition.
// ----------------------------------------------------------------------
export class CapBuilder
{
    capsGroup;
    capMeshes = [];

    #clip;
    #cellGrid;
    #crossSection;
    #materials;
    #layerModel;
    #focus;
    #planet;
    #traverseAxis;
    #capModel;

    constructor(scene, clipController, cellGrid, crossSectionFactory, materialFactory, layerModel, focus, planet, traverseAxis, capModel)
    {
        this.#clip = clipController;
        this.#cellGrid = cellGrid;
        this.#crossSection = crossSectionFactory;
        this.#materials = materialFactory;
        this.#layerModel = layerModel;
        this.#focus = focus;
        this.#planet = planet;
        this.#traverseAxis = traverseAxis;
        this.#capModel = capModel;

        this.capsGroup = new THREE.Group();
        scene.add(this.capsGroup);
    }

    clearCaps()
    {
        while (this.capsGroup.children.length > 0)
        {
            const cap = this.capsGroup.children[this.capsGroup.children.length - 1];
            this.capsGroup.remove(cap);
            cap.geometry.dispose();
        }

        this.capMeshes.length = 0;
    }

    // `slab`: use the generalised offset-plane broad-phase (open-slice sweep).
    build(slab = false)
    {
        this.clearCaps();

        const plane = this.#clip.plane;
        const n = plane.normal;
        const k = plane.constant;
        const maxDepth = this.#layerModel.maxDepth;

        // Merged cap buffers, one per depth.
        const buffers = [];
        for (let d = 0; d < maxDepth; d++)
        {
            buffers.push({ positions: [], normals: [], faceToCell: [] });
        }

        const latitudeAxis = this.#traverseAxis === 'latitude';
        const meridianPhase = !slab && (!latitudeAxis || this.#clip.isPoleCut());
        const greatCirclePhase = !slab && latitudeAxis && !this.#clip.isPoleCut();
        const cols = meridianPhase ? this.#cutColumns(this.#focus.lon) : null;
        const candRows = greatCirclePhase ? this.#latitudeCrossingRows() : null;

        for (let d = 0; d < maxDepth; d++)
        {
            for (const cell of this.#cellGrid.cellsByDepth[d])
            {
                if (!this.#cellPassesBroadPhase(cell, slab, n, k, meridianPhase, greatCirclePhase, cols, candRows))
                {
                    continue;
                }

                const cross = this.#crossSection.cellCrossSection(cell);

                if (cross === null) continue;

                this.#emitCross(buffers[d], cross, cell, n);
            }
        }

        this.#emitCapMeshes(buffers);

        if (this.#cellGrid.atmosphereCells.length > 0 && !slab)
        {
            this.#emitAtmosphereCaps(n, meridianPhase, greatCirclePhase, cols, candRows);
        }

        this.#emitCoreCap(n, k);
    }

    #cellPassesBroadPhase(cell, slab, n, k, meridianPhase, greatCirclePhase, cols, candRows)
    {
        if (slab)
        {
            // Offset-plane broad-phase. Polar caps aren't offset-aware, so
            // they're skipped during the sweep and reappear when it settles.
            if (cell.kind === 'cap') return false;

            this.#cellBounds(cell);

            return Math.abs(n.x * cell._cx + n.y * cell._cy + n.z * cell._cz + k) <= cell._cr;
        }

        if (cell.kind === 'cap')
        {
            // Caps are only sliced by a meridian cut.
            return meridianPhase;
        }

        if (greatCirclePhase)
        {
            return cell.latIdx >= candRows.lo[cell.lonIdx] - 1
                && cell.latIdx <= candRows.hi[cell.lonIdx] + 1;
        }

        // Meridian cut: quad cells only matter in a crossed column.
        return cols.has(cell.lonIdx);
    }

    #emitCross(buf, cross, cell, n)
    {
        const pts = cross.positions;
        const idx = cross.indices;

        for (let t = 0; t < idx.length; t += 3)
        {
            const a = pts[idx[t]];
            const b = pts[idx[t + 1]];
            const c = pts[idx[t + 2]];

            for (const p of [a, b, c])
            {
                buf.positions.push(p.x, p.y, p.z);
                buf.normals.push(-n.x, -n.y, -n.z);
            }

            buf.faceToCell.push(cell);
        }
    }

    #emitCapMeshes(buffers)
    {
        for (let d = 0; d < this.#layerModel.maxDepth; d++)
        {
            const buf = buffers[d];

            if (buf.positions.length === 0) continue;

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
            geo.computeBoundingSphere();

            const cap = new THREE.Mesh(geo, this.#materials.capMaterials[d]);
            cap.userData.faceToCell = buf.faceToCell;
            this.capsGroup.add(cap);
            this.capMeshes.push(cap);
        }
    }

    #emitAtmosphereCaps(n, meridianPhase, greatCirclePhase, cols, candRows)
    {
        const aPos = [];
        const aNorm = [];
        const aF2C = [];

        for (const cell of this.#cellGrid.atmosphereCells)
        {
            if (cell.kind === 'cap')
            {
                if (!meridianPhase) continue;
            }
            else if (greatCirclePhase)
            {
                if (cell.latIdx < candRows.lo[cell.lonIdx] - 1 ||
                    cell.latIdx > candRows.hi[cell.lonIdx] + 1)
                {
                    continue;
                }
            }
            else if (!cols.has(cell.lonIdx))
            {
                continue;
            }

            const cross = this.#crossSection.cellCrossSection(cell);

            if (cross === null) continue;

            this.#emitCross({ positions: aPos, normals: aNorm, faceToCell: aF2C }, cross, cell, n);
        }

        if (aPos.length === 0) return;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(aNorm, 3));
        geo.computeBoundingSphere();

        const cap = new THREE.Mesh(geo, this.#materials.atmosphereCapMaterial);
        cap.userData.faceToCell = aF2C;
        this.capsGroup.add(cap);
        this.capMeshes.push(cap);
    }

    #emitCoreCap(n, k)
    {
        const coreR = this.#layerModel.coreRadius;

        if (coreR * coreR <= k * k) return;

        const discR = Math.sqrt(coreR * coreR - k * k);
        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(discR, 48),
            this.#materials.coreCapMaterial,
        );
        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        disc.position.copy(n).multiplyScalar(-k);
        this.capsGroup.add(disc);
        // Not added to capMeshes — the core isn't a clickable cell.
    }

    // --- Broad-phase helpers ------------------------------------------

    // Which longitude columns can the meridian plane cut? The meridian
    // through `focusLon` crosses the body at that longitude AND its antipode.
    #cutColumns(focusLon)
    {
        const w = 360 / this.#planet.lonCells;
        const cols = new Set();
        const eps = 1e-6;

        for (const base of [focusLon, focusLon + 180])
        {
            const norm = ((base % 360) + 360) % 360;
            cols.add(Math.floor((norm - eps + 360) % 360 / w));
            cols.add(Math.floor((norm + eps) % 360 / w));
        }

        return cols;
    }

    // Latitude-axis broad-phase: the tilted great circle crosses each column
    // at one latitude; return the inclusive row span per column.
    #latitudeCrossingRows()
    {
        const lonCells = this.#planet.lonCells;
        const rowDegLat = this.#capModel.rowDegLat;
        const colDeg = 360 / lonCells;
        const tanPhi = Math.tan(deg2rad(this.#focus.lat));
        const lamR = deg2rad(this.#focus.lon);
        const lo = new Int32Array(lonCells);
        const hi = new Int32Array(lonCells);

        const rowAt = lonDeg => {
            const latDeg = Math.atan(tanPhi * Math.cos(lamR - deg2rad(lonDeg))) * 180 / Math.PI;

            return Math.floor((latDeg + 90) / rowDegLat);
        };

        for (let i = 0; i < lonCells; i++)
        {
            const a = rowAt(i * colDeg);
            const b = rowAt((i + 1) * colDeg);
            lo[i] = Math.min(a, b);
            hi[i] = Math.max(a, b);
        }

        return { lo, hi };
    }

    // Lazily cache a quad cell's bounding sphere for the offset-plane phase.
    #cellBounds(cell)
    {
        if (cell._cr !== undefined) return;

        const cs = cell.corners;
        let cx = 0, cy = 0, cz = 0;

        for (const v of cs) { cx += v.x; cy += v.y; cz += v.z; }

        const inv = 1 / cs.length;
        cx *= inv; cy *= inv; cz *= inv;
        let r2 = 0;

        for (const v of cs)
        {
            const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
            const d = dx * dx + dy * dy + dz * dz;

            if (d > r2) r2 = d;
        }

        cell._cx = cx; cell._cy = cy; cell._cz = cz; cell._cr = Math.sqrt(r2);
    }
}

