// SPDX-FileCopyrightText: 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { RowTrackingStringStream } from "@gnuxie/super-cool-stream";
import { TokenStream } from "./TokenStream";
import { Reader } from "./read";
import { AST, ASTMirror } from "./ast";

export const ReadAny = Symbol("ReadAny");
export type ReadPattern = typeof ReadAny;

export class ReadExpect {
  public constructor(private readonly reader: Reader) {
    // nothing to do mare.
  }

  public matches(ast: AST[], designator: (string | ReadPattern)[]): this {
    for (const item of designator) {
      if (item === ReadAny) {
        continue;
      }
      const stream = new TokenStream(new RowTrackingStringStream(item, 0));
      const readResult = this.reader.readExpression(stream);
      if (ASTMirror.isASTEqual(readResult, readResult)) {
        continue;
      }
      throw new TypeError(
        `Wait can't we just implement the real expect for this?`
      );
    }
    return this;
  }
}
