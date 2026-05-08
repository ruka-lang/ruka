<script lang="ts">
	import DocsShell, { type TocSection } from "$lib/components/DocsShell.svelte";
	import CodeBlock from "$lib/components/ui/codeBlock.svelte";

	const sections: TocSection[] = [
		{ id: "comments", title: "Comments" },
		{ id: "identifiers", title: "Identifiers" },
		{ id: "privacy", title: "Privacy" },
		{ id: "bindings", title: "Bindings" },
		{ id: "modes", title: "Modes" },
		{ id: "literals", title: "Literals" },
		{ id: "builtin-types", title: "Built-in types" },
		{ id: "operators", title: "Operators" },
		{ id: "casting", title: "Casting" },
		{ id: "patterns", title: "Patterns" },
		{ id: "control-flow", title: "Control flow" },
		{ id: "match", title: "Match" },
		{ id: "functions", title: "Functions" },
		{ id: "closures", title: "Closures" },
		{ id: "named-params", title: "Named parameters" },
		{ id: "records-variants", title: "Records & variants" },
		{ id: "methods", title: "Methods & members" },
		{ id: "inference", title: "Type inference" },
		{ id: "behaviours", title: "Behaviours" },
		{ id: "comprehensions", title: "Comprehensions" },
		{ id: "files", title: "Files & imports" },
		{ id: "bouquets", title: "Bouquets" },
		{ id: "tests", title: "Tests" },
		{ id: "comptime", title: "Compile-time evaluation" },
		{ id: "ruka-module", title: "The ruka module" }
	];
</script>

<svelte:head><title>Reference 💐 Ruka Programming Language</title></svelte:head>

