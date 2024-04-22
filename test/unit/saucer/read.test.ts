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
  ASTImplicitSelfSend,
  ASTMacroForm,
  ASTMirror,
} from "../../../src/ast";

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
    expect(macroForm.modifiers.length).toBe(2);
    expect(macroForm.body.length).toBe(1);
  });
  it("can read partial send in a macro form", function () {
    const example = `.height { }`;
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
    const macro = result as ASTMacroForm;
    expect(macro.modifiers.length).toBe(1);
    const partialSend = macro.modifiers[0];
    if (!ASTMirror.isPartialSend(partialSend)) {
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
    expect(macro.body.length).toBe(0);
    expect(macro.modifiers.length).toBe(4);
  });
  it("can read string", function () {
    const example = '"hello"';
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isAtom(result)).toBeTruthy();
  });
  it("can read infix expression", function () {
    const example = "3 + add(2, 3) + 4";
    const stream = new TokenStream(new RowTrackingStringStream(example, 0));
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    expect(ASTMirror.isTargettedSend(result)).toBeTruthy();
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
    const result = new Reader(new JSSaucerReadClient()).readExpression(stream);
    console.log(result);
    expect(ASTMirror.isMacroForm(result)).toBeTruthy();
    const destructure = result as ASTMacroForm;
    expect(destructure.modifiers.length).toBe(2);
    expect(ASTMirror.isMacroForm(destructure.body[0])).toBeTruthy();
    const match = destructure.body[0] as ASTMacroForm;
    expect(match.modifiers.length).toBe(2);
    expect(match.body.length).toBe(2);
  });
});
