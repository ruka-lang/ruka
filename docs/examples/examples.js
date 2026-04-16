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
		'local add = (a, b) => a + b',
		'local sub = (a, b) => a - b',
		'local mul = (a, b) => a * b',
		'local div = (a, b) => a / b',
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
		'local fib = (n) =>',
		'    if n <= 1 => n',
		'    else => fib(n - 1) + fib(n - 2)',
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
		'        if i % 15 == 0 => ruka.println("FizzBuzz")',
		'        else if i % 3 == 0 => ruka.println("Fizz")',
		'        else if i % 5 == 0 => ruka.println("Buzz")',
		'        else => ruka.println("${i}")',
		'        i = i + 1',
		'    end',
		'end',
	].join('\n'),
};
