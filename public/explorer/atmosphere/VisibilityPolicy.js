// Stateless policy: applies per-shell visibility based on mode and body config.
// In resource mode only the active body's shell may show (the camera is inside
// it); every other body's haze is hidden so it can't bleed over the sliced view.
export class VisibilityPolicy
{
    apply(mode, bodies, active)
    {
        const resource = mode === 'resource';

        for (const body of bodies)
        {
            const shell = body.atmosphere;

            if (!shell) continue;

            const cfg = body.atmosphereConfig;
            const allowed = resource
                ? (body === active && cfg.showInResourceMode)
                : true;

            shell.mesh.visible = cfg.show && allowed;
        }
    }
}
