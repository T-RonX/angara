<?php

declare(strict_types=1);

namespace App\GameCoreBundle\Context;

use Exception;
use Throwable;

class NoUserInContextException extends Exception
{
    public function __construct(int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct('Unable to get user from context, no user was set.', $code, $previous);
    }
}
