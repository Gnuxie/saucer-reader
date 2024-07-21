// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { ResultError, Result, Err } from "typescript-result";
import { SourceInfo } from "../ast";

export class SourceLocatableError extends ResultError {
  public constructor(
    public readonly sourceInfo: SourceInfo,
    message: string,
    elaborations?: string[]
  ) {
    super(message, elaborations);
  }
  public static Result(
    message: string,
    options: { sourceInfo: SourceInfo; }
  ): Result<never, SourceLocatableError> {
    return Err(new SourceLocatableError(options.sourceInfo, message));
  }
}
