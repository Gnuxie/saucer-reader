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
} from "./ast";
import { ReaderClient } from "./read";

export class AbstractSaucerReadClient
  implements
    Omit<
      ReaderClient,
      "parseNumber" | "parseSymbol" | "parseString" | "isBinarySelector"
    >
{
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
    args: AST[],
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
    args: AST[],
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
  createMacroForm(
    sourceStart: SourceInfo,
    modifiers: AST[],
    body: AST[],
  ): ASTMacroForm {
    return Object.freeze({
      modifiers,
      body,
      sourceInfo: sourceStart,
      astType: ASTType.MacroForm,
      get raw(): ASTMacroForm {
        return this;
      },
    });
  }
}
