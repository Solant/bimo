import { run } from '../../../../tests/utils';
import { compile } from '@rebel-struct/core';
import ts from '../../src';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function read(name: string) {
    return readFileSync(resolve(__dirname, name), { encoding: 'utf-8' });
}

function write(name: string, content: string) {
    return writeFileSync(resolve(__dirname, name), content, { encoding: 'utf-8' });
}

test('Dynamic arrays', async () => {
    await run({
        cwd: __dirname,
        native: {
            prepare: undefined,
            read: 'npx ts-node source-native.ts read _test-compiled.bin 10',
            write: 'npx ts-node source-native.ts write _test-compiled.bin 10',
        },
        rebel: {
            prepare() {
                const source = compile(read('data.rebel'), ts, { emitRuntime: true, target: 'ts' });
                write('source-rebel-compiled.ts', source.fileContent);
            },
            read: 'npx ts-node source-rebel.ts read _test-compiled.bin 10',
            write: 'npx ts-node source-rebel.ts write _test-compiled.bin 10',
        },
    })
}, 30000);
