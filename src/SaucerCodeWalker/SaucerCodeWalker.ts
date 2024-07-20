// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { isError, Ok, Result } from 'typescript-result';
import { AST, ASTMacroForm, ASTMirror } from '../ast';
import { nameFromAST } from '../SaucerCST';
import { StandardCementMixer } from './SaucerCSTCementMixer';

type MacroModifierPredicate = (modifiers: AST[]) => boolean;
type MacroExpansionFunction = (macro: ASTMacroForm) => Result<AST>;
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
    expander: (form) => StandardCementMixer.lexicalVariableFormFromMacro(form)
});

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

export function macroexpand1(form: AST): Result<AST> {
  if (ASTMirror.isMacroForm(form)) {
      const macroExpander = findMacro(form.modifiers);
      if (macroExpander === undefined) {
          return Ok(form);
      }
      const expansion = macroExpander.expander(form);
      return expansion;
  } else {
      return Ok(form);
  }
}

function macroexpandAll(form: AST): Result<AST> {
  let previousForm = form;
  let nextFormResult = macroexpand1(previousForm);
  if (isError(nextFormResult)) {
    return nextFormResult;
  }
  let nextForm = nextFormResult.ok;
  while (!Object.is(previousForm, nextForm)) {
      previousForm = nextForm;
      nextFormResult = macroexpand1(previousForm);
      if (isError(nextFormResult)) {
        return nextFormResult;
      }
      nextForm = nextFormResult.ok;
  }
  return Ok(nextForm);
}


export function walk(form: AST): Result<AST> {
  const exapndedForm = macroexpandAll(form);
  if (isError(exapndedForm)) {
    return exapndedForm;
  }
  if (ASTMirror.isMacroForm(exapndedForm.ok)) {
    const nextModifiers: AST[] = [];
    for (const modifier of exapndedForm.ok.modifiers) {
      const expansion = walk(modifier);
      if (isError(expansion)) {
        return expansion;
      }
      nextModifiers.push(expansion.ok);
    }
    return Ok(
      exapndedForm.ok.replaceModifiers(
        nextModifiers
    ));
  } else {
      return exapndedForm;
  }
}
