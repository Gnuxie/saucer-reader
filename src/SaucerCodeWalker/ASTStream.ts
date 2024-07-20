// SPDX-FileCopyrightText: 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { StandardSuperCoolStream, SuperCoolStream } from "super-cool-stream";
import { AST } from "../ast";

export type ASTStream = SuperCoolStream<AST, AST[]>;
export const ASTStream = StandardSuperCoolStream<AST, AST[]>;
