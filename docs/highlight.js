/* ── Ruka syntax highlighter ── */
(function () {
	const KEYWORDS = new Set([
		'let', 'share', 'local', 'if', 'match',
		'while', 'for', 'return', 'record', 'variant', 'behaviour',
		'true', 'false', 'self', 'test', 'break', 'continue', 'defer', 'ruka'
	]);

	const OPERATORS = new Set([
		'+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', ',', '=',
		'->', ':', '.', '@', '&', '$', '|', '^', '!', '?', 'and', 'or', 'not'
	]);

	const STRUCTURES = new Set([
		'(', ')', '[', ']', '{', '}'
	]);

	const SURROUNDS = new Set([
		'=>', 'do', 'end', 'with', 'in', 'else'
	]);

	function esc(s) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function span(cls, s) {
		return '<span class="' + cls + '">' + esc(s) + '</span>';
	}

	function highlight(raw) {
		let out = '', i = 0;

		while (i < raw.length) {
			// Comment
			if (raw[i] === '/' && raw[i + 1] === '/') {
				const end = raw.indexOf('\n', i);
				const stop = end === -1 ? raw.length : end;
				out += span('cmt', raw.slice(i, stop));
				i = stop;
				continue;
			}

			// String
			if (raw[i] === '"') {
				let j = i + 1, strOut = '"';
				while (j < raw.length && raw[j] !== '"') {
					if (raw[j] === '\\') { strOut += raw[j] + (raw[j + 1] ?? ''); j += 2; continue; }
					if (raw[j] === '$' && raw[j + 1] === '{') {
						out += span('str', strOut);
						strOut = '';
						out += span('str', '${');
						j += 2;
						let depth = 1, inner = '';
						while (j < raw.length && depth > 0) {
							if (raw[j] === '{') depth++;
								else if (raw[j] === '}') { if (--depth === 0) break; }
							inner += raw[j++];
						}
						out += highlight(inner);
						out += span('str', '}');
						j++;
						continue;
					}
					strOut += raw[j++];
				}
				out += span('str', strOut + '"');
				i = j + 1;
				continue;
			}

			// Named-parameter label  ~name
			if (raw[i] === '~') {
				let j = i + 1;
				while (j < raw.length && /\w/.test(raw[j])) j++;
				out += span('lbl', raw.slice(i, j));
				i = j;
				continue;
			}

			// Operators should be highlighted the same color as comments, braces and brackets and parentheses as well.
			// Since modes are now operator based, we just need to detect operators and highlight them.

			// Number
			if (/\d/.test(raw[i])) {
				let j = i;
				if (raw[i] === '0' && (raw[i + 1] === 'b' || raw[i + 1] === 'x')) {
					j += 2;
					while (j < raw.length && /[\da-fA-F]/.test(raw[j])) j++;
				} else {
					while (j < raw.length && /[\d.]/.test(raw[j])) j++;
				}
				out += span('num', raw.slice(i, j));
				i = j;
				continue;
			}

			// Surrounds
	   	    if (
				SURROUNDS.has(raw.slice(i, i + 4)) ||
				SURROUNDS.has(raw.slice(i, i + 3)) ||
				SURROUNDS.has(raw.slice(i, i + 2)) ||
				SURROUNDS.has(raw[i])
			) {
				let surr;
				if (SURROUNDS.has(raw.slice(i, i + 4))) surr = raw.slice(i, i + 4);
				else if (SURROUNDS.has(raw.slice(i, i + 3))) surr = raw.slice(i, i + 3);
				else if (SURROUNDS.has(raw.slice(i, i + 2))) surr = raw.slice(i, i + 2);
				else surr = raw[i];

				// Only if following character is not a valid identifier character `_, letter or number` do we accept
				if (i + surr.length >= raw.length || !/\w/.test(raw[i + surr.length])) {
					out += span('surr', surr);
					i += surr.length;
					continue;
				}
	        }

			// Operators
			if (
				OPERATORS.has(raw.slice(i, i + 3)) ||
				OPERATORS.has(raw.slice(i, i + 2)) ||
				OPERATORS.has(raw[i])
			) {
				let op;
				if (OPERATORS.has(raw.slice(i, i + 3))) op = raw.slice(i, i + 3);
				else if (OPERATORS.has(raw.slice(i, i + 2))) op = raw.slice(i, i + 2);
				else op = raw[i];

				// Only if following character is not a valid identifier character `_, letter or number` do we accept
				if (op.length < 2 || i + op.length >= raw.length || !/\w/.test(raw[i + op.length])) {
					out += span('op', op);
					i += op.length;
					continue;
				}
	    	}

			// Structures
	   	    if (STRUCTURES.has(raw.slice(i, i + 2)) || STRUCTURES.has(raw[i])) {
				const strc = STRUCTURES.has(raw.slice(i, i + 2)) ? raw.slice(i, i + 2) : raw[i];
				out += span('strc', strc);
				i += strc.length;
				continue;
	        }


			// Identifier / keyword / type
			if (/[a-zA-Z_]/.test(raw[i])) {
				let j = i;
				while (j < raw.length && /\w/.test(raw[j])) j++;
				const word = raw.slice(i, j);
				let previous_nonspace = {
					first: null,
					second: null
				};

				for (let k = i - 1; k > 0; k--) {
					if (!/\s/.test(raw[k])) {
						previous_nonspace = {
							first: raw[k-1],
							second: raw[k]
						};
						break;
					}
				}
				if (KEYWORDS.has(word)) out += span('kw', word);
					// types don't have to be capitalized, they are always proceeded by a `: ` or `-> `
					// with any amount of spaces beforehand
					else if (previous_nonspace && previous_nonspace.second === ':'
						|| (previous_nonspace.first === '-' && previous_nonspace.second === '>')
					) {
				    	out += span('tp', word);
					}
					else out += esc(word);
				i = j;
				continue;
			}

			out += esc(raw[i++]);
		}

		return out;
	}

	document.addEventListener('DOMContentLoaded', function () {
		// ── Syntax highlighting ──
		document.querySelectorAll('code.ruka').forEach(function (el) {
			el.innerHTML = highlight(el.textContent);
		});

		// ── Hero nav toggle (index page) ──
		var navToggle = document.querySelector('.nav-toggle');
		var heroNav   = document.querySelector('header.hero nav');

		if (navToggle && heroNav) {
			navToggle.addEventListener('click', function () {
				var isOpen = heroNav.classList.toggle('open');
				navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
			});
			heroNav.querySelectorAll('a').forEach(function (a) {
				a.addEventListener('click', function () {
					if (window.innerWidth <= 768) {
						heroNav.classList.remove('open');
						navToggle.setAttribute('aria-expanded', 'false');
					}
				});
			});
			document.addEventListener('keydown', function (e) {
				if (e.key === 'Escape') {
					heroNav.classList.remove('open');
					navToggle.setAttribute('aria-expanded', 'false');
				}
			});
		}

		// ── Playground (index.html) ──
		var playgroundCode     = document.getElementById('playground-code');
		var playgroundTextarea = document.getElementById('playground-textarea');
		var playgroundOutput   = document.getElementById('playground-output');
		var playgroundDesc     = document.getElementById('playground-desc');
		var exampleSelect      = document.getElementById('example-select');

		if (exampleSelect && playgroundCode && playgroundTextarea) {
			var EXAMPLES = {
				'hello-world': {
					desc: '',
					code: [
						'share main = () do',
						'    let name = "world"',
						'    ruka.println("Hello, ${name}!")',
						'    ruka.println("1 + 2 = ${1 + 2}")',
						'end'
					].join('\n')
				},
				'calculator': {
					desc: '',
					code: [
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
						'end'
					].join('\n')
				},
				'fibonacci': {
					desc: '',
					code: [
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
						'end'
					].join('\n')
				},
				'fizzbuzz': {
					desc: '',
					code: [
						'share main = () do',
						'    let i = 1',
						'    while i <= 20 do',
						'        if i % 15 == 0 => ruka.println("FizzBuzz")',
						'        else if i % 3 == 0 => ruka.println("Fizz")',
						'        else if i % 5 == 0 => ruka.println("Buzz")',
						'        else => ruka.println("${i}")',
						'        i = i + 1',
						'    end',
						'end'
					].join('\n')
				}
			};

			function rehighlight(source) {
				playgroundCode.innerHTML = highlight(source);
			}

			function setExample(key) {
				var ex = EXAMPLES[key];
				if (!ex) return;
				if (playgroundDesc)   playgroundDesc.innerHTML     = ex.desc;
				playgroundTextarea.value = ex.code;
				rehighlight(ex.code);
				if (playgroundOutput) playgroundOutput.textContent = '';
				var panel = document.getElementById('playground-output-panel');
				if (panel) panel.removeAttribute('data-state');
			}

			// Live re-highlight as the user types
			playgroundTextarea.addEventListener('input', function () {
				rehighlight(this.value);
			});

			// Insert four spaces on Tab instead of losing focus
			playgroundTextarea.addEventListener('keydown', function (e) {
				if (e.key !== 'Tab') return;
				e.preventDefault();
				var start = this.selectionStart;
				var end   = this.selectionEnd;
				this.value = this.value.slice(0, start) + '    ' + this.value.slice(end);
				this.selectionStart = this.selectionEnd = start + 4;
				rehighlight(this.value);
			});

			exampleSelect.addEventListener('change', function () {
				setExample(this.value);
			});

			setExample(exampleSelect.value);
		}

		// ── Mobile sidebar toggle ──
		var toggle  = document.querySelector('.sidebar-toggle');
		var sidebar = document.querySelector('.sidebar');
		var overlay = document.querySelector('.sidebar-overlay');

		if (!toggle || !sidebar || !overlay) return;

		function openSidebar() {
			sidebar.classList.add('open');
			overlay.classList.add('open');
			toggle.setAttribute('aria-expanded', 'true');
			document.body.style.overflow = 'hidden';
		}

		function closeSidebar() {
			sidebar.classList.remove('open');
			overlay.classList.remove('open');
			toggle.setAttribute('aria-expanded', 'false');
			document.body.style.overflow = '';
		}

		toggle.addEventListener('click', function () {
			sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
		});

		overlay.addEventListener('click', closeSidebar);

		// Close when a nav link is tapped on mobile
		sidebar.querySelectorAll('a').forEach(function (a) {
			a.addEventListener('click', function () {
				if (window.innerWidth <= 768) closeSidebar();
			});
		});

		// Close on Escape
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') closeSidebar();
		});
	});
})();
