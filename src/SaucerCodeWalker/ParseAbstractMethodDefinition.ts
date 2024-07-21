// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { Result, Ok, isError } from "typescript-result";
import {
  ASTParanethesizedForm,
  ASTAtom,
  ASTMirror,
  AST,
  ASTMacroForm,
} from "../ast";
import {
  CSTMethodParameters,
  nameFromAST,
  CSTClassDefinition,
  CSTMethodDefinition,
} from "../SaucerCST";
import { ASTStream } from "./ASTStream";
import { SourceLocatableError } from "./SourceLocatableError";

function CSTMethodParametersFromParanthesizedForm(
  form: ASTParanethesizedForm
): Result<CSTMethodParameters> {
  const paramaterDescriptions: ASTAtom[] = [];
  for (const description of form.inner) {
    if (!ASTMirror.isAtom(description)) {
      return SourceLocatableError.Result(
        `We only support atoms for descriptions at the moment`,
        { sourceInfo: description.sourceInfo }
      );
    }
    paramaterDescriptions.push(description);
  }
  return Ok(
    Object.freeze({
      inner: paramaterDescriptions,
      astType: form.astType,
      sourceInfo: form.sourceInfo,
      raw: form.raw,
    })
  );
}
// Does this need a CST??? I think so tbh...
// and we can't rely on the code walker to mix that for us.
function parseAbstractMethodParameters(
  stream: ASTStream
): Result<CSTMethodParameters | undefined> {
  const peekedItem = stream.peekItem(undefined);
  if (peekedItem === undefined) {
    return Ok(undefined);
  }
  if (ASTMirror.isBracedForm(peekedItem)) {
    return Ok(undefined);
  }
  if (ASTMirror.isParanethesizedForm(peekedItem)) {
    stream.readItem(undefined);
    return CSTMethodParametersFromParanthesizedForm(peekedItem);
  }
  return SourceLocatableError.Result(
    `There shouldn't be anything but the class body or parameters here`,
    { sourceInfo: peekedItem.sourceInfo }
  );
}
function parseExtends(stream: ASTStream): Result<AST | undefined> {
  if (
    ((modifier) =>
      modifier === undefined || nameFromAST(modifier) !== "extends")(
      stream.peekItem(undefined)
    )
  ) {
    return Ok(undefined);
  }
  const maybeExtends = stream.readItem(undefined);
  if (maybeExtends === undefined) {
    throw new TypeError(`code is wrong`);
  }
  const extendExpression = stream.readItem(undefined);
  if (extendExpression === undefined) {
    SourceLocatableError.Result(
      `extends is used in this class but has no associated expression`,
      { sourceInfo: maybeExtends.sourceInfo }
    );
  }
  return Ok(extendExpression);
}
function isAbstractMethodFormAClass(form: ASTMacroForm): boolean {
  return (
    form.modifiers.find((modifier) => nameFromAST(modifier) === "class") !==
    undefined
  );
}
function parseAbstractMethodAccessModifiers(
  stream: ASTStream,
  stopAtKeyword: string
): AST[] {
  const accessModifiers: AST[] = [];
  while (
    ((modifier) =>
      modifier !== undefined && nameFromAST(modifier) !== stopAtKeyword)(
      stream.peekItem(undefined)
    )
  ) {
    const modifier = stream.readItem(undefined);
    if (modifier === undefined) {
      throw new TypeError(`The code is wrong`);
    }
    accessModifiers.push(modifier);
  }
  return accessModifiers;
}
function parseAbstractMethodBody(stream: ASTStream): Result<AST[]> {
  const maybeBraceForm = stream.peekItem(undefined);
  if (maybeBraceForm === undefined) {
    return Ok([]);
  }
  if (ASTMirror.isBracedForm(maybeBraceForm)) {
    stream.readItem(undefined);
    if (stream.peekItem(undefined) === undefined) {
      return Ok(maybeBraceForm.inner);
    } else {
      return SourceLocatableError.Result(
        `There's something unexpected in the definition here`,
        { sourceInfo: maybeBraceForm.sourceInfo }
      );
    }
  } else {
    return SourceLocatableError.Result(
      `There's something unexpected in the definition here`,
      { sourceInfo: maybeBraceForm.sourceInfo }
    );
  }
}
function parseClassDefinition(form: ASTMacroForm): Result<CSTClassDefinition> {
  const stream = new ASTStream(form.modifiers);
  const accessModifiers = parseAbstractMethodAccessModifiers(stream, "class");
  const classKeyword = stream.readItem();
  if (classKeyword === undefined) {
    throw new TypeError(
      `parseClassDefinition is being called on something that is not a class`
    );
  }
  const name = stream.readItem();
  if (name === undefined || !ASTMirror.isAtom(name)) {
    return SourceLocatableError.Result(`Class is missing a name`, {
      sourceInfo: classKeyword.sourceInfo,
    });
  }
  const extendsForm = parseExtends(stream);
  if (isError(extendsForm)) {
    return extendsForm;
  }
  const parameters = parseAbstractMethodParameters(stream);
  if (isError(parameters)) {
    return parameters;
  }
  const body = parseAbstractMethodBody(stream);
  if (isError(body)) {
    return body;
  }
  return Ok(
    Object.freeze({
      ...form,
      name,
      extendsExpression: extendsForm.ok,
      parameters: parameters.ok,
      accessModifiers,
      body: body.ok,
    })
  );
}
function pasreMethodDefinition(
  form: ASTMacroForm
): Result<CSTMethodDefinition> {
  const stream = new ASTStream(form.modifiers);
  const accessModifiers = parseAbstractMethodAccessModifiers(stream, "class");
  const classKeyword = stream.readItem();
  if (classKeyword === undefined) {
    throw new TypeError(
      `parseClassDefinition is being called on something that is not a class`
    );
  }
  const name = stream.readItem();
  if (name === undefined || !ASTMirror.isAtom(name)) {
    return SourceLocatableError.Result(`Class is missing a name`, {
      sourceInfo: classKeyword.sourceInfo,
    });
  }
  const parameters = parseAbstractMethodParameters(stream);
  if (isError(parameters)) {
    return parameters;
  }
  const body = parseAbstractMethodBody(stream);
  if (isError(body)) {
    return body;
  }
  return Ok(
    Object.freeze({
      ...form,
      name,
      parameters: parameters.ok,
      accessModifiers,
      body: body.ok,
    })
  );
}
// so problem one is finding out whether it's a class or a method
// problem two is realising that the CST contains information for the class
// and also the slot definition in the enclosing object, such as access modifiers.
export function parseAbstractMethodForm(
  form: ASTMacroForm
): Result<CSTMethodDefinition> {
  const isClass = isAbstractMethodFormAClass(form);
  if (isClass) {
    return parseClassDefinition(form);
  }
  return pasreMethodDefinition(form);
}
