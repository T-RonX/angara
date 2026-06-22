<?php

declare(strict_types=1);

namespace App\SystemBundle\DataFixtures\Dev;

use App\GameCoreBundle\Player\Entity\Player;
use App\GameCoreBundle\World\Entity\CelestialBody;
use App\GameCoreBundle\World\Repository\CelestialBodyRepository;
use App\SystemBundle\DataFixtures\AbstractFixture;

/**
 * Claims some of the demo world's celestial bodies for players, demonstrating the
 * Player -> CelestialBody ownership relationship. One body is deliberately left
 * unowned to show that ownership is optional.
 */
class Load1200_BodyOwnership extends AbstractFixture
{
    public function __construct(
        private readonly CelestialBodyRepository $celestialBodyRepository,
    ) {
    }

    public function loadEntities(): void
    {
        $ron = $this->getReference('player-johndoe-ron', Player::class);
        $testP1 = $this->getReference('player-test-test_p1', Player::class);

        $this->claim($ron, 's1o1');
        $this->claim($ron, 's1o2');
        $this->claim($testP1, 's2o1');
        // s2o2 is intentionally left unowned.
    }

    private function claim(Player $player, string $bodyIdentifier): void
    {
        $body = $this->celestialBodyRepository->findOneBy(['identifier' => $bodyIdentifier]);

        if (!$body instanceof CelestialBody)
        {
            return;
        }

        $player->addCelestialBody($body);
    }
}
