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
		Form. It pairs with the <a href="/reference">reference</a>: the reference describes
		semantics in prose, and this page pins down the surface syntax. This is the defacto
		single source of truth for the language syntax.
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
				<tr><td><code>A*</code></td><td>Repetition — zero or more occurrences of A.</td></tr>
				<tr><td><code>A+</code></td><td>One or more occurrences of A.</td></tr>
				<tr><td><code>( A )</code></td><td>Grouping — treats A as a single unit.</td></tr>
				<tr><td><code>"terminal"</code></td><td>A literal character sequence.</td></tr>
				<tr><td><code>[a-z]</code></td><td>A character class — any character in the given range.</td></tr>
				<tr><td><code>&lt;description&gt;</code></td><td>An informal prose description of a terminal set.</td></tr>
				<tr><td><code>-- comment</code></td><td>An explanatory note; not part of the production.</td></tr>
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
			Ruka source files are encoded in UTF-8. The term <em>char</em> below means any
			Unicode scalar value.
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
			keyword is reserved and cannot be used as a user-defined name. Casing carries no
			semantic weight; visibility is controlled by the <code>@</code> mode prefix (see
			<a href="#declarations">Declarations</a>).
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
			<code>as</code>
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
			placed directly before a naming or parameter identifier with no whitespace between
			the prefix and the identifier. For named parameters, <code>~</code> appears before
			the mode prefix.
		</p>
		<pre class="ebnf"><code
				>mode-prefix   ::=  "*"    -- borrow; on parameters and receivers or on variables to allow modifying within a closure: may be modified
               |   "&"    -- move + mutable; ownership transfers into the function on parameters / into closures on variables; invalid after move
               |   "$"    -- stack + mutable; stack-allocated; passed by copy on parameters
               |   "@"    -- local + mutable; non-escaping — private at file scope, non-capturable at function scope
               |   "#"    -- compile-time; value must be known at compile time</code
			></pre>
		<p>
			<code>self</code> is reserved for the method receiver; it may only appear in the
			receiver clause of a naming declaration or as a parameter inside a method body.
			<code>with</code> is used in <code>match … with</code> and in the nested <code>for outer with pattern in inner</code> form.
			<code>as</code> is used only as the cast operator.
			<code>ruka</code> is a reserved identifier referring to the built-in module; it is
			implicitly in scope in every source file and cannot be shadowed or rebound.
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
			A character literal is a single byte in single quotes. It has type <code>u8</code>;
			there is no separate <code>char</code> primitive.
		</p>
		<pre class="ebnf"><code
				>char-escape   ::=  "\\" ( "n" | "t" | "r" | "\\" | "'" | '"' | "0" )
char-lit      ::=  "'" ( &lt;any char except "'", "\\", "\n"&gt; | char-escape ) "'"</code
			></pre>

		<h4>String literals</h4>
		<p>
			String literals are delimited by double quotes. Expressions may be embedded with
			<code>&#36;&#123;…&#125;</code>; the interpolated expression must satisfy the
			<code>ruka.printable</code> behaviour.
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
			explicitly to <code>newline</code> as a structural marker — these are the cases where
			the scanner's line breaks become syntactically significant (single-expression block
			bodies, and as a member separator inside braced declarations and literals).
		</p>

		<h3 id="program">Program</h3>
		<p>
			A Ruka source file is a flat sequence of declarations. Every file is implicitly a
			compile-time record: top-level <code>let</code> declarations become its public
			members; top-level <code>let</code> declarations with the <code>@</code> mode are
			private — used internally but not exported. <code>ruka.import</code> returns this
			record value; there is no separate module concept.
		</p>
		<pre class="ebnf"><code>program       ::=  declaration*</code></pre>

		<h3 id="declarations">Declarations</h3>
		<p>
			There are two declaration forms: <code>let</code> namings and <code>test</code>
			namings. There is no separate <code>fn</code>, <code>type</code>, or <code>mod</code>
			keyword. Mutability, locality, and evaluation time are all expressed through mode
			prefixes.
		</p>
		<pre class="ebnf"><code
				>declaration   ::=  naming | test-naming

