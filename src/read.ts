// SPDX-FileCopyrightText: 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from saucer-reader
// https://github.com/Gnuxie/saucer-reader
// </text>

import { Err, Result, ResultError } from "typescript-result";
import {
  AST,
  ASTAtom,
  ASTBracedForm,
  ASTImplicitSelfSend,
  ASTMacroForm,
  ASTMirror,
  ASTParanethesizedForm,
  ASTPartialSend,
  ASTTargettedSend,
  SourceInfo,
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

  public static Result(
    message: string,
    options: { stream: TokenStream },
  ): Result<never, ReadError> {
    return Err(new ReadError(options.stream, message));
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
  parseNumber(token: SaucerToken): ASTAtom;
  parseSymbol(token: SaucerToken): ASTAtom;
  parseString(token: SaucerToken): ASTAtom;
  createPartialSend(selector: ASTAtom, args: AST[]): ASTPartialSend;
  createImplicitSelfSend(selector: ASTAtom, args: AST[]): ASTImplicitSelfSend;
  createTargettedSend(
    target: AST,
    selector: ASTAtom,
    args: AST[],
  ): ASTTargettedSend;
  createMacroForm(
    sourceStart: SourceInfo,
    modifiers: AST[],
    body: AST[],
  ): ASTMacroForm;
  createParanethesizedForm(
    sourceStart: SourceInfo,
    inner: AST[],
  ): ASTParanethesizedForm;
  createBracedForm(sourceStart: SourceInfo, inner: AST[]): ASTBracedForm;
  isBinarySelector(token: SaucerToken): boolean;
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
      const tag = stream.peekTag();
      if (tag === undefined) {
        throw new TypeError(`We shouldn't be getting an undefined peek here.`);
      }
      if (items.length !== 0 && !delimiters.includes(tag)) {
        throw new TypeError(
          `Man we need better errors, expected a delimeter ${delimiters.toString()} but got ${stream.peekTag()}.\n${stream.peekSourcePreview()}`,
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
      return this.client.createPartialSend(
        this.client.parseSymbol(stream.read()),
        this.readMessageArguments(stream),
      );
    } else if (stream.peekTag() === TokenTag.Symbol) {
      const firstExpression = this.client.parseSymbol(stream.read());
      // Targetted Send
      if (stream.peekTag() === TokenTag.Dot) {
        const targetExpression = this.readExpression(stream);
        return this.client.createTargettedSend(
          targetExpression,
          firstExpression,
          this.readMessageArguments(stream),
        );
      } else {
        // Implicit self send
        if (stream.peekTag() === TokenTag.OpenParen) {
          return this.client.createImplicitSelfSend(
            firstExpression,
            this.readMessageArguments(stream),
          );
        } else {
          return this.client.createImplicitSelfSend(firstExpression, []);
        }
      }
    } else {
      return undefined;
    }
  }

  public maybeReadParanethesizedForm(
    stream: TokenStream,
  ): ASTParanethesizedForm | undefined {
    if (stream.peekTag() !== TokenTag.OpenParen) {
      return undefined;
    }
    const sourceStart = stream.peek()!.sourceInfo;
    const inner = this.readDelimitedList(
      stream,
      TokenTag.OpenParen,
      [TokenTag.Comma],
      TokenTag.CloseParen,
    );
    return this.client.createParanethesizedForm(sourceStart, inner);
  }

  public maybeReadBracedForm(stream: TokenStream): ASTBracedForm | undefined {
    if (stream.peekTag() !== TokenTag.OpenBrace) {
      return undefined;
    }
    const sourceStart = stream.peek()!.sourceInfo;
    const inner = this.readDelimitedList(
      stream,
      TokenTag.OpenBrace,
      [TokenTag.Comma, TokenTag.Semicolon],
      TokenTag.CloseBrace,
    );
    return this.client.createBracedForm(sourceStart, inner);
  }

  public maybeReadModifier(stream: TokenStream): AST | undefined {
    return (
      stream.savingPositionIf<AST | undefined>({
        predicate: (v) => v === undefined,
        body: () => this.maybeReadMessageSend(stream),
      }) ??
      stream.savingPositionIf<AST | undefined>({
        predicate: (v) => v === undefined,
        body: () => this.maybeReadLiteral(stream),
      }) ??
      stream.savingPositionIf<AST | undefined>({
        predicate: (v) => v === undefined,
        body: () => this.maybeReadParanethesizedForm(stream),
      }) ??
      stream.savingPositionIf<AST | undefined>({
        predicate: (v) => v === undefined,
        body: () => this.maybeReadBracedForm(stream),
      })
    );
  }

  /**
   * Reads an expression, Does not touch terminals like comma and semi-colon at the end.
   */
  public readExpression(stream: TokenStream): AST {
    let maybeModifierAST = this.maybeReadModifier(stream);
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
      maybeModifierAST = this.client.createTargettedSend(
        maybeModifierAST,
        this.client.parseSymbol(infixOperator),
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
      previousAST = this.maybeReadModifier(stream);
    } while (previousAST !== undefined);
    switch (stream.peekTag()) {
      case TokenTag.CloseBrace:
      case TokenTag.Comma:
      case TokenTag.Semicolon:
      case TokenTag.CloseParen:
        if (previousAST !== undefined && ASTMirror.isBracedForm(previousAST)) {
          return this.client.createMacroForm(
            macroSourceStart,
            macroParts,
            (previousAST as ASTBracedForm).inner,
          );
        }
        return this.client.createMacroForm(macroSourceStart, macroParts, []);
      default:
        // this won't work because previousAST will always be undefined lol
        // so now we need to decide whether to provide a body access to ASTMacroForm.
        // I was leaning on an accessor that returns the last modifier, but
        // the body would still be in the modifier list, and not distinct,
        // so i don't like that unless the accessor is described as bodyPosition.
        if (previousAST !== undefined && ASTMirror.isBracedForm(previousAST)) {
          return this.client.createMacroForm(
            macroSourceStart,
            macroParts,
            (previousAST as ASTBracedForm).inner,
          );
        }
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
}
