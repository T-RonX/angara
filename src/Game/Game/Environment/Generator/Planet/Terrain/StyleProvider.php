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
    public function getStyle(?string $styleName = null): MapDescriptor
    {
//        $dev = new MapDescriptor(1000, .6, -14.7, new ColorGradiant(128, [
//            new GradiantStop(new ColorRgb(0, 0, 59), 0),
//            new GradiantStop(new ColorRgb(0, 0, 176), .01),
//            new GradiantStop(new ColorRgb(15, 133, 50), .02),
//            new GradiantStop(new ColorRgb(29, 161, 7), .05),
//            new GradiantStop(new ColorRgb(29, 181, 7), .95),
//            new GradiantStop(new ColorRgb(157, 199, 4), .98),
//            new GradiantStop(new ColorRgb(185, 15, 22), .99),
//            new GradiantStop(new ColorRgb(86, 50, 39), 1),
//        ]));

//        $earth = new MapDescriptor(1000, .6, -14.7, new ColorGradiant(128, [
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
//        $earthMountainous = new MapDescriptor(1000, .7, -20, new ColorGradiant(64, [
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
//        $earthFlat = new MapDescriptor(1000, .6, -13, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('33401C'), 0),
//            new GradiantStop(ColorRgb::fromHex('394622'), .25),
//            new GradiantStop(ColorRgb::fromHex('395222'), .50),
//            new GradiantStop(ColorRgb::fromHex('33451C'), 1),
//        ]));
//
//        $earthSnow = new MapDescriptor(1000, .68, -14, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('AEAFA9'), 0),
//            new GradiantStop(ColorRgb::fromHex('D1D5D6'), .20),
//            new GradiantStop(ColorRgb::fromHex('CCCEC9'), .60),
//            new GradiantStop(ColorRgb::fromHex('C2C8CC'), .80),
//            new GradiantStop(ColorRgb::fromHex('9D9C97'), 1),
//        ]));
//
//        $planetFictional1 = new MapDescriptor(1000, .81, -17, new ColorGradiant(64, [
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

        $planetFictional1 = new MapDescriptor(1000, .81, -17, new TerrainDescriptor([
            new TerrainType(0.65, 1.0, $terrain['mountain'], new ColorGradiant(3, [new GradiantStop(ColorRgb::fromHex('7D5920'), 0), new GradiantStop(ColorRgb::fromHex('563F17'), .2), new GradiantStop(ColorRgb::fromHex('422F12'), 1)])),
            new TerrainType(0.35, 0.65, $terrain['land'], new ColorGradiant(3, [new GradiantStop(ColorRgb::fromHex('BA8C2D'), 0), new GradiantStop(ColorRgb::fromHex('C99A33'), 1)])),
            new TerrainType(0.0, 0.35, $terrain['water'], new ColorGradiant(3, [new GradiantStop(ColorRgb::fromHex('1A2117'), 0), new GradiantStop(ColorRgb::fromHex('1E311F'), .8), new GradiantStop(ColorRgb::fromHex('3D522D'), 1)])),
        ]));
//
//        $planetFictional2 = new MapDescriptor(1000, .82, -22, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('F5BD5A'), 0),
//            new GradiantStop(ColorRgb::fromHex('EFA72A'), .01),
//            new GradiantStop(ColorRgb::fromHex('DE7F15'), .02),
//            new GradiantStop(ColorRgb::fromHex('B02507'), .02),
//            new GradiantStop(ColorRgb::fromHex('A81A07'), .95),
//            new GradiantStop(ColorRgb::fromHex('7F1105'), .98),
//            new GradiantStop(ColorRgb::fromHex('5E1006'), .99),
//            new GradiantStop(ColorRgb::fromHex('1F0903'), 1),
//        ]));




        $planetFictional2 = new MapDescriptor(1000, .82, -22, new TerrainDescriptor([
            new TerrainType(0.65, 1.0, $terrain['mountain'], new ColorGradiant(3, [new GradiantStop(ColorRgb::fromHex('F5BD5A'), 0), new GradiantStop(ColorRgb::fromHex('EFA72A'), 1)])),
            new TerrainType(0.35, 0.65, $terrain['land'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('B02507'), 0), new GradiantStop(ColorRgb::fromHex('A81A07'), 1)])),
            new TerrainType(0.25, 0.35, $terrain['water'], new ColorGradiant(3, [new GradiantStop(ColorRgb::fromHex('1F0903'), 0), new GradiantStop(ColorRgb::fromHex('5E1006'), 1)])),
            new TerrainType(0.0, 0.25, $terrain['water'], new ColorGradiant(3, [new GradiantStop(ColorRgb::fromHex('1F0903'), 0), new GradiantStop(ColorRgb::fromHex('1F0903'), 1)])),
        ]));