naming        ::=  "let" naming-lhs "=" expr
               |   "let" naming-lhs ":" type "=" expr

naming-lhs    ::=  mode-prefix? identifier                  -- simple value naming
               |   mode-prefix? identifier receiver         -- function or method naming
               |   destructure-pattern                      -- destructuring naming

receiver      ::=  "(" type-receiver ")"
type-receiver ::=  identifier                               -- member: associated type name
               |   mode-prefix? "self"                      -- method: instance receiver

destructure-pattern
              ::=  record-pattern | tuple-pattern
                   -- destructures any irrefutable pattern; see Patterns
                   -- e.g.  let &#123;x, y&#125; = point
                   -- e.g.  let (a, b)   = pair
                   -- e.g.  let &#123; sqrt, pow &#125; = ruka.import("Math.ruka")

test-naming   ::=  "test" identifier "=" expr
                   -- the value must be a function expression; compiled in debug/test builds only</code
			></pre>
		<p>
			<strong>Uniform declarations.</strong> Functions, types, behaviours, and imported
			files are all values stored in ordinary <code>let</code> namings. A <em>receiver</em>
			in the naming left-hand side associates the value with a named type as either a
			<em>member</em> (type-name receiver) or a <em>method</em> (<code>self</code>
			receiver). The receiver appears between the naming name and the <code>=</code> sign.
		</p>
		<p>
			<strong>Type extension.</strong> The type named by a receiver is not required to be
			declared in the current scope — any type is a valid receiver, including primitives
			(<code>i32</code>, <code>bool</code>, etc.) and built-in generics. An extension
			declared outside the type's original scope shadows the type within the extending
			scope rather than mutating it. See
			<a href="/reference#methods">Methods &amp; members</a>.
		</p>
		<p>
			<strong>Locality.</strong> By default a <code>let</code> naming may escape its scope:
			at file scope it becomes a public member of the file's record; at function scope it
			is eligible for capture by a closure. Prefixing the name with <code>@</code> makes
			the naming <em>local</em> — non-escaping: at file scope it is private to the file;
			at function scope it cannot be captured by a closure that outlives the declaring
			function. The same <code>@</code> mode applies to fields, variant tags, and behaviour
			members (see <a href="#types">Types</a>).
		</p>
		<p>
			<strong>Mutability.</strong> Runtime variables (inside a function or block) are mutable
			by default — their memory may be modified.
			File-scope constants are immutable (file scope is compile-time and declarative). Parameters and receivers are immutable by
			default; any of <code>*</code>, <code>&amp;</code>, <code>$</code>, or <code>@</code>
			on a parameter or receiver allows its memory to be modified within the function.
		</p>
		<p>
			<strong>Evaluation time.</strong> Namings at file scope (including methods, members,
			and type declarations) are implicitly compile-time. The <code>#</code> mode may be
			written explicitly but is redundant there. Inside an inner scope (function body,
			block) a plain naming is runtime; <code>#</code> must be written explicitly to force
			compile-time evaluation of the right-hand side. Modes are never inferred from type
			annotations — <code>#</code> must always be written when required.
		</p>
		<p>
			<strong>Test namings.</strong> A <code>test</code> naming declares a function that
			is only compiled in debug and test builds and elided entirely in optimised builds.
			The value must be a function expression. Test namings have no mode prefix and no
			receiver clause.
		</p>

		<h3 id="types">Types</h3>
		<p>
			Type expressions appear after <code>:</code> in parameter and binding annotations,
			after <code>-&gt;</code> in return-type annotations, and as values passed to
			<code>type</code>-typed parameters.
		</p>
		<pre class="ebnf"><code
				>type          ::=  "()"                              -- unit type
               |   primitive-type
               |   array-type
               |   tuple-type
               |   range-type
               |   map-type
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
tuple-type    ::=  "(" type ( "," type )+ ","? ")"   -- fixed-length tuple:       (i32, string)
                                                     --   at least one comma; a single parenthesised type is just a grouping
