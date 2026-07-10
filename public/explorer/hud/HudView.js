import * as THREE from 'three';

// HudView -- owns the HUD's read-out panel: the hover / focus / selection
// text, the compass widget, the FPS counter and the mode button. It is the
// ONLY place that touches those DOM nodes, so the rest of the app speaks in
// cells and camera state, never in element ids.
//
// A pre-built HudElements bundle is required; it validates all nodes at
// construction so missing elements fail fast with a clear error.
export class HudView
{
    #maxDepth;
    #hasAtmosphere;
    #topology;

    #el = {};
    #modeBtn;
    #resourceControls;
    #compassRose;
    #modeBtnListener = null;
    #disposed = false;

    #camRight = new THREE.Vector3();
    #camUp = new THREE.Vector3();
    #perf = { last: performance.now(), ema: 0, lastHud: 0 };

    constructor(layerModel, hasAtmosphere, topology, elements)
    {
        this.#maxDepth = layerModel.maxDepth;
        this.#hasAtmosphere = hasAtmosphere;
        this.#topology = topology;

        if (!elements)
        {
            throw new Error('[HudView] A validated HudElements bundle is required');
        }

        this.#el = {
            mode:     elements.mode,
            selected: elements.selected,
            lon: elements.lon, lat: elements.lat, depth: elements.depth,
            slice:    elements.slice,
            selType:  elements.selType, selLon: elements.selLon,
            selLat:   elements.selLat,  selLayer: elements.selLayer,
            fps: elements.fps, frameMs: elements.frameMs,
            calls: elements.calls, tris: elements.tris,
            points: elements.points, lines: elements.lines,
            geoms: elements.geoms, textures: elements.textures,
        };
        this.#modeBtn           = elements.modeBtn;
        this.#resourceControls  = elements.resourceControls ?? null;
        this.#compassRose       = elements.compassRose ?? null;
    }

    setBodyContext(layerModel, hasAtmosphere, topology)
    {
        this.#maxDepth = layerModel.maxDepth;
        this.#hasAtmosphere = hasAtmosphere;
        this.#topology = topology;
    }

    bindModeButton(onToggle)
    {
        if (!this.#modeBtn) return;

        this.#modeBtnListener = onToggle;
        this.#modeBtn.addEventListener('click', onToggle);
    }

    setMode(mode)
    {
        const resource = mode === 'resource';
        if (this.#resourceControls) this.#resourceControls.hidden = !resource;
        if (this.#modeBtn) this.#modeBtn.textContent = resource ? 'Exit resource mode' : 'Enter resource mode';
        if (this.#el.mode) this.#el.mode.textContent = mode;
    }

    refreshModeButton(hasSelection)
    {
        if (this.#modeBtn) this.#modeBtn.disabled = !hasSelection;
    }

    setHoverReadout(cell)
    {
        if (this.#el.lon) this.#el.lon.textContent = `${cell.lon.toFixed(1)} deg`;
        if (this.#el.lat) this.#el.lat.textContent = `${cell.lat.toFixed(1)} deg`;
        if (this.#el.depth) this.#el.depth.textContent = this.layerLabel(cell);
    }

    clearHoverReadout()
    {
        if (this.#el.lon) this.#el.lon.textContent = '-';
        if (this.#el.lat) this.#el.lat.textContent = '-';
        if (this.#el.depth) this.#el.depth.textContent = '-';
    }

    updateFocusReadout(focus)
    {
        if (this.#el.slice)
        {
            this.#el.slice.textContent = `lon ${focus.lon.toFixed(0)} deg - lat ${focus.lat.toFixed(0)} deg`;
        }
    }

    setSelectedSurfaceReadout(cell)
    {
        if (this.#el.selected)
        {
            this.#el.selected.textContent = `lon ${cell.lon.toFixed(0)} deg - lat ${cell.lat.toFixed(0)} deg`;
        }
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
            if (this.#el.selType)  this.#el.selType.textContent = 'none';
            if (this.#el.selLon)   this.#el.selLon.textContent = '-';
            if (this.#el.selLat)   this.#el.selLat.textContent = '-';
            if (this.#el.selLayer) this.#el.selLayer.textContent = '-';

            return;
        }

        if (this.#el.selType)  this.#el.selType.textContent = this.#topology.cellTypeLabel(cell);
        if (this.#el.selLon)   this.#el.selLon.textContent = `${cell.lon.toFixed(1)} deg`;
        if (this.#el.selLat)   this.#el.selLat.textContent = `${cell.lat.toFixed(1)} deg`;
        if (this.#el.selLayer) this.#el.selLayer.textContent = this.layerLabel(cell);
    }

    // A cell's place in the layer stack, counting the atmosphere (when
    // present) as the outermost layer.
    layerLabel(cell)
    {
        const total = this.#maxDepth + (this.#hasAtmosphere ? 1 : 0);

        if (cell.isAtmosphere)
        {
            return `atmosphere - 1 / ${total}`;
        }

        const layerNo = cell.depth + 1 + (this.#hasAtmosphere ? 1 : 0);

        return `${layerNo} / ${total}`;
    }

    updateCompass(camera)
    {
        if (!this.#compassRose) return;

        this.#camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        this.#camUp.setFromMatrixColumn(camera.matrixWorld, 1);

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
            if (this.#el.fps)     this.#el.fps.textContent = (1000 / this.#perf.ema).toFixed(0);
            if (this.#el.frameMs) this.#el.frameMs.textContent = `${this.#perf.ema.toFixed(1)} ms`;
            this.#perf.lastHud = now;
        }
    }

    updateRenderInfo(info)
    {
        if (!info) return;

        const render = info.render ?? {};
        const memory = info.memory ?? {};

        if (this.#el.calls)    this.#el.calls.textContent = String(render.calls ?? '?');
        if (this.#el.tris)     this.#el.tris.textContent = String(render.triangles ?? '?');
        if (this.#el.points)   this.#el.points.textContent = String(render.points ?? '?');
        if (this.#el.lines)    this.#el.lines.textContent = String(render.lines ?? '?');
        if (this.#el.geoms)    this.#el.geoms.textContent = String(memory.geometries ?? '?');
        if (this.#el.textures) this.#el.textures.textContent = String(memory.textures ?? '?');
    }

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        if (this.#modeBtn && this.#modeBtnListener)
        {
            this.#modeBtn.removeEventListener('click', this.#modeBtnListener);
        }
    }
}
