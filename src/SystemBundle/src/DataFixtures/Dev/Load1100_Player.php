<?php

declare(strict_types=1);

namespace App\SystemBundle\DataFixtures\Dev;

use App\GameCoreBundle\Player\Entity\Player;
use App\SystemBundle\DataFixtures\AbstractFixture;
use App\SystemBundle\User\Entity\User;

class Load1100_Player extends AbstractFixture
{
    public function loadEntities(): void
    {
        $player_johndoe_ron = $this->createPlayer('user-johndoe', 'ron', '67d549a5-ed22-6cdf-8308-6689bd1c0149');
        $player_test_test_p1 = $this->createPlayer('user-test', 'test-p1', 'b196e3cf-65c0-4455-964e-ee7f15d14801');
        $player_test_test_p2 = $this->createPlayer('user-test', 'test-p2', '1ca222d1-33ce-4889-8896-5cd7d75b3d32');

        $this->save($player_johndoe_ron, 'player-johndoe-ron');
        $this->save($player_test_test_p1, 'player-test-test_p1');
        $this->save($player_test_test_p2, 'player-test-test_p2');
    }

    private function createPlayer(
        User|string $user,
        string $name,
        ?string $uuid,
    ): Player
    {
        return (new Player())
            ->setUuid($uuid)
            ->setUser(is_string($user) ? $this->getUserReference($user) : $user)
            ->setName($name);
    }
}