range-type    ::=  "[" type ".." "]"                 -- iterator range:           [int..]
map-type      ::=  "[" type "=&gt;" type "]"            -- key-to-value map:         [string =&gt; int]

-- ── Generic built-in types ────────────────────────
-- Both have shorthand forms; the shorthand is canonical.

option-type   ::=  "?" "(" type ")"                  -- value that may be absent: ?(int)
result-type   ::=  "!" "(" type "," type ")"         -- value or error:           !(int, string)

-- ── Function type ─────────────────────────────────

function-type ::=  "(" type-list? ")" "->" type
type-list     ::=  type ( "," type )*

-- ── User-defined types ────────────────────────────
-- Inside record / variant / behaviour blocks, members are separated by
-- newlines. Commas are only required when two members share a single line.
-- Each member may carry a mode prefix (typically @ to mark it local/private
-- to the declaring file).

record-type   ::=  "record" "&#123;" field-list? "&#125;"
field-list    ::=  field ( field-sep field )* field-sep?
field         ::=  mode-prefix? identifier ":" type

variant-type  ::=  "variant" "&#123;" tag-list? "&#125;"
tag-list      ::=  tag ( field-sep tag )* field-sep?
tag           ::=  mode-prefix? identifier ( ":" type )?  -- payload type is optional; absent means unit

behaviour-type
              ::=  "behaviour" "&#123;" method-sig-list? "&#125;"
method-sig-list
              ::=  method-sig ( field-sep method-sig )* field-sep?
method-sig    ::=  mode-prefix? identifier "(" mode-prefix? "self" ")" ":" function-type

field-sep     ::=  newline | ","                     -- newline separates members; comma only required on a single line</code
			></pre>
		<p>
			<strong>Empty records cannot be instantiated.</strong> A
			<code>record &#123; &#125;</code> with no fields is a type-level marker (something to
			attach members to) and has no values. To express "no information," use <code>()</code>.
		</p>
		<p>
			<strong>Result-location semantics.</strong> The braced literal
			<code>&#123; … &#125;</code> produces an array, a record, or a map depending on the
			shape of its items (see <a href="#primary">Primary expressions</a>) and the type
			expected from context.
		</p>

		<h3 id="expressions">Expressions</h3>
		<p>
			Ruka is expression-based: blocks, conditionals, match expressions, and function
			bodies all evaluate to a value. The following layered grammar encodes operator
			precedence structurally, from lowest-binding (outermost rule) to highest-binding
			(innermost rule). The <a href="#operators">operator table</a> below presents the
			same precedence in tabular form.
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
               |   cast-expr

