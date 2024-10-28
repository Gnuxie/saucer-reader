// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { noCase } from "change-case";
import { AbstractSaucerReadClient } from "./AbstractSaucerReadClient";
import { SaucerToken } from "./TokenStream";
import { ASTAtom, ASTType, SourceInfo } from "./ast";
import { ReaderClient } from "./read";

const JSTypeTag = Symbol("JSTypeTag");

enum JSType {
  Number,
  Symbol,
  String,
}

export type JSASTNumber = ASTAtom<number> & { [JSTypeTag]: JSType.Number };
export type JSASTSymbol = ASTAtom<string> & { [JSTypeTag]: JSType.Symbol } & {
  words: string[];
};
export type JSASTString = ASTAtom<string> & { [JSTypeTag]: JSType.String };

export const JSSaucerMirror = Object.freeze({
  createNumber(sourceInfo: SourceInfo, number: number): JSASTNumber {
    return Object.freeze({
      [JSTypeTag]: JSType.Number,
      sourceInfo,
      raw: number,
      astType: ASTType.Atom,
    }) as JSASTNumber;
  },
  createSymbol(sourceInfo: SourceInfo, symbolString: string): JSASTSymbol {
    const raw = noCase(symbolString);
    return Object.freeze({
      [JSTypeTag]: JSType.Symbol,
      sourceInfo,
      raw,
      astType: ASTType.Atom,
      get words() {
        return raw.split(" ");
      },
    }) as JSASTSymbol;
  },
  createString(sourceInfo: SourceInfo, string: string): JSASTString {
    return Object.freeze({
      [JSTypeTag]: JSType.String,
      sourceInfo,
      raw: string,
      astType: ASTType.Atom,
    }) as JSASTString;
  },
  isNumber(ast: ASTAtom): ast is JSASTNumber {
    return JSTypeTag in ast && ast[JSTypeTag] === JSType.Number;
  },
  isSymbol(ast: ASTAtom): ast is JSASTSymbol {
    return JSTypeTag in ast && ast[JSTypeTag] === JSType.Symbol;
  },
  isString(ast: ASTAtom): ast is JSASTString {
    return JSTypeTag in ast && ast[JSTypeTag] === JSType.String;
  },
});

export class JSSaucerReadClient
  extends AbstractSaucerReadClient
  implements ReaderClient
{
  parseNumber(token: SaucerToken): JSASTNumber {
    const number = Number.parseFloat(token.raw);
    if (Number.isNaN(number)) {
      throw new TypeError(`${token.raw} is NaN`);
    }
    return JSSaucerMirror.createNumber(token.sourceInfo, number);
  }
  parseSymbol(token: SaucerToken): JSASTSymbol {
    return JSSaucerMirror.createSymbol(token.sourceInfo, token.raw);
  }
  parseString(token: SaucerToken): JSASTString {
    return JSSaucerMirror.createString(token.sourceInfo, token.raw);
  }
}
