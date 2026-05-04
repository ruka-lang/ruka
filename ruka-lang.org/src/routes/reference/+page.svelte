<script lang="ts">
	import DocsShell, { type TocSection } from "$lib/components/DocsShell.svelte";
	import CodeBlock from "$lib/components/ui/codeBlock.svelte";

	const sections: TocSection[] = [
		{ id: "comments", title: "Comments" },
		{ id: "identifiers", title: "Identifiers & privacy" },
		{ id: "bindings", title: "Bindings" },
		{ id: "modes", title: "Modes" },
		{ id: "literals", title: "Literals" },
		{ id: "builtin-types", title: "Built-in types" },
		{ id: "operators", title: "Operators" },
		{ id: "patterns", title: "Patterns" },
		{ id: "control-flow", title: "Control flow" },
		{ id: "match", title: "Match" },
		{ id: "functions", title: "Functions" },
		{ id: "named-params", title: "Named parameters" },
		{ id: "records-variants", title: "Records & variants" },
		{ id: "methods", title: "Methods & statics" },
		{ id: "inference", title: "Type inference" },
		{ id: "behaviours", title: "Behaviours" },
		{ id: "modules", title: "Modules & imports" },
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
		<h2>Identifiers &amp; privacy</h2>
		<p>
			Identifiers are letters, digits, and underscores; they cannot start with a digit.
			Visibility is encoded in the first letter:
		</p>
		<ul>
			<li>
				<strong>lowercase first letter</strong> — exported from the module (public).
			</li>
			<li><strong>uppercase first letter</strong> — module-private.</li>
		</ul>
		<p>
			There is no separate <code>pub</code> keyword. Renaming a binding to change its case changes
			its visibility.
		</p>
		<CodeBlock
			code={`let greet = () do ruka.println("hi")    // exported
let Helper = () do ruka.println("...")  // private`}
		/>
	</section>

	<section id="bindings">
		<h2>Bindings</h2>
		<p>
			A <code>let</code> binding introduces a name. The type is inferred from the right-hand
			side; an explicit annotation is only needed when inference cannot reach the type you want.
			Binding can be shadowed by reusing the same name.
		</p>
		<CodeBlock
			code={`let answer = 42
let pi     = 3.14159
let name   = "Ruka"
let count: u32 = 0   // annotation pins the integer type`}
		/>
		<p>
			Bindings are immutable by default. To make a binding mutable, or to change how it is
			stored or evaluated, use a <em>mode prefix</em>
			directly before the name (no space). See <a href="#modes">Modes</a>.
		</p>
		<CodeBlock
			code={`let *count = 0    // mutable
count = count + 1`}
		/>
		<h3>Destructuring</h3>
		<p>
			A <code>let</code> binding may take any irrefutable
			<a href="#patterns">pattern</a> on the left-hand side. Destructuring patterns never
			include a type prefix or leading
			<code>.</code> — those forms belong to <em>literals</em>, not patterns.
		</p>
		<CodeBlock
			code={`let (x, y) = .(1, 2)     // tuple pattern; .(...) is the tuple literal
let {x, y} = origin      // record pattern; identifiers must match record members`}
		/>
		<h3>File scope is declarative</h3>
		<p>
			A Ruka file's top level holds declarations only — <code>let</code>
			bindings, type definitions, methods, statics, behaviours, tests. There are no executable
			statements at file scope. Every top-level right-hand side is therefore evaluated at compile
			time.
		</p>
	</section>

	<section id="modes">
		<h2>Modes</h2>
		<p>
			Mode prefixes adjust how a binding or parameter is stored, captured, or evaluated.
			The same four prefixes apply in both positions.
		</p>
		<table>
			<thead><tr><th>Prefix</th><th>Meaning</th></tr></thead>
			<tbody>
				<tr
					><td><code>*</code></td><td
						>Mutable. Bindings may be reassigned; parameters mutate in place and the
						change is visible to the caller.</td
					></tr
				>
				<tr
					><td><code>&amp;</code></td><td
						>Move. Ownership transfers — only into a closure on capture (annotated on
						bindings), variables pulled into the function on call (annotated on
						parameters). The original is invalid afterwards.</td
					></tr
				>
				<tr
					><td><code>$</code></td><td
						>Stack-allocated. Not GC-managed; passed by pointer or copy. Movable as a
						compile error only.</td
					></tr
				>
				<tr
					><td><code>@</code></td><td
						>Compile-time. The value must be known at compile time. See <a
							href="#comptime">Compile-time evaluation</a
						>.</td
					></tr
				>
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
			methods/statics, compile-time evaluation is the default; inside function bodies it
			is inferred whenever a parameter's type is <code>type</code>.
		</p>
	</section>

	<section id="literals">
		<h2>Literals</h2>

		<h3>Numbers</h3>
		<p>
			Integer literals default to <code>int</code>; literals containing a
			<code>.</code> default to <code>float</code>. The literal text is preserved —
			<code>2</code>
			and <code>2.0</code> are different literals. An explicit annotation pins a more specific
			type.
		</p>
		<CodeBlock
			code={`let a = 42
let b = 0.5
let c: u8 = 255   // annotated when a smaller integer type is needed`}
		/>

		<h3>Characters</h3>
		<p>
			A character literal is a single byte wrapped in single quotes; it has type <code
				>u8</code
			>. There is no separate <code>char</code>
			type. Escapes: <code>\n</code>, <code>\t</code>, <code>\r</code>,
			<code>\\</code>, <code>\'</code>, <code>\"</code>, <code>\0</code>.
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
			<code>|"</code>
			on its own line. Interior lines begin with <code>|</code>; one optional space after
			the bar is stripped. Interpolation works the same as in single-line strings.
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
			Both literals begin with <code>.</code>, mirroring the leading <code>.</code> of record
			and variant literals — the dot is what tells the parser this is a value being constructed,
			not a destructuring pattern.
		</p>
		<CodeBlock
			code={`let pair = .(1, "one")     // tuple, inferred [int, string]
let xs   = .{1, 2, 3}     // array,  inferred [int]
let prefixed = [u8].{0, 1, 2}   // type prefix initializes the enforces element type
let typed: [u8] = .{0, 1, 2}   // can also use annotation to pin the element type`}
		/>

		<h3>Records</h3>
		<p>
			A record literal is written as <code>.&#123;...&#125;</code> and the record type is
			inferred from context. Prefix the literal with a type name only when no context is
			available to drive inference. See
			<a href="#records-variants">Records &amp; variants</a> for declaration syntax.
		</p>
		<CodeBlock
			code={`let Point = record {
    x: f64
    y: f64
}

let make = (p: Point) do p
let p = make(.{ x = 1.0, y = 2.0 })   // inferred from parameter type
let q = Point.{ x = 1.0, y = 2.0 }    // explicit when there is no context`}
		/>

		<h3>Variant constructors</h3>
		<p>
			A variant value is written <code>.tag</code> for a payloadless case or
			<code>.tag(value)</code> with a payload. The variant type is inferred from context.
		</p>
		<CodeBlock
			code={`let report = (h: Hit) do
    match h with
        critical(d) do ...
        miss        do ...
    end
end

report(.critical(20))    // tag is resolved against Hit
report(.miss)`}
		/>

		<h3>Option &amp; result</h3>
		<p>
			Option and result are ordinary variants in the prelude with shorthand type syntax: <code
				>?(T)</code
			>
			for option,
			<code>!(T, E)</code> for result. Constructors are
			<code>.some(v)</code> / <code>.none</code> and <code>.ok(v)</code> /
			<code>.err(e)</code>.
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
				<tr
					><td>Signed integers</td><td
						><code>i8 i16 i32 i64</code>, <code>int</code> (target word size)</td
					></tr
				>
				<tr
					><td>Unsigned integers</td><td
						><code>u8 u16 u32 u64</code>, <code>uint</code></td
					></tr
				>
				<tr
					><td>Floats</td><td
						><code>f32 f64</code>, <code>float</code> (target word size)</td
					></tr
				>
				<tr
					><td>Other primitives</td><td
						><code>bool</code>, <code>string</code>, <code>()</code> (unit)</td
					></tr
				>
				<tr
					><td>Collections</td><td
						><code>[T]</code> (array), <code>[T, U, …]</code> (tuple), <code>[T..]</code> (range)</td
					></tr
				>
				<tr
					><td>Generic prelude</td><td
						><code>?(T)</code> (option), <code>!(T, E)</code> (result)</td
					></tr
				>
				<tr><td>Compile-time</td><td><code>type</code> (the type of types)</td></tr>
			</tbody>
		</table>
		<h3>Type annotations</h3>
		<p>
			A type appears after <code>:</code> on a binding or parameter, and after
			<code>-&gt;</code> on a function return.
		</p>
		<CodeBlock
			code={`let count: u32 = 0
let pair: [int, string] = .(1, "one")
let lookup = (key: string) -> ?(int) do ...`}
		/>
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
				<tr
					><td>Comparison</td><td
						><code>&lt;</code> <code>&lt;=</code> <code>&gt;</code> <code>&gt;=</code></td
					></tr
				>
				<tr><td>Range</td><td><code>..</code> <code>..=</code></td></tr>
				<tr
					><td>Bitwise</td><td
						><code>|</code> <code>^</code> <code>&amp;</code> <code>&lt;&lt;</code>
						<code>&gt;&gt;</code></td
					></tr
				>
				<tr><td>Additive</td><td><code>+</code> <code>-</code></td></tr>
				<tr
					><td>Multiplicative</td><td><code>*</code> <code>/</code> <code>%</code></td
					></tr
				>
				<tr><td>Exponent</td><td><code>**</code> (right-assoc)</td></tr>
				<tr><td>Unary</td><td><code>not</code> <code>-</code></td></tr>
				<tr
					><td>Postfix</td><td
						>call <code>f(x)</code>, member <code>x.f</code>, index <code>x[i]</code></td
					></tr
				>
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
			<code>add</code>
			makes
			<code>+</code> available for the type.
		</p>
	</section>

	<section id="patterns">
		<h2>Patterns</h2>
		<p>
			Patterns appear in <code>let</code> destructuring, <code>match</code> arms, and
			<code>for</code>
			loop binders. Patterns may be <em>refutable</em>
			(may not match) or <em>irrefutable</em> (always match) — only irrefutable patterns
			are allowed in <code>let</code> and
			<code>for</code>.
		</p>
		<p>
			Destructuring patterns are bare: tuple patterns are
			<code>(a, b)</code> and record patterns are
			<code>&#123; a, b &#125;</code>. The leading <code>.</code> is reserved for value literals.
		</p>
		<table>
			<thead><tr><th>Form</th><th>Example</th><th>Refutable?</th></tr></thead>
			<tbody>
				<tr><td>Identifier</td><td><code>x</code></td><td>no</td></tr>
				<tr><td>Tuple</td><td><code>(a, b)</code></td><td>no (when arity matches)</td></tr
				>
				<tr><td>Record</td><td><code>&#123; x, y &#125;</code></td><td>no</td></tr>
				<tr><td>Literal</td><td><code>0</code>, <code>"yes"</code></td><td>yes</td></tr>
				<tr><td>Range</td><td><code>1..=9</code></td><td>yes</td></tr>
				<tr
					><td>Variant</td><td><code>some(x)</code>, <code>miss</code></td><td>yes</td
					></tr
				>
				<tr><td>Guard</td><td><code>x if x &gt; 0</code></td><td>yes</td></tr>
			</tbody>
		</table>
		<p>
			Inside variant patterns the payload may itself be a tuple or binding pattern — <code
				>ok((a, b))</code
			>, <code>some(value)</code>.
		</p>
	</section>

	<section id="control-flow">
		<h2>Control flow</h2>
		<p>
			Every block in Ruka follows one rule, regardless of whether it belongs to a
			function, an <code>if</code>, a loop, or a
			<code>match</code> arm. <code>do expr</code> on a single line is a single-expression
			body closed by the newline. <code>do</code>
			followed by a newline opens a multi-statement block closed by
			<code>end</code>. The two forms are interchangeable; pick whichever reads better.
		</p>

		<h3>If / else</h3>
		<p>
			<code>if</code> is an expression. The condition is followed by
			<code>do</code>; <code>else</code> is optional and may chain with another
			<code>if</code>. A multi-statement branch uses
			<code>do … end</code>, or <code>do … else …</code> when the
			<code>else</code> closes the branch. The ternary form swaps the leading
			<code>do</code>
			with
			<code>if</code>:
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
			<code>ruka.iterable</code>. The loop variable is immutable within the body.
		</p>
		<CodeBlock
			code={`for n in 0..5 do ruka.println("\${n}")
for (k, v) in pairs do ruka.println("\${k}=\${v}")`}
		/>

		<h3>Break, continue, return</h3>
		<p>
			<code>break</code> and <code>continue</code> apply to the nearest enclosing loop.
			<code>return</code> exits the enclosing function with the given value.
		</p>

		<h3>Defer</h3>
		<p>
			<code>defer expr</code> schedules <code>expr</code> to run when the enclosing
			<code>do…end</code>
			block exits — by reaching the end, by
			<code>return</code>, or by <code>break</code>. Multiple
			<code>defer</code>s in the same block run in LIFO order.
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
			value of the subject's type. A trailing
			<code>else</code> arm covers anything not matched explicitly. A multi-statement
			<code>else</code>
			branch uses <code>do … end</code>
			like any other branch.
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
		<h3>Closures</h3>
		<p>
			Function literals capture their lexical environment. A binding declared with <code
				>&amp;</code
			> moves into the closure rather than being captured by reference.
		</p>
	</section>

	<section id="named-params">
		<h2>Named parameters</h2>
		<p>
			Prefixing a parameter with <code>~</code> makes it
			<em>named</em>. Named arguments are passed as
			<code>~label=value</code> at the call site and may appear in any order. Positional and
			named parameters can be mixed; positional arguments come first.
		</p>
		<CodeBlock
			code={`let greet = (~name, ~greeting) do
    "\${greeting}, \${name}!"
end

greet(~name="Ruka", ~greeting="Hello")
greet(~greeting="Hi", ~name="World")`}
		/>

		<h3>Label shorthand</h3>
		<p>
			If a local variable shares the label name, the
			<code>=value</code> may be omitted.
		</p>
		<CodeBlock
			code={`let name = "Ruka"
let greeting = "Hello"
greet(~name, ~greeting)`}
		/>

		<h3>Optional named parameters</h3>
		<p>
			A named parameter typed <code>?(T)</code> is optional. When omitted, it receives
			<code>.none</code>; when given a bare value, the value is automatically wrapped in
			<code>.some(...)</code>. This is the one place where annotating a named parameter is
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
			code={`let map = (t, xs: [t], ~f) do ...

let doubled = map(nums) ~f=(x) do x * 2
let squared = map(nums) ~f=(x) do
    let s = x * x
    s
end`}
		/>
	</section>

	<section id="records-variants">
		<h2>Records &amp; variants</h2>

		<h3>Records</h3>
		<p>
			A record is a fixed set of named, typed fields. Declare with
			<code>record &#123; … &#125;</code>. In a multi-line declaration the fields are
			separated by newlines; commas are only needed when fields share a single line.
		</p>
		<CodeBlock
			code={`let Point = record {
    x: f64
    y: f64
}

let Inline = record { x: f64, y: f64 }   // commas required on one line`}
		/>
		<p>
			Construct a record with <code>.&#123;...&#125;</code>; the type is inferred from
			context. Records destructure with the same field names — <strong>without</strong> a
			leading
			<code>.</code> or type prefix, since destructuring is a pattern, not a literal.
		</p>
		<CodeBlock
			code={`let move = (p: Point) do .{ x = p.x + 1.0, y = p.y }

let { x, y } = move(.{ x = 0.0, y = 0.0 })`}
		/>

		<h3>Variants</h3>
		<p>
			A variant (tagged union) names a fixed set of cases, each with an optional payload
			type. Cases are separated by newlines in a multi-line declaration; commas are only
			needed on a single line.
		</p>
		<CodeBlock
			code={`let Hit = variant {
    critical: int
    normal:   int
    miss
}`}
		/>
		<p>
			Construct a variant with <code>.tag</code> or <code>.tag(payload)</code>
			and consume it with <a href="#match"><code>match</code></a>. The tag is resolved
			against the variant type that flows in from context.
		</p>
	</section>

	<section id="methods">
		<h2>Methods &amp; statics</h2>
		<p>
			Methods and statics are declared with the same <code>let</code>
			form, distinguished by what appears in parentheses after the name:
		</p>
		<ul>
			<li>
				<code>let name (Type) = …</code> — <strong>static</strong> on <code>Type</code>,
				called as
				<code>Type.name(...)</code>.
			</li>
			<li>
				<code>let name (self) = …</code> — <strong>method</strong>, called as
				<code>value.name(...)</code>.
			</li>
			<li>
				<code>let name (*self) = …</code> — <strong>mutating method</strong>; the receiver
				follows the <code>*</code> mode rules.
			</li>
		</ul>
		<CodeBlock
			code={`let counter = record {
    count: int
}

// statics — accessed as counter.zero, counter.new(...)
let zero (counter) = .{ count = 0 }
let new  (counter) = (start) do .{ count = start }

// method — accessed as c.bump()
let bump (self) = () do .{ count = self.count + 1 }

// mutating method
let inc (*self) = () do
    self.count = self.count + 1
end`}
		/>
		<p>
			Ruka has no concept of constructors or destructors. By convention, a <em>constructor</em> is a 
			function that returns a value of the type and a <em>destructor</em>
			is a method that takes moves the receivers ownership into the method disallowing it's further use.
		</p>
		<h3>Extending types</h3>
		<p>
			An imported may be extended with additional methods and statics but they cannot access locals and shadowing is disallowed (at least implicitly).
		</p>
	</section>

	<section id="inference">
		<h2>Type inference</h2>
		<p>
			Bidirectional inference flows in two directions: a known type can drive the shape of
			an expression (the <em>checking</em>
			direction), and the shape of an expression can determine its type (the
			<em>synthesis</em> direction). Annotations are needed only when neither direction reaches
			a unique answer.
		</p>

		<h3>Numeric defaults</h3>
		<p>
			An integer literal with no contextual type takes <code>int</code>; a literal
			containing
			<code>.</code>
			takes <code>float</code>. A type-annotated binding or parameter pulls the literal
			toward a more specific numeric type.
		</p>

		<h3>Record literals</h3>
		<p>
			A <code>.&#123;...&#125;</code> record literal first looks for an expected type from context
			— a binding annotation, a parameter type, the field type of an enclosing record. If context
			exists, that type wins and the literal is checked against it.
		</p>
		<p>
			With no context, the compiler searches the surrounding scope for record types whose
			field set matches the literal exactly. If exactly one type fits, the literal infers
			to that type. If two or more types fit, the literal is ambiguous and an annotation
			or type prefix is required.
		</p>
		<CodeBlock
			code={`let Point = record { x: f64, y: f64 }

let p = .{ x = 1.0, y = 2.0 }   // ok — only Point matches in scope
let q = Point.{ x = 1.0, y = 2.0 }   // explicit prefix when ambiguous`}
		/>

		<h3>Variant constructors</h3>
		<p>
			A constructor written <code>.tag</code> or <code>.tag(value)</code>
			is resolved against the expected type from context. With no context, the compiler searches
			scope for variant types that declare the tag with a compatible payload. If exactly one
			matches, the constructor infers to that type.
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
			code={`let Point = record { x: f64, y: f64 }

// uses .x and .y — only Point has both → param inferred as Point
let length = (p) do ruka.sqrt(p.x * p.x + p.y * p.y)`}
		/>

		<h3>Variant parameters</h3>
		<p>
			The same rule applies to a parameter used only by
			<code>match</code>: the compiler collects the tags the arms require, and if exactly
			one variant in scope declares those tags (with compatible payload arities), the
			parameter infers to that variant.
		</p>

		<h3>Method receivers</h3>
		<p>
			On a method declared <code>let name (self) = …</code>, the receiver type is inferred
			by the same record-or-variant structural rule against the bodies field accesses,
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
			A behaviour-typed parameter is <strong>never</strong> inferred. The behaviour must be
			written explicitly as the parameter annotation. This is what distinguishes a structurally-inferred
			record parameter (concrete type, monomorphic) from a behaviour parameter (polymorphic
			over every type that satisfies the behaviour, monomorphised per call site).
		</p>
		<CodeBlock
			code={`let area = (s) do s.area()             // inferred to a single concrete type
let area = (s: Shape) do s.area()      // polymorphic over Shape`}
		/>
	</section>

	<section id="behaviours">
		<h2>Behaviours</h2>
		<p>
			A behaviour declares a set of method signatures. Any type whose methods cover those
			signatures <em>satisfies</em>
			the behaviour — no <code>implements</code> declaration is required. Like records and variants,
			signatures are separated by newlines in a multi-line declaration; commas are only needed
			on a single line.
		</p>
		<CodeBlock
			code={`let Shape = behaviour {
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
			code={`let describe = (s: Shape) do
    ruka.println("area: \${s.area()}")
end`}
		/>
		<p>
			Behaviour types may only appear in parameter position. Using one as a return type,
			field type, or binding type is a compile error — behaviours describe behaviour, not
			storage.
		</p>

		<h3>Builtin behaviours</h3>
		<p>The compiler recognises three families of behaviours specially.</p>

		<h4><code>ruka.printable</code></h4>
		<p>
			A type satisfying <code>printable</code> may appear inside
			<code>&#36;&#123;…&#125;</code> string interpolation and may be passed to
			<code>ruka.print</code>
			/ <code>ruka.println</code>.
		</p>
		<CodeBlock
			code={`let printable = behaviour {
    format(self): () -> string
}

let format (self) = () do "(\${self.x}, \${self.y})"   // makes Point printable`}
		/>

		<h4><code>ruka.iterable</code></h4>
		<p>
			A type satisfying <code>iterable</code> may be used in a
			<code>for</code> loop. The compiler calls <code>next</code> per iteration;
			<code>.none</code> ends the loop.
		</p>
		<CodeBlock
			code={`let iterable = behaviour {
    next(*self): () -> ?(T)
}`}
		/>

		<h4>Operator behaviours</h4>
		<p>
			Methods with names like <code>add</code>, <code>sub</code>,
			<code>mul</code>, <code>div</code>, <code>eq</code>,
			<code>lt</code>, <code>index</code> are recognised as operator implementations. Defining
			one of these enables the corresponding operator on the type.
		</p>
	</section>

	<section id="modules">
		<h2>Modules &amp; imports</h2>
		<p>
			A Ruka file <em>is</em> a module — its top-level declarations are the module's fields.
			Lowercase-named declarations are exported; uppercase-named declarations are private.
		</p>
		<p>
			<code>ruka.import("path")</code> evaluates at compile time and returns the imported file
			as a record value. Access fields, or destructure to bring names into scope.
		</p>
		<CodeBlock
			code={`let math = ruka.import("math")
let r = math.sqrt(2.0)

// destructuring import — bare record pattern, no leading dot
let { sqrt, pow } = ruka.import("math")
let { Dog, Cat } = ruka.import("animals")`}
		/>
		<p>
			Because the result is compile-time known, an imported type may be passed to a <code
				>type</code
			>-typed parameter directly:
		</p>
		<CodeBlock
			code={`let describe = (t: type) do ruka.println("\${t}")
describe(animals.Dog)`}
		/>
	</section>

	<section id="tests">
		<h2>Tests</h2>
		<p>
			A <code>test</code> binding declares a zero-argument function that runs as part of
			the test suite. Tests are compiled in
			<em>debug</em> and <em>test</em> builds and elided entirely in
			<em>release</em> — assertions inside a <code>test</code> have no runtime cost in production.
		</p>
		<CodeBlock
			code={`let add = (a, b) do a + b

test addition = () do
    ruka.expect_eq(add(1, 2), 3)
    ruka.expect_eq(add(0, 0), 0)
end`}
		/>
		<p>
			Tests live in their module's scope and can therefore call uppercase-named (private)
			declarations directly. There is no separate test-visibility mechanism.
		</p>
	</section>

	<section id="comptime">
		<h2>Compile-time evaluation</h2>
		<p>
			Ruka has a compile-time interpreter. Functions with
			<code>@</code>-prefixed parameters run at compile time; their results are
			compile-time constants. Types, functions, and modules are first-class values in
			compile-time contexts.
		</p>

		<h3>Inferring <code>@</code> from <code>type</code></h3>
		<p>
			A parameter typed <code>type</code> infers the <code>@</code>
			prefix automatically. A parameter used to annotate another parameter infers both.
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
			monomorphisation in Rust or
			<code>comptime</code> in Zig.
		</p>
		<CodeBlock
			code={`let x = min(i32, 3, 7)      // i32 instantiation
let y = min(f64, 1.5, 2.0)  // f64 instantiation`}
		/>

		<h3>Generating types</h3>
		<p>
			A compile-time function may return a type. Non-<code>type</code>
			parameters that must be compile-time still need an explicit
			<code>@</code>.
		</p>
		<CodeBlock
			code={`let FixedArray = (t, @cap: uint) do
    record {
        data: [t]
        len:  uint
    }
end

let IntBuf   = FixedArray(i32, 64)
let FloatBuf = FixedArray(f64, 16)`}
		/>

		<h3>Storing compile-time results</h3>
		<p>
			At file scope, <code>let</code> already evaluates its right-hand side at compile
			time, so no prefix is needed. Inside a function body, prefix the binding with
			<code>@</code> to force compile-time storage.
		</p>
		<CodeBlock
			code={`let SQRT_2 = ruka.sqrt(2.0)    // top level — comptime by default

let run = () do
    let @table = build_lookup_table(256)   // forced to comptime
    let rows   = fetch_rows()              // runtime
end`}
		/>

		<h3>Reflection</h3>
		<p>
			<code>ruka.type_of(e)</code> returns the type of <code>e</code> as a compile-time
			value.
			<code>ruka.fields_of</code>,
			<code>ruka.methods_of</code>, and <code>ruka.statics_of</code>
			return the structural pieces of a type.
			<code>ruka.record_of(fields)</code> constructs a new record type from a list of
			field descriptors. All four take
			<code>@</code>-prefixed type arguments and run at compile time — there is no runtime
			reflection.
		</p>
		<CodeBlock
			code={`// derive: produce an option-of-every-field version of any record
let Partial = (t) do
    let fs = ruka.fields_of(t)
        |> map((f) do .{ name = f.name, type = ?(f.type) })
    ruka.record_of(fs)
end

let User = record {
    id: i32
    name: string
}
let PartialUser = Partial(User)
// PartialUser ≡ record { id: ?(i32), name: ?(string) }`}
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
				<tr
					><td><code>print(printable)</code></td><td
						>Write an argument implementing <code>ruka.printable</code> to stdout, 
                        no newline.</td
					></tr
				>
				<tr
					><td><code>println(printable)</code></td><td
						>Like <code>print</code>, appends a newline.</td
					></tr
				>
				<tr
					><td><code>readln()</code></td><td
						>Read a single line of input from stdin and return it as a <code>string</code>.</td
					></tr
				>
				<tr
					><td><code>read()</code></td><td
						>Like <code>readln()</code> but continues until user terminates with a ctrl-d.</td
					></tr
				>
			</tbody>
		</table>

		<h3>Math</h3>
		<p>
			<code>abs</code>, <code>sqrt</code>, <code>pow</code>, 
			<code>exp</code>, <code>floor</code>, <code>ceil</code>, 
			<code>min</code>, <code>max</code>, <code>sin</code>, 
			<code>cos</code>, <code>tan</code>.
		</p>

		<h3>Testing</h3>
		<p>
			<code>expect_eq(a, b)</code> returns an <code>!((), string)</code>.
		</p>

		<h3>File Import</h3>
		<p>
			<code>import("path")</code> — see <a href="#modules">Modules &amp; imports</a>.
		</p>

		<h3>Compile-time</h3>
		<p>
			<code>type_of</code>, <code>fields_of</code>,
			<code>methods_of</code>, <code>statics_of</code>,
			<code>record_of</code>, <code>compile_error(msg)</code>. See
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

	ul {
		margin: 0 0 16px 24px;
		color: var(--fg);
		max-width: 70ch;
	}

	li + li {
		margin-top: 4px;
	}
</style>