cast-expr     ::=  postfix-expr ( "as" type )*
                   -- left-associative; binds tighter than unary, looser than postfix</code
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
				<tr><td>1 (lowest)</td><td><code>=</code></td><td>Right</td><td>Assignment</td></tr>
				<tr><td>2</td><td><code>|&gt;</code></td><td>Left</td><td>Pipeline (forward application)</td></tr>
				<tr><td>3</td><td><code>or</code></td><td>Left</td><td>Logical OR</td></tr>
				<tr><td>4</td><td><code>and</code></td><td>Left</td><td>Logical AND</td></tr>
				<tr><td>5</td><td><code>== &nbsp; !=</code></td><td>None</td><td>Equality</td></tr>
				<tr><td>6</td><td><code>&lt; &nbsp; &lt;= &nbsp; &gt; &nbsp; &gt;=</code></td><td>None</td><td>Comparison</td></tr>
				<tr><td>7</td><td><code>.. &nbsp; ..=</code></td><td>None</td><td>Range construction</td></tr>
				<tr><td>8</td><td><code>|</code></td><td>Left</td><td>Bitwise OR</td></tr>
				<tr><td>9</td><td><code>^</code></td><td>Left</td><td>Bitwise XOR</td></tr>
				<tr><td>10</td><td><code>&amp;</code></td><td>Left</td><td>Bitwise AND</td></tr>
				<tr><td>11</td><td><code>&lt;&lt; &nbsp; &gt;&gt;</code></td><td>Left</td><td>Bitwise shift</td></tr>
				<tr><td>12</td><td><code>+ &nbsp; -</code></td><td>Left</td><td>Additive arithmetic</td></tr>
				<tr><td>13</td><td><code>* &nbsp; / &nbsp; %</code></td><td>Left</td><td>Multiplicative arithmetic</td></tr>
				<tr><td>14</td><td><code>**</code></td><td>Right</td><td>Exponentiation</td></tr>
				<tr><td>15</td><td><code>not</code> &nbsp; <code>-</code> (prefix)</td><td>Prefix</td><td>Logical NOT, arithmetic negation</td></tr>
				<tr><td>16</td><td><code>as</code></td><td>Left</td><td>Type cast</td></tr>
				<tr><td>17 (highest)</td><td><code>. &nbsp; [] &nbsp; () &nbsp; .?() &nbsp; .!()</code></td><td>Left</td><td>Field access, index, call, unwrap</td></tr>
			</tbody>
		</table>

		<h3 id="postfix">Postfix expressions</h3>
		<p>
			Postfix operations bind tighter than any prefix or infix operator and are
			left-associative, allowing arbitrary chaining.
		</p>
		<pre class="ebnf"><code
				>postfix-expr  ::=  primary postfix-op*

postfix-op    ::=  "." identifier                         -- field/member access (also used to qualify variant tags: type.tag)
               |   "." identifier "(" arg-list? ")"       -- method call
               |   ".?()"                                 -- option force-unwrap; panics if .none
               |   ".!()"                                 -- result force-unwrap; panics if .err
               |   "[" expr "]"                           -- index (array, tuple, range slice, map)
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
               |   identifier                              -- "ruka" is reserved as the built-in module reference;
                                                           --   bare identifiers also serve as payloadless variant constructors
                                                           --   (resolved against in-scope bindings first, then variant tags)
               |   block-expr
               |   if-expr
               |   match-expr
               |   while-expr
               |   for-expr
               |   return-expr
               |   break-expr
               |   continue-expr
               |   function-expr
               |   brace-lit                              -- "&#123; ... &#125;"  array, record, or map (resolved by item shape and context)
               |   typed-brace-lit                        -- "Type &#123; ... &#125;" or "[T] &#123; ... &#125;" or "[K=&gt;V] &#123; ... &#125;"
               |   tuple-lit                              -- "(e, e, ...)"
               |   "(" expr ")"                           -- parenthesised expression
               |   unit-lit                               -- "()"

-- ── Literal expressions ───────────────────────────

literal-expr  ::=  integer-lit
               |   float-lit
               |   bool-lit
               |   char-lit
               |   string-lit
               |   multiline-lit

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

-- ── Tuple literals ────────────────────────────────
-- A tuple literal is a parenthesised list with at least one comma; a
-- single parenthesised expression is just a grouping (see "primary"),
-- and "()" is the unit value. There are no zero- or one-element tuples
-- without an explicit trailing comma — "(x,)" is a one-element tuple.

tuple-lit     ::=  "(" expr "," ")"                       -- one-element tuple
               |   "(" expr ( "," expr )+ ","? ")"        -- two-or-more-element tuple

-- ── Brace literals (array / record / map) ─────────
-- All three share the same outer shape "&#123; ... &#125;". They are syntactically
-- distinguished by the form of their items:
--   array  — bare expressions:           &#123; e, e, ... &#125;
--   record — "ident = expr":             &#123; f = v, f = v, ... &#125;
--   map    — "expr =&gt; expr":             &#123; k =&gt; v, k =&gt; v, ... &#125;
-- Items within a single literal must all use the same form. Empty braces
-- "&#123; &#125;" denote an empty array or empty map; the kind is resolved by context.
-- Comprehensions (see Array comprehensions) are an additional alternative
-- form that may appear inside braces.

