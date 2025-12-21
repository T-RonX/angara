<?php

declare(strict_types=1);

namespace App\System\DataFixtures\Dev;

use App\System\DataFixtures\AbstractFixture;
use App\System\User\Entity\User;

class Load1000_User extends AbstractFixture
{
    public function loadEntities(): void
    {
        $user_johndoe = $this->createUser('johndoe', 'test', '56240031-0eb6-4b58-840a-1e32e0669d01');
        $user_test = $this->createUser('test', 'test', '482c68a5-5707-4304-ab61-dc2b992c2308');

        $this->save($user_johndoe, 'user-johndoe');
        $this->save($user_test, 'user-test');
    }

    private function createUser(
        string $username,
        string $password,
        ?string $uuid,
    ): User
    {
        return (new User())
            ->setUuid($uuid)
            ->setUsername($username)
            ->setPassword(password_hash($password, PASSWORD_BCRYPT));
    }
}
