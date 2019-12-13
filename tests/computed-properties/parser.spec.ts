import { parse } from '../../compiler/parser/document';
import * as Ast from '../../compiler/parser/ast';
import { transform as transformIR } from '../../compiler/transformer/ir-transformer';
import { transform as transformTarget } from '../../compiler/transformer/target-transformer';
import { ComputedField, CustomType } from '../../compiler/transformer/ir-ast';

describe('Parser', function () {
    it('should parse type arg expression', () => {
        const result: Ast.DocumentAstNode = parse(`
        default struct Test {
            length: array<i32>(4);
        }
        `);

        console.log(result);
    });

    it('should parse', () => {
        const result: Ast.DocumentAstNode = parse(`
        default struct Test {
            length: i32 = 3+lengthof(body);
        }
        `);

        expect((result.structures[0].fields[0] as Ast.ComputedFieldAstNode).expr).toEqual({
            type: 'BinaryOperator',
            op: '+',
            left: {
                pos: {
                    column: 27,
                    line: 3,
                    offset: 57,
                },
                type: 'Number',
                value: 3,
            },
            right: {
                type: 'Function',
                name: 'lengthof',
                body: {type: 'Var', value: 'body'}
            }
        });
    });

    describe('IR transformer', () => {
        const res = parse(`
        default struct Test {
            length: i32 = 3+lengthof(body);
        }
        `);
        const types = transformIR(res);

        it('should create prop', () => {
            expect((types[0] as CustomType).props[0].name).toBe('length');
        });

        it('should add expression', () => {
            expect(((types[0] as CustomType).props[0] as ComputedField).expression).toEqual({
                type: 'BinaryOperator',
                op: '+',
                left: {
                    type: 'Number',
                    value: 3,
                    'pos': {
                        'column': 27,
                        'line': 3,
                        'offset': 57,
                    },
                },
                right: {
                    type: 'Function',
                    name: 'lengthof',
                    body: {type: 'Var', value: 'body'}
                }
            });
        });
    });

    describe('target transformer', () => {
        const res = parse(`
        default struct Test {
            length: i32 = 3+lengthof(body);
        }
        `);
        const source = transformTarget(transformIR(res));

        it('should create target AST', () => {
            console.log(source);
        });
    });
});
