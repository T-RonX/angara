<?php

declare(strict_types=1);

namespace App\SystemBundle\Exception;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class ItemNotFoundException extends NotFoundHttpException
{
    public function __construct(string $type, string|int $id, ?Throwable $previous = null)
    {
        parent::__construct("Item of type '$type' with id '$id' could not be found.", $previous);
    }
}
