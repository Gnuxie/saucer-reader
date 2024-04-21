// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { UNumber } from "../../primitive/number";
import { USymbol } from "../../primitive/symbol";
import { Result, ResultError } from "../../Result";
import {
  AST,
  ASTAtom,
  ASTImplicitSelfSend,
  ASTMacroForm,
  ASTPartialSend,
  ASTTargettedSend,
} from "./ast";
import { SaucerToken, TokenStream, TokenTag } from "./TokenStream";

// Error support types

export class ReadError extends ResultError {
  constructor(
    public readonly stream: TokenStream,
    message: string,
  ) {
    super(message);
  }

  public static Result<Ok>(
    message: string,
    options: { stream: TokenStream },
  ): Result<Ok, ReadError> {
    return Result.Err(new ReadError(options.stream, message));
  }
}

// Reader

/**
 * TODO: Make the literals the reader creates for numeric types (and then everything else)
 * configurable. Including all the way down through symbols and cons.
 * just copy eclector tbh.
 */

export interface ReaderClient {
  // While in the AST they might be an atom, they might not from a single token e.g. floats.
  parseNumber(token: SaucerToken): any;
  parseSymbol(token: SaucerToken): ASTAtom;
  parseString(token: SaucerToken): ASTAtom;
  isBinarySelector(token: SaucerToken): boolean;
}

export class SaucerReaderClient implements ReaderClient {
  parseNumber(token: SaucerToken) {
    return new ASTAtom(
      new UNumber(Number.parseInt(token.raw)),
      token.sourceInfo,
    );
  }
  parseSymbol(token: SaucerToken) {
    return new ASTAtom(USymbol.make(token.raw), token.sourceInfo);
  }
  parseString(token: SaucerToken) {
    return new ASTAtom(token.raw, token.sourceInfo);
  }
  isBinarySelector(token: SaucerToken): boolean {
    const selectors = new Set(["+", "-", "/", "*", "&&", "||", "<", ">"]);
    return selectors.has(token.raw);
  }
}

export class Reader {
  constructor(private readonly client: ReaderClient) {
    // now't to do yet.
  }

  /**
   * Does not read opening or closing tokens of a list.
   * @param stream
   * @param delimiter
   * @param close
   * @returns
   */
  public readInnerList(
    stream: TokenStream,
    delimiters: TokenTag[],
    close: TokenTag | undefined,
  ): AST[] {
    const items: AST[] = [];
    // first/only/last item of the list doesn't need a delimiter so what's happening here?
    // (but it can have a delimiter)
    if (stream.peekTag() !== close) {
      items.push(this.readExpression(stream));
    }
    while (stream.peekTag() !== close) {
      if (items.length !== 0 && !delimiters.includes(stream.peekTag())) {
        throw new TypeError(
          `Man we need better errors, expected a delimeter ${delimiters} but got ${stream.peekTag()}.\n${stream.peekSourcePreview()}`,
        );
      }
      stream.read(); // dispose of delimiter.
      items.push(this.readExpression(stream));
    }
    if (close !== undefined && stream.peekTag() === undefined) {
      throw new TypeError(`Unexpected EOF`);
    }
    return items;
  }

  /**
   * Reads the opening and closing tokens.
   * @param stream
   * @param delimiter
   * @returns
   */
  public readDelimitedList(
    stream: TokenStream,
    open: TokenTag,
    delimiters: TokenTag[],
    close: TokenTag,
  ): AST[] {
    if (stream.peekTag() !== open) {
      throw new TypeError(
        `You're calling readDelimitedList but the opening token does not match expected ${open} but got ${stream.peekTag()}`,
      );
    }
    stream.read();
    const items = this.readInnerList(stream, delimiters, close);
    stream.read(); // close
    return items;
  }

  public readMessageArguments(stream: TokenStream): AST[] {
    if (stream.peekTag() === TokenTag.OpenParen) {
      return this.readDelimitedList(
        stream,
        TokenTag.OpenParen,
        [TokenTag.Comma],
        TokenTag.CloseParen,
      );
    } else {
      return [];
    }
  }

  public maybeReadLiteral(stream: TokenStream): AST | undefined {
    if (stream.peekTag() === TokenTag.Number) {
      return this.client.parseNumber(stream.read());
    } else if (stream.peekTag() === TokenTag.String) {
      return this.client.parseString(stream.read());
    } else {
      return undefined;
    }
  }