//
//        $planetFictional3 = new MapDescriptor(200, .62, -22, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('00102D'), 0),
//            new GradiantStop(ColorRgb::fromHex('023D71'), .01),
//            new GradiantStop(ColorRgb::fromHex('056EBA'), .02),
//            new GradiantStop(ColorRgb::fromHex('C1BFCF'), .02),
//            new GradiantStop(ColorRgb::fromHex('BABBCD'), .95),
//            new GradiantStop(ColorRgb::fromHex('A0A2AE'), .98),
//            new GradiantStop(ColorRgb::fromHex('9FABAD'), .99),
//            new GradiantStop(ColorRgb::fromHex('CFE1DB'), 1),
//        ]));


        $planetFictional3 = new MapDescriptor(1000, .62, -22, new TerrainDescriptor([
                new TerrainType(0.7, 1.0, $terrain['mountain'], new ColorGradiant(3, [new GradiantStop(ColorRgb::fromHex('CFE1DB'), 0), new GradiantStop(ColorRgb::fromHex('A0A2AE'), 1)])),
                new TerrainType(0.3, 0.7, $terrain['land'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('D0CEDD'), 0), new GradiantStop(ColorRgb::fromHex('ABACBC'), 1)])),
                new TerrainType(0.26, 0.3, $terrain['water'], new ColorGradiant(1, [new GradiantStop(ColorRgb::fromHex('056EBA'), 0), new GradiantStop(ColorRgb::fromHex('056EBA'), 1)])),
                new TerrainType(0.12, 0.26, $terrain['water'], new ColorGradiant(2, [new GradiantStop(ColorRgb::fromHex('045289'), 0), new GradiantStop(ColorRgb::fromHex('045289'), 1)])),
                new TerrainType(0.0, 0.12, $terrain['water'], new ColorGradiant(2, [new GradiantStop(ColorRgb::fromHex('00102D'), 0), new GradiantStop(ColorRgb::fromHex('00102D'), 1)])),
            ])
        );

//        $planetFictional4 = new MapDescriptor(1000, .50, -30, new ColorGradiant(64, [
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

            $planetFictional4 = new MapDescriptor(1000, .50, -30, new TerrainDescriptor([
                new TerrainType(0.75, 1.0, $terrain['mountain'], new ColorGradiant(4, [new GradiantStop(ColorRgb::fromHex('787536'), 0), new GradiantStop(ColorRgb::fromHex('4A4425'), 1)])),
                new TerrainType(0.57, 0.75, $terrain['land'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('94B76E'), 0), new GradiantStop(ColorRgb::fromHex('7EAA5C'), 1)])),
                new TerrainType(0.53, 0.57, $terrain['land'], new ColorGradiant(6, [new GradiantStop(ColorRgb::fromHex('C4BB44'), 0), new GradiantStop(ColorRgb::fromHex('C2C66D'), .5), new GradiantStop(ColorRgb::fromHex('C4BB44'), 1)])),
                new TerrainType(0.35, 0.53, $terrain['land'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('7EAA5C'), 0), new GradiantStop(ColorRgb::fromHex('94B76E'), 1)])),
                new TerrainType(0.0, 0.35, $terrain['water'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('364653'), 0), new GradiantStop(ColorRgb::fromHex('364653'), .8), new GradiantStop(ColorRgb::fromHex('748B69'), 1)])),
        ]));

            $planetFictional5 = new MapDescriptor(250, .50, -30, new TerrainDescriptor([
                new TerrainType(0.75, 1.0, $terrain['mountain'], new ColorGradiant(4, [new GradiantStop(ColorRgb::fromHex('787536'), 0), new GradiantStop(ColorRgb::fromHex('4A4425'), 1)])),
                new TerrainType(0.57, 0.75, $terrain['land'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('94B76E'), 0), new GradiantStop(ColorRgb::fromHex('7EAA5C'), 1)])),
                new TerrainType(0.53, 0.57, $terrain['land'], new ColorGradiant(6, [new GradiantStop(ColorRgb::fromHex('C4BB44'), 0), new GradiantStop(ColorRgb::fromHex('C2C66D'), .5), new GradiantStop(ColorRgb::fromHex('C4BB44'), 1)])),
                new TerrainType(0.35, 0.53, $terrain['land'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('7EAA5C'), 0), new GradiantStop(ColorRgb::fromHex('94B76E'), 1)])),
                new TerrainType(0.0, 0.35, $terrain['water'], new ColorGradiant(8, [new GradiantStop(ColorRgb::fromHex('364653'), 0), new GradiantStop(ColorRgb::fromHex('364653'), .8), new GradiantStop(ColorRgb::fromHex('748B69'), 1)])),
        ]));

//        $planetFictional2Small = new MapDescriptor(1000, .82, -22, new ColorGradiant(64, [
//            new GradiantStop(ColorRgb::fromHex('F5BD5A'), 0),
//            new GradiantStop(ColorRgb::fromHex('EFA72A'), .01),
//            new GradiantStop(ColorRgb::fromHex('DE7F15'), .02),
//            new GradiantStop(ColorRgb::fromHex('B02507'), .02),
//            new GradiantStop(ColorRgb::fromHex('A81A07'), .95),
//            new GradiantStop(ColorRgb::fromHex('7F1105'), .98),
//            new GradiantStop(ColorRgb::fromHex('5E1006'), .99),
//            new GradiantStop(ColorRgb::fromHex('1F0903'), 1),
//        ]));

        $styles = [
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
            'fictional_5' => $planetFictional5,
        ];

        $style1 = $styleName ?: array_rand($styles);
        $style2 = $styleName ?: array_rand($styles);

        $style = $styles[$style1];
        $style->setTerrain($styles[$style2]->getTerrain());

        return $style ?? throw new InvalidArgumentException(sprintf("Style '%s' does not exist.", $styleName));
    }
}
