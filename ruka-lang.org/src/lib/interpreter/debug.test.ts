import { describe, it, expect } from "vitest";
import { parseSource } from "./parser";
import { checkScope } from "./check/scope";

describe("debug for-destructure", () => {
  it("shows parse tree", () => {
    const source = `let main = () do
\tlet pairs = [(int, int)]{
\t\t(1, 10)
\t\t(2, 20)
\t\t(3, 30)
\t}
end
`;
    const ast = parseSource(source);
    // Find the 'main' binding
    const mainBinding = ast.body[0] as any;
    // Get the body of main
    const mainBody = mainBinding.value.body.body;
    // First stmt is let pairs = ...
    const pairsBinding = mainBody[0] as any;
    const pairsValue = pairsBinding.value;
    console.log("pairs kind:", pairsValue.kind);
    console.log("pairs typePrefix:", JSON.stringify(pairsValue.typePrefix));
    console.log("pairs elements count:", pairsValue.elements?.length);
    if (pairsValue.elements) {
      for (let i = 0; i < pairsValue.elements.length; i++) {
        console.log(`element[${i}]:`, JSON.stringify(pairsValue.elements[i]));
      }
    }
    expect(pairsValue.kind).toBe("ListLiteral");
    expect(pairsValue.elements).toHaveLength(3);
  });
});
