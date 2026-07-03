// ----------------------------------------------------------------------
// Atmosphere shader source (GLSL as strings).
//
// A classic glsl-atmosphere single-scattering integrator (Sean O'Neil
// style), scaled to scene units and re-parameterised so every knob comes
// from config. The fragment shader now loops over NUM_SUNS suns and SUMS
// their in-scattering, so a sky with several suns glows correctly — each
// sun contributes its own day-side blue and terminator reddening.
//
// NUM_SUNS / I_STEPS / J_STEPS are supplied as `defines` on the material.
// ----------------------------------------------------------------------

export const vertexShader = /* glsl */`
    varying vec3 vWorldPos;
    void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
    }
`;

export const fragmentShader = /* glsl */`
    precision highp float;

    varying vec3 vWorldPos;

    uniform vec3  uPlanetCenter;
    uniform float uPlanetRadius;
    uniform float uAtmosRadius;
    uniform vec3  uSunDir[NUM_SUNS];
    uniform float uSunIntensity;
    uniform float uOpacity;
    uniform vec3  uBaseColor;
    uniform vec3  uRayleighCoeff;
    uniform float uRayleighScale;
    uniform float uMieCoeff;
    uniform float uMieScale;
    uniform float uMieG;

    const float PI = 3.141592653589793;

    // Ray / sphere intersection: returns (entry, exit) ray params, or
    // (1e9, -1e9) on a miss.
    vec2 raySphere(vec3 ro, vec3 rd, float sr) {
        float b = dot(rd, ro);
        float c = dot(ro, ro) - sr * sr;
        float d = b * b - c;
        if (d < 0.0) return vec2(1e9, -1e9);
        d = sqrt(d);
        return vec2(-b - d, -b + d);
    }

    // In-scattered colour for a single sun direction pSun.
    vec3 atmosphere(vec3 r, vec3 r0, vec3 pSun) {
        r0 = r0 - uPlanetCenter;

        // The base colour multiplies the PHYSICAL Rayleigh coefficient, so
        // the wavelength-dependent attenuation that reddens the terminator
        // stays intact.
        vec3 rayleighEff = uRayleighCoeff * uBaseColor;

        vec2 p = raySphere(r0, r, uAtmosRadius);
        if (p.x > p.y) return vec3(0.0);

        // Stop at the planet surface so we don't sample through the body.
        vec2 pp = raySphere(r0, r, uPlanetRadius);
        if (pp.x > 0.0) p.y = min(p.y, pp.x);
        p.x = max(p.x, 0.0);

        float iStepSize = (p.y - p.x) / float(I_STEPS);
        float iTime = p.x;

        vec3  totalRlh = vec3(0.0);
        vec3  totalMie = vec3(0.0);
        float iOdRlh   = 0.0;
        float iOdMie   = 0.0;

        float mu   = dot(r, pSun);
        float mumu = mu * mu;
        float gg   = uMieG * uMieG;

        float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
        float pMie = 3.0 / (8.0 * PI)
                   * ((1.0 - gg) * (mumu + 1.0))
                   / (pow(1.0 + gg - 2.0 * mu * uMieG, 1.5) * (2.0 + gg));

        for (int i = 0; i < I_STEPS; i++) {
            vec3  iPos    = r0 + r * (iTime + iStepSize * 0.5);
            float iHeight = length(iPos) - uPlanetRadius;

            float odStepRlh = exp(-iHeight / uRayleighScale) * iStepSize;
            float odStepMie = exp(-iHeight / uMieScale)      * iStepSize;
            iOdRlh += odStepRlh;
            iOdMie += odStepMie;

            float jStepSize = raySphere(iPos, pSun, uAtmosRadius).y / float(J_STEPS);
            float jTime     = 0.0;
            float jOdRlh    = 0.0;
            float jOdMie    = 0.0;

            for (int j = 0; j < J_STEPS; j++) {
                vec3  jPos    = iPos + pSun * (jTime + jStepSize * 0.5);
                float jHeight = length(jPos) - uPlanetRadius;
                jOdRlh += exp(-jHeight / uRayleighScale) * jStepSize;
                jOdMie += exp(-jHeight / uMieScale)      * jStepSize;
                jTime  += jStepSize;
            }

            vec3 attn = exp(-(uMieCoeff * (iOdMie + jOdMie)
                           + rayleighEff * (iOdRlh + jOdRlh)));

            totalRlh += odStepRlh * attn;
            totalMie += odStepMie * attn;
            iTime    += iStepSize;
        }

        return uSunIntensity * (pRlh * rayleighEff * totalRlh
                              + pMie * uMieCoeff   * totalMie);
    }

    void main() {
        vec3 viewDir = normalize(vWorldPos - cameraPosition);

        // Sum the in-scattering from EVERY sun.
        vec3 col = vec3(0.0);
        for (int i = 0; i < NUM_SUNS; i++) {
            col += atmosphere(viewDir, cameraPosition, normalize(uSunDir[i]));
        }

        // Soft tonemap so fragments near a sun don't blow out to white.
        col = 1.0 - exp(-col);
        col *= uOpacity;

        gl_FragColor = vec4(col, 1.0);
    }
`;

