// SPDX-FileCopyrightText: 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: CC0-1.0

import { gnuxieEslint } from "gnuxie-tsconfig";
import tseslint from 'typescript-eslint';

export default tseslint.config({
  languageOptions: {
    parserOptions: {
    project: ["./tsconfig.json", "./test/tsconfig.json"],
    },
  },
  extends: gnuxieEslint,
});
