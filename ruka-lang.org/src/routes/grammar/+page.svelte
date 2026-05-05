<script lang="ts">
	import DocsShell, { type TocSection } from "$lib/components/DocsShell.svelte";

	const sections: TocSection[] = [
		{ id: "notation", title: "Notation" },
		{
			id: "lexical",
			title: "Lexical grammar",
			children: [
				{ id: "encoding", title: "Source encoding" },
				{ id: "whitespace", title: "Whitespace & comments" },
				{ id: "identifiers", title: "Identifiers" },
				{ id: "keywords", title: "Keywords & modes" },
				{ id: "literals-lex", title: "Literals" }
			]
		},
		{
			id: "syntactic",
			title: "Syntactic grammar",
			children: [
				{ id: "program", title: "Program" },
				{ id: "declarations", title: "Declarations" },
				{ id: "types", title: "Types" },
				{ id: "expressions", title: "Expressions" },
				{ id: "operators", title: "Operator precedence" },
				{ id: "postfix", title: "Postfix expressions" },
				{ id: "primary", title: "Primary expressions" },
				{ id: "functions", title: "Function expressions" },
				{ id: "control-flow", title: "Control flow" },
				{ id: "defer", title: "Defer" },
				{ id: "patterns", title: "Patterns" }
			]
		}
	];
</script>

<svelte:head><title>Grammar 💐 Ruka Programming Langauge</title></svelte:head>

<DocsShell title="Grammar" {sections}>
	<h1>Grammar</h1>
	<p>
		This page is the formal grammar of Ruka, written in a variant of Extended Backus–Naur
		Form. It pairs with the
		<a href="/reference">reference</a>: the reference describes semantics in prose, and
		this page pins down the surface syntax. This is the defacto single source of truth for
		the language syntax.
	</p>

	<section id="notation">
		<h2>Notation</h2>
		<p>Each production has the form:</p>
		<pre class="ebnf"><code>rule-name  ::=  production</code></pre>
		<p>The following meta-syntax is used throughout:</p>
		<table>
			<thead><tr><th>Form</th><th>Meaning</th></tr></thead>
			<tbody>
				<tr><td><code>A B</code></td><td>Concatenation — A followed by B.</td></tr>
				<tr><td><code>A | B</code></td><td>Alternation — A or B.</td></tr>
				<tr><td><code>A?</code></td><td>Option — zero or one occurrence of A.</td></tr>
				<tr
					><td><code>A*</code></td><td>Repetition — zero or more occurrences of A.</td
					></tr
				>
				<tr><td><code>A+</code></td><td>One or more occurrences of A.</td></tr>
				<tr><td><code>( A )</code></td><td>Grouping — treats A as a single unit.</td></tr>
				<tr><td><code>"terminal"</code></td><td>A literal character sequence.</td></tr>
				<tr
					><td><code>[a-z]</code></td><td
						>A character class — any character in the given range.</td
					></tr
				>
				<tr
					><td><code>&lt;description&gt;</code></td><td
						>An informal prose description of a terminal set.</td
					></tr
				>
				<tr
					><td><code>-- comment</code></td><td
						>An explanatory note; not part of the production.</td
					></tr
				>
			</tbody>
		</table>
		<p>
			Lexical rules describe raw text; syntactic rules describe token sequences. Both use
			lowercase-with-hyphens names. Whitespace and comments between tokens are always
			permitted and are omitted from syntactic rules for clarity.
		</p>
	</section>

	<section id="lexical">
		<h2>Lexical grammar</h2>
		<p>
			The lexical grammar describes how raw source text is divided into tokens. The
			scanner reads left-to-right and always produces the longest possible token at each
			position (maximal munch).
		</p>

		<h3 id="encoding">Source encoding</h3>
		<p>
			Ruka source files are encoded in UTF-8. The term <em>char</em>
			below means any Unicode scalar value.
		</p>

		<h3 id="whitespace">Whitespace &amp; comments</h3>
		<p>
			Whitespace and comments are discarded by the scanner and do not appear in the
			syntactic grammar. Block comments are not supported.
		</p>
		<pre class="ebnf"><code
				>whitespace    ::=  ( " " | "\t" | "\r" | "\n" )+

