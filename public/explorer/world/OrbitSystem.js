import * as THREE from 'three';
import { OrbitModel } from '../model/OrbitModel.js';

// ----------------------------------------------------------------------
// OrbitSystem — composes every body's per-parent OrbitModel into concrete
// scene positions each frame. It owns the parent/child hierarchy (a moon
// orbits a planet that orbits nothing) and re-frames the whole system so the
// currently ACTIVE body sits at the world origin (the camera's orbit target),
// with all other bodies positioned RELATIVE to it. That is exactly the
// requested behaviour: "objects are visible orbiting relative to the current
// selected object".
//
// Entries form a tree via `parent`; a body's absolute position is the sum of
// the orbital offsets along its parent chain. SINGLE RESPONSIBILITY: "place
// every body group in the scene for time t, framed on the active body".
// ----------------------------------------------------------------------
export class OrbitSystem
{
    #entries = [];              // { body, model, parent, _abs, _stamp }
    #byBody = new Map();
    #registry;
    #stamp = 0;
    #tmp = new THREE.Vector3();

    constructor(registry)
    {
        this.#registry = registry;
    }

    // Register a body with its orbit config and (optional) parent CelestialBody.
    add(body, parentBody = null)
    {
        const entry = {
            body,
            model: new OrbitModel(body.orbit),
            parent: parentBody ? this.#byBody.get(parentBody) : null,
            _abs: new THREE.Vector3(),
            _stamp: -1,
        };

        this.#entries.push(entry);
        this.#byBody.set(body, entry);

        return entry;
    }

    // The live OrbitModel driving a body (so the HUD can reconfigure it when the
    // orbit sliders change). Null for an unregistered body.
    modelFor(body)
    {
        return this.#byBody.get(body)?.model ?? null;
    }

    // Advance to absolute time `tSec` and reposition every body group so the
    // active body is at the origin.
    update(tSec)
    {
        this.#stamp++;

        for (const entry of this.#entries)
        {
            this.#absolute(entry, tSec);
        }

        const active = this.#byBody.get(this.#registry.active);
        const origin = active ? active._abs : this.#tmp.set(0, 0, 0);

        for (const entry of this.#entries)
        {
            entry.body.group.position.copy(entry._abs).sub(origin);
        }
    }

    // Absolute (system-root-relative) position of a body: its local orbital
    // offset plus its parent's absolute position. Memoised per update stamp so
    // a deep chain is still O(n) per frame.
    #absolute(entry, tSec)
    {
        if (entry._stamp === this.#stamp)
        {
            return entry._abs;
        }

        entry._abs.copy(entry.model.positionAt(tSec));

        if (entry.parent)
        {
            entry._abs.add(this.#absolute(entry.parent, tSec));
        }

        entry._stamp = this.#stamp;

        return entry._abs;
    }
}