<DocsShell title="Reference" {sections}>
	<h1>Reference</h1>
	<p>
		This page is the language specification. It describes the surface syntax, semantics,
		and the contract every implementation should satisfy. This document serves as the
		defacto source of truth when it comes to langauge functionality.
	</p>
	<p>
		Ruka is an opinionated, statically typed programming language. Ruka is garbage
		collected by default, with modes allowing control over reference lifetimes and
		mutability; even allowing stack allocation. Ruka uses aggressive bi-directional type
		inferrence, only requiring explicit annotations to clear up ambiguity. Examples in
		this document omit type annotations except where the annotation is the point of the
		example.
	</p>

	<section id="comments">
		<h2>Comments</h2>
		<p>
			Line comments begin with <code>//</code> and run to the end of the line. There are no
			block comments.
		</p>
		<CodeBlock
			code={`// this is a comment
let x = 1   // trailing comments are fine`}
		/>
	</section>

	<section id="identifiers">
		<h2>Identifiers</h2>
		<p>
			Identifiers are letters, digits, and underscores; they cannot start with a digit.
			Casing carries no semantic weight.
		</p>
		<CodeBlock
			code={`let point = record { x: f64, y: f64 }      // type binding
let Math  = ruka.import("Math.ruka")       // imported file`}
		/>
	</section>

	<section id="privacy">
		<h2>Privacy</h2>
		<p>
			Ruka has two binding keywords. <code>let</code> declares a binding that may escape
			its scope: at file scope it is exported as part of the file's public record, and at
			function scope it may be captured by a closure. <code>local</code> declares a
			non-escaping binding: at file scope it is private to the file (importers cannot see
			it), and at function scope it cannot be captured by a closure that outlives the
			declaring function. See <a href="#closures">Closures</a> for the capture rule.
		</p>
		<p>
			<code>let</code> and <code>local</code> are alternative binding forms, not modifiers
			— write <code>local x = …</code>, never <code>let local x = …</code>.
		</p>
		<p>
			A field of a record (or a tag of a variant, or a member of a behaviour) prefixed
			with <code>local</code> is private in the same sense — accessible inside the declaring
			file, hidden everywhere else.
		</p>
		<CodeBlock
			code={`local helper = () do ruka.println("...")   // private file-scope binding

let point = record {
    x: f64
    y: f64
    local cache: f64    // private field
}`}
		/>
		<p>
			<code>local</code> is the only privacy modifier; there is no <code>pub</code> keyword.
		</p>
	</section>

	<section id="bindings">
		<h2>Bindings</h2>
		<p>
			<code>let</code> and <code>local</code> introduce names. The right-hand side drives type
			inference; an explicit annotation is only needed when inference cannot reach the type
			you want. Bindings can be shadowed by reusing the same name.
		</p>
		<CodeBlock
			code={`let answer = 42
let pi     = 3.14159
let name   = "Ruka"
let count: u32 = 0   // annotation pins the integer type

local cache = ruka.sqrt(2.0)   // file-private; same syntax, different keyword`}
		/>
		<p>
			See <a href="#privacy">Privacy</a> for what <code>local</code> does and where it differs
			from <code>let</code>.
		</p>
		<p>
			Bindings are immutable by default. To make a binding mutable, or to change how it is
			stored or evaluated, use a <em>mode prefix</em> directly before the name (no space).
			See <a href="#modes">Modes</a>.
		</p>
		<CodeBlock
			code={`let *count = 0     // mutable
count = count + 1`}
		/>
		<h3>Destructuring</h3>
		<p>
			A binding may take any irrefutable <a href="#patterns">pattern</a> on the left-hand
			side. Destructuring patterns reuse the same shapes as value literals — a tuple
			pattern is <code>(a, b)</code>, a record pattern is <code>&#123; a, b &#125;</code>.
		</p>
		<CodeBlock
			code={`let (x, y) = (1, 2)         // tuple pattern
let { x, y } = origin       // record pattern; identifiers must match record fields`}
		/>
		<h3>File scope is declarative</h3>
		<p>
			A Ruka file's top level holds declarations only — <code>let</code>/<code>local</code>
			bindings, type definitions, methods, members, behaviours, tests. There are no
			executable statements at file scope. Every top-level right-hand side is therefore
			evaluated at compile time.
		</p>
	</section>

	<section id="modes">
		<h2>Modes</h2>
		<p>
			Mode prefixes adjust how a binding or parameter is stored, captured, or evaluated.
			The same four prefixes apply in both positions, and on method receivers.
		</p>
		<table>
			<thead><tr><th>Prefix</th><th>Meaning</th></tr></thead>
			<tbody>
				<tr><td><code>*</code></td><td>Mutable. Bindings may be reassigned; parameters mutate in place and the change is visible to the caller.</td></tr>
				<tr><td><code>&amp;</code></td><td>Move. Ownership transfers — into a closure on capture (annotated on the binding being captured), or into a function on call (annotated on parameters). The original is invalid afterwards.</td></tr>
				<tr><td><code>$</code></td><td>Stack-allocated. Not GC-managed; passed by pointer or copy. Cannot be moved.</td></tr>
				<tr><td><code>@</code></td><td>Compile-time. The value must be known at compile time. See <a href="#comptime">Compile-time evaluation</a>.</td></tr>
			</tbody>
		</table>
		<CodeBlock
			code={`let *counter = 0                    // mutable binding
let consume = (&buf) do ...         // takes ownership of buf
let hash    = ($data) do ...        // stack copy
let repeat  = (@n: uint, msg) do .. // n must be comptime`}
		/>
		<p>
			The <code>@</code> prefix is rarely written explicitly. At file scope and on
			methods/members, compile-time evaluation is the default; inside function bodies it
			is inferred whenever a parameter's type is <code>type</code>.
		</p>
		<p>
			Method receivers also accept mode prefixes. <code>*self</code> is a mutating receiver;
			<code>&amp;self</code> consumes the receiver (a destructor-like method);
			<code>$self</code> and <code>@self</code> are reserved for cases where the receiver
			itself is stack-bound or compile-time known. See <a href="#methods">Methods &amp; members</a>.
		</p>
	</section>

	<section id="literals">
		<h2>Literals</h2>

		<h3>Numbers</h3>
		<p>
			Integer literals default to <code>int</code>; literals containing a <code>.</code>
			default to <code>float</code>. The literal text is preserved — <code>2</code> and
			<code>2.0</code> are different literals. An explicit annotation pins a more specific type.
		</p>
		<CodeBlock
			code={`let a = 42
let b = 0.5
let c: u8 = 255   // annotated when a smaller integer type is needed`}
		/>

		<h3>Characters</h3>
		<p>
			A character literal is a single byte wrapped in single quotes; it has type <code>u8</code>.
			There is no separate <code>char</code> type. Escapes:
			<code>\n</code>, <code>\t</code>, <code>\r</code>, <code>\\</code>, <code>\'</code>,
			<code>\"</code>, <code>\0</code>.
		</p>
		<CodeBlock
			code={`let nl = '\\n'
let q  = '\\''`}
		/>

		<h3>Strings</h3>
		<p>
			Strings are double-quoted and may interpolate any expression with
			<code>&#36;&#123;…&#125;</code>. Escapes match the character literal set.
		</p>
		<CodeBlock
			code={`let name = "Ruka"
let s = "hello, \${name}!"`}
		/>

		<h3>Multiline strings</h3>
		<p>
			A multiline string opens with <code>|"</code> on its own line and closes with
			<code>|"</code> on its own line. Interior lines begin with <code>|</code>; one optional
			space after the bar is stripped. Interpolation works the same as in single-line strings.
		</p>
		<CodeBlock
			code={`let report =
    |"
    | hello \${name}!
    | line two
    |"`}
		/>

		<h3>Booleans &amp; unit</h3>
		<CodeBlock
			code={`let yes = true
let no  = false
let nothing = ()    // the unit value, type ()`}
		/>

		<h3>Tuples and arrays</h3>
		<p>
			Tuples are heterogeneous fixed-arity; arrays are homogeneous and variable-length.
			Both literals share the brace/paren shapes used by their type annotations: arrays use
			<code>&#123; … &#125;</code>, tuples use <code>( …, … )</code>. Tuple literals always
			contain at least one comma; a single parenthesised expression is just a grouping.
		</p>
		<CodeBlock
			code={`let pair = (1, "one")           // tuple, inferred (int, string)
let xs   = { 1, 2, 3 }          // array, inferred [int]
let prefixed = [u8] { 0, 1, 2 } // type prefix pins the element type
let typed: [u8] = { 0, 1, 2 }   // annotation does the same`}
		/>
		<p>
			In multi-line literals, members may be separated by newlines instead of commas.
			Commas are only required when two members share a single line.
		</p>
		<CodeBlock
			code={`let xs = {
    1
    2
    3
}`}
		/>

		<h3>Records</h3>
		<p>
			A record literal is <code>&#123; field = value, … &#125;</code> and the record type
			is inferred from context. Prefix the literal with the type name when no context is
			available to drive inference. See <a href="#records-variants">Records &amp; variants</a>
			for declaration syntax.
		</p>
		<CodeBlock
			code={`let point = record {
    x: f64
    y: f64
}

let make = (p: point) do p
let p = make({ x = 1.0, y = 2.0 })   // inferred from parameter type
let q = point { x = 1.0, y = 2.0 }   // explicit when there is no context`}
		/>
		<p>
			A record literal disambiguates from an array literal by the <code>=</code> in each
			field initialiser. A single-element shape such as <code>&#123; x &#125;</code> is treated
			as a record shorthand when an enclosing record type is expected, and as an array literal
			when an array type is expected; if neither context is available it is a compile error.
		</p>

		<h3>Variant constructors</h3>
		<p>
			A variant value is constructed by writing the tag name like a function call:
			<code>tag(value)</code> for a tag with payload, <code>tag</code> for a payloadless
			tag. The constructor resolves against context — if an in-scope binding shares the
			name, that binding wins; otherwise the compiler searches in-scope variant types for
			a tag of that name. Use a type-prefixed form <code>type.tag(value)</code> to
			disambiguate or to read more explicitly.
		</p>
		<CodeBlock
			code={`let report = (h: hit) do
    match h with
        critical(d) do ...
        miss        do ...
    end
end

report(critical(20))      // resolved against hit
report(miss)
report(hit.critical(20))  // type-prefixed; always unambiguous`}
		/>

		<h3>Maps</h3>
		<p>
			A map is a homogeneous key→value collection. The type annotation is
			<code>[K =&gt; V]</code>; the literal is <code>&#123; k =&gt; v, … &#125;</code> or
			<code>[K =&gt; V] &#123; k =&gt; v, … &#125;</code> when context is unavailable.
		</p>
		<CodeBlock
			code={`let scores: [string => int] = { "alice" => 91, "bob" => 84 }
let prefixed = [string => int] { "alice" => 91 }`}
		/>
		<p>
			Multi-line map literals separate entries with newlines like every other braced literal;
			commas are only needed on a single line.
		</p>

		<h3>Option &amp; result</h3>
		<p>
			Option and result are ordinary variants in the prelude with shorthand type syntax:
			<code>?(T)</code> for option, <code>!(T, E)</code> for result. Constructors are
			<code>some(v)</code> / <code>none</code> and <code>ok(v)</code> / <code>err(e)</code>.
		</p>

		<h3>Ranges</h3>
		<p>
			<code>a..b</code> is half-open; <code>a..=b</code> is inclusive. Both are
			first-class values of type <code>[T..]</code> and double as iterators.
		</p>
		<CodeBlock
			code={`for i in 0..10 do ruka.println("\${i}")
let r: [int..] = 1..=5`}
		/>
	</section>

	<section id="builtin-types">
		<h2>Built-in types</h2>
		<p>The following types are always in scope.</p>
		<table>
			<thead><tr><th>Group</th><th>Types</th></tr></thead>
			<tbody>
				<tr><td>Signed integers</td><td><code>i8 i16 i32 i64 i128</code>, <code>int</code> (target word size)</td></tr>
				<tr><td>Unsigned integers</td><td><code>u8 u16 u32 u64 u128</code>, <code>uint</code></td></tr>
				<tr><td>Floats</td><td><code>f32 f64</code>, <code>float</code> (target word size)</td></tr>
				<tr><td>Other primitives</td><td><code>bool</code>, <code>string</code>, <code>()</code> (unit)</td></tr>
				<tr><td>Collections</td><td><code>[T]</code> (array), <code>(T, U, …)</code> (tuple), <code>[T..]</code> (range), <code>[K =&gt; V]</code> (map)</td></tr>
				<tr><td>Generic prelude</td><td><code>?(T)</code> (option), <code>!(T, E)</code> (result)</td></tr>
				<tr><td>Compile-time</td><td><code>type</code> (the type of types)</td></tr>
			</tbody>
		</table>
		<p>
			Every type in Ruka — primitive, built-in generic, or user-defined — supports methods,
			members, and behaviour satisfaction. There is no privileged class of types that cannot
			be extended. <code>i32</code> can have methods; <code>[T]</code> can satisfy a
			behaviour; <code>bool</code> can have members. At runtime each type uses its natural
			representation (an integer is a machine integer, not an object), but at the language
			level the rules are uniform.
		</p>
		<CodeBlock
			code={`// attaching a method to i32 is legal anywhere
let is_positive (self) = () -> bool do self > 0

let n: i32 = 42
ruka.println("\${n.is_positive()}")   // true`}
		/>
		<h3>Type annotations</h3>
		<p>
			A type appears after <code>:</code> on a binding or parameter, and after
			<code>-&gt;</code> on a function return.
		</p>
		<CodeBlock
			code={`let count: u32 = 0
let pair: (int, string) = (1, "one")
let lookup = (key: string) -> ?(int) do ...`}
		/>
		<h3>Implicit numeric widening</h3>
		<p>
			An integer or float value may be implicitly converted to a larger type of the same
			family — <code>i32</code> to <code>i64</code>, <code>f32</code> to <code>f64</code>,
			<code>u8</code> to <code>u32</code>, and so on. Narrowing or cross-family
			conversions (signed↔unsigned, int↔float) require an explicit
			<a href="#casting">cast</a>.
		</p>
	</section>

	<section id="operators">
		<h2>Operators</h2>
		<p>From lowest to highest precedence:</p>
		<table>
			<thead><tr><th>Tier</th><th>Operators</th></tr></thead>
			<tbody>
				<tr><td>Pipeline</td><td><code>|&gt;</code></td></tr>
				<tr><td>Logical or</td><td><code>or</code></td></tr>
				<tr><td>Logical and</td><td><code>and</code></td></tr>
				<tr><td>Equality</td><td><code>==</code> <code>!=</code></td></tr>
				<tr><td>Comparison</td><td><code>&lt;</code> <code>&lt;=</code> <code>&gt;</code> <code>&gt;=</code></td></tr>
				<tr><td>Range</td><td><code>..</code> <code>..=</code></td></tr>
				<tr><td>Bitwise</td><td><code>|</code> <code>^</code> <code>&amp;</code> <code>&lt;&lt;</code> <code>&gt;&gt;</code></td></tr>
				<tr><td>Additive</td><td><code>+</code> <code>-</code></td></tr>
				<tr><td>Multiplicative</td><td><code>*</code> <code>/</code> <code>%</code></td></tr>
				<tr><td>Exponent</td><td><code>**</code> (right-assoc)</td></tr>
				<tr><td>Unary</td><td><code>not</code> <code>-</code></td></tr>
				<tr><td>Cast</td><td><code>as</code></td></tr>
				<tr><td>Postfix</td><td>call <code>f(x)</code>, member <code>x.f</code>, index <code>x[i]</code></td></tr>
			</tbody>
		</table>
		<p>
			<code>and</code> / <code>or</code> short-circuit. The pipeline
			<code>x |&gt; f</code> rewrites to <code>f(x)</code>; chains compose left-to-right.
		</p>
		<CodeBlock
			code={`let n = nums |> filter(~pred=(x) do x % 2 == 0)
            |> map(~f=(x) do x * x)
            |> sum()`}
		/>
		<p>
			Operators on user-defined types are dispatched via
			<a href="#behaviours">operator behaviours</a>: defining a method named
			<code>add</code> makes <code>+</code> available for the type.
		</p>
	</section>

	<section id="casting">
		<h2>Casting</h2>
		<p>
			The <code>as</code> operator converts a value to a target type:
			<code>value as Type</code>. Implicit widening (see
			<a href="#builtin-types">Built-in types</a>) is the only conversion the compiler
			performs without an explicit cast — every other conversion goes through
			<code>as</code>.
		</p>
		<p>
			<code>as</code> is a behaviour-driven operator. It dispatches on
			<code>ruka.cast</code>: any type that defines a <code>cast</code> method satisfying
			the behaviour can be the source of an <code>as</code> conversion to whichever
			target types its <code>cast</code> method enumerates. The prelude provides casts
			between numeric types, between numeric types and characters, and between numeric
			types and strings.
		</p>
		<CodeBlock
			code={`let n: i64 = 10
let m = n as i32       // explicit narrowing
let s = n as string    // numeric → string
let c = 65 as u8       // implicit (u8 is wider for an unsigned literal here)`}
		/>
		<p>
			A type customises <code>as</code> by defining a <code>cast</code> member that
			matches the <a href="#rukacast"><code>ruka.cast</code></a> behaviour. Casting source
			code is checked at compile time; if the conversion is invalid for the source/target
			pair, the program fails to compile.
		</p>
	</section>

	<section id="patterns">
		<h2>Patterns</h2>
		<p>
			The same pattern syntax is used in every position —
			<code>let</code>/<code>local</code> destructuring, <code>match</code> arms,
			<code>for</code> loop binders, and the
			<a href="#conditional-pattern-binding">conditional pattern forms</a> of
			<code>if</code> and <code>while</code>. There is no separate destructuring syntax per
			construct. Whether a pattern is <em>refutable</em> (may not match) or
			<em>irrefutable</em> (always matches) determines where it is allowed, but the forms
			themselves are identical everywhere.
		</p>
		<table>
			<thead><tr><th>Form</th><th>Example</th><th>Refutable?</th></tr></thead>
			<tbody>
				<tr><td>Identifier</td><td><code>x</code></td><td>no</td></tr>
				<tr><td>Tuple</td><td><code>(a, b)</code></td><td>no (when arity matches)</td></tr>
				<tr><td>Record</td><td><code>&#123; x, y &#125;</code></td><td>no</td></tr>
				<tr><td>Literal</td><td><code>0</code>, <code>"yes"</code></td><td>yes</td></tr>
				<tr><td>Range</td><td><code>1..=9</code></td><td>yes</td></tr>
				<tr><td>Variant</td><td><code>some(x)</code>, <code>miss</code></td><td>yes</td></tr>
				<tr><td>Guard</td><td><code>x if x &gt; 0</code></td><td>yes</td></tr>
			</tbody>
		</table>
		<p>
			Inside variant patterns the payload may itself be a tuple or binding pattern —
			<code>ok((a, b))</code>, <code>some(value)</code>.
		</p>
	</section>

	<section id="control-flow">
		<h2>Control flow</h2>
		<p>
			Every block in Ruka follows one rule, regardless of whether it belongs to a
			function, an <code>if</code>, a loop, or a <code>match</code> arm.
			<code>do expr</code> on a single line is a single-expression body closed by the
			newline. <code>do</code> followed by a newline opens a multi-statement block closed
			by <code>end</code>. The two forms are interchangeable; pick whichever reads better.
		</p>

		<h3>If / else</h3>
		<p>
			<code>if</code> is an expression. The condition is followed by <code>do</code>;
			<code>else</code> is optional and may chain with another <code>if</code>. A
			multi-statement branch uses <code>do … end</code>. The ternary form swaps the
			leading <code>do</code> with <code>if</code>:
			<code>value if condition else other</code>.
		</p>
		<CodeBlock
			code={`let sign = if n > 0 do 1 else if n < 0 do -1 else 0
let label = if score >= 60 do "pass" else "fail"
let bucket = "larger" if x >= 100 else "smaller"`}
		/>

		<h3>While</h3>
		<CodeBlock
			code={`let *i = 0
while i < 10 do
    ruka.println("\${i}")
    i = i + 1
end`}
		/>

		<h3>For</h3>
		<p>
			<code>for x in iter do … end</code> — <code>iter</code> must satisfy
			<code>ruka.iterable</code>. The loop variable is immutable within the body. The
			<code>x in</code> clause may be omitted when the body does not need the iterated value,
			useful for "do this N times".
		</p>
		<CodeBlock
			code={`for n in 0..5 do ruka.println("\${n}")
for (k, v) in pairs do ruka.println("\${k}=\${v}")

for 0..3 do ruka.println("tick")    // no binding — runs 3 times`}
		/>

		<h4>Nested for with <code>with</code></h4>
		<p>
			A common shape is "repeat a body N times, each time iterating over a collection".
			Writing this as two nested <code>for</code> loops works, but reads heavily because the
			outer loop has no useful binding. The
			<code>for outer with pattern in inner do …</code> form is sugar for that nesting:
		</p>
		<CodeBlock
			code={`for 0..epochs with (input, target) in training do
    self.fit(input, target)
end

// equivalent to:
for 0..epochs do
    for (input, target) in training do
        self.fit(input, target)
    end
end`}
		/>
		<p>
			The outer iterator never binds a name (use a plain nested
			<code>for x in … do for y in …</code> if you need the outer value).
			<code>break</code> and <code>continue</code> apply to the <em>inner</em> loop.
		</p>

		<h3 id="conditional-pattern-binding">Conditional pattern binding</h3>
		<p>
			<code>if</code>, <code>while</code>, and <code>for</code> accept a <em>refutable</em>
			pattern in place of a plain condition or binding. Each construct interprets a
			non-match differently:
		</p>
		<ul>
			<li>
				<code>if pattern = expr do …</code> — evaluates <code>expr</code>, runs the block
				(with the bindings introduced by <code>pattern</code>) only if the pattern matches.
				May chain with <code>else if</code> / <code>else</code>.
			</li>
			<li>
				<code>while pattern = expr do …</code> — re-evaluates <code>expr</code> each
				iteration; terminates the first time the pattern fails to match.
			</li>
			<li>
				<code>for pattern in iter do …</code> — silently skips elements that fail to match.
				Useful for filtering by shape.
			</li>
		</ul>
		<CodeBlock
			code={`if some(name) = lookup(id) do
    ruka.println("hello, \${name}")
else
    ruka.println("unknown")
end

while some(line) = stream.next() do
    process(line)
end

for ok(row) in rows do
    handle(row)    // err(_) elements are skipped
end`}
		/>
		<p>
			Use the form whose semantics match the intent: <code>if</code> for opportunistic
			action, <code>while</code> to drain matching values until the first non-match,
			<code>for</code> to filter as you iterate.
		</p>

		<h3>Break, continue, return</h3>
		<p>
			<code>break</code> and <code>continue</code> apply to the nearest enclosing loop.
			<code>return</code> exits the enclosing function with the given value.
		</p>

		<h3>Defer</h3>
		<p>
			<code>defer expr</code> schedules <code>expr</code> to run when the enclosing
			<code>do…end</code> block exits — by reaching the end, by <code>return</code>, or by
			<code>break</code>. Multiple <code>defer</code>s in the same block run in LIFO order.
		</p>
		<CodeBlock
			code={`let read_file = (path) do
    let f = open(path)
    defer f.close()
    // ... use f
end   // f.close() runs here`}
		/>
		<p>
			A deferred expression captures variables by reference; it observes their values at
			the moment the block exits, not at declaration.
		</p>
	</section>

	<section id="match">
		<h2>Match</h2>
		<p>
			<code>match e with</code> dispatches on a value using
			<a href="#patterns">patterns</a>. Each arm is
			<code>pattern do expression</code>. Match is an expression — every arm must produce
			a value of the same type.
		</p>
		<CodeBlock
			code={`let report = (h) do
    match h with
        critical(d) do "critical for \${d}"
        normal(d)   do "hit for \${d}"
        miss        do "missed"
    end
end`}
		/>
		<p>
			Match must be <em>exhaustive</em>: the patterns together must cover every possible
			value of the subject's type. A trailing <code>else</code> arm covers anything not
			matched explicitly.
		</p>
		<CodeBlock
			code={`match n with
    0..=9   do "small"
    10..=99 do "medium"
    else       "large"
end`}
		/>
	</section>

	<section id="functions">
		<h2>Functions</h2>
		<p>
			A function literal is <code>(params) do body end</code>. The empty parameter list is
			<code>()</code>. Body forms:
		</p>
		<ul>
			<li><strong>Single expression:</strong> <code>(x) do x + 1</code>.</li>
			<li>
				<strong>Block:</strong> <code>(x) do … end</code> — multiple statements; the value of
				the block is its last expression.
			</li>
		</ul>
		<p>Bind a function with <code>let</code> like any other value:</p>
		<CodeBlock
			code={`let inc = (x) do x + 1
let main = () do
    ruka.println("\${inc(41)}")
end`}
		/>
		<p>
			Parameter and return types are inferred from use. Annotate a parameter or return
			only when inference cannot reach the type you need, or when the annotation is
			documentation. Parameter modes follow the <a href="#modes">mode</a> rules.
		</p>
	</section>

	<section id="closures">
		<h2>Closures</h2>
		<p>
			A <em>closure</em> is a runtime function value that references runtime bindings from
			an enclosing scope. Its <em>capture set</em> is exactly those referenced bindings —
			every name the body uses that is not one of the function's parameters and not a
			top-level (compile-time) value. The compiler infers the set from the body. Functions
			defined at file scope are <em>not</em> closures: file scope is compile-time, so
			there is no runtime state to close over.
		</p>
		<p>Two rules constrain capture:</p>
		<ol>
			<li>
				<strong>Only <code>let</code> runtime bindings may be captured.</strong> A
				<code>local</code> runtime binding cannot escape its declaring function, so a
				closure that outlives that function cannot reference it.
			</li>
			<li>
				<strong><code>&amp;</code>-annotated bindings transfer ownership on capture.</strong>
				A binding declared <code>let &amp;name = …</code> <em>moves</em> into the first
				closure that captures it; the original binding is invalid afterwards. Without
				<code>&amp;</code>, capture is by reference.
			</li>
		</ol>
		<CodeBlock
			code={`let make_counter = () do
    let *n = 0
    () do
        n = n + 1
        n
    end
end

let counter = make_counter()
ruka.println("\${counter()}")   // 1
ruka.println("\${counter()}")   // 2`}
		/>
		<p>
			In the example above, the inner function captures <code>n</code> (a <code>let</code>
			binding) from <code>make_counter</code>. If <code>n</code> had been declared
			<code>local *n = 0</code>, the inner closure could not have escaped
			<code>make_counter</code> and the program would fail to compile.
		</p>
	</section>

	<section id="named-params">
		<h2>Named parameters</h2>
		<p>
			Prefixing a parameter with <code>~</code> makes it <em>named</em>. Named arguments
			are passed as <code>~label=value</code> at the call site and may appear in any order.
			Positional and named parameters can be mixed; positional arguments come first.
		</p>
		<CodeBlock
			code={`let greet = (~name, ~greeting) do
    "\${greeting}, \${name}!"
end

greet(~name="Ruka", ~greeting="Hello")
greet(~greeting="Hi", ~name="World")`}
		/>

		<h3>Label shorthand</h3>
		<p>If a local variable shares the label name, the <code>=value</code> may be omitted.</p>
		<CodeBlock
			code={`let name = "Ruka"
let greeting = "Hello"
greet(~name, ~greeting)`}
		/>

		<h3>Optional named parameters</h3>
		<p>
			A named parameter typed <code>?(T)</code> is optional. When omitted, it receives
			<code>none</code>; when given a bare value, the value is automatically wrapped in
			<code>some(...)</code>. This is the one place where annotating a named parameter is
			required — the <code>?(T)</code> annotation is what marks it optional.
		</p>
		<CodeBlock
			code={`let greet = (~name, ~title: ?(string)) do
    match title with
        some(t) do "\${t} \${name}"
        none    do name
    end
end

greet(~name="Ruka")                  // "Ruka"
greet(~name="Ruka", ~title="Dr.")    // "Dr. Ruka"`}
		/>

		<h3>Trailing block syntax</h3>
		<p>
			A single named argument may follow the closing parenthesis. This reads naturally for
			higher-order functions whose closure parameter is named and placed last.
		</p>
		<CodeBlock
			code={`let map = (~t: type, xs: [t], ~f) do ...

let doubled = map(nums) ~f=(x) do x * 2
let squared = map(nums) ~f=(x) do
    let s = x * x
    s
end`}
		/>

		<h3>Compile-time type inference from a trailing named parameter</h3>
		<p>
			When a function declares a <code>~t: type</code> named parameter and the call site
			does not pass <code>~t</code> explicitly, the compiler infers <code>t</code> from
			the <em>result location</em> — the type of the binding, parameter, or field that
			will receive the call's result. This makes generic factory functions read like
			ordinary literals at the call site.
		</p>
		<CodeBlock
			code={`let empty = (~t: type) -> [t] do [t] {}

let xs: [i32] = empty()         // ~t=i32 inferred from the binding's type
let ys: [string] = empty()      // ~t=string inferred similarly`}
		/>
		<p>
			If no result-location type is available, the compiler falls back to the usual rules
			— ambiguity is a compile error.
		</p>
	</section>

	<section id="records-variants">
		<h2>Records &amp; variants</h2>

		<h3>Records</h3>
		<p>
			A record is a fixed set of named, typed fields. Declare with
			<code>record &#123; … &#125;</code>. In a multi-line declaration the fields are
			separated by newlines; commas are only needed when fields share a single line.
			Fields prefixed with <code>local</code> are private to the declaring file.
		</p>
		<CodeBlock
			code={`let point = record {
    x: f64
    y: f64
    local cache: f64
}

let inline = record { x: f64, y: f64 }   // commas required on one line`}
		/>
		<p>
			Construct a record with <code>&#123; field = value, … &#125;</code>; the type is
			inferred from context, or written as a type-name prefix when not. Records destructure
			with the same field names — <code>&#123; a, b &#125;</code>.
		</p>
		<CodeBlock
			code={`let move = (p: point) do { x = p.x + 1.0, y = p.y, cache = p.cache }

let { x, y } = move({ x = 0.0, y = 0.0, cache = 0.0 })`}
		/>
		<p>
			A record type with <strong>no fields</strong> cannot be instantiated — there is no
			value to construct, since there are no fields to give. An empty
			<code>record &#123; &#125;</code> is reserved for use as a type-level marker (a
			declaration that exists only to attach members to). To express "no information",
			use the unit type <code>()</code>.
		</p>

		<h3>Variants</h3>
		<p>
			A variant (tagged union) names a fixed set of cases, each with an optional payload
			type. Cases are separated by newlines in a multi-line declaration; commas are only
			needed on a single line.
		</p>
		<CodeBlock
			code={`let hit = variant {
    critical: int
    normal:   int
    miss
}`}
		/>
		<p>
			Construct a variant with <code>tag</code> or <code>tag(payload)</code> (resolved
			against context, with a binding of the same name winning over a tag — see
			<a href="#literals">Variant constructors</a>) and consume it with
			<a href="#match"><code>match</code></a>.
		</p>
	</section>

	<section id="methods">
		<h2>Methods &amp; members</h2>
		<p>
			Methods and <em>members</em> are declared with the same <code>let</code> form,
			distinguished by what appears in parentheses after the name. (Members are constants
			attached to a type — what other languages call statics. Reserve "fields" for the
			runtime data of a record.)
		</p>
		<ul>
			<li>
				<code>let name (type) = …</code> — <strong>member</strong> on <code>type</code>,
				called as <code>type.name(...)</code>.
			</li>
			<li>
				<code>let name (self) = …</code> — <strong>method</strong>, called as
				<code>value.name(...)</code>.
			</li>
			<li>
				<code>let name (*self) = …</code> — <strong>mutating method</strong>.
			</li>
			<li>
				<code>let name (&amp;self) = …</code> — <strong>consuming method</strong>;
				ownership of the receiver moves into the method (the destructor-style form). The
				receiver is invalid after the call.
			</li>
		</ul>
		<CodeBlock
			code={`let counter = record {
    count: int
}

// members — accessed as counter.zero, counter.new(...)
let zero (counter) = { count = 0 }
let new  (counter) = (start) do { count = start }

// method — accessed as c.bump()
let bump (self) = () do { count = self.count + 1 }

// mutating method
let inc (*self) = () do
    self.count = self.count + 1
end`}
		/>
		<p>
			Ruka has no concept of constructors or destructors. By convention, a <em>constructor</em>
			is a function that returns a value of the type and a <em>destructor</em> is a method
			declared <code>(&amp;self)</code> that consumes the receiver, disallowing its further use.
		</p>

		<h3>Type receivers vs file-as-type</h3>
		<p>
			A type receiver (<code>let name (type) = …</code>) is most useful for
			<em>extending</em> foreign types — primitives, prelude generics, or types imported
			from another file. For first-party types, the cleanest pattern is a file-per-type:
			bind the type to <code>t</code> at the top of its file, define members and methods
			alongside it, and consumers refer to it through the imported file.
		</p>
		<CodeBlock
			code={`// Vector.ruka
let t = record {
    x: f64
    y: f64
}

let new = (x: f64, y: f64) -> t do { x, y }

let length (self) = () do ruka.sqrt(self.x * self.x + self.y * self.y)`}
		/>
		<CodeBlock
			code={`// main.ruka
local Vector = ruka.import("Vector.ruka")

let main = () do
    let v: Vector.t = Vector.new(3.0, 4.0)
    ruka.println("\${v.length()}")
end`}
		/>
		<p>
			Type receivers remain available for genuine extension — adding a method to
			<code>i32</code>, to a third-party record, or to a prelude type — where the
			file-per-type pattern is not possible.
		</p>
	</section>

	<section id="inference">
		<h2>Type inference</h2>
		<p>
			Type inference in Ruka is <em>resolution</em>, not <em>synthesis</em>. Every value's
			type must already exist somewhere in scope; inference figures out which one.
			Bidirectional flow lets a known type drive the shape of an expression, and the shape
			of an expression narrows which in-scope type matches it. Annotations are needed only
			when more than one in-scope type fits — ambiguity is always a compile error, never an
			excuse to invent an anonymous type.
		</p>

		<h3>Numeric defaults</h3>
		<p>
			An integer literal with no contextual type takes <code>int</code>; a literal
			containing <code>.</code> takes <code>float</code>. A type-annotated binding or
			parameter pulls the literal toward a more specific numeric type. Implicit widening
			between numeric types of the same family is allowed; everything else needs an
			explicit <a href="#casting">cast</a>.
		</p>

		<h3>Record literals</h3>
		<p>
			A <code>&#123; … &#125;</code> record literal first looks for an expected type from
			context — a binding annotation, a parameter type, the field type of an enclosing
			record. If context exists, that type wins and the literal is checked against it.
		</p>
		<p>
			With no context, the compiler searches the surrounding scope for record types whose
			field set matches the literal exactly. If exactly one type fits, the literal infers
			to that type. If two or more types fit, the literal is ambiguous and a type-name
			prefix or annotation is required.
		</p>
		<CodeBlock
			code={`let point = record { x: f64, y: f64 }

let p = { x = 1.0, y = 2.0 }       // ok — only point matches in scope
let q = point { x = 1.0, y = 2.0 } // explicit prefix when ambiguous`}
		/>

		<h3>Variant constructors</h3>
		<p>
			A constructor written <code>tag</code> or <code>tag(value)</code> is first resolved
			as an ordinary identifier — if a binding of that name is in scope, it wins.
			Otherwise the compiler searches in-scope variant types for a tag of that name with a
			compatible payload. If exactly one variant matches, the constructor infers to that
			type; ambiguity requires a <code>type.tag</code> prefix.
		</p>

		<h3>Record parameters</h3>
		<p>
			A parameter that is used only as a record (field access, record destructuring) but
			has no annotation is inferred structurally. The compiler collects every field the
			body reads and searches scope for record types whose declared fields are a superset
			of that set. If exactly one type fits, the parameter takes that type; otherwise the
			function is ambiguous and the parameter must be annotated.
		</p>
		<CodeBlock
			code={`let point = record { x: f64, y: f64 }

// uses .x and .y — only point has both → param inferred as point
let length = (p) do ruka.sqrt(p.x * p.x + p.y * p.y)`}
		/>

		<h3>Variant parameters</h3>
		<p>
			The same rule applies to a parameter used only by <code>match</code>: the compiler
			collects the tags the arms require, and if exactly one variant in scope declares
			those tags (with compatible payload arities), the parameter infers to that variant.
		</p>

		<h3>Method receivers</h3>
		<p>
			On a method declared <code>let name (self) = …</code>, the receiver type is inferred
			by the same record-or-variant structural rule against the body's field accesses,
			mutations, and pattern arms.
		</p>

		<h3>Return types</h3>
		<p>
			A function's return type is inferred from its body. Recursive functions and mutually
			recursive groups infer through their call graph; an annotation is only needed to
			break a cycle the checker cannot resolve.
		</p>

		<h3>Behaviours never infer</h3>
		<p>
			A behaviour-typed parameter is <strong>never</strong> inferred. The behaviour must
			be written explicitly as the parameter annotation. This is what distinguishes a
			structurally-inferred record parameter (concrete type, monomorphic) from a behaviour
			parameter (polymorphic over every type that satisfies the behaviour, monomorphised
			per call site).
		</p>
		<CodeBlock
			code={`let area = (s) do s.area()             // inferred to a single concrete type
let area = (s: shape) do s.area()      // polymorphic over shape`}
		/>
	</section>

	<section id="behaviours">
		<h2>Behaviours</h2>
		<p>
			A behaviour declares a set of method signatures. Any type whose methods cover those
			signatures <em>satisfies</em> the behaviour — no <code>implements</code> declaration
			is required. Like records and variants, signatures are separated by newlines in a
			multi-line declaration; commas are only needed on a single line.
		</p>
		<CodeBlock
			code={`let shape = behaviour {
    area(self):      () -> f64
    perimeter(self): () -> f64
}`}
		/>

		<h3>Using a behaviour</h3>
		<p>
			A behaviour may appear as a parameter type. Each call site monomorphises against the
			concrete argument type — this is static dispatch, not virtual.
		</p>
		<CodeBlock
			code={`let describe = (s: shape) do
    ruka.println("area: \${s.area()}")
end`}
		/>
		<p>
			Behaviour types may only appear in parameter position. Using one as a return type,
			field type, or binding type is a compile error — behaviours describe behaviour, not
			storage.
		</p>

		<h3>Builtin behaviours</h3>
		<p>The compiler recognises four families of behaviours specially.</p>

		<h4><code>ruka.printable</code></h4>
		<p>
			A type satisfying <code>printable</code> may appear inside
			<code>&#36;&#123;…&#125;</code> string interpolation and may be passed to
			<code>ruka.print</code> / <code>ruka.println</code>.
		</p>
		<CodeBlock
			code={`let printable = behaviour {
    format(self): () -> string
}

let format (self) = () do "(\${self.x}, \${self.y})"   // makes point printable`}
		/>

		<h4><code>ruka.iterable</code></h4>
		<p>
			A type satisfying <code>iterable</code> may be used in a <code>for</code> loop. The
			compiler calls <code>next</code> per iteration; <code>none</code> ends the loop.
		</p>
		<CodeBlock
			code={`let iterable = behaviour {
    next(*self): () -> ?(T)
}`}
		/>

		<h4 id="rukacast"><code>ruka.cast</code></h4>
		<p>
			A type satisfying <code>cast</code> is the source type of
			<code>value as Target</code>. The behaviour declares which target types are reachable
			from the source; the operator dispatches to the matching overload at compile time.
		</p>
		<CodeBlock
			code={`let cast = behaviour {
    cast(self): (~t: type) -> t
}`}
		/>

		<h4>Operator behaviours</h4>
		<p>
			Methods with names like <code>UNDECIDED</code> are recognised
			as operator implementations. Defining one of these enables the corresponding operator
			on the type.
		</p>
	</section>

	<section id="comprehensions">
		<h2>Comprehensions</h2>
		<p>
			A comprehension builds a collection from an iterator. Two forms are recognised —
			they share the same outer brace shape used by every braced literal, and disambiguate
			by what their body expression looks like.
		</p>
		<p><strong>Array comprehension</strong> — body is a single expression:</p>
		<CodeBlock
			code={`let squares = { x * x for x in 0..10 }
let evens   = { x for x in 0..100 if x % 2 == 0 }
let pairs   = { (k, v) for (k, v) in scores if v >= 90 }`}
		/>
		<p><strong>Map comprehension</strong> — body is a <code>key =&gt; value</code> pair:</p>
		<CodeBlock
			code={`let lookup  = { name => id for (name, id) in roster }
let squares = { n => n * n for n in 1..=10 }
let passing = { name => score for (name, score) in scores if score >= 60 }`}
		/>
		<p>
			The pattern follows the same rules as a <code>for</code> loop pattern — refutable
			patterns silently skip non-matching elements, so
			<code>&#123; x for some(x) in maybes &#125;</code> extracts the values of every
			<code>some</code> element.
		</p>
		<p>
			The element type is inferred from the body expression and may be pinned by a type
			prefix or surrounding annotation:
			<code>[u32] &#123; f(x) for x in src &#125;</code>,
			<code>[string =&gt; i32] &#123; k =&gt; f(k) for k in keys &#125;</code>.
		</p>
	</section>

	<section id="files">
		<h2>Files &amp; imports</h2>
		<p>
			A Ruka file <em>is</em> a record — a record type whose only constituents are members
			(constants attached at compile time), with no runtime fields. Every top-level
			<code>let</code> declaration becomes a member of that record; <code>local</code>
			declarations are members the file uses internally but does not export. There is no
			separate "module" concept.
		</p>
		<p>
			<code>ruka.import("path")</code> evaluates at compile time and returns the imported
			file as that record value. Access members through it, or destructure to bring names
			into scope.
		</p>
		<CodeBlock
			code={`let Math = ruka.import("Math.ruka")
let r = Math.sqrt(2.0)

// destructuring import
let { sqrt, pow } = ruka.import("Math.ruka")`}
		/>
		<p>
			Because the result is compile-time known, an imported type may be passed to a
			<code>type</code>-typed parameter directly:
		</p>
		<CodeBlock
			code={`let Animals = ruka.import("Animals.ruka")
let describe = (t: type) do ruka.println("\${t}")
describe(Animals.dog)`}
		/>
	</section>

	<section id="bouquets">
		<h2>Bouquets</h2>
		<p>
			A <em>bouquet</em> is Ruka's package unit. Bouquets are created and managed through
			the <code>ruka</code> CLI:
		</p>
		<pre><code>ruka bouquet new my-package</code></pre>
		<p>
			Every bouquet has an <em>index</em> file conventionally called
			<code>petal.ruka</code>. The index file is the entry point: it is what
			<code>ruka.import("bouquet-name")</code> returns. Library-only bouquets place their
			petal at <code>src/petal.ruka</code> to keep the project root uncluttered; binary
			bouquets typically place it at the root and accompany it with an executable entry.
		</p>
		<p>
			A bouquet may import other bouquets; the resolver looks them up by name against the
			project's manifest and returns each one's petal as a record.
		</p>
	</section>

	<section id="tests">
		<h2>Tests</h2>
		<p>
			A <code>test</code> binding declares a zero-argument function that runs as part of
			the test suite. Tests are compiled in <em>debug</em> and <em>test</em> builds and
			elided entirely in <em>release</em> — assertions inside a <code>test</code> have no
			runtime cost in production.
		</p>
		<CodeBlock
			code={`let add = (a, b) do a + b

test addition = () do
    ruka.expect_eq(add(1, 2), 3)
    ruka.expect_eq(add(0, 0), 0)
end`}
		/>
		<p>
			Tests live in their declaring file's scope and can therefore call <code>local</code>
			declarations directly. There is no separate test-visibility mechanism.
		</p>
	</section>

	<section id="comptime">
		<h2>Compile-time evaluation</h2>
		<p>
			Ruka has a compile-time interpreter. Functions with <code>@</code>-prefixed
			parameters run at compile time; their results are compile-time constants. Types,
			functions, and records-of-members are first-class values in compile-time contexts.
		</p>
		<p>
			<strong>Type values are compile-time only.</strong> Any code that <em>creates</em>,
			<em>inspects</em>, or <em>passes around</em> a <code>type</code> value must run at
			compile time. There is no runtime reflection — <code>ruka.type_of</code>,
			<code>ruka.fields_of</code>, <code>ruka.record_of</code>, and friends are all
			compile-time. A binding of type <code>type</code> is, by definition, compile-time.
		</p>

		<h3>Inferring <code>@</code> from <code>type</code></h3>
		<p>
			A parameter typed <code>type</code> infers the <code>@</code> prefix automatically.
			A parameter used to annotate another parameter infers both.
		</p>
		<CodeBlock
			code={`// all three forms are equivalent
let min = (@t: type, a: t, b: t) do if a < b do a else b
let min = (t: type,  a: t, b: t) do if a < b do a else b
let min = (t,        a: t, b: t) do if a < b do a else b`}
		/>

		<h3>Generics</h3>
		<p>
			Each unique compile-time argument set produces a distinct specialisation, much like
			monomorphisation in Rust or <code>comptime</code> in Zig.
		</p>
		<CodeBlock
			code={`let x = min(i32, 3, 7)      // i32 instantiation
let y = min(f64, 1.5, 2.0)  // f64 instantiation`}
		/>

		<h3>Generating types</h3>
		<p>
			A compile-time function may return a type. Non-<code>type</code> parameters that
			must be compile-time still need an explicit <code>@</code>.
		</p>
		<CodeBlock
			code={`let fixed_array = (t, @cap: uint) do
    record {
        data: [t]
        len:  uint
    }
end

let int_buf   = fixed_array(i32, 64)
let float_buf = fixed_array(f64, 16)`}
		/>

		<h3>Storing compile-time results</h3>
		<p>
			At file scope, <code>let</code> already evaluates its right-hand side at compile
			time, so no prefix is needed. Inside a function body, prefix the binding with
			<code>@</code> to force compile-time storage.
		</p>
		<CodeBlock
			code={`let sqrt_2 = ruka.sqrt(2.0)    // top level — comptime by default

let run = () do
    let @table = build_lookup_table(256)   // forced to comptime
    let rows   = fetch_rows()              // runtime
end`}
		/>

		<h3>Reflection</h3>
		<p>
			<code>ruka.type_of(e)</code> returns the type of <code>e</code> as a compile-time
			value. <code>ruka.fields_of</code>, <code>ruka.methods_of</code>, and
			<code>ruka.members_of</code> return the structural pieces of a type.
			<code>ruka.record_of(fields)</code> constructs a new record type from a list of
			field descriptors. All four take <code>@</code>-prefixed type arguments and run at
			compile time — there is no runtime reflection.
		</p>
		<CodeBlock
			code={`// derive: produce an option-of-every-field version of any record
let partial = (t) do
    let fs = ruka.fields_of(t)
        |> map((f) do { name = f.name, type = ?(f.type) })
    ruka.record_of(fs)
end

let user = record {
    id: i32
    name: string
}
let partial_user = partial(user)
// partial_user ≡ record { id: ?(i32), name: ?(string) }`}
		/>
	</section>

	<section id="ruka-module">
		<h2>The <code>ruka</code> module</h2>
		<p>
			<code>ruka</code> is the prelude — always in scope, never imported. The members below
			are referenced throughout this document.
		</p>

		<h3>I/O</h3>
		<table>
			<thead><tr><th>Member</th><th>Purpose</th></tr></thead>
			<tbody>
				<tr><td><code>print(printable)</code></td><td>Write an argument implementing <code>ruka.printable</code> to stdout, no newline.</td></tr>
				<tr><td><code>println(printable)</code></td><td>Like <code>print</code>, appends a newline.</td></tr>
				<tr><td><code>readln()</code></td><td>Read a single line of input from stdin and return it as a <code>string</code>.</td></tr>
				<tr><td><code>read()</code></td><td>Like <code>readln()</code> but continues until user terminates with a ctrl-d.</td></tr>
			</tbody>
		</table>

		<h3>Behaviours</h3>
		<table>
			<tbody>
				<tr><td><code>printable</code> driving string interpolation.</td></tr>
				<tr><td><code>iterable</code> driving for loops.</td></tr>
				<tr><td><code>cast</code> driving the <a href="#casting"><code>as</code> operator</a>.</td></tr>
				<tr><td>There are also behaviours driving mathematical, indexing, and bitwise operators.</td></tr>
			</tbody>
		</table>

		<h3>Math</h3>
		<p>
			<code>abs</code>, <code>sqrt</code>, <code>pow</code>, <code>exp</code>,
			<code>floor</code>, <code>ceil</code>, <code>min</code>, <code>max</code>,
			<code>sin</code>, <code>cos</code>, <code>tan</code>, <code>random</code>.
		</p>

		<h3>Testing</h3>
		<p><code>expect_eq(a, b)</code> returns an <code>!((), string)</code>.</p>

		<h3>File import</h3>
		<p><code>import("path")</code> — see <a href="#files">Files &amp; imports</a>.</p>

		<h3>Compile-time</h3>
		<p>
			<code>type_of</code>, <code>fields_of</code>, <code>methods_of</code>,
			<code>members_of</code>, <code>record_of</code>, <code>compile_error(msg)</code>. See
			<a href="#comptime">Compile-time evaluation</a>.
		</p>
	</section>
</DocsShell>

<style>
	table {
		border-collapse: collapse;
		width: 100%;
		margin: 16px 0;
		font-size: var(--fs-sm);
	}

	th,
	td {
		text-align: left;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}

	th {
		font-weight: 600;
		color: var(--fg-muted);
		font-size: var(--fs-xs);
		text-transform: uppercase;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	h4 {
		font-size: var(--fs-sm);
		font-weight: 600;
		margin-top: 20px;
		margin-bottom: 8px;
	}

	ul,
	ol {
		margin: 0 0 16px 24px;
		color: var(--fg);
		max-width: 70ch;
	}

	li + li {
		margin-top: 4px;
	}
</style>
