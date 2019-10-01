import { BaseType, CustomType, Field, isCustomType, TypeTag } from './ir-ast';
import * as TargetAst from './target-ast';
import { ExpressionTag, ReadArrayType, ReadBuiltInType, ReadCustomType } from './target-ast';

function getTypeField(f: Field): TargetAst.TypeFieldDeclaration {
    return {
        tag: ExpressionTag.TypeFieldDeclaration,
        name: f.name,
        type: f.type,
    };
}

function getTypeDeclaration(type: CustomType): TargetAst.TypeDeclaration {
    return {
        tag: ExpressionTag.TypeDeclaration,
        name: type.name,
        fields: type.props.map(getTypeField),
    }
}

function getWriteFunctionDeclaration(type: CustomType): TargetAst.FunctionDeclaration {
    const props: Array<TargetAst.WriteCustomType | TargetAst.WriteBuiltInType> = type.props.map((prop)=> {
        const propType = prop.type;
        switch (propType.tag) {
            case TypeTag.BuiltIn:
                return {
                    tag: ExpressionTag.WriteBuiltInType,
                    id: prop.name,
                    type: propType,
                };
            case TypeTag.Custom:
                return {
                    tag: ExpressionTag.WriteCustomType,
                    id: prop.name,
                    type: propType,
                }
        }
    });

    return {
        tag: ExpressionTag.FunctionDeclaration,
        id: `write${type.name}`,
        type: 'void',
        signature: {
            tag: ExpressionTag.FunctionSignature,
            params: [
                { tag: ExpressionTag.FunctionParameter, id: 'struct', type },
                { tag: ExpressionTag.FunctionParameter, id: 'stream', type: 'BimoStream' },
            ],
        },
        body: [...props],
    };
}

function getReadFunctionDeclaration(type: CustomType): TargetAst.FunctionDeclaration {
    const props: Array<ReadCustomType | ReadBuiltInType | ReadArrayType> = type.props.map((prop)=> {
        const propType = prop.type;
        switch (propType.tag) {
            case TypeTag.BuiltIn:
                return {
                    tag: ExpressionTag.ReadBuiltInType,
                    id: prop.name,
                    type: propType,
                };
            case TypeTag.Custom:
                return {
                    tag: ExpressionTag.ReadCustomType,
                    id: prop.name,
                    type: propType,
                }
        }
    });

    const createType: TargetAst.CreateType = {
        tag: ExpressionTag.CreateType,
        type: type,
        id: 'ret',
    };

    const ret: TargetAst.ReturnStatement = {
        tag: ExpressionTag.ReturnStatement,
        id: 'ret',
    };

    return {
        tag: ExpressionTag.FunctionDeclaration,
        id: `read${type.name}`,
        type: `${type.name}`,
        signature: {
            tag: ExpressionTag.FunctionSignature,
            params: [{ tag: ExpressionTag.FunctionParameter, id: 'stream', type: 'BimoStream' }],
        },
        body: [...props, createType, ret],
    };
}

export function transform(types: BaseType[]) {
    const customTypes = types.filter(isCustomType);

    const functions = [
        ...customTypes.map(getReadFunctionDeclaration),
        ...customTypes.map(getWriteFunctionDeclaration),
    ];

    const result: TargetAst.Program = {
        tag: ExpressionTag.Program,
        declarations: customTypes.map(getTypeDeclaration),
        functions,
    };

    return result;
}
