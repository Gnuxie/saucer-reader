// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { nameFromAST } from "../SaucerCST";
import { defineMacroExpander, StandardMacroTable } from "./MacroTable";
import { StandardCementMixer } from "./SaucerCSTCementMixer";

export const SaucerCSTCementMixerMacros = new StandardMacroTable();

defineMacroExpander({
  table: SaucerCSTCementMixerMacros,
  name: "ConstFormExpander",
  predicate: (modifiers) => {
    return (
      modifiers.find((modifier) => nameFromAST(modifier) === "const") !==
      undefined
    );
  },
  expander: (form) => StandardCementMixer.lexicalVariableFormFromMacro(form),
});
