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

export interface AST<Raw = unknown> {
  readonly raw: Raw;
  readonly sourceInfo: SourceInfo;
  readonly isAtom: boolean;
}

export interface ASTAtom<Raw = unknown> extends AST<Raw> {
  readonly isAtom: true;
}

export function atomRawString(_atom: AST): string {
  throw new TypeError(
    "Consumers should implement ASTAtom interface on a CSTNode",
  );
}

/**
 * We can just say that we scan modifiers left to right for the first
 * matching macro name.
 *
 * Expander function get given the following ASTMacroForms
 * in a list that it gets to choose which applies to it e.g. if else.
 */
export class ASTMacroForm implements AST {
  constructor(
    public readonly sourceInfo: SourceInfo,
    public readonly modifiers: ASTAtom[],
    public readonly body: AST[],
    public readonly isAssignment: boolean = false,
    /** If there are no block arguments, then it is not a block. E.g. assignment */
    public readonly blockArguments?: ASTAtom[],
  ) {}

  public get raw(): AST {
    return this;
  }

  public replaceBody(newBody: AST[]): ASTMacroForm {
    return new ASTMacroForm(
      this.sourceInfo,
      this.modifiers,
      newBody,
      this.isAssignment,
      this.blockArguments,
    );
  }

  public toCSTMethodForm(): CSTMethodForm {
    const selector = this.modifiers.find(
      (modifier) => !CSTMethodForm.MODIFIERS.has(atomRawString(modifier)),
    );
    if (selector === undefined) {
      throw new TypeError("No selector provided for this Method form.");
    }
    return new CSTMethodForm(
      this.sourceInfo,
      selector,
      this.modifiers,
      this.body,
      this.blockArguments,
    );
  }

  public toCSTValueSlotForm(): CSTValueSlotForm {
    const selector = this.modifiers.find(
      (modifier) => !CSTValueSlotForm.MODIFIERS.has(atomRawString(modifier)),
    );
    if (selector === undefined) {
      throw new TypeError("No selector provided for this value slot form.");
    }
    return new CSTValueSlotForm(
      this.sourceInfo,
      selector,
      this.modifiers,
      this.body,
    );
  }
}

export class CSTMethodForm extends ASTMacroForm {
  constructor(
    sourceInfo: SourceInfo,
    public readonly selector: ASTAtom,
    modifiers: ASTAtom[],
    body: AST[],
    blockArguments?: ASTAtom[],
  ) {
    super(sourceInfo, modifiers, body, false, blockArguments);
  }

  public static readonly MODIFIERS = new Set(["public", "private"]);
}

export class CSTValueSlotForm extends ASTMacroForm {
  constructor(
    sourceInfo: SourceInfo,
    public readonly selector: ASTAtom,
    modifiers: ASTAtom[],
    body: AST[],
    blockArguments?: ASTAtom[],
  ) {
    super(sourceInfo, modifiers, body, true, blockArguments);
  }

  public static readonly MODIFIERS = new Set(["public", "private", "mutable"]);
}

/**
 * All message sends are the same
 * except for the target of the send which can be one of the following:
 * implicit self (lexical first), targetted or partial.
 */
export abstract class AbstractASTMessageSend {
  constructor(
    public readonly sourceInfo: SourceInfo,
    public readonly selector: ASTAtom,
    public readonly args: AST[],
  ) {
    // nothing to do.
  }

  public get raw(): AST {
    return this;
  }
}

export class ASTTargettedSend extends AbstractASTMessageSend implements AST {
  constructor(
    selector: ASTAtom,
    public readonly subject: AST,
    args: AST[],
  ) {
    super(selector.sourceInfo, selector, args);
  }
}

export class ASTPartialSend extends AbstractASTMessageSend implements AST {
  constructor(selector: ASTAtom, args: AST[]) {
    super(selector.sourceInfo, selector, args);
  }
}

export class ASTImplicitSelfSend extends AbstractASTMessageSend implements AST {
  constructor(selector: ASTAtom, args: AST[]) {
    super(selector.sourceInfo, selector, args);
  }
}
