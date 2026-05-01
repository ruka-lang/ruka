import { expect, it, describe } from "vitest";
import { render } from "vitest-browser-svelte";
import Terminal from "./index.svelte";

describe("Terminal component", () => {
	it("renders the empty message when no output has been written", async () => {
		const screen = render(Terminal, {});
		await expect.element(screen.getByText("(no output)")).toBeInTheDocument();
	});

	it("appends stdout text via the imperative write() method", async () => {
		const screen = render(Terminal, {});
		const instance = screen.component as unknown as { write(text: string): void };
		instance.write("hello\n");
		instance.write("world\n");
		await expect.element(screen.getByText(/hello/)).toBeInTheDocument();
		await expect.element(screen.getByText(/world/)).toBeInTheDocument();
	});

	it("resolves requestInput() with the line the user typed", async () => {
		const screen = render(Terminal, {});
		const instance = screen.component as unknown as { requestInput(): Promise<string> };
		const promise = instance.requestInput();
		const input = screen.getByLabelText("Program input");
		await input.fill("alice");
		await input
			.element()
			.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		const line = await promise;
		expect(line).toBe("alice");
	});
});
