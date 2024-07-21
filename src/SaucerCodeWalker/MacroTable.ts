// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { Result } from "typescript-result";
import { AST, ASTMacroForm } from "../ast";

export type MacroModifierPredicate = (modifiers: AST[]) => boolean;
export type MacroExpansionFunction = (macro: ASTMacroForm) => Result<AST>;
export type MacroExpander = {
  name: string;
  predicate: MacroModifierPredicate;
  expander: MacroExpansionFunction;
};

/**
 * The macro table is a way to transform the AST into CSTs with the help
 * of the code walker. The code walker accepts a table that it queries against
 * to be able to find an expansion for the AST.
 *
 * This keeps the code walker portable between different uses of the AST.
 * Since, I might use the same AST for different languages in the future,
 * as it is very simple but broad.
 */
export interface MacroTable {
  findMacro(form: ASTMacroForm): MacroExpander | undefined;
  registerMacro(macro: MacroExpander): this;
}

export class StandardMacroTable implements MacroTable {
  private readonly expanders = new Map<string, MacroExpander>();

  public registerMacro(macro: MacroExpander): this {
    if (this.expanders.has(macro.name)) {
      throw new TypeError(`${macro.name} is already defined`);
    }
    this.expanders.set(macro.name, macro);
    return this;
  }

  public findMacro(form: ASTMacroForm): MacroExpander | undefined {
    // below is a naive implementation that doesn't use the predicate system.
    // the predicate system is required for things like methods that rely on a context.
    //for (const modifier of modifiers) {
    //    if (modifier instanceof ASTImplicitSelfSend) {
    //        const candidate = MACRO_EXPANDERS.get(modifier.selector.raw);
    //        if (candidate !== undefined) {
    //            return candidate;
    //        }
    //    }
    //}
    for (const macro of this.expanders.values()) {
      if (macro.predicate(form.modifiers)) {
        return macro;
      }
    }
    return undefined;
  }
}

export function defineMacroExpander({
  table,
  name,
  predicate,
  expander,
}: {
  table: MacroTable;
  name: string;
  predicate: MacroModifierPredicate;
  expander: MacroExpansionFunction;
}) {
  table.registerMacro({
    name,
    predicate,
    expander,
  });
}
