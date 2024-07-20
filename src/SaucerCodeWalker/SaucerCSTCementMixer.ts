// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { Err, isError, Ok, Result, ResultError } from "typescript-result";
import { AST, ASTAtom, ASTMacroForm, ASTMirror, ASTParanethesizedForm, SourceInfo } from "../ast";
import { CSTLexicalVariableForm, CSTClassDefinition, CSTMethodDefinition, nameFromAST, CSTMethodParameters } from "../SaucerCST";
import { StandardSuperCoolStream } from "super-cool-stream";
import { ASTStream } from "./ASTStream";

export class SourceLocatableError extends ResultError {
  public constructor(
    public readonly sourceInfo: SourceInfo,
    message: string,
    elaborations?: string[],
  ) {
    super(message, elaborations)
  }
  public static Result(
    message: string,
    options: { sourceInfo: SourceInfo }
  ): Result<never, SourceLocatableError> {
    return Err(new SourceLocatableError(options.sourceInfo, message));
  }
}

export interface SaucerCSTCementMixer {
  lexicalVariableFormFromMacro(form: ASTMacroForm): Result<CSTLexicalVariableForm>;
  // we don't really support multiple bindings yet...
  // if we do, we should create a bindingForm that the lexicalVariableForm collects.
  createLexicalVariableForm(selector: ASTAtom, binding: AST, writeModifier: 'const' | 'let', sourceInfo: SourceInfo): CSTLexicalVariableForm;
  methodDefinitionFromMacro(form: ASTMacroForm): Result<CSTMethodDefinition>;
  classDefinitionFromMacro(form: ASTMacroForm): Result<CSTClassDefinition>;
}

function parseLexicalVariableForm(form: ASTMacroForm): Result<CSTLexicalVariableForm> {
  const stream: StandardSuperCoolStream<AST, AST[]> = new StandardSuperCoolStream<AST, AST[]>(form.modifiers);
  // JS allows for a lot of stretching of `let` and `const` due to destructuring
  // assignment rules. For now, we're just going to ignore that.
  const accessModifiers: AST[] = [];
  const names: AST[] = [];
  const expressions: AST[] = [];
  while(((modifier) => modifier !== undefined && nameFromAST(modifier) !== 'const' && nameFromAST(modifier) !== 'let')(stream.peekItem(undefined))) {
    accessModifiers.push(stream.readItem())
  }
  const writeModifierAST = stream.readItem();
  if (writeModifierAST === undefined ) {
    return SourceLocatableError.Result(`There was no const or let in this assignment form`, { sourceInfo: form.sourceInfo });
  }
  const writeModifier = nameFromAST(writeModifierAST);
  if (!(writeModifier === 'const' || writeModifier === 'let')) {
    throw new TypeError(`The code is goddamn wrong this is terrible`);
  }
  while(((modifier) => modifier !== undefined && nameFromAST(modifier) !== '=')(stream.peekItem(undefined))) {
    names.push(stream.readItem());
  }
  if (stream.readItem() === undefined) {
    throw new TypeError(`Should have been able to dispose of assignment thingy`);
  }
  while(stream.peekItem() !== undefined) {
    expressions.push(stream.readItem());
  }
  const selector = names.at(0);
  if (names.length > 1 || selector === undefined || !ASTMirror.isAtom(selector)) {
    throw new TypeError(`Names section malformed in form -- we haven't implemented this yet`);
  }
  const binding = expressions.at(0);
  if (binding === undefined || expressions.length > 1) {
    throw new TypeError(`Binding section is malformed -- we haven't implemented this yet`);
  }
  const accessModifier = accessModifiers.at(0) ?? 'private';
  return Ok(StandardCementMixer.createLexicalVariableForm(
    form,
    selector,
    binding,
    writeModifier,
    accessModifier
  ));
}

function CSTMethodParametersFromParanthesizedForm(form: ASTParanethesizedForm): Result<CSTMethodParameters> {
  const paramaterDescriptions: ASTAtom[] = [];
  for (const description of form.inner) {
    if (!ASTMirror.isAtom(description)) {
      return SourceLocatableError.Result(`We only support atoms for descriptions at the moment`, { sourceInfo: description.sourceInfo });
    }
    paramaterDescriptions.push(description);
  }
  return Ok(Object.freeze({
    inner: paramaterDescriptions,
    astType: form.astType,
    sourceInfo: form.sourceInfo,
    raw: form.raw,
  }))
}

// Does this need a CST??? I think so tbh...
// and we can't rely on the code walker to mix that for us.
function parseAbstractMethodParameters(stream: ASTStream): Result<CSTMethodParameters | undefined> {
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
  return SourceLocatableError.Result(`There shouldn't be anything but the class body or parameters here`, { sourceInfo: peekedItem.sourceInfo });
}