comment       ::=  "//" &lt;any char except "\n"&gt;* "\n"?</code
			></pre>

		<h3 id="identifiers">Identifiers</h3>
		<p>
			An identifier begins with a letter or underscore and is followed by zero or more
			letters, digits, or underscores. Any identifier that matches a keyword or mode
			keyword is reserved and cannot be used as a user-defined name. The first letter of
			an identifier determines visibility at file scope: lowercase exports, uppercase is
			private.
		</p>
		<pre class="ebnf"><code
				>letter        ::=  [a-zA-Z_]
digit         ::=  [0-9]

identifier    ::=  letter ( letter | digit )*
                   -- must not be a keyword or mode keyword</code
			></pre>

		<h3 id="keywords">Keywords &amp; modes</h3>
		<p>The following identifiers are reserved as keywords:</p>
		<div class="kwgrid">
			<code>and</code>
			<code>behaviour</code>
			<code>break</code>
			<code>continue</code>
			<code>defer</code>
			<code>do</code>
			<code>else</code>
			<code>end</code>
			<code>false</code>
			<code>for</code>
			<code>if</code>
			<code>in</code>
			<code>let</code>
			<code>match</code>
			<code>not</code>
			<code>or</code>
			<code>record</code>
			<code>return</code>
			<code>self</code>
			<code>test</code>
			<code>true</code>
			<code>variant</code>
			<code>while</code>
			<code>with</code>
		</div>
		<p>
			The following symbols are reserved as <em>mode prefixes</em>. A mode prefix is
			placed directly before a parameter or binding identifier with no whitespace between
			the prefix and the identifier.
		</p>
		<pre class="ebnf"><code
				>mode-prefix   ::=  "*"    -- mutable; binding may be reassigned, parameter mutates in place
               |   "&"    -- move (ownership transfer); on parameters, caller cannot use the value after the call;
                          --   on runtime bindings, capture by a closure transfers ownership into the closure
               |   "$"    -- stack-allocated; value cannot escape the function scope
               |   "@"    -- compile-time; value must be known at compile time</code
			></pre>
		<p>
			<code>self</code> is reserved for the method receiver; it may only appear in the
			receiver clause of a binding declaration or as a parameter inside a method body.
			<code>with</code>
			is used only as part of <code>match</code> syntax. <code>ruka</code> is a reserved identifier
			referring to the built-in module; it is implicitly in scope in every source file and cannot
			be shadowed or rebound.
		</p>

		<h3 id="literals-lex">Literals</h3>

		<h4>Integer literals</h4>
		<pre class="ebnf"><code
				>decimal-digit ::=  [0-9]
hex-digit     ::=  [0-9a-fA-F]
binary-digit  ::=  "0" | "1"

decimal-lit   ::=  decimal-digit+
hex-lit       ::=  "0x" hex-digit+
binary-lit    ::=  "0b" binary-digit+

integer-lit   ::=  decimal-lit | hex-lit | binary-lit
                   -- a leading minus sign is parsed as a unary operator, not part of the literal
                   -- default type: int; overridden by type context</code
			></pre>

		<h4>Float literals</h4>
		<pre class="ebnf"><code
				>float-lit     ::=  decimal-digit+ "." decimal-digit+
                   -- leading minus is a unary operator
                   -- default type: float; overridden by type context</code
			></pre>

		<h4>Boolean literals</h4>
		<pre class="ebnf"><code>bool-lit      ::=  "true" | "false"</code></pre>

		<h4>Character literals</h4>
		<p>
			A character literal is a single byte in single quotes. It has type
			<code>u8</code>; there is no separate <code>char</code> primitive.
		</p>
		<pre class="ebnf"><code
				>char-escape   ::=  "\\" ( "n" | "t" | "r" | "\\" | "'" | '"' | "0" )
char-lit      ::=  "'" ( &lt;any char except "'", "\\", "\n"&gt; | char-escape ) "'"</code
			></pre>

		<h4>String literals</h4>
		<p>
			String literals are delimited by double quotes. Expressions may be embedded with <code
				>&#36;&#123;…&#125;</code
			>; the interpolated expression must satisfy the <code>ruka.printable</code> behaviour.
		</p>
		<pre class="ebnf"><code
				>str-escape    ::=  "\\" ( "n" | "t" | "r" | "\\" | "'" | '"' | "0" )
