/* ── Playground examples ────────────────────────────────────────────
   Edit this file to add or change playground examples.
   Each key must match an <option value="..."> in index.html.
   One array entry = one line of code.
   ──────────────────────────────────────────────────────────────── */
window.RUKA_EXAMPLES = {
	'hello-world': [
		'share main = () do',
		'    let name = "world"',
		'    ruka.println("Hello, ${name}!")',
		'    ruka.println("1 + 2 = ${1 + 2}")',
		'end',
	].join('\n'),

	'calculator': [
		'local add = (a, b) do a + b',
		'local sub = (a, b) do a - b',
		'local mul = (a, b) do a * b',
		'local div = (a, b) do a / b',
		'',
		'share main = () do',
		'    let x = 12',
		'    let y = 4',
		'    ruka.println("${x} + ${y} = ${add(x, y)}")',
		'    ruka.println("${x} - ${y} = ${sub(x, y)}")',
		'    ruka.println("${x} * ${y} = ${mul(x, y)}")',
		'    ruka.println("${x} / ${y} = ${div(x, y)}")',
		'end',
	].join('\n'),

	'fibonacci': [
		'local fib = (n) do',
		'    n if n <= 1 else fib(n - 1) + fib(n - 2)',
		'end',
		'',
		'share main = () do',
		'    let i = 0',
		'    while i <= 10 do',
		'        ruka.println("fib(${i}) = ${fib(i)}")',
		'        i = i + 1',
		'    end',
		'end',
	].join('\n'),

	'fizzbuzz': [
		'share main = () do',
		'    let i = 1',
		'    while i <= 20 do',
		'        if i % 15 == 0 do ruka.println("FizzBuzz")',
		'        else if i % 3 == 0 do ruka.println("Fizz")',
		'        else if i % 5 == 0 do ruka.println("Buzz")',
		'        else ruka.println("${i}")',
		'        i = i + 1',
		'    end',
		'end',
	].join('\n'),
};
