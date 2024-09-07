import { RowTrackingStringStream } from "super-cool-stream";
import { TokenStream } from "../../../src/TokenStream";
import {
  JSASTNumber,
  JSSaucerMirror,
  JSSaucerReadClient,
} from "../../../src/JSSaucerReadClient";
import { Reader } from "../../../src/read";
import {
  ASTAtom,
  ASTBracedForm,
  ASTDestructure,
  ASTImplicitSelfSend,
  ASTMacroForm,
  ASTMirror,
} from "../../../src/ast";
import { ReadAny, ReadExpect } from "../../../src/ReadExpect";

describe("read basics", function () {
  it("can read symbols", function () {
    const example = "wow";
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isImplicitSelfSend(result)).toBeTruthy();
    const selector = (result as ASTImplicitSelfSend).selector;
    expect(ASTMirror.isAtom(selector)).toBeTruthy();
    expect(JSSaucerMirror.isSymbol(selector)).toBeTruthy();
    expect(selector.raw).toBe("wow");
  });
  it("can read numbers", function () {
    const example = "12";
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isAtom(result)).toBeTruthy();
    expect(JSSaucerMirror.isNumber(result as ASTAtom)).toBeTruthy();
    expect((result as JSASTNumber).raw).toBe(12);
  });
  it("can read complex symbols", function () {
    const example = "===";
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isImplicitSelfSend(result)).toBeTruthy();
    const selector = (result as ASTImplicitSelfSend).selector;
    expect(ASTMirror.isAtom(selector)).toBeTruthy();
    expect(JSSaucerMirror.isSymbol(selector)).toBeTruthy();
    expect(selector.raw).toBe("===");
  });
  it("can read macros", function () {
    const example = "public eat() { food }";
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
    const macroForm = result as ASTMacroForm;
    expect(macroForm.modifiers.length).toBe(3);
    expect(ASTDestructure.tailModifierInner(macroForm)?.length).toBe(1);
  });
  it("can read partial send in a macro form", function () {
    const example = `.height { }`;
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
    const macro = result as ASTMacroForm;
    expect(macro.modifiers.length).toBe(2);
    const partialSend = macro.modifiers[0];
    if (partialSend === undefined || !ASTMirror.isPartialSend(partialSend)) {
      throw new TypeError(`Expected ASTPartialSend`);
    }
    const heightSelector = partialSend.selector;
    if (!JSSaucerMirror.isSymbol(partialSend.selector)) {
      throw new TypeError(`Expected JSSymbol`);
    }
    expect(heightSelector.raw).toBe("height");
  });
  it("can read complex macros", function () {
    const example = `.height > 12 && .width === 10 { huh }`;
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    console.log(result);
  });
  it("can read assignment", function () {
    const example = "const x = 3;";
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
    const macro = result as ASTMacroForm;
    expect(ASTDestructure.tailModifierInner(macro)).toBe(undefined);
    expect(macro.modifiers.length).toBe(4);
  });
  it("can read string", function () {
    const example = '"hello"';
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isAtom(result)).toBeTruthy();
  });
  it("can read infix expression - as macro form, nom.", function () {
    const example = "3 + add(2, 3) + 4";
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
  });
  it("can read complex macros", function () {
    const example = `public destructure(something) {
            match something {
                .height > 12 && .width === 10 { "huh" },
                true {
                    "nothing"
                }
            }
        }`;
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const reader = new Reader(new JSSaucerReadClient());
    const result = reader.readExpression(stream);
    const readExpect = new ReadExpect(reader);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
    const destructureMacroForm = result as ASTMacroForm;
    readExpect.matches(destructureMacroForm.modifiers, [
      "public",
      "destructure",
      "(something)",
      ReadAny,
    ]);
    expect(
      destructureMacroForm.tailModifier &&
        ASTMirror.isBracedForm(destructureMacroForm.tailModifier)
    ).toBe(true);
    const matchForm = (destructureMacroForm.tailModifier as ASTBracedForm)
      .inner[0] as ASTMacroForm;
    readExpect.matches(matchForm.modifiers, ["match", "something", ReadAny]);
    expect(
      matchForm.tailModifier && ASTMirror.isBracedForm(matchForm.tailModifier)
    ).toBe(true);
    const matchBody = matchForm.tailModifier as ASTBracedForm;
    expect(matchBody.inner.length).toBe(2);
    const matchPattern = matchBody.inner[0];
    if (matchPattern === undefined || !ASTMirror.isMacroForm(matchPattern)) {
      throw new TypeError(`Should be able to parse the complex match pattern`);
    }
    const heightWidthTestForm = matchBody.inner.at(-1) as ASTMacroForm;
    readExpect.matches(heightWidthTestForm.modifiers, [
      ".height > 12 && .width === 10",
      ReadAny,
    ]);
  });
  it("it can read ML too LMAO", function () {
    const example = `public map(f, xs) =
    match xs {
      nil -> nil;
      cons(head, tail) -> cons(f.value(head), map(f, tail))
    }`;
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const reader = new Reader(new JSSaucerReadClient());
    const result = reader.readExpression(stream);
    //const readExpect = new ReadExpect(reader);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
  });
});