str-interp    ::=  "&#36;&#123;" expr "&#125;"
str-content   ::=  ( &lt;any char except '"', "\\", or "$"&gt; | str-escape | str-interp )*
string-lit    ::=  '"' str-content '"'</code
			></pre>

		<h4>Multiline string literals</h4>
		<p>
			Multiline strings begin with <code>|"</code> followed by a newline. Each content
			line must begin with <code>|</code>, which is stripped from the resulting string
			value (a single space immediately after the bar is also stripped). The literal ends
			with <code>|"</code> on its own line.
		</p>
		<pre class="ebnf"><code
				>ml-content    ::=  &lt;any char except "\n"&gt;
ml-line       ::=  "|" ml-content* "\n"
multiline-lit ::=  '|"' "\n" ml-line* '|"'</code
			></pre>
	</section>

	<section id="syntactic">
		<h2>Syntactic grammar</h2>
		<p>
			The syntactic grammar is defined over token sequences. Whitespace and comments
			between any two tokens are implicitly permitted and ignored. A few rules below refer
			explicitly to <code>newline</code>
			as a structural marker — these are the cases where the scanner's line breaks become syntactically
			significant (single-expression block bodies).
		</p>

		<h3 id="program">Program</h3>
		<p>
			A Ruka source file is a flat sequence of declarations. Every file is implicitly a
			compile-time record: top-level <code>let</code>
			declarations whose names begin with a lowercase letter become its public fields; those
			whose names begin with an uppercase letter are private fields, inaccessible to importers.
			<code>ruka.import</code> returns this record value; there is no separate module concept.
		</p>
		<pre class="ebnf"><code>program       ::=  declaration*</code></pre>

		<h3 id="declarations">Declarations</h3>
		<p>
			There are two declaration forms: ordinary <code>let</code> bindings and
			<code>test</code>
			bindings. There is no separate <code>fn</code>,
			<code>type</code>, or <code>mod</code> keyword. Mutability and evaluation time are expressed
			through modes; privacy is determined by the case of the binding name.
		</p>
		<pre class="ebnf"><code
				>declaration   ::=  binding | test-binding

binding       ::=  "let" binding-lhs "=" expr
               |   "let" binding-lhs ":" type "=" expr

binding-lhs   ::=  mode-prefix? identifier                  -- simple value binding
               |   mode-prefix? identifier receiver         -- function or method binding
               |   destructure-pattern                      -- destructuring binding

receiver      ::=  "(" type-receiver ")"
type-receiver ::=  identifier                               -- static function: associated type name
               |   mode-prefix? "self"                      -- method: instance receiver

destructure-pattern
              ::=  record-pattern | tuple-pattern
                   -- destructures any irrefutable pattern; see Patterns
                   -- e.g.  let &#123; x, y &#125; = point
                   -- e.g.  let (a, b)   = pair
                   -- e.g.  let &#123; sqrt, pow &#125; = ruka.import("math")

