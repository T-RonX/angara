// ----------------------------------------------------------------------
// bodyWorker — the module-worker entry point that runs the heavy body
// generation off the main thread. It owns NO rendering state; it is a pure
// function of its request message:
//
//   in : { id, frequency, layerThicknesses, coreRadius, minSurface, shape, size }
//   out: { id, faces, surface }  (all payload buffers Transferred, not copied)
//
// A module worker has no importmap, so it can only import dependency-free code
// — GoldbergGen is deliberately THREE-free for exactly this reason. Because the
// output is plain typed arrays, the whole result is handed back as zero-copy
// Transferables and the main thread never blocks on generation.
// ----------------------------------------------------------------------
import { buildGoldbergFaces, buildSurfaceGeometry, ShapeSampler } from './GoldbergGen.js';

self.onmessage = (e) =>
{
    const req = e.data;

    try
    {
        const shapeSampler = new ShapeSampler(req.shape, req.size);
        const faces = buildGoldbergFaces(req.frequency);
        const surface = buildSurfaceGeometry(
            faces,
            req.layerThicknesses,
            req.coreRadius,
            req.minSurface,
            shapeSampler,
        );

        const transfer = [
            faces.dirs.buffer,
            faces.sides.buffer,
            faces.cornerOffset.buffer,
            faces.cornerXYZ.buffer,
            faces.neighborOffset.buffer,
            faces.neighborIndex.buffer,
            surface.positions.buffer,
            surface.normals.buffer,
            surface.indices.buffer,
            surface.faceCellIndex.buffer,
        ];

        self.postMessage({ id: req.id, ok: true, faces, surface }, transfer);
    }
    catch (err)
    {
        self.postMessage({ id: req.id, ok: false, error: String(err && err.stack || err) });
    }
};
