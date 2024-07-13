// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { RowTrackingStringStream, StringStream } from "super-cool-stream";
import { SourceInfo } from "./ast";

export function createSourcePreview(
  source: string,
  sourceInfo: SourceInfo
): string {
  const rows = source.split(/\r?\n/);
  const sourceRow = rows.at(sourceInfo.row);
  return `${sourceRow}\n${Array(sourceInfo.column + 1).join(" ")} ^`;
}

/**
 * Helper that consumes from `stream` and appends to `output` until a character is peeked matching `regex`.
 * @param regex A regex for a character to stop at.
 * @param stream A stream to consume from.
 * @param output An array of characters.
 * @returns `output`.
 */
function readUntil(
  regex: RegExp,
  stream: StringStream,
  output: string[] = []
): string[] {
  while (stream.peekChar() !== undefined && !regex.test(stream.peekChar())) {
    output.push(stream.readChar());
  }
  return output;
}

export enum TokenTag {
  OpenBrace = "OpenBrace",
  CloseBrace = "CloseBrace",
  OpenParen = "OpenParen",
  CloseParen = "CloseParen",
  Dot = "Dot",
  Semicolon = "Semicolon",
  Comma = "Comma",
  Symbol = "Symbol",
  Number = "Number",
  String = "String",
}

// Symbols are currently excluded because usually they are always read as implicit self sends.
export const LiteralTags = [Number];

export interface SaucerToken {
  readonly sourceInfo: SourceInfo;
  readonly tag: TokenTag;
  readonly raw: string;
}

type TokenParser = (
  stream: RowTrackingStringStream,
  tag: TokenTag
) => SaucerToken;

const TOKEN_PASRSERS = new Map<TokenTag, TokenParser>();

function findTokenPasrser(tag: TokenTag): TokenParser {
  const entry = TOKEN_PASRSERS.get(tag);
  if (entry === undefined) {
    throw new TypeError(`Couldn't find token parser for token tag: ${tag}`);
  } else {
    return entry;
  }
}

function defineTokenParser(tag: TokenTag, parser: TokenParser) {
  if (TOKEN_PASRSERS.has(tag)) {
    throw new TypeError(`A parser for the tag ${tag} is already defined`);
  }
  TOKEN_PASRSERS.set(tag, parser);
}

function sourceBase(stream: RowTrackingStringStream) {
  return {
    sourceInfo: {
      row: stream.peekRow,
      column: stream.peekColumn,
    },
  };
}

function characterTokenParser(
  stream: RowTrackingStringStream,
  tag: TokenTag
): SaucerToken {
  return {
    ...sourceBase(stream),
    tag: tag,
    raw: stream.readChar(),
  };
}

for (const tag of [
  TokenTag.OpenBrace,
  TokenTag.CloseBrace,
  TokenTag.OpenParen,
  TokenTag.CloseParen,
  TokenTag.Dot,
  TokenTag.Semicolon,
  TokenTag.Comma,
]) {
  defineTokenParser(tag, characterTokenParser);
}

const OPERATOR_SYMBOLS_REGEX = /[-+=<>&]/;
const OPERATOR_SYMBOLS_MATTER_REGEX = /[^-+=<>&]/;

defineTokenParser(TokenTag.Symbol, function (stream, tag): SaucerToken {
  // TODO: How would error recovery work here?
  //       Probably like Draupnir.
  // TODO: How to allow token parser to have a client like eclector?
  if (/[A-Za-z]/.test(stream.peekChar())) {
    return {
      ...sourceBase(stream),
      tag,
      raw: readUntil(/[^\w\-<>]/, stream).join(""),
    };
  } else if (OPERATOR_SYMBOLS_REGEX.test(stream.peekChar())) {
    return {
      ...sourceBase(stream),
      tag,
      raw: readUntil(OPERATOR_SYMBOLS_MATTER_REGEX, stream).join(""),
    };
  } else {
    throw new TypeError("This symbol token has been created incorrectly.");
  }
});

