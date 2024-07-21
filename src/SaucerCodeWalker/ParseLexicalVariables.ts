// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { StandardSuperCoolStream } from "super-cool-stream";
import { Result, Ok } from "typescript-result";
import { ASTMacroForm, AST, ASTMirror } from "../ast";
import { CSTLexicalVariableForm, nameFromAST } from "../SaucerCST";
import { StandardCementMixer } from "./SaucerCSTCementMixer";
import { SourceLocatableError } from "./SourceLocatableError";

export function parseLexicalVariableForm(
  form: ASTMacroForm
): Result<CSTLexicalVariableForm> {
  const stream: StandardSuperCoolStream<AST, AST[]> =
    new StandardSuperCoolStream<AST, AST[]>(form.modifiers);
  // JS allows for a lot of stretching of `let` and `const` due to destructuring
  // assignment rules. For now, we're just going to ignore that.
  const accessModifiers: AST[] = [];
  const names: AST[] = [];
  const expressions: AST[] = [];
  while (
    ((modifier) =>
      modifier !== undefined &&
      nameFromAST(modifier) !== "const" &&
      nameFromAST(modifier) !== "let")(stream.peekItem(undefined))
  ) {
    accessModifiers.push(stream.readItem());
  }
  const writeModifierAST = stream.readItem();
  if (writeModifierAST === undefined) {
    return SourceLocatableError.Result(
      `There was no const or let in this assignment form`,
      { sourceInfo: form.sourceInfo }
    );
  }
  const writeModifier = nameFromAST(writeModifierAST);
  if (!(writeModifier === "const" || writeModifier === "let")) {
    throw new TypeError(`The code is goddamn wrong this is terrible`);
  }
  while (
    ((modifier) => modifier !== undefined && nameFromAST(modifier) !== "=")(
      stream.peekItem(undefined)
    )
  ) {
    names.push(stream.readItem());
  }
  if (stream.readItem() === undefined) {
    throw new TypeError(
      `Should have been able to dispose of assignment thingy`
    );
  }
  while (stream.peekItem() !== undefined) {
    expressions.push(stream.readItem());
  }
  const selector = names.at(0);
  if (
    names.length > 1 ||
    selector === undefined ||
    !ASTMirror.isAtom(selector)
  ) {
    throw new TypeError(
      `Names section malformed in form -- we haven't implemented this yet`
    );
  }
  const binding = expressions.at(0);
  if (binding === undefined || expressions.length > 1) {
    throw new TypeError(
      `Binding section is malformed -- we haven't implemented this yet`
    );
  }
  const accessModifier = accessModifiers.at(0) ?? "private";
  return Ok(
    StandardCementMixer.createLexicalVariableForm(
      form,
      selector,
      binding,
      writeModifier,
      accessModifier
    )
  );
}
