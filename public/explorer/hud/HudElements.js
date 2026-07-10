// ----------------------------------------------------------------------
// HudElements -- resolves and strictly validates all required template DOM
// nodes ONCE at startup, throwing a path/id-specific error on any missing
// element. ExplorerApplication injects this bundle into HudView so the HUD
// never silently falls back to null for a required node.
//
// Optional render-info nodes (calls, tris, points, lines, geoms, textures)
// are resolved but allowed to be absent -- the template may legitimately
// lack them in a minimal layout.
// ----------------------------------------------------------------------
export class HudElements
{
    // Required readout nodes.
    mode;
    selected;
    lon; lat; depth;
    slice;
    selType; selLon; selLat; selLayer;
    fps; frameMs;

    // Optional render-info nodes (null when template omits them).
    calls; tris; points; lines; geoms; textures;

    // Interactive elements.
    modeBtn;
    resourceControls;
    compassRose;

    constructor()
    {
        const req = (id, label) =>
        {
            const el = document.getElementById(id);

            if (!el)
            {
                throw new Error(`[HudElements] Required element #${id} (${label}) not found in template`);
            }

            return el;
        };

        const opt = (id) => document.getElementById(id);

        // Required display nodes.
        this.mode     = req('rMode',     'mode readout');
        this.selected = req('rSelected', 'selected readout');
        this.lon      = req('rLon',      'hover longitude');
        this.lat      = req('rLat',      'hover latitude');
        this.depth    = req('rDepth',    'hover depth');
        this.slice    = req('rSlice',    'focus readout');
        this.selType  = req('rSelType',  'selection type');
        this.selLon   = req('rSelLon',   'selection longitude');
        this.selLat   = req('rSelLat',   'selection latitude');
        this.selLayer = req('rSelLayer', 'selection layer');
        this.fps      = req('rFps',      'FPS counter');
        this.frameMs  = req('rFrameMs',  'frame time');

        // Optional render-info nodes.
        this.calls    = opt('rCalls');
        this.tris     = opt('rTris');
        this.points   = opt('rPoints');
        this.lines    = opt('rLines');
        this.geoms    = opt('rGeoms');
        this.textures = opt('rTextures');

        // Interactive elements.
        this.modeBtn          = req('modeBtn',          'mode toggle button');
        this.resourceControls = opt('resourceControls');
        this.compassRose      = opt('compassRose');
    }
}
