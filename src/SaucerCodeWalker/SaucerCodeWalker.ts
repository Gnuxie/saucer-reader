// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { AST, ASTMacroForm, ASTMirror } from '../ast';
import { nameFromAST } from '../SaucerCST';

type MacroModifierPredicate = (modifiers: AST[]) => boolean;
type MacroExpansionFunction = (macro: ASTMacroForm) => AST;
type MacroExpander = {
    name: string,
    predicate: MacroModifierPredicate,
    expander: MacroExpansionFunction,
}

const MACRO_EXPANDERS = new Map<string, MacroExpander>();

function defineMacroExpander({ name, predicate, expander }: {
    name: string,
    predicate: MacroModifierPredicate,
    expander: MacroExpansionFunction
}) {
    if (MACRO_EXPANDERS.has(name)) {
        throw new TypeError(`${name} is already defined`);
    }
    MACRO_EXPANDERS.set(name, { name, predicate, expander })
}

defineMacroExpander({
    name: 'ConstFormExpander',
    predicate: (modifiers) => {
        return modifiers.find(modifier => nameFromAST(modifier) === 'const') !== undefined;
    },
    expander: (form) =>
})

function findMacro(modifiers: AST[]): MacroExpander|undefined {
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
    for (const macro of MACRO_EXPANDERS.values()) {
        if (macro.predicate(modifiers)) {
            return macro;
        }
    }
    return undefined;
}

export function macroexpand1(form: AST): AST {
  if (ASTMirror.isMacroForm(form)) {
      const macroExpander = findMacro(form.modifiers);
      if (macroExpander === undefined) {
          return form;
      }
      const expansion = macroExpander.expander(form);
      return expansion;
  } else {
      return form;
  }
}

function macroexpandAll(form: AST): AST {
  let previousForm = form;
  let nextForm = macroexpand1(previousForm);
  while (!Object.is(previousForm, nextForm)) {
      previousForm = nextForm;
      nextForm = macroexpand1(previousForm);
  }
  return nextForm;
}


export function walk(form: AST): AST {
  const exapndedForm = macroexpandAll(form);
  if (ASTMirror.isMacroForm(exapndedForm)) {
      return exapndedForm.replaceBody(
          exapndedForm.body.map(
              ast => macroWalk(ast)
          )
      );
  } else {
      return exapndedForm;
  }
}
