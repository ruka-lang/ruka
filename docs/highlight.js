/* ── Ruka syntax highlighter ── */
(function () {
	const KEYWORDS = new Set([
		'let', 'share', 'local', 'if', 'else', 'match', 'with', 'do', 'end',
		'while', 'for', 'in', 'return', 'record', 'variant', 'behaviour',
		'true', 'false', 'self', 'test', 'break', 'continue', 'defer', 'ruka'
	]);

	const OPERATORS = new Set([
		'+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', ',', '=',
		'->', ':', '.', '@', '&', '$', '|', '^', '!', '?', 'and', 'or', 'not'
	]);

	const SURROUNDS = new Set([
		'(', ')', '[', ']', '{', '}', '=>'
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

			// Surrounds
	   	    if (SURROUNDS.has(raw.slice(i, i + 2)) || SURROUNDS.has(raw[i])) {
				const surr = SURROUNDS.has(raw.slice(i, i + 2)) ? raw.slice(i, i + 2) : raw[i];
				out += span('surr', surr);
				i += surr.length;
				continue;
	        }

			// Operators
			if (OPERATORS.has(raw.slice(i, i + 2)) || OPERATORS.has(raw[i])) {
				const op = OPERATORS.has(raw.slice(i, i + 2)) ? raw.slice(i, i + 2) : raw[i];
				out += span('op', op);
				i += op.length;
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
					desc: 'The entry point of every Ruka program is a <code>share main</code> function. <code>ruka.println</code> writes a line to standard output. This is the smallest complete program.',
					code: 'share main = () do\n    ruka.println("Hello, world!")\nend',
					output: 'Hello, world!'
				},
				'binary-tree': {
					desc: 'A recursive <code>variant</code> whose tags are <code>leaf</code> and <code>branch</code>. Methods use <code>match</code> to dispatch on the active tag — the same receiver syntax works for both records and variants.',
					code: [
						'local Tree = variant {',
						'    leaf:   i32,',
						'    branch: record { left: Tree, right: Tree }',
						'}',
						'',
						'// Sum of all leaf values',
						'share sum (self) = () do',
						'    match self with',
						'        .leaf(n)   => n',
						'        .branch(b) => b.left.sum() + b.right.sum()',
						'    end',
						'end',
						'',
						'// Height of the tree',
						'share height (self) = () do',
						'    match self with',
						'        .leaf(_)   => 1',
						'        .branch(b) do',
						'            let l = b.left.height()',
						'            let r = b.right.height()',
						'            1 + if l > r do l else r end',
						'        end',
						'    end',
						'end',
						'',
						'share main = () do',
						'    //       branch',
						'    //      /      \\',
						'    //  branch     leaf(5)',
						'    //  /    \\',
						'    // leaf(1) leaf(2)',
						'    let tree = Tree.branch(.{',
						'        left = Tree.branch(.{',
						'            left  = Tree.leaf(1),',
						'            right = Tree.leaf(2)',
						'        }),',
						'        right = Tree.leaf(5)',
						'    })',
						'',
						'    ruka.println("sum:    ${tree.sum()}")',
						'    ruka.println("height: ${tree.height()}")',
						'end'
						].join('\n'),
					output: 'sum:    8\nheight: 3'
				},
				'shapes': {
					desc: 'Two unrelated record types satisfy a shared <code>behaviour</code> structurally — no explicit declaration needed. The compiler infers the receiver type from field names, and behaviour-typed parameters cause each concrete type to be compiled separately.',
					code: [
						'local Shape = behaviour {',
						'    area(self):      () -> f64',
						'    perimeter(self): () -> f64',
						'    label(self):     () -> string',
						'}',
						'',
						'local Circle = record { radius: f64 }',
						'local Rect   = record { width: f64, height: f64 }',
						'',
						'// self inferred as Circle — only type in scope with `radius`',
						'share area      (self) = () => 3.14159 * self.radius * self.radius',
						'share perimeter (self) = () => 2.0 * 3.14159 * self.radius',
						'share label     (self) = () => "Circle(r=${self.radius})"',
						'',
						'// self inferred as Rect — only type with both `width` and `height`',
						'share area      (self) = () => self.width * self.height',
						'share perimeter (self) = () => 2.0 * (self.width + self.height)',
						'share label     (self) = () => "Rect(${self.width}x${self.height})"',
						'',
						'// Behaviour parameter — any Shape can be passed',
						'local print_info = (s: Shape) do',
						'    ruka.println("${s.label()}")',
						'    ruka.println("  area:      ${s.area()}")',
						'    ruka.println("  perimeter: ${s.perimeter()}")',
						'end',
						'',
						'share main = () do',
						'    let c = .{ radius = 5.0 }',
						'    let r = .{ width = 4.0, height = 6.0 }',
						'    print_info(c)',
						'    print_info(r)',
						'end'
						].join('\n'),
					output: 'Circle(r=5.0)\n  area:      78.53975\n  perimeter: 31.4159\nRect(4.0x6.0)\n  area:      24.0\n  perimeter: 20.0'
				},
				'generics': {
					desc: 'Parameters of type <code>type</code> are automatically compile-time. Functions with type parameters are instantiated separately for each unique set of arguments — similar to monomorphisation. Compile-time functions can also return types.',
					code: [
						'// Generic min — t is inferred as a compile-time type parameter',
						'local min = (t, a: t, b: t) => if a < b => a else => b',
						'',
						'// Type constructor — takes two types, returns a record type',
						'local Pair = (a, b) do',
						'    record { first: a, second: b }',
						'end',
						'',
						'// Swap fields, reversing the type parameters',
						'local swap = (a, b, p: Pair(a, b)) => Pair(b, a).{ first = p.second, second = p.first }',
						'',
						'share main = () do',
						'    ruka.println("min(3, 7)     = ${min(i32, 3, 7)}")',
						'    ruka.println("min(1.5, 2.0) = ${min(f64, 1.5, 2.0)}")',
						'',
						'    let p = Pair(string, i32).{ first = "score", second = 42 }',
						'    let q = swap(string, i32, p)',
						'    ruka.println("${q.first}: ${q.second}")',
						'end'
						].join('\n'),
					output: 'min(3, 7)     = 3\nmin(1.5, 2.0) = 1.5\n42: score'
				}
			};

			function rehighlight(source) {
				playgroundCode.innerHTML = highlight(source);
			}

			function setExample(key) {
				var ex = EXAMPLES[key];
				if (!ex) return;
				if (playgroundDesc)   playgroundDesc.innerHTML    = ex.desc;
				playgroundTextarea.value = ex.code;
				rehighlight(ex.code);
				if (playgroundOutput) playgroundOutput.textContent = ex.output;
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
