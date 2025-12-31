<?php

declare(strict_types=1);

namespace App\SystemBundle\CliAccess;

use ReflectionMethod;
use ReflectionNamedType;
use RuntimeException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;
use Symfony\Component\DependencyInjection\Attribute\AutowireLocator;
use Symfony\Component\DependencyInjection\ServiceLocator;

class AppExecuteCommand extends Command
{
    /**
     * @param iterable|CliAccessContextInterface[] $contexts
     */
    public function __construct(
        #[AutowireLocator('app.cli_access')] private readonly ServiceLocator $cliAccessLocator,
        #[AutowireIterator('app.cli_access.context')] private readonly iterable $contexts,
    ) {
        parent::__construct('app:execute');
    }

    public function configure(): void
    {
        $this->addArgument('object', InputArgument::REQUIRED, 'Object to call a method on.')
            ->addArgument('method', InputArgument::REQUIRED, 'Method to call on the object.')
            ->addArgument('arguments', InputArgument::IS_ARRAY, 'Method arguments to pass on.')
            ->setDescription('Calls a scalar facade method using the given arguments');

        foreach ($this->contexts as $context)
        {
            $this->addOption(
                $context->getOptionName(),
                $context->getOptionShortcut(),
                $context->getOptionMode(),
                $context->getOptionDescription(),
                $context->getOptionDefaultValue(),
            );
        }
    }

    public function execute(InputInterface $input, OutputInterface $output): int
    {
        $objectArgument = $input->getArgument('object');
        $method = $input->getArgument('method');
        $argumentsArgument = $input->getArgument('arguments');

        $object = $this->getCliAccessObject($objectArgument);
        $this->validateMethod($object, $method);
        $arguments = $this->prepareArguments($argumentsArgument);

        $this->handleContexts($input);

        $result = $object->$method(...$arguments);

        if ($this->isValueReturned($object, $method))
        {
            dump($result);
        }

        return 0;
    }

    private function getCliAccessObject(string $cliAccessObjectName): CliAccessInterface
    {
        if (!$this->cliAccessLocator->has($cliAccessObjectName))
        {
            $objectsRegistered = implode(', ', array_keys($this->cliAccessLocator->getProvidedServices()));
            throw new RuntimeException("Object '$cliAccessObjectName' is not registered. The following objects are registered: $objectsRegistered");
        }

        return $this->cliAccessLocator->get($cliAccessObjectName);
    }

    private function validateMethod(CliAccessInterface $object, string $method): void
    {
        if (!method_exists($object, $method))
        {
            $objectClass = get_class($object);
            throw new RuntimeException("Method '$method' does not exist or is not accessible on class '$objectClass'.");
        }
    }

    private function isValueReturned(CliAccessInterface $object, string $method): bool
    {
        $methodMeta = new ReflectionMethod($object, $method);
        $returnType = $methodMeta->getReturnType();

        return !($returnType instanceof ReflectionNamedType && in_array($returnType->getName(), ['void', 'never']));
    }

    private function prepareArguments(array $arguments): array
    {
        return array_map(static function($argument): int|float|string|array {
            return match (true) {
                ($argumentFloat = preg_replace('/^(float:)(.+)/', '$2', $argument, 1, $count)) && $count === 1 => (float) $argumentFloat,
                ($argumentInt = preg_replace('/^(int:)(.+)/', '$2', $argument, 1, $count)) && $count === 1 => (int) $argumentInt,
                ($argumentString = preg_replace('/^(string:)(.+)/', '$2', $argument, 1, $count)) && $count === 1 => (string) $argumentString,
                preg_match('/^\d*\.\d+$/', $argument) === 1 => (float) $argument,
                is_numeric($argument) => (int) $argument,
                ($array = json_decode($argument, true)) !== null => $array,
                default => $argument,
            };
        }, $arguments);
    }

    private function handleContexts(InputInterface $input): void
    {
        foreach ($this->contexts as $context)
        {
            $optionValue = $input->getOption($context->getOptionName());
            $context->setContext($optionValue);
        }
    }
}
