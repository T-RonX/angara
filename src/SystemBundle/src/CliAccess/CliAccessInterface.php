<?php

declare(strict_types=1);

namespace App\SystemBundle\CliAccess;

use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

#[AutoconfigureTag('app.cli_access')]
interface CliAccessInterface
{
}
