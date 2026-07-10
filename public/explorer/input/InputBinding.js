import * as THREE from 'three';

// ----------------------------------------------------------------------
// InputBinding — the SINGLE place that touches the DOM event system. It
// binds every explorer-relevant listener exactly once on construction and
// removes them all on dispose. The semantic meaning of each event is
// decided by the callbacks the owner provides; this class only tracks raw
// pointer state (NDC coordinates, inside/outside, drag bookkeeping) and
// dispatches.
//
// Shared between ALL bodies: body-switch does NOT rebind listeners.
// HoverController reads `pointer` / `pointerInside` directly.
// ----------------------------------------------------------------------
export class InputBinding
{
    // Shared pointer state read by HoverController each frame.
    pointer = new THREE.Vector2();
    pointerInside = false;

    #el;
    #listeners = [];
    #drag = { active: false, x: 0, y: 0, button: 0 };
    #pressOrigin = { x: 0, y: 0, valid: false };
    #clickSlop;
    #disposed = false;

    constructor(domElement, callbacks, inputCfg)
    {
        this.#el = domElement;
        this.#clickSlop = inputCfg.clickSlopPx;
        this.#bind(callbacks);
    }

    // --- private -------------------------------------------------------

    #on(target, event, handler, options)
    {
        target.addEventListener(event, handler, options);
        this.#listeners.push({ target, event, handler, options });
    }

    #bind(cb)
    {
        const el = this.#el;

        this.#on(el, 'pointerdown', e =>
        {
            this.#updatePointer(e);
            this.#pressOrigin.x = e.clientX;
            this.#pressOrigin.y = e.clientY;
            this.#pressOrigin.valid = true;

            this.#drag.active = true;
            this.#drag.button = e.button;
            this.#drag.x = e.clientX;
            this.#drag.y = e.clientY;

            cb.onDragStart?.(e);
        });

        this.#on(window, 'pointerup', () =>
        {
            if (!this.#drag.active) return;

            this.#drag.active = false;
            cb.onDragEnd?.();
        });

        this.#on(window, 'pointermove', e =>
        {
            this.#updatePointer(e);

            if (this.#drag.active)
            {
                const dx = e.clientX - this.#drag.x;
                const dy = e.clientY - this.#drag.y;
                this.#drag.x = e.clientX;
                this.#drag.y = e.clientY;

                cb.onDrag?.(dx, dy, this.#drag.button);
            }
        });

        this.#on(el, 'pointerleave', () =>
        {
            this.pointerInside = false;
        });

        this.#on(el, 'wheel', e => cb.onWheel?.(e), { passive: false });

        this.#on(window, 'keydown', e => cb.onKeyDown?.(e));

        this.#on(el, 'click', e =>
        {
            // Reject the synthetic click that fires at the end of a drag.
            if (this.#pressOrigin.valid)
            {
                const moved = Math.hypot(
                    e.clientX - this.#pressOrigin.x,
                    e.clientY - this.#pressOrigin.y,
                );
                this.#pressOrigin.valid = false;

                if (moved > this.#clickSlop) return;
            }

            cb.onClick?.(e);
        });

        this.#on(el, 'contextmenu', e => cb.onContextMenu?.(e));
    }

    #updatePointer(e)
    {
        const rect = this.#el.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.pointerInside = true;
    }

    // --- public ---------------------------------------------------------

    dispose()
    {
        if (this.#disposed) return;
        this.#disposed = true;

        for (const { target, event, handler, options } of this.#listeners)
        {
            target.removeEventListener(event, handler, options);
        }

        this.#listeners.length = 0;
    }
}
