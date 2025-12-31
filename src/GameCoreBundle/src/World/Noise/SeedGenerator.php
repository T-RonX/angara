<?php

declare(strict_types=1);

namespace App\GameCoreBundle\World\Noise;

class SeedGenerator
{
   public function createSeed(): string
   {
       return bin2hex(random_bytes(16));
   }
}
