---
name: create-or-make-a-new-unit-test
description: Create or make a new unit test. Use when asked to create or add new unit tests. Do not use for functional tests.
---

Use the skeleton file as an example to create a new unit test. The skeleton file is located at `.agents/skills/create-unit-test/assets/unit-test-skeleton.php`.

- Follow the style and structure of the skeleton file when creating the new unit test.
- Never create new instances of value objects directly, always use a createXxx() method for that with the arguments to build the object.
- Of value objects require other value objects, you must construct the dependencies first in the tests 'arrange' section and pass them as parameters.
- When constructing the class under testing, always put the dependencies in the constructor on a new line.
- Always set all object dependencies to null in tearDown() method to prevent memory leaks and ensure a clean state for each test.
- Always add a TestDox annotation to each test method to provide a clear description of what the test is verifying. Make sure its on the same line as Test as in `#[Test, TestDox(...)]`.
- Use a dataProvider for tests that require multiple sets of input data to ensure comprehensive test coverage and maintainability.
- If you add ->should... assert before the act section, make sure to add a `// Expect` comment above it.
- Always add prophecy methods like ->should and ->will on a new line while keeping the first method call on the same line for better readability and maintainability.
- Always check the logic to be tested, and verify it is logical and does not contain potential obscure bugs or other issues. Simple and obvious fixes can be made in the logic to test. Bigger fixes should be reported first before continuing.
- Always adhere to the Arrange/Act/Assert pattern and naming convention.
