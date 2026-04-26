/* ── Ruka syntax highlighter ── */
(function () {
	const KEYWORDS = new Set([
		'let', 'if', 'match',
		'while', 'for', 'return', 'record', 'variant', 'behaviour',
		'true', 'false', 'self', 'test', 'break', 'continue', 'defer'
	]);

	// `ruka` is the reserved built-in module identifier; styled as a keyword.
	const BUILTIN_IDENTS = new Set(['ruka']);

	const OPERATORS = new Set([
		'+', '-', '*', '**', '/', '%', '==', '!=', '<', '>', '<=', '>=', ',', '=',
		'->', ':', '.', '..', '..=', '@', '&', '$', '|', '^', '!', '?', 'and', 'or', 'not'
	]);

	const STRUCTURES = new Set([
		'(', ')', '[', ']', '{', '}'
	]);

	const SURROUNDS = new Set([
		'do', 'end', 'with', 'in', 'else'
	]);

	function esc(s) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function span(cls, s) {
		return '<span class="' + cls + '">' + esc(s) + '</span>';
	}

	// Render a raw string body (already stripped of outer quotes) with ${...}
	// interpolation highlighted. Handles \-escape sequences. Returns HTML spans.
	function highlightStrContent(raw) {
		let out = '', i = 0;
		while (i < raw.length) {
			if (raw[i] === '$' && raw[i + 1] === '{') {
				out += span('str', '$' + '{');
				i += 2;
				let depth = 1, inner = '';
				while (i < raw.length && depth > 0) {
					if (raw[i] === '{') depth++;
					else if (raw[i] === '}') { if (--depth === 0) break; }
					inner += raw[i++];
				}
				out += highlight(inner);
				out += span('str', '}');
				i++;
			} else {
				// collect plain text (including escape sequences) up to next ${
				let start = i;
				while (i < raw.length && !(raw[i] === '$' && raw[i + 1] === '{')) {
					if (raw[i] === '\\' && i + 1 < raw.length) { i += 2; continue; }
					i++;
				}
				if (i > start) out += span('str', raw.slice(start, i));
			}
		}
		return out;
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

			// Multiline string: |" ... |"
			if (raw[i] === '|' && raw[i + 1] === '"') {
				let j = i + 2; // skip opening |"
				let content = '';
				// collect everything up to the closing |"
				while (j < raw.length) {
					if (raw[j] === '|' && raw[j + 1] === '"') { j += 2; break; }
					content += raw[j++];
				}
				out += span('str', '|"');
				out += highlightStrContent(content);
				out += span('str', '|"');
				i = j;
				continue;
			}

			// String
			if (raw[i] === '"') {
				let j = i + 1, strContent = '';
				// collect raw string content up to closing quote, respecting escapes
				while (j < raw.length && raw[j] !== '"') {
					if (raw[j] === '\\' && j + 1 < raw.length) { strContent += raw[j] + raw[j + 1]; j += 2; continue; }
					strContent += raw[j++];
				}
				out += span('str', '"');
				out += highlightStrContent(strContent);
				out += span('str', '"');
				i = j + 1;
				continue;
			}

			// Char literal  'x'  '\n'  '\\'
		if (raw[i] === "'") {
			let j = i + 1;
			if (j < raw.length && raw[j] === '\\') j++; // escape prefix
			j++; // the char itself
			if (j < raw.length && raw[j] === "'") j++; // closing quote
			out += span('str', raw.slice(i, j));
			i = j;
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

			// Number — fractional part is consumed only when the dot isn't `..`
			if (/\d/.test(raw[i])) {
				let j = i;
				if (raw[i] === '0' && (raw[i + 1] === 'b' || raw[i + 1] === 'x')) {
					j += 2;
					while (j < raw.length && /[\da-fA-F]/.test(raw[j])) j++;
				} else {
					while (j < raw.length && /\d/.test(raw[j])) j++;
					if (raw[j] === '.' && raw[j + 1] !== '.' && /\d/.test(raw[j + 1])) {
						j++;
						while (j < raw.length && /\d/.test(raw[j])) j++;
					}
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

				// Word-based ops (and/or/not) must not match inside an identifier;
				// symbol ops have no such conflict, so accept them unconditionally.
				const isWordOp = /[a-zA-Z]/.test(op[0]);
				if (op.length < 2 || !isWordOp || i + op.length >= raw.length || !/\w/.test(raw[i + op.length])) {
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
					else if (BUILTIN_IDENTS.has(word)) out += span('kw', word);
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

	// Expose for playground.js error re-rendering
	window.highlightRuka = highlight;

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
			var EXAMPLES = {};
			var EXAMPLE_KEYS = ['hello-world', 'projectile', 'combat', 'destructuring', 'multiline-strings', 'methods-and-statics', 'calculator', 'fibonacci', 'fizzbuzz', 'arrays', 'ranges-and-chars', 'range-match'];

			function rehighlight(source) {
				playgroundCode.innerHTML = highlight(source);
			}

			function setExample(key) {
				var ex = EXAMPLES[key];
				if (!ex) return;
				if (playgroundDesc)   playgroundDesc.innerHTML     = ex.desc;
				playgroundTextarea.value = ex.code;
				(window.rukaCheckAndHighlight || rehighlight)(ex.code);
				if (playgroundOutput) playgroundOutput.textContent = '';
				var panel = document.getElementById('playground-output-panel');
				if (panel) panel.removeAttribute('data-state');
			}

			// Live re-highlight as the user types.
			// playground.js replaces this with rukaCheckAndHighlight once loaded.
			playgroundTextarea.addEventListener('input', function () {
				(window.rukaCheckAndHighlight || rehighlight)(this.value);
			});

			// Insert four spaces on Tab instead of losing focus
			playgroundTextarea.addEventListener('keydown', function (e) {
				if (e.key !== 'Tab') return;
				e.preventDefault();
				var start = this.selectionStart;
				var end   = this.selectionEnd;
				this.value = this.value.slice(0, start) + '    ' + this.value.slice(end);
				this.selectionStart = this.selectionEnd = start + 4;
				(window.rukaCheckAndHighlight || rehighlight)(this.value);
			});

			exampleSelect.addEventListener('change', function () {
				setExample(this.value);
			});

			// Populate from examples/examples.js (window.RUKA_EXAMPLES)
			var source = window.RUKA_EXAMPLES || {};
			EXAMPLE_KEYS.forEach(function (key) {
				EXAMPLES[key] = { desc: '', code: source[key] || '// Example not found: ' + key };
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
