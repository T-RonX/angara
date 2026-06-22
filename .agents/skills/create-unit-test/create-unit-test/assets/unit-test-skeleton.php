<?php

declare(strict_types=1);

namespace Schulinck\ContentStoreBundle\Tests\Continue\NameSpace\To\Test\Subject;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\TestDox;
use PHPUnit\Framework\TestCase;
use Prophecy\PhpUnit\ProphecyTrait;
use Prophecy\Prophecy\ObjectProphecy;

class RelativePermalinkGeneratorTest extends TestCase
{
    use ProphecyTrait;

    private ExampleToBeTested|null $example;
    private DependencyForExample|ObjectProphecy|null $exampleDependency;

    public function setUp(): void
    {
        $this->exampleDependency = $this->prophesize(DependencyForExample::class);

        $this->example = new ExampleToBeTested(
            $this->exampleDependency->reveal(),
        );
    }

    public function tearDown(): void
    {
        $this->example = null;
        $this->exampleDependency = null;
    }

    #[Test(), TestDox('Longer description of the test.')]
    public function shortOtherTestDescription(): void
    {
        // Arrange
        $valueObjectId = 1;
        $valueObjectName = 'value-object-name';
        $valueObject = $this->createValueObject($valueObjectId, $valueObjectName);
        $otherObject = $this->createOtherObject($valueObject);

        $this->exampleDependency->doStuff()
            ->willReturn($otherObject);

        // Act
        $result = $this->example->executeLogic($valueObjectId);

        // Assert
        static::assertSame($valueObjectId, $result->getId());
        static::assertSame($valueObjectName, $result->getName());
        static::assertSame('some-expectation', $result->getSomeValue());
    }

    #[Test(), TestDox('Longer description of the test.'), DataProvider('useCases')]
    public function shortTestDescription(string $param1, int $param2, bool $expectedResult): void
    {
        // Arrange
        $param3 = false;

        // Act
        $result = $this->example->test($param1, $param2, $param3);

        // Assert
        static::assertSame($expectedResult, $result);
    }

    private function createValueObject(int $id, string $name): ValueObject
    {
        return new ValueObject()
            ->setId($id)
            ->setName($name);
    }

    private function createOtherObject(ValueObject $valueObject): OtherObject
    {
        return new OtherObject()
            ->setValueObject($valueObject);
    }

    public static function useCases(): array
    {
        return [
            'test-case-description' => [
                'param1' => 'value1',
                'param2' => 10,
                'expectedResult' => true,
            ],
            'some-other-test-case-description' => [
                'param1' => 'value2',
                'param2' => '70',
                'expectedResult' => false,
            ],
        ];
    }
}