test-binding  ::=  "test" identifier "=" expr
                   -- the value must be a function expression; compiled in debug/test builds only</code
			></pre>
		<p>
			<strong>Uniform declarations.</strong> Functions, types, behaviours, and modules are
			all values stored in ordinary
			<code>let</code> bindings. A <em>receiver</em> in the binding left-hand side
			associates the value with a named type as either a static function (type-name
			receiver) or a method (<code>self</code>
			receiver). The receiver appears between the binding name and the
			<code>=</code> sign.
		</p>
		<p>
			<strong>Type extension.</strong> The type named by a receiver is not required to be
			declared in the current scope — any type is a valid receiver, including primitives (<code
				>i32</code
			>,
			<code>bool</code>, etc.) and built-in generics. An extension declared outside the
			type's original scope shadows the type within the extending scope rather than
			mutating it. See
			<a href="/reference#methods">Methods &amp; statics</a>.
		</p>
		<p>
			<strong>Privacy.</strong> Visibility is determined by the first letter of the binding
			name — the inverse of Go's convention. A binding whose name begins with a lowercase letter
			is public (exported from the file record); a binding whose name begins with an uppercase
			letter is private. The same rule applies to methods, statics, and record or variant fields.
			Privacy does not apply inside function bodies, where name case is purely conventional.
		</p>
		<p>
			<strong>Mutability.</strong> By default a <code>let</code> binding is immutable. The
			<code>*</code>
			mode prefix makes the binding a mutable variable: <code>let *count = 0</code>.
			Reassignment is only permitted on bindings declared with <code>*</code>.
		</p>
		<p>
			<strong>Evaluation time.</strong> Bindings at file scope (including methods,
			statics, and type declarations) are implicitly compile-time. The <code>@</code> mode
			may be written explicitly but is redundant there. Inside an inner scope (function
			body, block) a plain <code>let</code>
			is runtime; <code>@</code> must be written explicitly to force compile-time evaluation
			of the right-hand side.
		</p>
		<p>
			<strong>Test bindings.</strong> A <code>test</code> binding declares a function that is
			only compiled in debug and test builds and elided entirely in optimised builds. The value
			must be a function expression. Test bindings have no visibility qualifier and no receiver
			clause. The name is an ordinary identifier used by the test runner to identify the test.
		</p>

		<h3 id="types">Types</h3>
		<p>
			Type expressions appear after <code>:</code> in parameter and binding annotations,
			after
			<code>-&gt;</code>
			in return-type annotations, and as values passed to <code>type</code>-typed
			parameters.
		</p>
		<pre class="ebnf"><code
				>type          ::=  "()"                              -- unit type
               |   primitive-type
               |   array-type
               |   tuple-type
               |   range-type
               |   option-type
               |   result-type
               |   function-type
               |   record-type
               |   variant-type
               |   behaviour-type
               |   identifier                         -- named type (user-defined or type parameter)

-- ── Primitive types ───────────────────────────────

primitive-type
              ::=  "int"                              -- signed integer, platform-native width (default)
               |   "uint"                             -- unsigned integer, platform-native width
               |   "i8"   | "i16"  | "i32"  | "i64"  | "i128"
               |   "u8"   | "u16"  | "u32"  | "u64"  | "u128"
               |   "float"                            -- floating-point, platform-native width (default)
               |   "f32"  | "f64"
               |   "string"                           -- UTF-8 string
               |   "bool"                             -- boolean
               |   "type"                             -- the type of types; used in compile-time contexts

-- ── Collection types ──────────────────────────────

array-type    ::=  "[" type "]"                      -- homogeneous array:        [i32]
tuple-type    ::=  "[" type ( "," type )+ "]"        -- fixed-length tuple:        [i32, string]
range-type    ::=  "[" type ".." "]"                 -- iterator range:            [int..]

-- ── Generic built-in types ────────────────────────
-- Both have shorthand forms; the shorthand is canonical.

option-type   ::=  "?" "(" type ")"                  -- value that may be absent:  ?(int)
result-type   ::=  "!" "(" type "," type ")"         -- value or error:            !(int, string)

-- ── Function type ─────────────────────────────────

function-type ::=  "(" type-list? ")" "->" type
type-list     ::=  type ( "," type )*

-- ── User-defined types ────────────────────────────
-- Inside record / variant / behaviour blocks, members are separated by
-- newlines. Commas are only required when two members share a single line.

record-type   ::=  "record" "&#123;" field-list? "&#125;"
field-list    ::=  field ( field-sep field )* field-sep?
field         ::=  identifier ":" type               -- private iff identifier starts with an uppercase letter

variant-type  ::=  "variant" "&#123;" tag-list? "&#125;"
tag-list      ::=  tag ( field-sep tag )* field-sep?
tag           ::=  identifier ( ":" type )?          -- payload type is optional; absent means unit

behaviour-type
              ::=  "behaviour" "&#123;" method-sig-list? "&#125;"
method-sig-list
              ::=  method-sig ( field-sep method-sig )* field-sep?
method-sig    ::=  identifier "(" mode-prefix? "self" ")" ":" function-type

field-sep     ::=  newline | ","                     -- newline separates members; comma only required on a single line</code
			></pre>
		<p>
			<strong>Result-location semantics.</strong> The collection literal
			<code>.&#123;…&#125;</code> produces an array, and
			<code>.(…)</code> produces a tuple. The element type of an array literal and the field
			types of a record literal flow in from context; an annotation pins them when context is
			unavailable.
		</p>

		<h3 id="expressions">Expressions</h3>
		<p>
			Ruka is expression-based: blocks, conditionals, match expressions, and function
			bodies all evaluate to a value. The following layered grammar encodes operator
			precedence structurally, from lowest-binding (outermost rule) to highest-binding
			(innermost rule). The <a href="/reference#operators">reference's operator table</a> presents
			the same precedence in tabular form.
		</p>
		<pre class="ebnf"><code
				>expr          ::=  ternary-expr
                   -- see "Conditional expression (ternary)" under Control Flow

