// SPDX-FileCopyrightText: 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { RowTrackingStringStream } from "super-cool-stream";
import { TokenStream } from "../../../src/TokenStream";
import { Reader } from "../../../src/read";
import { JSSaucerReadClient } from "../../../src/JSSaucerReadClient";
import { walk } from "../../../src/SaucerCodeWalker/SaucerCodeWalker";

describe("just a class innit", function () {
  it("walks the code", function () {
    const example = `class HelloWorld {
      public hello () {
        const x = 1;
        x
      }
    }`;
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const readResult = new Reader(new JSSaucerReadClient()).readExpression(
      stream
    );
    const walkResult = walk(readResult);
    expect(Object.is(walkResult, readResult)).toBeFalsy();
  });
});
