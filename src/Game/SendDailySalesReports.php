<?php

namespace App\Game;

use Symfony\Component\DependencyInjection\Attribute\Exclude;

#[Exclude]
class SendDailySalesReports
{
    public function __construct(private int $id)
    {
    }

    public function getId(): int
    {
        return $this->id;
    }
}
