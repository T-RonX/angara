export const ringProfileShader = /* glsl */`
uniform sampler2D uRingProfile;
uniform float uRingProfileWidth;
uniform float uRingInnerRadius;
uniform float uRingOuterRadius;

vec4 sampleRingProfile(float radius)
{
    if (radius < uRingInnerRadius || radius > uRingOuterRadius)
    {
        return vec4(0.0);
    }

    float coordinate = (radius - uRingInnerRadius) / (uRingOuterRadius - uRingInnerRadius);
    float halfTexel = 0.5 / uRingProfileWidth;

    return texture2D(
        uRingProfile,
        vec2(clamp(coordinate, halfTexel, 1.0 - halfTexel), 0.5)
    );
}
`;

export const ringShadowShader = /* glsl */`
${ringProfileShader}
uniform vec3 uRingCenterWorld;
uniform vec3 uRingNormalWorld;
uniform vec3 uRingSunDirection[RING_SUN_COUNT];

float ringDirectTransmittance(vec3 worldPosition, vec3 worldLightDirection)
{
    bool isSun = false;

    for (int i = 0; i < RING_SUN_COUNT; i++)
    {
        if (dot(normalize(uRingSunDirection[i]), worldLightDirection) > 0.99999)
        {
            isSun = true;
            break;
        }
    }

    if (!isSun)
    {
        return 1.0;
    }

    float planeCosine = dot(worldLightDirection, uRingNormalWorld);

    if (abs(planeCosine) < 0.0001)
    {
        return 1.0;
    }

    float distanceToPlane = dot(uRingCenterWorld - worldPosition, uRingNormalWorld)
        / planeCosine;

    if (distanceToPlane <= 0.0001)
    {
        return 1.0;
    }

    vec3 hit = worldPosition + worldLightDirection * distanceToPlane;
    float opticalDepth = sampleRingProfile(length(hit - uRingCenterWorld)).a;

    if (opticalDepth <= 0.0)
    {
        return 1.0;
    }

    float pathCosine = max(abs(planeCosine), 0.08);

    return pow(max(1.0 - opticalDepth, 0.015), 1.0 / pathCosine);
}
`;
