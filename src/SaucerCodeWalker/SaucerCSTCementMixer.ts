// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { Result } from "typescript-result";
import { AST, ASTAtom, ASTMacroForm, SourceInfo } from "../ast";
import {
  CSTLexicalVariableForm,
  CSTClassDefinition,
  CSTMethodDefinition,
} from "../SaucerCST";
import { parseAbstractMethodForm } from "./ParseAbstractMethodDefinition";
import { parseLexicalVariableForm } from "./ParseLexicalVariables";

export interface SaucerCSTCementMixer {
  lexicalVariableFormFromMacro(
    form: ASTMacroForm
  ): Result<CSTLexicalVariableForm>;
  // we don't really support multiple bindings yet...
  // if we do, we should create a bindingForm that the lexicalVariableForm collects.
  createLexicalVariableForm(
    selector: ASTAtom,
    binding: AST,
    writeModifier: "const" | "let",
    sourceInfo: SourceInfo
  ): CSTLexicalVariableForm;
  methodDefinitionFromMacro(form: ASTMacroForm): Result<CSTMethodDefinition>;
  classDefinitionFromMacro(form: ASTMacroForm): Result<CSTClassDefinition>;
}

export const StandardCementMixer = Object.freeze({
  createLexicalVariableForm(
    sourceForm: ASTMacroForm,
    selector: ASTAtom,
    binding: AST,
    writeModifier: "const" | "let",
    accessModifier: AST | "private"
  ): CSTLexicalVariableForm {
    return Object.freeze({
      ...sourceForm,
      selector,
      writeModifier,
      assignmentForm: binding,
      accessModifier,
    });
  },
  lexicalVariableFormFromMacro: parseLexicalVariableForm,
  methodDefinitionFromMacro: parseAbstractMethodForm,
  classDefinitionFromMacro: parseAbstractMethodForm,
});