brace-lit     ::=  "&#123;" "&#125;"
               |   "&#123;" array-items "&#125;"
               |   "&#123;" record-items "&#125;"
               |   "&#123;" map-items "&#125;"
               |   "&#123;" comprehension "&#125;"

array-items   ::=  expr ( field-sep expr )* field-sep?

record-items  ::=  field-init ( field-sep field-init )* field-sep?
field-init    ::=  identifier "=" expr                    -- explicit:  name = value
               |   identifier                             -- shorthand: variable name matches field name

map-items     ::=  map-entry ( field-sep map-entry )* field-sep?
map-entry     ::=  expr "=&gt;" expr

-- ── Type-prefixed brace literals ──────────────────
-- A type prefix pins the literal's type when context cannot.

typed-brace-lit
              ::=  type-prefix brace-lit

type-prefix   ::=  identifier                             -- record:  point &#123; x = 1.0, y = 2.0 &#125;
               |   "[" type "]"                           -- array:   [u8] &#123; 0, 1, 2 &#125;
               |   "[" type "=&gt;" type "]"                 -- map:     [string =&gt; int] &#123; "a" =&gt; 1 &#125;

-- ── Comprehensions ───────────────────────────────
-- Builds a collection by iterating; placed inside a brace-lit. The
-- pattern follows the same rule as a "for" loop pattern — refutable
-- patterns silently skip non-matching elements.
--   array form — body is a single expression:        &#123; e for p in xs (if c)? &#125;
--   map form   — body is a "key =&gt; value" pair:      &#123; k =&gt; v for p in xs (if c)? &#125;
-- The chosen kind is fixed by the body shape; the element type(s) are
-- inferred from the body and may be pinned by a type prefix or
-- surrounding annotation.

comprehension ::=  array-comprehension | map-comprehension

array-comprehension
              ::=  expr "for" pattern "in" expr ( "if" expr )?

map-comprehension
              ::=  expr "=&gt;" expr "for" pattern "in" expr ( "if" expr )?

-- ── Variant constructors ──────────────────────────
-- There is no dedicated variant-constructor syntax. A payloadless tag is
-- written as a bare identifier; a tag with payload is written as a call
-- "tag(payload)". Both forms reuse the ordinary identifier and call
-- productions, and are resolved by the type checker — an in-scope
-- binding of the same name wins over a variant tag. A type-qualified
-- form "type.tag" or "type.tag(payload)" is just a postfix field access
-- followed (optionally) by a call.</code
			></pre>

		<h3 id="functions">Function expressions</h3>
		<p>
			Functions are anonymous values. A function expression is a parameter list, an
			optional return-type annotation, and a body introduced by <code>do</code>. The body
			uses the same <code>block-expr</code> rule as every other block.
		</p>
		<pre class="ebnf"><code
				>function-expr ::=  "(" param-list? ")" return-annot? block-expr

return-annot  ::=  "->" type

param-list    ::=  param ( "," param )*
param         ::=  "~"? mode-prefix? identifier type-annot?     -- positional or named parameter
               |   mode-prefix? "self"                          -- method receiver (keyword only)

type-annot    ::=  ":" type</code
			></pre>
		<p>
			<strong>Receiver and function expression.</strong> When a binding declaration
			carries a receiver clause, the <code>param-list</code> describes only the
			<em>explicit</em> parameters — the receiver itself is declared by the binding, not
			by the function expression. See <a href="#declarations">Declarations</a>.
		</p>

		<h4>Named parameters</h4>
		<p>
			Prepending <code>~</code> to a parameter name makes it a <em>named parameter</em>.
			Named parameters are always passed by label at the call site and may appear in any
			order. A named parameter may also be passed as a trailing argument outside the
			closing parenthesis, which is useful for higher-order functions that accept a
			closure.
		</p>
		<pre class="ebnf"><code
				>-- Declaration (in param-list)
--   "~" mode-prefix? identifier type-annot?
--   ~ comes before the mode prefix: ~#t: type, ~*buf: [u8], ~name: string
--   e.g.  ~name: string,  ~f: (int) -> int,  ~#t: type