assign-expr   ::=  pipeline-expr ( "=" assign-expr )?
                   -- right-associative; left-hand side must be a mutable place expression

pipeline-expr ::=  or-expr ( "|>" or-expr )*
                   -- left-associative; inserts the left value as the first argument of the right call

or-expr       ::=  and-expr ( "or" and-expr )*

and-expr      ::=  eq-expr ( "and" eq-expr )*

eq-expr       ::=  compare-expr ( ( "==" | "!=" ) compare-expr )?
                   -- non-associative

compare-expr  ::=  range-expr ( ( "&lt;" | "&lt;=" | "&gt;" | "&gt;=" ) range-expr )?
                   -- non-associative

range-expr    ::=  bit-or-expr ( ( ".." | "..=" ) bit-or-expr )?
                   -- ".."  — exclusive: lower &lt;= i &lt; upper
                   -- "..=" — inclusive: lower &lt;= i &lt;= upper

bit-or-expr   ::=  bit-xor-expr ( "|" bit-xor-expr )*

bit-xor-expr  ::=  bit-and-expr ( "^" bit-and-expr )*

bit-and-expr  ::=  shift-expr ( "&amp;" shift-expr )*

shift-expr    ::=  add-expr ( ( "&lt;&lt;" | "&gt;&gt;" ) add-expr )*

add-expr      ::=  mul-expr ( ( "+" | "-" ) mul-expr )*

mul-expr      ::=  pow-expr ( ( "*" | "/" | "%" ) pow-expr )*

pow-expr      ::=  unary-expr ( "**" pow-expr )?
                   -- right-associative

unary-expr    ::=  "not" unary-expr
               |   "-" unary-expr
               |   postfix-expr</code
			></pre>

		<h3 id="operators">Operator precedence</h3>
		<p>The table below summarises all operators from lowest to highest precedence.</p>
		<table>
			<thead>
				<tr>
					<th>Level</th>
					<th>Operator(s)</th>
					<th>Associativity</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr
					><td>1 (lowest)</td><td><code>=</code></td><td>Right</td><td>Assignment</td></tr
				>
				<tr
					><td>2</td><td><code>|&gt;</code></td><td>Left</td><td
						>Pipeline (forward application)</td
					></tr
				>
				<tr><td>3</td><td><code>or</code></td><td>Left</td><td>Logical OR</td></tr>
				<tr><td>4</td><td><code>and</code></td><td>Left</td><td>Logical AND</td></tr>
				<tr><td>5</td><td><code>== &nbsp; !=</code></td><td>None</td><td>Equality</td></tr
				>
				<tr
					><td>6</td><td><code>&lt; &nbsp; &lt;= &nbsp; &gt; &nbsp; &gt;=</code></td><td
						>None</td
					><td>Comparison</td></tr
				>
				<tr
					><td>7</td><td><code>.. &nbsp; ..=</code></td><td>None</td><td
						>Range construction</td
					></tr
				>
				<tr><td>8</td><td><code>|</code></td><td>Left</td><td>Bitwise OR</td></tr>
				<tr><td>9</td><td><code>^</code></td><td>Left</td><td>Bitwise XOR</td></tr>
				<tr><td>10</td><td><code>&amp;</code></td><td>Left</td><td>Bitwise AND</td></tr>
				<tr
					><td>11</td><td><code>&lt;&lt; &nbsp; &gt;&gt;</code></td><td>Left</td><td
						>Bitwise shift</td
					></tr
				>
				<tr
					><td>12</td><td><code>+ &nbsp; -</code></td><td>Left</td><td
						>Additive arithmetic</td
					></tr
				>
				<tr
					><td>13</td><td><code>* &nbsp; / &nbsp; %</code></td><td>Left</td><td
						>Multiplicative arithmetic</td
					></tr
				>
				<tr><td>14</td><td><code>**</code></td><td>Right</td><td>Exponentiation</td></tr>
				<tr
					><td>15</td><td><code>not</code> &nbsp; <code>-</code> (prefix)</td><td
						>Prefix</td
					><td>Logical NOT, arithmetic negation</td></tr
				>
				<tr
					><td>16 (highest)</td><td
						><code>. &nbsp; [] &nbsp; () &nbsp; .?() &nbsp; .!()</code></td
					><td>Left</td><td>Field access, index, call, unwrap</td></tr
				>
			</tbody>
		</table>

		<h3 id="postfix">Postfix expressions</h3>
		<p>
			Postfix operations bind tighter than any prefix or infix operator and are
			left-associative, allowing arbitrary chaining.
		</p>
		<pre class="ebnf"><code
				>postfix-expr  ::=  primary postfix-op*