function parseExtends(stream: ASTStream): Result<AST | undefined> {
  if (((modifier) => modifier === undefined || nameFromAST(modifier) !== 'extends')(stream.peekItem(undefined))) {
    return Ok(undefined);
  }
  const maybeExtends = stream.readItem(undefined);
  if (maybeExtends === undefined) {
    throw new TypeError(`code is wrong`);
  }
  const extendExpression = stream.readItem(undefined);
  if (extendExpression === undefined) {
    SourceLocatableError.Result(`extends is used in this class but has no associated expression`, { sourceInfo: maybeExtends.sourceInfo });
  }
  return Ok(extendExpression);
}

function isAbstractMethodFormAClass(form: ASTMacroForm): boolean {
  return form.modifiers.find((modifier) => nameFromAST(modifier) === 'class') !== undefined
}

function parseAbstractMethodAccessModifiers(stream: ASTStream, stopAtKeyword: string): AST[] {
  const accessModifiers: AST[] = []
  while(((modifier) => modifier !== undefined && nameFromAST(modifier) !== stopAtKeyword)(stream.peekItem(undefined))) {
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
    return SourceLocatableError.Result(`There's something unexpected in the definition here`, {sourceInfo: maybeBraceForm.sourceInfo });
   }
  } else {
    return SourceLocatableError.Result(`There's something unexpected in the definition here`, {sourceInfo: maybeBraceForm.sourceInfo });
  }
}

function parseClassDefinition(form: ASTMacroForm): Result<CSTClassDefinition> {
  const stream = new ASTStream(form.modifiers);
  const accessModifiers = parseAbstractMethodAccessModifiers(stream, 'class');
  const classKeyword = stream.readItem();
  if (classKeyword === undefined) {
    throw new TypeError(`parseClassDefinition is being called on something that is not a class`);
  }
  const name = stream.readItem();
  if (name === undefined || !ASTMirror.isAtom(name)) {
    return SourceLocatableError.Result(`Class is missing a name`, { sourceInfo: classKeyword.sourceInfo });
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
  return Ok(Object.freeze({
    raw: form.raw,
    astType: form.astType,
    modifiers: form.modifiers,
    tailModifier: form.tailModifier,
    sourceInfo: form.sourceInfo,
    name,
    extendsExpression: extendsForm.ok,
    parameters: parameters.ok,
    accessModifiers,
    body: body.ok,
  }));
}

function pasreMethodDefinition(form: ASTMacroForm): Result<CSTMethodDefinition> {
  const stream = new ASTStream(form.modifiers);
  const accessModifiers = parseAbstractMethodAccessModifiers(stream, 'class');
  const classKeyword = stream.readItem();
  if (classKeyword === undefined) {
    throw new TypeError(`parseClassDefinition is being called on something that is not a class`);
  }
  const name = stream.readItem();
  if (name === undefined || !ASTMirror.isAtom(name)) {
    return SourceLocatableError.Result(`Class is missing a name`, { sourceInfo: classKeyword.sourceInfo });
  }
  const parameters = parseAbstractMethodParameters(stream);
  if (isError(parameters)) {
    return parameters;
  }
  const body = parseAbstractMethodBody(stream);
  if (isError(body)) {
    return body;
  }
  return Ok(Object.freeze({
    raw: form.raw,
    astType: form.astType,
    modifiers: form.modifiers,
    tailModifier: form.tailModifier,
    sourceInfo: form.sourceInfo,
    name,
    parameters: parameters.ok,
    accessModifiers,
    body: body.ok,
  }));
}

// so problem one is finding out whether it's a class or a method
// problem two is realising that the CST contains information for the class
// and also the slot definition in the enclosing object, such as access modifiers.
function parseAbstractMethodForm(form: ASTMacroForm): Result<CSTMethodDefinition> {
  const isClass = isAbstractMethodFormAClass(form);
  if (isClass) {
    return parseClassDefinition(form);
  }
  return pasreMethodDefinition(form);
}

export const StandardCementMixer = Object.freeze({
  createLexicalVariableForm(sourceForm: ASTMacroForm, selector: ASTAtom, binding: AST, writeModifier: 'const' | 'let', accessModifier: AST | 'private'): CSTLexicalVariableForm {
    return Object.freeze({
      selector,
      writeModifier,
      sourceInfo: sourceForm.sourceInfo,
      assignmentForm: binding,
      accessModifier,
      modifiers: sourceForm.modifiers,
      astType: sourceForm.astType,
      tailModifier: sourceForm.modifiers.at(-1),
      raw: sourceForm.raw,
    })
  },
  lexicalVariableFormFromMacro: parseLexicalVariableForm,
  methodDefinitionFromMacro: parseAbstractMethodForm,
  classDefinitionFromMacro: parseAbstractMethodForm,
})
