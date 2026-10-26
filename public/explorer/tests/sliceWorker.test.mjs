import assert from 'node:assert/strict';

import { behaviour } from '../config/behaviour.js';
import { validateConfigs } from '../config/ConfigValidator.js';
import { createPhysical } from '../config/physical.js';
import { calculateSlice } from '../worker/SliceCalculation.js';
import { SliceRebuildService } from '../worker/SliceRebuildService.js';

assert.deepEqual(behaviour.slice.worker, {
    enabled: true,
    minimumColumns: 4096,
});
const invalidWorkerConfig = structuredClone(behaviour);
invalidWorkerConfig.slice.worker.minimumColumns = 0;
assert.throws(
    () => validateConfigs(createSeededPhysical(), invalidWorkerConfig),
    /slice\.worker\.minimumColumns must be a finite number >= 1/,
);

const snapshot = {
    cornerCoordinates: new Float64Array([
        -2, 0, 0,
        0, 0, 0,
        -2, 0, 0,
        2, 0, 0,
    ]),
    cornerOffsets: new Uint32Array([0, 6, 9, 12]),
    centroidCoordinates: new Float64Array([
        -1, 0, 0,
        -2, 0, 0,
        2, 0, 0,
    ]),
    cornerRadii: new Float64Array([1, 0, 0]),
    columnBounds: new Float64Array([
        -1, 0, 0, 0.1,
        -2, 0, 0, 0.1,
        2, 0, 0, 0.1,
    ]),
};

const collectRequest = {
    kind: 'collect',
    normal: [1, 0, 0],
    constant: 0,
    eps: 0.05,
    maxDepth: 3,
    cellStride: 4,
    wallBandDist: 0.2,
    applyViewCull: false,
    measure: true,
};

const full = calculateSlice(snapshot, collectRequest);
assert.deepEqual([...full.surfaceColumns], [0, 2]);
assert.deepEqual([...full.wallCandidateColumns], [0]);
assert.deepEqual([...full.wallColumns], [0]);
assert.equal(full.surfaceHash, 2);
assert.equal(full.count, 5);
assert.equal(full.hash, 62);
assert.equal(full.boundsRejected, 1);
assert.equal(full.boundsAccepted, 1);
assert.equal(full.exactTested, 1);
assert.equal(full.cornerTests, 2);

const scaledNormal = calculateSlice(snapshot, {
    ...collectRequest,
    normal: [2, 0, 0],
});
assert.deepEqual([...scaledNormal.surfaceColumns], [0, 2]);

const culled = calculateSlice(snapshot, {
    ...collectRequest,
    applyViewCull: true,
    frustumPlanes: new Float64Array([1, 0, 0, -0.5]),
});
assert.deepEqual([...culled.surfaceColumns], [0, 2]);
assert.deepEqual([...culled.wallCandidateColumns], [0]);
assert.deepEqual([...culled.wallColumns], []);
assert.equal(culled.count, 2);
assert.equal(culled.hash, 62);

const refocused = calculateSlice(snapshot, {
    kind: 'refocus',
    physical: {
        surfaceColumns: full.surfaceColumns,
        wallCandidateColumns: full.wallCandidateColumns,
        surfaceHash: full.surfaceHash,
    },
    maxDepth: 3,
    cellStride: 4,
    applyViewCull: true,
    frustumPlanes: new Float64Array([1, 0, 0, -0.5]),
});
assert.deepEqual([...refocused.surfaceColumns], [0, 2]);
assert.deepEqual([...refocused.wallColumns], []);
assert.equal(refocused.count, 2);
assert.equal(refocused.hash, 62);

const depthZero = calculateSlice(snapshot, {
    ...collectRequest,
    maxDepth: 1,
});
assert.deepEqual([...depthZero.surfaceColumns], [0, 2]);
assert.deepEqual([...depthZero.wallColumns], [0]);
assert.equal(depthZero.count, 3);

class FakeWorker
{
    messages = [];
    onmessage = null;
    onerror = null;
    terminated = false;

    postMessage(message)
    {
        this.messages.push(message);
    }

    emit(message)
    {
        this.onmessage({ data: message });
    }

    terminate()
    {
        this.terminated = true;
    }
}

const worker = new FakeWorker();
const events = [];
const service = new SliceRebuildService({
    workerFactory: () => worker,
    onError: error => { throw error; },
    now: () => 10,
});

const request = { kind: 'collect', measure: true };
service.request(snapshot, request, {
    onResult: ({ revision }) => events.push(`result:${revision}`),
    onStale: revision => events.push(`stale:${revision}`),
    onCoalesced: revision => events.push(`coalesced:${revision}`),
});
assert.equal(worker.messages.filter(message => message.type === 'initialize').length, 1);

worker.emit({ type: 'initialized', ok: true });
assert.equal(worker.messages.at(-1).type, 'calculate');
assert.equal(worker.messages.at(-1).revision, 1);

service.request(snapshot, request, {
    onResult: ({ revision }) => events.push(`result:${revision}`),
    onStale: revision => events.push(`stale:${revision}`),
    onCoalesced: revision => events.push(`coalesced:${revision}`),
});
service.request(snapshot, request, {
    onResult: ({ revision }) => events.push(`result:${revision}`),
    onStale: revision => events.push(`stale:${revision}`),
    onCoalesced: revision => events.push(`coalesced:${revision}`),
});

worker.emit({ type: 'result', revision: 1, ok: true, result: {}, calcMs: 2 });
assert.equal(worker.messages.at(-1).revision, 3);

worker.emit({ type: 'result', revision: 3, ok: true, result: {}, calcMs: 2 });
assert.deepEqual(events, ['coalesced:2', 'stale:1', 'result:3']);
assert.equal(worker.messages.filter(message => message.type === 'initialize').length, 1);

service.dispose();
service.dispose();
assert.equal(worker.terminated, true);

console.log('Slice worker calculation and latest-wins service invariants passed');

function createSeededPhysical()
{
    return createPhysical({
        id: 'primary',
        seed: 1,
        companions: [
            { id: 'moon-1', seed: 2 },
            { id: 'satellite-1', seed: 3 },
            { id: 'satellite-2', seed: 4 },
        ],
    });
}
