<?php

declare(strict_types=1);

namespace App\Game\Game\Environment\Generator\Planet\Terrain;

use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorGradiant;
use App\Game\Game\Environment\Generator\Planet\Terrain\Color\ColorRgb;
use App\Game\Game\Environment\Generator\Planet\Terrain\Color\GradiantStop;
use App\Game\Game\Environment\Generator\Planet\Terrain\Type\TerrainType;
use InvalidArgumentException;

class StyleProvider
{
    public function getStyles(): array
    {

//        $dev = new MapDescriptor(150, .6, -14.7, new ColorGradiant(128, [
//            new GradiantStop(new ColorRgb(0, 0, 59), 0),
//            new GradiantStop(new ColorRgb(0, 0, 176), .01),
//            new GradiantStop(new ColorRgb(15, 133, 50), .02),
//            new GradiantStop(new ColorRgb(29, 161, 7), .05),
//            new GradiantStop(new ColorRgb(29, 181, 7), .95),
//            new GradiantStop(new ColorRgb(157, 199, 4), .98),
//            new GradiantStop(new ColorRgb(185, 15, 22), .99),
//            new GradiantStop(new ColorRgb(86, 50, 39), 1),
//        ]));

//        $earth = new MapDescriptor(150, .6, -14.7, new ColorGradiant(128, [
//            new GradiantStop(ColorRgb::fromHex('05052F'), 0),
//            new GradiantStop(ColorRgb::fromHex('222970'), .01),
//            new GradiantStop(ColorRgb::fromHex('39418B'), .02),
//            new GradiantStop(ColorRgb::fromHex('344520'), .02),
//            new GradiantStop(ColorRgb::fromHex('44541E'), .95),
//            new GradiantStop(ColorRgb::fromHex('6C673F'), .98),
//            new GradiantStop(ColorRgb::fromHex('A38A69'), .99),
//            new GradiantStop(ColorRgb::fromHex('6C5E3E'), 1),
//        ]));
//
//        $earthMountainous = new MapDescriptor(150, .7, -20, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('6C5E3E'), 0),
//            new GradiantStop(ColorRgb::fromHex('A38A69'), .01),
//            new GradiantStop(ColorRgb::fromHex('6C673F'), .02),
//            new GradiantStop(ColorRgb::fromHex('394622'), .10),
//            new GradiantStop(ColorRgb::fromHex('395222'), .90),
//            new GradiantStop(ColorRgb::fromHex('6C673F'), .98),
//            new GradiantStop(ColorRgb::fromHex('A38A69'), .99),
//            new GradiantStop(ColorRgb::fromHex('6C5E3E'), 1),
//        ]));
//
//        $earthFlat = new MapDescriptor(150, .6, -13, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('33401C'), 0),
//            new GradiantStop(ColorRgb::fromHex('394622'), .25),
//            new GradiantStop(ColorRgb::fromHex('395222'), .50),
//            new GradiantStop(ColorRgb::fromHex('33451C'), 1),
//        ]));
//
//        $earthSnow = new MapDescriptor(150, .68, -14, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('AEAFA9'), 0),
//            new GradiantStop(ColorRgb::fromHex('D1D5D6'), .20),
//            new GradiantStop(ColorRgb::fromHex('CCCEC9'), .60),
//            new GradiantStop(ColorRgb::fromHex('C2C8CC'), .80),
//            new GradiantStop(ColorRgb::fromHex('9D9C97'), 1),
//        ]));
//
//        $planetFictional1 = new MapDescriptor(150, .81, -17, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('1A2117'), 0),
//            new GradiantStop(ColorRgb::fromHex('1E311F'), .01),
//            new GradiantStop(ColorRgb::fromHex('3D522D'), .02),
//            new GradiantStop(ColorRgb::fromHex('BA8C2D'), .02),
//            new GradiantStop(ColorRgb::fromHex('C99A33'), .95),
//            new GradiantStop(ColorRgb::fromHex('7D5920'), .98),
//            new GradiantStop(ColorRgb::fromHex('563F17'), .99),
//            new GradiantStop(ColorRgb::fromHex('422F12'), 1),
//        ]));

        $terrain = [
            'mountain' => new TerrainProperties('mountain'),
            'land' => new TerrainProperties('land'),
            'water' => new TerrainProperties('water'),
        ];

        $planetFictional1 = new MapDescriptor(150, .81, 0.035, new TerrainDescriptor([
            new TerrainType(0.35, $terrain['water'], ColorRgb::fromHex('1E311F')),
            new TerrainType(0.85, $terrain['land'], ColorRgb::fromHex('BA8C2D')),
            new TerrainType(null, $terrain['mountain'], ColorRgb::fromHex('563F17')),
        ]));
//
//        $planetFictional2 = new MapDescriptor(150, .82, -22, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('F5BD5A'), 0),
//            new GradiantStop(ColorRgb::fromHex('EFA72A'), .01),
//            new GradiantStop(ColorRgb::fromHex('DE7F15'), .02),
//            new GradiantStop(ColorRgb::fromHex('B02507'), .02),
//            new GradiantStop(ColorRgb::fromHex('A81A07'), .95),
//            new GradiantStop(ColorRgb::fromHex('7F1105'), .98),
//            new GradiantStop(ColorRgb::fromHex('5E1006'), .99),
//            new GradiantStop(ColorRgb::fromHex('1F0903'), 1),
//        ]));



        $planetFictional2 = new MapDescriptor(150, .82, 0.035, new TerrainDescriptor([
            new TerrainType(0.25, $terrain['water'], ColorRgb::fromHex('1F0903')),
            new TerrainType(0.25, $terrain['water'], ColorRgb::fromHex('1F0903')),
            new TerrainType(0.35, $terrain['land'], ColorRgb::fromHex('B02507')),
            new TerrainType(null, $terrain['mountain'], ColorRgb::fromHex('F5BD5A')),
        ]));
//
//        $planetFictional3 = new MapDescriptor(150, .62, -22, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('00102D'), 0),
//            new GradiantStop(ColorRgb::fromHex('023D71'), .01),
//            new GradiantStop(ColorRgb::fromHex('056EBA'), .02),
//            new GradiantStop(ColorRgb::fromHex('C1BFCF'), .02),
//            new GradiantStop(ColorRgb::fromHex('BABBCD'), .95),
//            new GradiantStop(ColorRgb::fromHex('A0A2AE'), .98),
//            new GradiantStop(ColorRgb::fromHex('9FABAD'), .99),
//            new GradiantStop(ColorRgb::fromHex('CFE1DB'), 1),
//        ]));


        $planetFictional3 = new MapDescriptor(150, .62, 0.035, new TerrainDescriptor([
                new TerrainType(0.12, $terrain['water'], ColorRgb::fromHex('00102D')),
                new TerrainType(0.26, $terrain['water'], ColorRgb::fromHex('045289')),
                new TerrainType(0.3, $terrain['water'], ColorRgb::fromHex('056EBA')),
                new TerrainType(0.7, $terrain['land'], ColorRgb::fromHex('D0CEDD')),
                new TerrainType(null, $terrain['mountain'], ColorRgb::fromHex('CFE1DB')),
            ])
        );

//        $planetFictional4 = new MapDescriptor(150, .50, -30, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('364653'), 0),
//            new GradiantStop(ColorRgb::fromHex('435357'), .01),
//            new GradiantStop(ColorRgb::fromHex('748B69'), .02),
//            new GradiantStop(ColorRgb::fromHex('7EAA5C'), .02),
//            new GradiantStop(ColorRgb::fromHex('94B76E'), .95),
//            new GradiantStop(ColorRgb::fromHex('787536'), .98),
//            new GradiantStop(ColorRgb::fromHex('716733'), .99),
//            new GradiantStop(ColorRgb::fromHex('4A4425'), 1),
//        ]));
//


        $planetFictional4 = new MapDescriptor(150, .50, 0.035, new TerrainDescriptor([
            new TerrainType(0.35, $terrain['water'], ColorRgb::fromHex('364653')),
            new TerrainType(0.53, $terrain['land'], ColorRgb::fromHex('7EAA5C')),
            new TerrainType(0.57, $terrain['land'], ColorRgb::fromHex('C4BB44')),
            new TerrainType(0.75, $terrain['land'], ColorRgb::fromHex('94B76E')),
            new TerrainType(null, $terrain['mountain'], ColorRgb::fromHex('787536')),
        ]));

        $planetFictional5 = new MapDescriptor(150, .50, 0.035, new TerrainDescriptor([
            new TerrainType(0.35, $terrain['water'], ColorRgb::fromHex('364653')),
            new TerrainType(0.53, $terrain['land'], ColorRgb::fromHex('7EAA5C')),
            new TerrainType(0.57, $terrain['land'], ColorRgb::fromHex('C4BB44')),
            new TerrainType(0.75, $terrain['land'], ColorRgb::fromHex('94B76E')),
            new TerrainType(null, $terrain['mountain'], ColorRgb::fromHex('787536')),
        ]));

//        $planetFictional2Small = new MapDescriptor(150, .82, -22, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('F5BD5A'), 0),
//            new GradiantStop(ColorRgb::fromHex('EFA72A'), .01),
//            new GradiantStop(ColorRgb::fromHex('DE7F15'), .02),
//            new GradiantStop(ColorRgb::fromHex('B02507'), .02),
//            new GradiantStop(ColorRgb::fromHex('A81A07'), .95),
//            new GradiantStop(ColorRgb::fromHex('7F1105'), .98),
//            new GradiantStop(ColorRgb::fromHex('5E1006'), .99),
//            new GradiantStop(ColorRgb::fromHex('1F0903'), 1),
//        ]));


        $planetFictional6 = new MapDescriptor(150, .9, 0.02, new TerrainDescriptor([
            new TerrainType(0.46, $terrain['water'], ColorRgb::fromHex('C48787')),
            new TerrainType(0.462, $terrain['land'], ColorRgb::fromHex('87C49A')),
            new TerrainType(0.463, $terrain['land'], ColorRgb::fromHex('C527F5')),
            new TerrainType(0.8, $terrain['land'], ColorRgb::fromHex('B687C4')),
            new TerrainType(null, $terrain['mountain'], ColorRgb::fromHex('87ABC4')),
        ]));

        $planetFictional7 = new MapDescriptor(150, .8, 0.02, new TerrainDescriptor([
            new TerrainType(0.1, $terrain['water'], ColorRgb::fromHex('104b06')),
            new TerrainType(0.2, $terrain['land'], ColorRgb::fromHex('524702')),
            new TerrainType(0.3, $terrain['land'], ColorRgb::fromHex('debf2d')),
            new TerrainType(0.4, $terrain['land'], ColorRgb::fromHex('bec832')),
            new TerrainType(0.5, $terrain['mountain'], ColorRgb::fromHex('4f280f')),
            new TerrainType(0.6, $terrain['mountain'], ColorRgb::fromHex('dae44b')),
            new TerrainType(0.7, $terrain['mountain'], ColorRgb::fromHex('7a351c')),
            new TerrainType(0.8, $terrain['mountain'], ColorRgb::fromHex('23380e')),
            new TerrainType(null, $terrain['mountain'], ColorRgb::fromHex('1a0c01')),
        ]));

        $planetFictional8 = new MapDescriptor(50, .7, 0.04, new TerrainDescriptor([
            new TerrainType(0.5, $terrain['water'], ColorRgb::fromHex('454545')),
            new TerrainType(null, $terrain['land'], ColorRgb::fromHex('1C1C1C')),
        ]));

        return [
//            'dev' => $dev,
//            'earth' => $earth,
//            'earth_mountainous' => $earthMountainous,
//            'earth_flat' => $earthFlat,
//            'earth_snow' => $earthSnow,
            'fictional_1' => $planetFictional1,
            'fictional_2' => $planetFictional2,
//            'fictional_2_small' => $planetFictional2Small,
            'fictional_3' => $planetFictional3,
            'fictional_4' => $planetFictional4,
         //   'fictional_5' => $planetFictional5,
            'fictional_6' => $planetFictional6,
            'fictional_7' => $planetFictional7,
            'astroid' => $planetFictional8,
        ];
    }

    /**
     * @param string|null $styleName
     *
     * @return array{MapDescriptor[], string}
     */
    public function getStyle(?string $styleName = null): array
    {
        $styles = $this->getStyles();

        if (!$styleName)
        {
            $styleKeys = array_keys($styles);

            $name = $styleKeys[random_int(0, count($styleKeys) - 1)];
            return [$styles[$name], $name];
        }


        $style1 = $styleName ?: array_rand($styles);
        $style2 = $styleName ?: array_rand($styles);

        $style = $styles[$style1];
        $style->setTerrain($styles[$style2]->getTerrain());

        return [$style ?? throw new InvalidArgumentException(sprintf("Style '%s' does not exist.", $styleName)), $styleName];
    }
}
