// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import {
  ASTAtom,
  AST,
  ASTPartialSend,
  ASTImplicitSelfSend,
  ASTTargettedSend,
  SourceInfo,
  ASTMacroForm,
  ASTType,
  ASTParanethesizedForm,
  ASTBracedForm,
} from "./ast";
import { ReaderClient } from "./read";

export class AbstractSaucerReadClient
  implements Omit<ReaderClient, "parseNumber" | "parseSymbol" | "parseString">
{
  createParanethesizedForm(
    sourceStart: SourceInfo,
    inner: AST[]
  ): ASTParanethesizedForm {
    return Object.freeze({
      inner,
      sourceInfo: sourceStart,
      astType: ASTType.ParanethesizedForm,
      get raw(): ASTParanethesizedForm {
        return this;
      },
    });
  }
  createBracedForm(sourceStart: SourceInfo, inner: AST[]): ASTBracedForm {
    return Object.freeze({
      sourceInfo: sourceStart,
      inner,
      astType: ASTType.BracedForm,
      get raw(): ASTBracedForm {
        return this;
      },
    });
  }
  createPartialSend(selector: ASTAtom<unknown>, args: AST[]): ASTPartialSend {
    return Object.freeze({
      selector,
      args,
      astType: ASTType.PartialSend,
      get raw(): ASTPartialSend {
        return this;
      },
      sourceInfo: selector.sourceInfo,
    });
  }
  createImplicitSelfSend(
    selector: ASTAtom<unknown>,
    args: AST[]
  ): ASTImplicitSelfSend {
    return Object.freeze({
      selector,
      args,
      astType: ASTType.ImplicitSelfSend,
      get raw(): ASTImplicitSelfSend {
        return this;
      },
      sourceInfo: selector.sourceInfo,
    });
  }
  createTargettedSend(
    target: AST,
    selector: ASTAtom<unknown>,
    args: AST[]
  ): ASTTargettedSend {
    return Object.freeze({
      selector,
      args,
      target,
      astType: ASTType.TargettedSend,
      get raw(): ASTTargettedSend {
        return this;
      },
      sourceInfo: target.sourceInfo,
    });
  }
  createMacroForm(sourceStart: SourceInfo, modifiers: AST[]): ASTMacroForm {
    return Object.freeze({
      modifiers,
      sourceInfo: sourceStart,
      astType: ASTType.MacroForm,
      get raw(): ASTMacroForm {
        return this;
      },
      get tailModifier(): AST | undefined {
        return this.modifiers.at(-1);
      },
    });
  }
}
