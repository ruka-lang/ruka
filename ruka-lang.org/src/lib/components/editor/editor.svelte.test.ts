import { expect, it, describe } from "vitest";
import { render } from "vitest-browser-svelte";
import Editor from "./index.svelte";

describe("Editor component", () => {
	it("renders the value into both the textarea and the highlight overlay", async () => {
		const screen = render(Editor, { value: "let x = 1\n" });
		const textarea = screen.getByLabelText("Code editor");
		await expect.element(textarea).toHaveValue("let x = 1\n");
	});

	it("updates the value when the user types", async () => {
		let captured = "";
		const screen = render(Editor, {
			value: "",
			onChange: (next: string) => {
				captured = next;
			}
		});
		const textarea = screen.getByLabelText("Code editor");
		await textarea.fill("hi");
		expect(captured).toBe("hi");
	});

	it("renders an error marker when errorLine and errorMessage are set", async () => {
		const screen = render(Editor, {
			value: "ok\nbad\n",
			errorLine: 2,
			errorMessage: "boom"
		});
		await expect.element(screen.getByText(/boom/)).toBeInTheDocument();
	});
});
