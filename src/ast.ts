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
  Atom = "Atom",
  MacroForm = "MacroForm",
  TargettedSend = "TargettedSend",
  PartialSend = "PartialSend",
  ImplicitSelfSend = "ImplicitSelfSend",
  ParanethesizedForm = "ParenthesizedForm",
  BracedForm = "BracedForm",
}

interface AbstractAST<Raw = unknown> {
  readonly raw: Raw;
  readonly sourceInfo: SourceInfo;
  readonly astType: ASTType;
}

export type AST =
  | ASTAtom
  | ASTMacroForm
  | ASTParanethesizedForm
  | ASTBracedForm
  | ASTMessageSend;

export interface ASTAtom<Raw = unknown> extends AbstractAST<Raw> {
  readonly astType: ASTType.Atom;
}

export interface ASTMacroForm extends AbstractAST<ASTMacroForm> {
  readonly modifiers: AST[];
  readonly astType: ASTType.MacroForm;
  readonly tailModifier: AST | undefined;
}

export interface ASTParanethesizedForm
  extends AbstractAST<ASTParanethesizedForm> {
  readonly inner: AST[];
  readonly astType: ASTType.ParanethesizedForm;
}

export interface ASTBracedForm extends AbstractAST<ASTBracedForm> {
  readonly inner: AST[];
  readonly astType: ASTType.BracedForm;
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
  isASTEqual(astA: AST, astB: AST): boolean {
    switch (astA.astType) {
      case ASTType.Atom:
        return this.isAtom(astB) ? this.isAtomEqual(astA, astB) : false;
      case ASTType.BracedForm:
        return this.isBracedForm(astB)
          ? this.isBracedFormEqual(astA, astB)
          : false;
      case ASTType.ImplicitSelfSend:
        return this.isImplicitSelfSend(astB)
          ? this.isImplicitSelfSendEqual(astA, astB)
          : false;
      case ASTType.MacroForm:
        return this.isMacroForm(astB)
          ? this.isMacroFormEqual(astA, astB)
          : false;
      case ASTType.ParanethesizedForm:
        return this.isParanethesizedForm(astB)
          ? this.isParenthesizedFormEqual(astA, astB)
          : false;
      case ASTType.PartialSend:
        return this.isPartialSend(astB)
          ? this.isPartialSendEqual(astA, astB)
          : false;
      case ASTType.TargettedSend:
        return this.isTargettedSend(astB)
          ? this.isTargettedSendEqual(astA, astB)
          : false;
    }
  },
  isAtom(ast: AST): ast is ASTAtom {
    return ast.astType === ASTType.Atom;
  },
  isAtomEqual(atoma: ASTAtom, atomb: ASTAtom): boolean {
    // hmm this is a bit uneasy.
    // in reality we need the read client to compare raw atoms.
    return atoma.raw === atomb.raw;
  },
  isMacroForm(ast: AST): ast is ASTMacroForm {
    return ast.astType === ASTType.MacroForm;
  },
  isMacroFormEqual(
    macroFormA: ASTMacroForm,
    macroFormB: ASTMacroForm
  ): boolean {
    return this.isASTJSArrayEqual(macroFormA.modifiers, macroFormB.modifiers);
  },
  isASTJSArrayEqual(astA: AST[], astB: AST[]): boolean {
    return astA.every((m, index) => {
      const mB = astB.at(index);
      if (mB === undefined) {
        return false;
      }
      return this.isASTEqual(mB, m);
    });
  },
  isParanethesizedForm(ast: AST): ast is ASTParanethesizedForm {
    return ast.astType === ASTType.ParanethesizedForm;
  },
  isParenthesizedFormEqual(
    astA: ASTParanethesizedForm,
    astB: ASTParanethesizedForm
  ): boolean {
    return this.isASTJSArrayEqual(astA.inner, astB.inner);
  },
  isBracedForm(ast: AST): ast is ASTBracedForm {
    return ast.astType === ASTType.BracedForm;
  },
  isBracedFormEqual(astA: ASTBracedForm, astB: ASTBracedForm): boolean {
    return this.isASTJSArrayEqual(astA.inner, astB.inner);
  },
  isMessageSend(ast: AST): ast is ASTMessageSend {
    switch (ast.astType) {
      case ASTType.ImplicitSelfSend:
      case ASTType.PartialSend:
      case ASTType.TargettedSend:
        return true;
      default:
        return false;
    }
  },
  isMessageSendEqual(astA: ASTMessageSend, astB: ASTMessageSend): boolean {
    return (
      this.isASTEqual(astA.selector, astB.selector) &&
      this.isASTJSArrayEqual(astA.args, astB.args)
    );
  },
  isTargettedSend(ast: AST): ast is ASTTargettedSend {
    return ast.astType === ASTType.TargettedSend;
  },
  isTargettedSendEqual(
    astA: ASTTargettedSend,
    astB: ASTTargettedSend
  ): boolean {
    return (
      this.isASTEqual(astA.selector, astB.selector) &&
      this.isASTEqual(astA.target, astB.target) &&
      this.isASTJSArrayEqual(astA.args, astB.args)
    );
  },
  isPartialSend(ast: AST): ast is ASTPartialSend {
    return ast.astType === ASTType.PartialSend;
  },
  isPartialSendEqual(astA: ASTPartialSend, astB: ASTPartialSend): boolean {
    return (
      this.isASTEqual(astA.selector, astB.selector) &&
      this.isASTJSArrayEqual(astA.args, astB.args)
    );
  },
  isImplicitSelfSend(ast: AST): ast is ASTImplicitSelfSend {
    return ast.astType === ASTType.ImplicitSelfSend;
  },
  isImplicitSelfSendEqual(
    astA: ASTImplicitSelfSend,
    astB: ASTImplicitSelfSend
  ): boolean {
    return (
      this.isASTEqual(astA.selector, astB.selector) &&
      this.isASTJSArrayEqual(astA.args, astB.args)
    );
  },
});

export const ASTDestructure = Object.freeze({
  tailModifierInner(ast: ASTMacroForm): AST[] | undefined {
    const tail = ast.tailModifier;
    if (tail === undefined) {
      return undefined;
    } else if (!ASTMirror.isBracedForm(tail)) {
      return undefined;
    } else {
      return tail.inner;
    }
  },
});