postfix-op    ::=  "." identifier                         -- field access
               |   "." identifier "(" arg-list? ")"       -- method call
               |   ".?()"                                 -- option force-unwrap; panics if .none
               |   ".!()"                                 -- result force-unwrap; panics if .err
               |   "[" expr "]"                           -- index (array, tuple, range slice)
               |   "(" arg-list? ")" trailing-arg*        -- function call

arg-list      ::=  arg ( "," arg )*
arg           ::=  named-arg | expr

named-arg     ::=  "~" identifier ( "=" expr )?
                   -- "~label=value" passes a labelled argument
                   -- "~label" shorthand: variable in scope shares the label name

trailing-arg  ::=  "~" identifier "=" function-expr
                   -- a named closure argument passed after the closing parenthesis
                   -- e.g.  map(nums) ~f=(x) do x * 2</code
			></pre>

		<h3 id="primary">Primary expressions</h3>
		<pre class="ebnf"><code
				>primary       ::=  literal-expr
               |   identifier                              -- `ruka` is reserved as the built-in module reference
               |   block-expr
               |   if-expr
               |   match-expr
               |   while-expr
               |   for-expr
               |   return-expr
               |   break-expr
               |   continue-expr
               |   function-expr
               |   array-lit
               |   tuple-lit
               |   record-lit
               |   variant-ctor
               |   "(" expr ")"                           -- parenthesised expression

-- ── Literal expressions ───────────────────────────

literal-expr  ::=  integer-lit
               |   float-lit
               |   bool-lit
               |   char-lit
               |   string-lit
               |   multiline-lit
               |   unit-lit

unit-lit      ::=  "(" ")"                                -- the unit value; the only inhabitant of the unit type

-- ── Block expression ──────────────────────────────
-- A sequence of statements; evaluates to its last expression.
-- "do" is shared by every block-introducing construct (function body,
-- if/else branches, while/for body, match arms). Everywhere it appears, the
-- two forms below apply uniformly: a single expression on the same line is
-- closed by the newline; a multi-statement body opens a new line and is
-- closed by "end".

block-expr    ::=  "do" expr                                  -- single-expression block; closed by newline
               |   "do" newline stmt* "end"                   -- multi-statement block; closed by "end"

stmt          ::=  declaration | defer-stmt | expr

-- ── Array and tuple literals ──────────────────────
-- Array literals use ".&#123;...&#125;" and are homogeneous. Tuple literals use
-- ".(...)" and are heterogeneous fixed-arity. The leading "." marks a value
-- being constructed and distinguishes literals from destructuring patterns.

array-lit     ::=  ".&#123;" "&#125;"                               -- empty array
               |   ".&#123;" expr-items "&#125;"                    -- non-empty array
               |   identifier "." array-lit               -- explicit element-type prefix: [u8].&#123;0, 1, 2&#125;

tuple-lit     ::=  ".(" ")"                               -- empty tuple
               |   ".(" expr-items ")"                    -- non-empty tuple

expr-items    ::=  expr ( "," expr )* ","?

-- ── Record literals ───────────────────────────────
-- Constructs a value of a record type. Field initialisers are separated by
-- newlines or commas using the same "field-sep" rule as type declarations.

record-lit    ::=  ( identifier "." )? ".&#123;" field-inits? "&#125;"
                   -- optional "TypeName." prefix forces the type; omitted when inferrable

field-inits   ::=  field-init ( field-sep field-init )* field-sep?
field-init    ::=  identifier "=" expr                    -- explicit:   name = value
               |   identifier                             -- shorthand:  variable name matches field name

-- ── Variant constructors ──────────────────────────
-- Constructs a value of a variant type.

