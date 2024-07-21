// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { isError, Ok, Result } from "typescript-result";
import { AST, ASTMirror } from "../ast";
import { MacroTable } from "./MacroTable";

export function macroexpand1(form: AST, table: MacroTable): Result<AST> {
  if (ASTMirror.isMacroForm(form)) {
    const macroExpander = table.findMacro(form);
    if (macroExpander === undefined) {
      return Ok(form);
    }
    const expansion = macroExpander.expander(form);
    return expansion;
  } else {
    return Ok(form);
  }
}

function macroexpandAll(form: AST, table: MacroTable): Result<AST> {
  let previousForm = form;
  let nextFormResult = macroexpand1(previousForm, table);
  if (isError(nextFormResult)) {
    return nextFormResult;
  }
  let nextForm = nextFormResult.ok;
  while (!Object.is(previousForm, nextForm)) {
    previousForm = nextForm;
    nextFormResult = macroexpand1(previousForm, table);
    if (isError(nextFormResult)) {
      return nextFormResult;
    }
    nextForm = nextFormResult.ok;
  }
  return Ok(nextForm);
}

export function walk(form: AST, table: MacroTable): Result<AST> {
  const exapndedForm = macroexpandAll(form, table);
  if (isError(exapndedForm)) {
    return exapndedForm;
  }
  if (ASTMirror.isMacroForm(exapndedForm.ok)) {
    const nextModifiers: AST[] = [];
    for (const modifier of exapndedForm.ok.modifiers) {
      const expansion = walk(modifier, table);
      if (isError(expansion)) {
        return expansion;
      }
      nextModifiers.push(expansion.ok);
    }
    return Ok(exapndedForm.ok.replaceModifiers(nextModifiers));
  } else {
    return exapndedForm;
  }
}
