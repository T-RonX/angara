<?php

declare(strict_types=1);

namespace App\SystemBundle\CliAccess;

use Symfony\Component\Console\Input\InputOption;

abstract readonly class BaseCliAccessContext implements CliAccessContextInterface
{
    public function getOptionDescription(): string
    {
        return "Sets the {$this->getOptionName()} context provided.";
    }

    public function getOptionShortcut(): string
    {
        return mb_substr($this->getOptionName(), 0, 1);
    }

    public function getOptionMode(): int
    {
        return InputOption::VALUE_REQUIRED;
    }

    public function getOptionDefaultValue(): mixed
    {
        return null;
    }
}
