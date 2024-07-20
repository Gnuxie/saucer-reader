// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { AST, ASTAtom, ASTMacroForm, ASTMirror, ASTParanethesizedForm } from "./ast";
import { JSSaucerMirror } from "./JSSaucerReadClient";

export enum CSTSaucerType {
  ClassDefinition = 'ClassDefinition',
  MethodDefinition = 'MethodDefinition',
  AssignmentForm = 'AssignmentForm',
}

// a class definition is just a method definition.
// when we establish lexical variables in methods via const or let
// this is usually expressed in IR as establishing a new block
// So in class definition, we should express this by establishing a new mixin
// ARs created from blcoks ofc refer to the lexicla scope
// and mixins refer to the super scope.
// We can imagine the object vector as the same idea as the stack.
// We grow it from the base class in the opposite direction to super.
export interface CSTClassDefinition extends CSTMethodDefinition {
  readonly extendsExpression: AST | undefined;
}

export interface CSTMethodDefinition extends ASTMacroForm {
  // there is a union with undefined here because this is a CST for a paranthesized form in the
  // paramater position. undefined is for when one isn't present at all, even if empty.
  readonly parameters: CSTMethodParameters | undefined;
  readonly body: AST[];
  readonly accessModifiers: AST[];
  readonly name: ASTAtom;
}

export interface CSTLexicalVariableForm extends ASTMacroForm {
  readonly selector: ASTAtom;
  readonly writeModifier: 'let' | 'const';
  // consumer should check this against literals like private/protected
  // but this is AST because it's intended to be used like an interface key
  // for mirror chord/mirror magic.
  // top level classes won't be able to use mirror chord or magic because
  // there's no enclosing object to get them from.
  // Private by default because if a accessMOdifier is not provided then
  // we have to default to private.
  readonly accessModifier: AST | 'private';
  readonly assignmentForm: AST;
}

export function nameFromAST(ast: AST): string | undefined {
  if (ASTMirror.isImplicitSelfSend(ast)) {
    const selector = ast.selector;
    if (JSSaucerMirror.isSymbol(selector)) {
      return selector.raw;
    }
    return undefined;
  } else {
    return undefined;
  }
}

export interface CSTMethodParameters extends ASTParanethesizedForm {
  // we clearly don't support destructuring yet but whatever.
  inner: ASTAtom[]
}
