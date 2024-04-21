// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

export interface SourceInfo {
  readonly row: number;
  readonly column: number;
}

export enum ASTType {
  Atom,
  MacroForm,
  TargettedSend,
  PartialSend,
  ImplicitSelfSend,
}

interface AbstractAST<Raw = unknown> {
  readonly raw: Raw;
  readonly sourceInfo: SourceInfo;
  readonly astType: ASTType;
}

export type AST = ASTAtom | ASTMacroForm | ASTMessageSend;

export interface ASTAtom<Raw = unknown> extends AbstractAST<Raw> {
  readonly astType: ASTType.Atom;
}

export interface ASTMacroForm extends AbstractAST<ASTMacroForm> {
  readonly modifiers: AST[];
  readonly body: AST[];
  readonly astType: ASTType.MacroForm;
}

export interface AbstractASTMessageSend<Raw> extends AbstractAST<Raw> {
  readonly selector: ASTAtom;
  readonly args: AST[];
  readonly astType:
    | ASTType.ImplicitSelfSend
    | ASTType.PartialSend
    | ASTType.TargettedSend;
}

export type ASTMessageSend =
  | ASTTargettedSend
  | ASTPartialSend
  | ASTImplicitSelfSend;

/**
 * All message sends are the same
 * except for the target of the send which can be one of the following:
 * implicit self (lexical first), targetted or partial.
 */

export interface ASTTargettedSend
  extends AbstractASTMessageSend<ASTTargettedSend> {
  readonly target: AST;
  readonly astType: ASTType.TargettedSend;
}

export interface ASTPartialSend extends AbstractASTMessageSend<ASTPartialSend> {
  readonly astType: ASTType.PartialSend;
}

export interface ASTImplicitSelfSend
  extends AbstractASTMessageSend<ASTImplicitSelfSend> {
  readonly astType: ASTType.ImplicitSelfSend;
}

export const ASTMirror = Object.freeze({
  isASTAtom(ast: AST): ast is ASTAtom {
    return ast.astType === ASTType.Atom;
  },
  isASTMacroForm(ast: AST): ast is ASTMacroForm {
    return ast.astType === ASTType.MacroForm;
  },
  isASTMessageSend(ast: AST): ast is ASTMessageSend {
    switch (ast.astType) {
      case ASTType.ImplicitSelfSend:
      case ASTType.PartialSend:
      case ASTType.TargettedSend:
        return true;
      default:
        return false;
    }
  },
  isASTTargettedSend(ast: AST): ast is ASTTargettedSend {
    return ast.astType === ASTType.TargettedSend;
  },
  isASTPartialSend(ast: AST): ast is ASTPartialSend {
    return ast.astType === ASTType.PartialSend;
  },
  isASTImplicitSelfSend(ast: AST): ast is ASTImplicitSelfSend {
    return ast.astType === ASTType.ImplicitSelfSend;
  },
});
