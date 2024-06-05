<?php

declare(strict_types=1);

namespace App\DataFixtures;

use App\User\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;
use RuntimeException;

abstract class AbstractFixture extends Fixture implements OrderedFixtureInterface
{
    use OrderedFixtureTrait;

    private EntityManagerInterface $em;

    abstract protected function  loadEntities(): void;

    public function load(ObjectManager|EntityManagerInterface $manager): void
    {
        if (!$manager instanceof EntityManagerInterface)
        {
            throw new RuntimeException('Entity Manager must be an instance of EntityManagerInterface');
        }

        $this->em = $manager;

        $this->loadEntities();
        $this->em->flush();
    }

    protected function save(object $entity, ?string $reference = null): void
    {
        $this->em->persist($entity);

        if ($reference !== null)
        {
            $this->addReference($reference, $entity);
        }
    }

    protected function getUserReference(string $reference): User
    {
        return $this->getReference($reference, User::class);
    }
}