  public maybeReadMessageSend(stream: TokenStream): AST | undefined {
    // This is wrong, surely? the atoms aren't being parsed
    if (stream.peekTag() === TokenTag.Dot) {
      stream.read(); // discard the dot.
      return new ASTPartialSend(
        this.client.parseSymbol(stream.read()),
        this.readMessageArguments(stream),
      );
    } else if (stream.peekTag() === TokenTag.Symbol) {
      const firstExpression = this.client.parseSymbol(stream.read()!);
      if (stream.peekTag() === TokenTag.Dot) {
        // Targetted Send
        return new ASTTargettedSend(
          stream.read(),
          firstExpression,
          this.readMessageArguments(stream),
        );
      } else {
        // Implicit self send
        if (stream.peekTag() === TokenTag.OpenParen) {
          return new ASTImplicitSelfSend(
            firstExpression,
            this.readMessageArguments(stream),
          );
        } else {
          return new ASTImplicitSelfSend(firstExpression, []);
        }
      }
    } else {
      return undefined;
    }
  }

  /**
   * Reads an expression, Does not touch terminals like comma and semi-colon at the end.
   */
  public readExpression(stream: TokenStream): AST {
    let maybeModifierAST =
      stream.savingPositionIf<AST | undefined>({
        predicate: (v) => v === undefined,
        body: () => this.maybeReadMessageSend(stream),
      }) ??
      stream.savingPositionIf<AST | undefined>({
        predicate: (v) => v === undefined,
        body: () => this.maybeReadLiteral(stream),
      });
    if (maybeModifierAST === undefined) {
      throw new Error(
        `idk, is there anything that isn't a message send?? probably anon function?\n${stream.peekSourcePreview()}`,
      );
    }
    // collect infix expressions.
    if (
      stream.peek() !== undefined &&
      this.client.isBinarySelector(stream.peek())
    ) {
      const infixOperator = stream.read()!;
      maybeModifierAST = new ASTTargettedSend(
        new ASTAtom(USymbol.make(infixOperator.raw), infixOperator.sourceInfo),
        maybeModifierAST,
        [this.readExpression(stream)],
      );
    }
    if (
      stream.peekTag() === TokenTag.Semicolon ||
      stream.peekTag() === TokenTag.Comma ||
      stream.peekTag() === TokenTag.CloseBrace ||
      stream.peekTag() === TokenTag.CloseParen ||
      stream.peekTag() === undefined
    ) {
      return maybeModifierAST;
    }
    const macroParts: AST[] = [];
    const macroSourceStart = maybeModifierAST.sourceInfo;
    let previousAST: AST | undefined = maybeModifierAST;
    do {
      macroParts.push(previousAST);
      previousAST =
        stream.savingPositionIf<AST | undefined>({
          predicate: (v) => v === undefined,
          body: () => this.maybeReadMessageSend(stream),
        }) ??
        stream.savingPositionIf<AST | undefined>({
          predicate: (v) => v === undefined,
          body: () => this.maybeReadLiteral(stream),
        });
    } while (previousAST !== undefined);
    // We should surely do a comma check here? otherwise it will be fucky.
    // TODO FIXME: HERE.
    // .
    // Now we expect to see a macro form
    const paramaterList: AST[] = [];
    if (stream.peekTag() === TokenTag.OpenParen) {
      this.readDelimitedList(
        stream,
        TokenTag.OpenParen,
        [TokenTag.Comma],
        TokenTag.CloseParen,
      ).forEach((v) => paramaterList.push(v));
    }
    if (stream.peekTag() === TokenTag.OpenBrace) {
      const body = this.readBody(stream);
      return new ASTMacroForm(
        macroSourceStart,
        macroParts,
        body,
        false,
        paramaterList,
      );
    } else if (stream.peekTag() === TokenTag.Equals) {
      const body = this.readAssignmentInitform(stream);
      return new ASTMacroForm(
        macroSourceStart,
        macroParts,
        body,
        true,
        paramaterList,
      );
    } else {
      stream.assertPeekTag(
        TokenTag.OpenBrace,
        "Was expecting a body for this macro form.",
      );
      throw new TypeError();
    }
  }

  public readBody(stream: TokenStream): AST[] {
    return this.readDelimitedList(
      stream,
      TokenTag.OpenBrace,
      [TokenTag.Comma, TokenTag.Semicolon],
      TokenTag.CloseBrace,
    );
  }

  public readAssignmentInitform(stream: TokenStream): AST[] {
    return this.readDelimitedList(
      stream,
      TokenTag.Equals,
      [TokenTag.Comma],
      TokenTag.Semicolon,
    );
  }
}