-- Call site (in arg-list)
--   "~" identifier "=" expr     standard form:  ~name="Ruka"
--   "~" identifier              shorthand form: ~name  (variable in scope has the same name)

-- Trailing form (after the closing parenthesis)
--   "~" identifier "=" function-expr
--   e.g.  map(nums) ~f=(x) do x * 2</code
			></pre>
		<p>
			Any final parameter typed <code>: type</code> — whether positional or named — may be
			omitted at the call site. The compiler infers its value from the <em>result
			location</em>: the type of the naming, parameter, or field that receives the call's
			value. The mode of such a parameter must still be written explicitly (e.g. <code>#</code>
			for compile-time); modes are never inferred. See the
			<a href="/reference#named-params">reference</a> for details.
		</p>

		<h3 id="control-flow">Control flow</h3>
		<p>
			All control flow constructs are expressions and produce a value. When used purely
			for side effects the result is the unit type <code>()</code>. Each construct's body
			is a <code>block-expr</code> (see Block expression above) — the single-line and
			multi-line forms apply uniformly.
		</p>

		<h4>If expression</h4>
		<p>
			A multi-statement <code>if</code> chain is closed by a single trailing
			<code>end</code>; an all-single-expression chain has no <code>end</code>, since each
			branch closes at its newline. The condition position accepts either a plain boolean
			expression or a <em>conditional pattern binding</em> — <code>pattern = expr</code> —
			which runs the branch only if the pattern matches the value of <code>expr</code>
			(the bindings introduced by the pattern are in scope inside that branch).
		</p>
		<pre class="ebnf"><code
				>if-expr       ::=  "if" if-cond block-expr
                   ( "else" "if" if-cond block-expr )*
                   ( "else" block-expr )?

if-cond       ::=  expr                                   -- ordinary boolean condition
               |   pattern "=" expr                       -- conditional pattern binding;
                                                          --   pattern is typically refutable</code
			></pre>
		<p>
			<strong>Conditional expression (ternary).</strong> A right-hand-side conditional
			uses <code>value if cond else value</code> — the same keywords, rearranged. The form
			sits at the top of the expression hierarchy (just below <code>expr</code>), is
			right-associative on the <code>else</code> branch, and parses the <code>cond</code>
			at <code>or-expr</code> precedence — a nested ternary in the condition position
			requires parentheses.
		</p>
		<pre class="ebnf"><code
				>ternary-expr  ::=  assign-expr ( "if" or-expr "else" ternary-expr )?
                   -- right-associative on the else branch; the value may chain freely
                   -- e.g.  let label = "positive" if x > 0 else "non-positive"</code
			></pre>

		<h4>While expression</h4>
		<p>
			A <code>while</code> accepts the same condition forms as <code>if</code>. With a
			<code>pattern = expr</code> form, the loop terminates the first time the pattern
			fails to match.
		</p>
		<pre class="ebnf"><code
				>while-expr    ::=  "while" while-cond block-expr