variant-ctor  ::=  "." identifier                         -- unqualified, no payload: .tagName
               |   "." identifier "(" expr ")"            -- unqualified, with payload: .tagName(expr)
               |   identifier "." identifier              -- qualified, no payload:   Type.tagName
               |   identifier "." identifier "(" expr ")" -- qualified, with payload: Type.tagName(expr)</code
			></pre>

		<h3 id="functions">Function expressions</h3>
		<p>
			Functions are anonymous values. A function expression is a parameter list, an
			optional return-type annotation, and a body introduced by <code>do</code>. The body
			uses the same
			<code>block-expr</code> rule as every other block.
		</p>
		<pre class="ebnf"><code
				>function-expr ::=  "(" param-list? ")" return-annot? block-expr

return-annot  ::=  "->" type

param-list    ::=  param ( "," param )*
param         ::=  mode-prefix? "~"? identifier type-annot?     -- positional or named parameter
               |   mode-prefix? "self"                          -- method receiver (keyword only)

type-annot    ::=  ":" type</code
			></pre>
		<p>
			<strong>Receiver and function expression.</strong> When a binding declaration
			carries a receiver clause, the
			<code>param-list</code> describes only the <em>explicit</em>
			parameters — the receiver itself is declared by the binding, not by the function expression.
			See
			<a href="#declarations">Declarations</a>.
		</p>

		<h4>Named parameters</h4>
		<p>
			Prepending <code>~</code> to a parameter name makes it a
			<em>named parameter</em>. Named parameters are always passed by label at the call
			site and may appear in any order. A named parameter may also be passed as a trailing
			argument outside the closing parenthesis, which is useful for higher-order functions
			that accept a closure.
		</p>
		<pre class="ebnf"><code
				>-- Declaration (in param-list)
--   mode-prefix? "~" identifier type-annot?
--   e.g.  ~name: string,  ~f: (int) -> int

-- Call site (in arg-list)
--   "~" identifier "=" expr     standard form:  ~name="Ruka"
--   "~" identifier              shorthand form: ~name  (variable in scope has the same name)

-- Trailing form (after the closing parenthesis)
--   "~" identifier "=" function-expr
--   e.g.  map(nums) ~f=(x) do x * 2
--   e.g.  reduce(nums, 0) ~f=(acc, x) do
--             acc + x
--         end</code
			></pre>

		<h3 id="control-flow">Control flow</h3>
		<p>
			All control flow constructs are expressions and produce a value. When used purely
			for side effects the result is the unit type
			<code>()</code>. Each construct's body is a <code>block-expr</code>
			(see Block expression above) — the single-line and multi-line forms apply uniformly.
		</p>

		<h4>If expression</h4>
		<p>
			A multi-statement <code>if</code> chain is closed by a single trailing
			<code>end</code>; an all-single-expression chain has no
			<code>end</code>, since each branch closes at its newline.
		</p>
		<pre class="ebnf"><code
				>if-expr       ::=  "if" expr block-expr
                   ( "else" "if" expr block-expr )*
                   ( "else" block-expr )?
                   -- when any branch uses the multi-statement block-expr form, the chain ends with "end"
                   -- when every branch is single-expression, the chain has no "end"</code
			></pre>
		<p>
			<strong>Conditional expression (ternary).</strong> A right-hand-side conditional
			uses
			<code>value if cond else value</code>
			— the same keywords, rearranged. The form sits at the top of the expression hierarchy
			(just below <code>expr</code>), is right-associative on the <code>else</code>
			branch, and parses the
			<code>cond</code>
			at
			<code>or-expr</code> precedence — a nested ternary in the condition position requires
			parentheses.
		</p>
		<pre class="ebnf"><code
				>ternary-expr  ::=  assign-expr ( "if" or-expr "else" ternary-expr )?
                   -- right-associative on the else branch; the value may chain freely
                   -- e.g.  let label = "positive" if x > 0 else "non-positive"
                   -- e.g.  let grade = "A" if score >= 90 else
                   --                   "B" if score >= 80 else
                   --                   "C"</code
			></pre>

		<h4>While expression</h4>
		<pre class="ebnf"><code>while-expr    ::=  "while" expr block-expr</code></pre>

		<h4>For expression</h4>
		<pre class="ebnf"><code
				>for-expr      ::=  "for" for-pattern "in" expr block-expr
               |   "for" expr block-expr            -- iterator without a binding variable

