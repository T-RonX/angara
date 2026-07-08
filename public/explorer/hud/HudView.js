import * as THREE from 'three';

// ----------------------------------------------------------------------
// HudView — owns the HUD's read-out panel: the hover / focus / selection
// text, the compass widget, the FPS counter and the mode button. It is the
// ONLY place that touches those DOM nodes, so the rest of the app speaks in
// cells and camera state, never in element ids.
// ----------------------------------------------------------------------
export class HudView
{
    #maxDepth;
    #hasAtmosphere;
    #topology;

    #el = {};
    #modeBtn;
    #resourceControls;
    #compassRose;

    #camRight = new THREE.Vector3();
    #camUp = new THREE.Vector3();
    #perf = { last: performance.now(), ema: 0, lastHud: 0 };

    constructor(layerModel, hasAtmosphere, topology)
    {
        this.#maxDepth = layerModel.maxDepth;
        this.#hasAtmosphere = hasAtmosphere;
        this.#topology = topology;

        const id = i => document.getElementById(i);
        this.#el = {
            mode: id('rMode'),
            selected: id('rSelected'),
            lon: id('rLon'), lat: id('rLat'), depth: id('rDepth'),
            slice: id('rSlice'),
            selType: id('rSelType'), selLon: id('rSelLon'), selLat: id('rSelLat'), selLayer: id('rSelLayer'),
            fps: id('rFps'), frameMs: id('rFrameMs'),
            calls: id('rCalls'), tris: id('rTris'), points: id('rPoints'), lines: id('rLines'),
            geoms: id('rGeoms'), textures: id('rTextures'),
        };
        this.#modeBtn = id('modeBtn');
        this.#resourceControls = id('resourceControls');
        this.#compassRose = id('compassRose');
    }

    retarget(layerModel, hasAtmosphere, topology)
    {
        this.#maxDepth = layerModel.maxDepth;
        this.#hasAtmosphere = hasAtmosphere;
        this.#topology = topology;
    }

    bindModeButton(onToggle)
    {
        this.#modeBtn.addEventListener('click', onToggle);
    }

    setMode(mode)
    {
        const resource = mode === 'resource';
        this.#resourceControls.hidden = !resource;
        this.#modeBtn.textContent = resource ? 'Exit resource mode' : 'Enter resource mode';
        this.#el.mode.textContent = mode;
    }

    refreshModeButton(hasSelection)
    {
        this.#modeBtn.disabled = !hasSelection;
    }

    // --- Hover read-out ------------------------------------------------

    setHoverReadout(cell)
    {
        this.#el.lon.textContent = `${cell.lon.toFixed(1)}°`;
        this.#el.lat.textContent = `${cell.lat.toFixed(1)}°`;
        this.#el.depth.textContent = this.layerLabel(cell);
    }

    clearHoverReadout()
    {
        this.#el.lon.textContent = this.#el.lat.textContent = this.#el.depth.textContent = '—';
    }

    // --- Focus / selection read-outs -----------------------------------

    updateFocusReadout(focus)
    {
        this.#el.slice.textContent = `lon ${focus.lon.toFixed(0)}° · lat ${focus.lat.toFixed(0)}°`;
    }

    setSelectedSurfaceReadout(cell)
    {
        this.#el.selected.textContent = `lon ${cell.lon.toFixed(0)}° · lat ${cell.lat.toFixed(0)}°`;
    }

    // Reflect the cell relevant to the current mode (cliff pick in resource
    // mode, falling back to the surface anchor; surface cell in view mode).
    updateSelectionReadout(state)
    {
        const cell = (state.mode === 'resource' && state.resourceSelected)
            ? state.resourceSelected
            : state.selected;

        if (!cell)
        {
            this.#el.selType.textContent = '— none';
            this.#el.selLon.textContent = this.#el.selLat.textContent = this.#el.selLayer.textContent = '—';

            return;
        }

        this.#el.selType.textContent = this.#topology.cellTypeLabel(cell);
        this.#el.selLon.textContent = `${cell.lon.toFixed(1)}°`;
        this.#el.selLat.textContent = `${cell.lat.toFixed(1)}°`;
        this.#el.selLayer.textContent = this.layerLabel(cell);
    }

    // A cell's place in the layer stack, counting the atmosphere (when
    // present) as the outermost layer.
    layerLabel(cell)
    {
        const total = this.#maxDepth + (this.#hasAtmosphere ? 1 : 0);

        if (cell.isAtmosphere)
        {
            return `atmosphere · 1 / ${total}`;
        }

        const layerNo = cell.depth + 1 + (this.#hasAtmosphere ? 1 : 0);

        return `${layerNo} / ${total}`;
    }

    // --- Compass + FPS -------------------------------------------------

    updateCompass(camera)
    {
        if (!this.#compassRose) return;

        this.#camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        this.#camUp.setFromMatrixColumn(camera.matrixWorld, 1);

        // World north (+Y) projected onto the camera's screen basis.
        const x = this.#camRight.y;
        const y = this.#camUp.y;
        const deg = Math.atan2(x, y) * 180 / Math.PI;
        this.#compassRose.setAttribute('transform', `rotate(${deg.toFixed(2)})`);
    }

    updateFps(now)
    {
        const dt = now - this.#perf.last;
        this.#perf.last = now;
        this.#perf.ema = this.#perf.ema === 0 ? dt : this.#perf.ema + (dt - this.#perf.ema) * 0.1;

        if (now - this.#perf.lastHud > 250)
        {
            this.#el.fps.textContent = (1000 / this.#perf.ema).toFixed(0);
            this.#el.frameMs.textContent = `${this.#perf.ema.toFixed(1)} ms`;
            this.#perf.lastHud = now;
        }
    }

    updateRenderInfo(info)
    {
        if (!info) return;

        const render = info.render ?? {};
        const memory = info.memory ?? {};

        if (this.#el.calls)    this.#el.calls.textContent = String(render.calls ?? '—');
        if (this.#el.tris)     this.#el.tris.textContent = String(render.triangles ?? '—');
        if (this.#el.points)   this.#el.points.textContent = String(render.points ?? '—');
        if (this.#el.lines)    this.#el.lines.textContent = String(render.lines ?? '—');
        if (this.#el.geoms)    this.#el.geoms.textContent = String(memory.geometries ?? '—');
        if (this.#el.textures) this.#el.textures.textContent = String(memory.textures ?? '—');
    }
}