while-cond    ::=  expr
               |   pattern "=" expr                       -- terminates on first non-match</code
			></pre>

		<h4>For expression</h4>
		<p>
			<code>for</code> accepts any pattern in its binder position. An <em>irrefutable</em>
			pattern (identifier, tuple, record) binds every element. A <em>refutable</em>
			pattern (variant, literal, range, guard) silently skips elements that fail to match.
		</p>
		<pre class="ebnf"><code
				>for-expr      ::=  "for" pattern "in" expr block-expr
               |   "for" expr block-expr                  -- iterator without a binding variable
               |   "for" expr "with" pattern "in" expr block-expr
                                                          -- sugar: outer "for expr" wraps an inner "for pattern in expr"</code
			></pre>

		<h4>Return</h4>
		<pre class="ebnf"><code
				>return-expr   ::=  "return" expr
                   -- "return" always carries a payload expression
                   -- a unit-returning function exits early with `return ()`</code
			></pre>

		<h4>Break and continue</h4>
		<p>
			<code>break</code> and <code>continue</code> are only valid inside a <code>while</code>
			or <code>for</code> loop body. Both produce the unit value.
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
			enclosing <code>do…end</code> block, regardless of how control exits that block.
			Multiple defers in the same block execute in LIFO order (last deferred, first to run).
		</p>
		<pre class="ebnf"><code
				>defer-stmt    ::=  "defer" expr
                   -- expr is evaluated when the enclosing block exits
                   -- defers in the same block run LIFO: last defer statement runs first</code
			></pre>

		<h3 id="patterns">Patterns</h3>
		<p>
			Patterns appear in <code>let</code> destructuring, <code>match</code> arms,
			<code>for</code> loop binders, and the <code>pattern = expr</code> forms of
			<code>if</code> and <code>while</code>. Patterns are <em>refutable</em> (may not
			match) or <em>irrefutable</em> (always match) — only irrefutable patterns are allowed
			in <code>let</code> destructuring; the other positions accept either form (refutable
			patterns skip non-matching values where they appear).
			<br /><br />
			A mode prefix may appear on an individual binder inside a pattern (<code>(*x, y)</code>)
			or before the whole pattern to distribute that mode to every binder it introduces
			(<code>*(x, y)</code>). A per-identifier mode overrides a distributed mode for that
			binder.
		</p>
		<p>
			Patterns share their concrete shapes with value literals — without the literal's
			type-prefix or initialiser syntax. A tuple pattern is <code>(a, b)</code>; a record
			pattern is <code>&#123; a, b &#125;</code>; a variant pattern is <code>tag</code> or
			<code>tag(inner)</code>.
		</p>
		<pre class="ebnf"><code
				>match-expr    ::=  "match" expr "with" arm+ else-arm? "end"

arm           ::=  pattern block-expr
else-arm      ::=  "else" block-expr

pattern       ::=  mode-prefix? identifier                 -- binds the value (irrefutable); mode applied to this binder
               |   literal-expr                            -- exact value: integer, float, bool, char, string
               |   range-pattern                           -- numeric range: 0..=9, 'a'..='z'
               |   mode-prefix? tuple-pattern              -- mode-prefix distributes to all binders in the tuple
               |   mode-prefix? record-pattern             -- mode-prefix distributes to all binders in the record
               |   variant-pattern                         -- "tag" or "tag(p)" refutable
               |   guard-pattern                           -- pattern with boolean guard

-- Per-binder modes override a distributed prefix:
--   *(x, *y)  -- x gets *, y gets * (distributed wins unless per-binder differs)
--   *(x, &y)  -- x gets *, y gets & (per-binder & overrides distributed *)

range-pattern ::=  literal-expr ( ".." | "..=" ) literal-expr

tuple-pattern ::=  "(" pattern "," ")"                     -- one-element tuple pattern
               |   "(" pattern ( "," pattern )+ ","? ")"   -- two-or-more

record-pattern
              ::=  "&#123;" mode-prefix? identifier ( field-sep mode-prefix? identifier )* field-sep? "&#125;"

variant-pattern
              ::=  identifier                              -- payloadless tag:           miss
               |   identifier "(" pattern ")"              -- tag with payload pattern:  some(x), ok((a, b))

guard-pattern ::=  pattern "if" expr
                   -- e.g.  n if n &lt; 0   in   match n with  n if n &lt; 0 do "negative" ... end</code
			></pre>
		<p>
			<strong>Option and result patterns.</strong> <code>?(T)</code> and
			<code>!(T, E)</code> are built-in variant types and follow the same variant-pattern
			syntax: <code>some(name)</code>, <code>none</code>, <code>ok(name)</code>,
			<code>err(name)</code>.
		</p>
		<p>
			<strong>Identifier vs variant-pattern resolution.</strong> A bare identifier in
			pattern position binds (irrefutably) by default. The same identifier resolves to a
			payloadless variant tag only when the pattern's expected type is a variant whose
			tags include that name — matching the same "binding wins over tag" precedence used
			in expressions, but inverted for the destination context.
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