for-pattern   ::=  identifier                       -- simple binding
               |   tuple-pattern                    -- "(a, b, ...)"   tuple destructure
               |   record-pattern                   -- "&#123; a, b, ... &#125;" record destructure</code
			></pre>

		<h4>Return</h4>
		<pre class="ebnf"><code
				>return-expr   ::=  "return" expr
                   -- "return" always carries a payload expression
                   -- a unit-returning function exits early with `return ()`</code
			></pre>

		<h4>Break and continue</h4>
		<p>
			<code>break</code> and <code>continue</code> are only valid inside a
			<code>while</code>
			or
			<code>for</code> loop body. Both produce the unit value.
		</p>
		<pre class="ebnf"><code
				>break-expr    ::=  "break"
                   -- immediately exits the innermost enclosing loop

continue-expr ::=  "continue"
                   -- skips the remainder of the current iteration and begins the next</code
			></pre>

		<h3 id="defer">Defer</h3>
		<p>
			A <code>defer</code> statement schedules an expression to execute at the end of the
			enclosing
			<code>do…end</code> block, regardless of how control exits that block. Multiple defers
			in the same block execute in LIFO order (last deferred, first to run).
		</p>
		<pre class="ebnf"><code
				>defer-stmt    ::=  "defer" expr
                   -- expr is evaluated when the enclosing block exits
                   -- expr is typically a function call or a do...end block
                   -- defers in the same block run LIFO: last defer statement runs first</code
			></pre>

		<h3 id="patterns">Patterns</h3>
		<p>
			Patterns appear in <code>let</code>-destructuring, <code>match</code>
			arms, and <code>for</code> loop binders. Patterns are <em>refutable</em>
			(may not match) or <em>irrefutable</em> (always match) — only irrefutable patterns
			are allowed in <code>let</code> and
			<code>for</code>.
		</p>
		<p>
			<strong>No leading dot in patterns.</strong> The leading
			<code>.</code> of <code>.tag</code>, <code>.&#123;…&#125;</code>, and
			<code>.(…)</code> belongs to <em>value literals</em>; in patterns the same shapes
			are written bare.
		</p>
		<pre class="ebnf"><code
				>match-expr    ::=  "match" expr "with" arm+ else-arm? "end"

arm           ::=  pattern block-expr
else-arm      ::=  "else" block-expr

pattern       ::=  identifier                              -- binds the value (irrefutable)
               |   literal-expr                            -- exact value: integer, float, bool, char, string
               |   range-pattern                           -- numeric range: 0..=9, 'a'..='z'
               |   tuple-pattern                           -- "(a, b)"          irrefutable when arity matches
               |   record-pattern                          -- "&#123; x, y &#125;"         irrefutable when fields match
               |   variant-pattern                         -- "tag" or "tag(p)"  refutable
               |   guard-pattern                           -- pattern with boolean guard

range-pattern ::=  literal-expr ( ".." | "..=" ) literal-expr

tuple-pattern ::=  "(" pattern ( "," pattern )* ","? ")"

record-pattern
              ::=  "&#123;" identifier ( field-sep identifier )* field-sep? "&#125;"

variant-pattern
              ::=  identifier                              -- payloadless tag:           miss
               |   identifier "(" pattern ")"              -- tag with payload pattern:  some(x), ok((a, b))

guard-pattern ::=  pattern "if" expr
                   -- e.g.  n if n &lt; 0   in   match n with  n if n &lt; 0 do "negative" ... end</code
			></pre>
		<p>
			<strong>Option and result patterns.</strong> <code>?(T)</code> and
			<code>!(T, E)</code> are built-in variant types and follow the same variant-pattern
			syntax:
			<code>some(name)</code>,
			<code>none</code>, <code>ok(name)</code>, <code>err(name)</code>.
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

	/* EBNF blocks: same shell as the default <pre>, but a left accent bar
	   marks them as grammar productions rather than Ruka source. */
	pre.ebnf {
		border-left: 3px solid var(--accent);
	}

	.kwgrid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 8px;
		margin: 12px 0 16px;
		max-width: 70ch;
	}

	.kwgrid code {
		font-size: var(--fs-sm);
	}
</style>
