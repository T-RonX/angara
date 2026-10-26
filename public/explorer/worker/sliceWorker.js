import { calculateSlice } from './SliceCalculation.js';

let snapshot = null;

self.onmessage = (event) =>
{
    const message = event.data;

    try
    {
        if (message.type === 'initialize')
        {
            snapshot = message.snapshot;
            self.postMessage({ type: 'initialized', ok: true });

            return;
        }

        if (message.type !== 'calculate') return;
        if (!snapshot) throw new Error('Slice worker received a calculation before initialization');

        const startedAt = message.measure ? performance.now() : 0;
        const result = calculateSlice(snapshot, message.request);
        const calcMs = message.measure ? performance.now() - startedAt : null;
        const transfer = [
            result.surfaceColumns.buffer,
            result.wallCandidateColumns.buffer,
            result.wallColumns.buffer,
        ];

        self.postMessage({
            type: 'result',
            revision: message.revision,
            ok: true,
            result,
            calcMs,
        }, transfer);
    }
    catch (error)
    {
        self.postMessage({
            type: message.type === 'initialize' ? 'initialized' : 'result',
            revision: message.revision,
            ok: false,
            error: String(error?.stack || error),
        });
    }
};