defineTokenParser(TokenTag.Number, function (stream, tag): SaucerToken {
  return {
    ...sourceBase(stream),
    tag,
    raw: readUntil(/[^0-9]/, stream).join(""),
  };
});

defineTokenParser(TokenTag.String, function (stream, tag): SaucerToken {
  stream.readChar(); // dispose open quote.
  const innerString = {
    ...sourceBase(stream),
    tag,
    raw: readUntil(/["]/, stream).join(""),
  };
  stream.readChar(); // dispose close quote.
  return innerString;
});

export class TokenStream {
  protected readonly source: SaucerToken[] = [];
  /** This is the index of the character that is being peeked. */
  private position: number = 0;

  constructor(private readonly stream: RowTrackingStringStream) {
    // nothing to do.
  }

  public getPosition(): number {
    return this.position;
  }

  private eatWhitespace() {
    readUntil(/\S/, this.stream);
  }

  private peekNextTag(): TokenTag {
    this.eatWhitespace();
    // honestly we should use a table with defineSingleCharTokenTag.
    switch (this.stream.peekChar()) {
      case "{":
        return TokenTag.OpenBrace;
      case "}":
        return TokenTag.CloseBrace;
      case "(":
        return TokenTag.OpenParen;
      case ")":
        return TokenTag.CloseParen;
      case ".":
        return TokenTag.Dot;
      case ";":
        return TokenTag.Semicolon;
      case '"':
        return TokenTag.String;
      case ",":
        return TokenTag.Comma;
    }
    if (/[A-Za-z]/.test(this.stream.peekChar())) {
      return TokenTag.Symbol;
    } else if (/[0-9]/.test(this.stream.peekChar())) {
      return TokenTag.Number;
    } else if (OPERATOR_SYMBOLS_REGEX.test(this.stream.peekChar())) {
      return TokenTag.Symbol;
    }
    throw new TypeError(
      `Could not find a token tag for ${this.stream.peekChar()}`
    );
  }

  private readTokenToSource(): SaucerToken {
    const tag = this.peekNextTag();
    const parser = findTokenPasrser(tag);
    const token = parser(this.stream, tag);
    this.source.push(token);
    return token;
  }

  private peekSource(): SaucerToken | undefined {
    if (this.position >= this.source.length) {
      // then we must be either at EOF or we need to read more from the string stream.
      if (this.stream.peekChar() === undefined) {
        return undefined;
      }
      return this.readTokenToSource();
    } else {
      return this.source.at(this.position);
    }
  }

  public peek<T = undefined>(eof?: T): T | SaucerToken {
    const val = this.peekSource();
    if (val === undefined) {
      return eof as T;
    }
    return val;
  }

  public read<T = undefined>(eof?: T): T | SaucerToken {
    const peek = this.peekSource();
    if (peek === undefined) {
      return eof as T;
    }
    this.position++;
    return peek;
  }

  public peekTag<EOF = undefined>(eof?: EOF) {
    const peek = this.peek(undefined);
    if (peek === undefined) {
      return eof;
    }
    return peek.tag;
  }

  public clone(): TokenStream {
    return new TokenStream(this.stream.clone());
  }

  public savingPositionIf<T>(options: {
    predicate: (value: T) => boolean;
    body: () => T;
  }) {
    const oldPosition = this.position;
    const value = options.body();
    if (options.predicate(value)) {
      this.position = oldPosition;
      return value;
    } else {
      return value;
    }
  }

  public peekSourcePreview(): string {
    return createSourcePreview(this.stream.source as string, {
      row: this.stream.peekRow,
      column: this.stream.peekColumn,
    });
  }

  public assertPeekTag(tag: TokenTag, message: string): true {
    if (this.peekTag() === tag) {
      return true;
    }
    throw new TypeError(`${message}\n
            ${this.peekSourcePreview()}`);
  }
}
