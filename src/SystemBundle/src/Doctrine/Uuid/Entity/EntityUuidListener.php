<?php

declare(strict_types=1);

namespace App\SystemBundle\Doctrine\Uuid\Entity;

use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PrePersistEventArgs;
use Doctrine\ORM\Events;
use Symfony\Component\Uid\Uuid;

#[AsDoctrineListener(event: Events::prePersist)]
class EntityUuidListener
{
    public function __invoke(PrePersistEventArgs $eventArgs): void
    {
        $entity = $eventArgs->getObject();

        if (
            $entity instanceof EntityUuidInterface
            && !$entity->hasUuid()
        ) {
            $entity->setUuid(Uuid::v4()->toRfc4122());
        }
    }
}
