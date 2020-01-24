import { targetAst, irAst, generatorModule, parserAst } from '@bimo/core';
import { TypeName } from '@bimo/core/builtInTypes';
import { injectedCode } from './runtime';

function typeTransformer(type: irAst.BaseType): string {
    type TypeMap = { [key in TypeName]: string };
    const types: TypeMap = {
        i8: 'number',
        i16: 'number',
        i32: 'number',
        i64: 'number',
        u8: 'number',
        u16: 'number',
        u32: 'number',
        u64: 'number',
        array: '[]',
    };

    switch (type.tag) {
        case irAst.TypeTag.BuiltIn:
            if (irAst.isBuiltInArray(type)) {
                return `${typeTransformer(type.typeArgs.type!)}[]`;
            }
            return types[type.name];
        case irAst.TypeTag.Custom:
            return type.name;
    }
}

export const ts: generatorModule.GeneratorModule = {
    fileExtension: 'ts',
    language: 'TypeScript',
    visitor: [{
        TypeDeclaration: {
            enter(node, path, scope) {
                scope.level += 1;
                scope.result += `export interface ${node.name} {\n`;
            },
            exit(node, path, scope) {
                scope.level -= 1;
                scope.result += '}\n';
            }
        },
        TypeFieldDeclaration: {
            enter(node, path, scope) {
                if (node.public) {
                    scope.result += `${'\t'.repeat(scope.level)}${node.name}: ${typeTransformer(node.type)}`;
                }
            },
            exit(node, path, scope) {
                if (node.public) {
                    scope.result += ',\n';
                }
            }
        },
        FunctionDeclaration: {
            enter(node, path, scope) {
                scope.level += 1;
                scope.result += `function ${node.id}`;
            },
            exit(node, path, scope) {
                scope.level -= 1;
                scope.result += '}\n';
            },
        },
        FunctionSignature: {
            enter(node, path, scope) {
                scope.result += '(';
            },
            exit(node, path, scope) {
                const {type} = path.find(t => t.tag === targetAst.ExpressionTag.FunctionDeclaration)! as targetAst.FunctionDeclaration;
                scope.result += `): ${type} {\n`;
            },
        },
        FunctionParameter: {
            enter(node, path, scope) {
                if (node.type === 'BimoStream') {
                    scope.result += `${node.id}: ${node.type}`;
                } else {
                    scope.result += `${node.id}: ${typeTransformer(node.type)}`;
                }
            },
            exit(node, path, scope) {
                scope.result += ',';
            },
        },
        ReadBuiltInType: {
            enter(node, path, scope) {
                scope.result += `${'\t'.repeat(scope.level)}const ${node.id}: ${typeTransformer(node.type)} = stream.read${generatorModule.capitalize(node.type.name)}();\n`;
            },
        },
        ReadCustomType: {
            enter(node, path, scope) {
                scope.result += `${'\t'.repeat(scope.level)}const ${node.id}: ${node.type.name} = read${node.type.name}(stream);\n`;
            }
        },
        CreateType: {
            enter(node, path, scope) {
                scope.result += `${'\t'.repeat(scope.level)}const ${node.id} = { ${node.type.props.map(p => p.name).join(',')} };\n`;
            },
        },
        WriteBuiltInType: {
            enter(node, path, scope) {
                if (node.computed.lengthOf) {
                    scope.result += `${'\t'.repeat(scope.level)}stream.write${generatorModule.capitalize(node.type.name)}(struct.${node.computed.lengthOf}.length);\n`;
                } else if (node.expression) {
                    const exprToString = (node: parserAst.Expression.ExpressionNode): string => {
                        switch(node.type) {
                            case parserAst.AstNodeType.Number:
                                return node.value.toString();
                            case parserAst.AstNodeType.BinaryOperator:
                                return exprToString(node.left) + node.op + exprToString(node.right);
                            case parserAst.AstNodeType.Variable:
                                return `struct.${node.value}`;
                            case parserAst.AstNodeType.Function: {
                                const body = exprToString(node.body);
                                if (node.name === 'lengthof') {
                                    return `${body}.length`;
                                }
                            }
                            default:
                                return '';
                        }
                    };

                    scope.result += `${'\t'.repeat(scope.level)}const ${node.id} = ${exprToString(node.expression)};\n`;
                    scope.result += `${'\t'.repeat(scope.level)}stream.write${generatorModule.capitalize(node.type.name)}(${node.id});\n`;

                } else {
                    scope.result += `${'\t'.repeat(scope.level)}stream.write${generatorModule.capitalize(node.type.name)}(struct.${node.id});\n`;
                }
            },
        },
        WriteCustomType: {
            enter(node, path, scope) {
                scope.result += `${'\t'.repeat(scope.level)}write${node.type.name}(struct.${node.id}, stream);\n`;
            },
        },
        ReturnStatement: {
            enter(node, path, scope) {
                scope.result += `${'\t'.repeat(scope.level)}return ${node.id};\n`;
            },
        },
        ReadArrayType: {
            enter(node, path, scope) {
                scope.result += `${'\t'.repeat(scope.level)}const ${node.id}: ${typeTransformer(node.type)} = [];\n`;

                let sizeExpr = '';
                if (node.sizeExpr) {
                    const exprToString = (node: parserAst.Expression.ExpressionNode): string => {
                        switch(node.type) {
                            case parserAst.AstNodeType.Number:
                                return node.value.toString();
                            case parserAst.AstNodeType.BinaryOperator:
                                return exprToString(node.left) + node.op + exprToString(node.right);
                            case parserAst.AstNodeType.Variable:
                                return `${node.value}`;
                            case parserAst.AstNodeType.Function: {
                                const body = exprToString(node.body);
                                if (node.name === 'lengthof') {
                                    return `${body}.length`;
                                }
                            }
                            default:
                                return '';
                        }
                    };
                    sizeExpr = exprToString(node.sizeExpr);
                }

                scope.result += `${'\t'.repeat(scope.level)}for (let i = 0; i < ${sizeExpr}; i++) {\n`;
                scope.level += 1;
            },
            exit(node, path, scope) {
                scope.result += `${'\t'.repeat(scope.level)}${node.id}.push(temp);\n`;
                scope.level -= 1;
                scope.result += `${'\t'.repeat(scope.level)}}\n`;
            },
        },
        WriteArrayType: {
            enter(node, path, scope) {
                let expr: string = '';
                if (node.typeArg.length) {
                    expr = `${node.typeArg.length}`;
                } else if (node.typeArg.lengthOf) {
                    expr = `struct.${node.id}.length`;
                }

                if (node.expression) {
                    const exprToString = (node: parserAst.Expression.ExpressionNode): string => {
                        switch(node.type) {
                            case parserAst.AstNodeType.Number:
                                return node.value.toString();
                            case parserAst.AstNodeType.BinaryOperator:
                                return exprToString(node.left) + node.op + exprToString(node.right);
                            case parserAst.AstNodeType.Variable:
                                return `${node.value}`;
                            case parserAst.AstNodeType.Function: {
                                const body = exprToString(node.body);
                                if (node.name === 'lengthof') {
                                    return `${body}.length`;
                                }
                            }
                            default:
                                return '';
                        }
                    };
                    expr = exprToString(node.expression);
                }

                scope.result += `${'\t'.repeat(scope.level)}for (let i = 0; i < ${expr}; i++) {\n`;
                scope.level += 1;
            },
            exit(node, path, scope) {
                scope.level -= 1;
                scope.result += `${'\t'.repeat(scope.level)}}\n`;
            },
        },
        MainReadFunctionDeclaration: {
            enter(node, path, scope) {
                scope.result += `export function read(buffer: Buffer): ${node.type.name} {\n`;
                scope.result += `    const stream: BimoStream = new BimoStream(buffer);\n`;
                scope.result += `    return read${node.type.name}(stream);\n`;
                scope.result += `}\n`;
            },
        },
        MainWriteFunctionDeclaration: {
            enter(node, path, scope) {
                scope.result += `export function write(buffer: Buffer, source: ${node.type.name}): void {\n`;
                scope.result += `    const stream: BimoStream = new BimoStream(buffer);\n`;
                scope.result += `    write${node.type.name}(source, stream);\n`;
                scope.result += `}\n`;
            },
        },
    }],
    injects: injectedCode,
};

export default ts;
