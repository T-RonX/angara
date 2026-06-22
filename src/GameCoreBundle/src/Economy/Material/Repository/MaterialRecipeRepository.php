<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Economy\Material\Repository;

use App\GameCoreBundle\Economy\Material\Entity\MaterialRecipe;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<MaterialRecipe>
 */
class MaterialRecipeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MaterialRecipe::class);
    }
}

