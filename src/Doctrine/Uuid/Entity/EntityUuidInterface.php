<?php

declare(strict_types=1);

namespace App\Doctrine\Uuid\Entity;

interface EntityUuidInterface
{
    public function getUuid(): string;

    public function setUuid(string $uuid): self;

    public function hasUuid(): bool;
}
