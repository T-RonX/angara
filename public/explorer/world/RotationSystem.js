import { RotationModel } from '../model/RotationModel.js';

// ----------------------------------------------------------------------
// RotationSystem — advances every registered body's RotationModel once per
// frame and writes the resulting quaternion to its group. Mirrors OrbitSystem
// in structure. Rotation uses frame deltas (not absolute time) so live
// period / tilt edits are seamlessly continuous.
// SINGLE RESPONSIBILITY: "spin and tilt every body each frame".
// ----------------------------------------------------------------------
export class RotationSystem
{
    #entries = [];
    #byBody = new Map();

    // Register a body. bodyConfig's axialTiltDeg / rotationPeriodSec drive the model.
    add(body)
    {
        const model = new RotationModel(body.config);
        const entry = { body, model };

        this.#entries.push(entry);
        this.#byBody.set(body, entry);

        return entry;
    }

    // The live RotationModel for a body (used by the HUD to reconfigure live).
    // Returns null for unregistered bodies.
    modelFor(body)
    {
        return this.#byBody.get(body)?.model ?? null;
    }

    // Advance every body's spin phase by `dt` seconds and apply to its group.
    update(dt)
    {
        for (const { body, model } of this.#entries)
        {
            model.advance(dt);
            model.applyToGroup(body.group);
        }
    }
}
