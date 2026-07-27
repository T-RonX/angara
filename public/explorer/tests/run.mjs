import { readdir } from 'node:fs/promises';

const testsDirectory = new URL('./', import.meta.url);
const testFiles = (await readdir(testsDirectory))
    .filter(file => file.endsWith('.test.mjs'))
    .sort();

for (const testFile of testFiles)
{
    await import(new URL(testFile, testsDirectory));
}

console.log(`Explorer tests passed (${testFiles.length} files)`);
