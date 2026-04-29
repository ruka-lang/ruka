// Curated playground examples. The source files are pulled at build time
// from the interpreter fixtures so the playground always runs the exact
// programs that the test suite exercises.
import helloWorld from "../interpreter/fixtures/ok/hello-world.ruka?raw";
import projectile from "../interpreter/fixtures/ok/projectile.ruka?raw";
import combat from "../interpreter/fixtures/ok/combat.ruka?raw";
import destructuring from "../interpreter/fixtures/ok/destructuring.ruka?raw";
import methodsAndStatics from "../interpreter/fixtures/ok/methods-and-statics.ruka?raw";
import fizzbuzz from "../interpreter/fixtures/ok/fizzbuzz.ruka?raw";
import fibonacci from "../interpreter/fixtures/ok/fibonacci.ruka?raw";
import calculator from "../interpreter/fixtures/ok/calculator.ruka?raw";
import blank from "../interpreter/fixtures/ok/blank.ruka?raw";

export type Example = {
	id: string;
	label: string;
	source: string;
};

export const examples: Example[] = [
	{ id: "hello-world", label: "Hello World", source: helloWorld },
	{ id: "projectile", label: "Projectile", source: projectile },
	{ id: "combat", label: "Combat", source: combat },
	{ id: "destructuring", label: "Destructuring", source: destructuring },
	{ id: "methods-and-statics", label: "Methods and Statics", source: methodsAndStatics },
	{ id: "fizzbuzz", label: "FizzBuzz", source: fizzbuzz },
	{ id: "fibonacci", label: "Fibonacci", source: fibonacci },
	{ id: "calculator", label: "Calculator", source: calculator },
	{ id: "blank", label: "Blank", source: blank }
];

export function findExample(id: string): Example | undefined {
	return examples.find((ex) => ex.id === id);
}
