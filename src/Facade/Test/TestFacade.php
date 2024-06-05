<?php

declare(strict_types=1);

namespace App\Facade\Test;

use App\CliAccess\CliAccessInterface;
use App\Context\UserContext;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\AsTaggedItem;

#[AsTaggedItem('test-test')]
readonly class TestFacade implements CliAccessInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,

        private UserContext $userContext,
    ) {
    }

    public function complete(Task|int $task): void
    {
        $this->entityManager->wrapInTransaction(function() use($task): void {
            $task = $this->taskProvider->resolveTask($task);
            $user = $this->userContext->getUser();

            $this->completer->complete($task, $user);
        });
    }
}
