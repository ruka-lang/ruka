<script lang="ts">
	import ExampleViewer from "$lib/components/ExampleViewer.svelte";
	import CodeBlock from "$lib/components/ui/codeBlock.svelte";
	import { Button } from "$lib/components/ui";
	import { pickExamples } from "$lib/playground/landingExamples";

	const examples = pickExamples();

	const snippets = {
		inference: `\
let name   = "Ruka"
let answer = 42
let lookup = (key: string) -> ?(int) do ...`,

		expressions: `\
let label = "pass" if score >= 60 else "fail"

let grade = match score with
    90..=100 do "A"
    80..=89  do "B"
    else        "C"
end`,

		modes: `\
let @private = ...             // private / local (cannot be captured)
let consume  = (&buf) do ..    // takes ownership
let fast     = ($data) do ..   // stack copy
let repeat   = (*n: uint) do . // n is borrowed and mutable
let work = () do
    let counter = 0           // mutable by default at runtime scope
    let #lut = build_table()  // forced compile-time evaluation
end`,

		behaviours: `\
let shape = behaviour {
    area(self):      () -> f64
    perimeter(self): () -> f64
}

let describe = (s: shape) do
    ruka.println("area=\${s.area()}")
end`,

		patterns: `\
let (x, y)        = point   // tuple destructuring
let {name, age}   = person  // record destructuring

if some(name) = lookup(id) do
    ruka.println("hello, \${name}")
end

for ok(row) in rows do
    handle(row)    // rows that don't match ok(_) are skipped
end`,

		testing: `\
let @add = (a, b) do a + b

test addition = () do
    ruka.expect_eq(add(1, 2), 3)
    ruka.expect_eq(add(0, 0), 0)
end`
	};
</script>

<svelte:head><title>Home 💐 Ruka Programming Langauge</title></svelte:head>

<section class="landing">
	<header class="hero">
		<h1 class="hero-title">
			A small language; fun by <em>default</em>.
		</h1>
		<p class="hero-lede">
			Ruka is an opinionated language focused on simplicity and useability, opt in to fine
			control when needed. Write what you mean; let the compiler fill in the rest.
		</p>
		<div class="hero-actions">
			<Button variant="primary" href="/playground">Open the playground</Button>
			<Button variant="ghost" href="/reference">Read the reference</Button>
		</div>
	</header>

	<section class="examples" aria-labelledby="examples-heading">
		<h2 id="examples-heading" class="section-title">Try it</h2>
		<p class="section-lede">
			Pick an example to run it in-browser.
		</p>
		<ExampleViewer height="400px" {examples} />
	</section>

	<section class="overview" aria-labelledby="overview-heading">
		<h2 id="overview-heading" class="section-title">The language, briefly.</h2>
		<p class="section-lede">A few features that shape how Ruka feels to write.</p>

		<div class="features">
			<div class="feature">
				<div class="feature-meta">
					<h3 class="feature-title">Inference-first types</h3>
					<p class="feature-desc">
						Ruka is statically typed throughout. Type annotations are only required when
						inference needs a nudge — in practice, most code is annotation-free.
					</p>
				</div>
				<div class="feature-code"><CodeBlock code={snippets.inference} /></div>
			</div>

			<div class="feature">
				<div class="feature-meta">
					<h3 class="feature-title">Expression-based</h3>
					<p class="feature-desc">
						<code>if</code>, <code>match</code>, loops and blocks all produce values. The same forms work everywhere an expression
						is expected.
					</p>
				</div>
				<div class="feature-code"><CodeBlock code={snippets.expressions} /></div>
			</div>

			<div class="feature">
				<div class="feature-meta">
					<h3 class="feature-title">Opt-in control with modes</h3>
					<p class="feature-desc">
						Five symbol prefixes cover mutability, ownership transfer, stack
						allocation, locality, and compile-time evaluation. They apply anywhere a name is introduced.
					</p>
				</div>
				<div class="feature-code"><CodeBlock code={snippets.modes} /></div>
			</div>

			<div class="feature">
				<div class="feature-meta">
					<h3 class="feature-title">Behaviours</h3>
					<p class="feature-desc">
						A behaviour declares a set of method signatures. Any type whose methods
						cover those signatures satisfies it — no <code>implements</code> declaration
						needed. Dispatch is static, monomorphised at each call site.
					</p>
				</div>
				<div class="feature-code"><CodeBlock code={snippets.behaviours} /></div>
			</div>

			<div class="feature">
				<div class="feature-meta">
					<h3 class="feature-title">Patterns everywhere</h3>
					<p class="feature-desc">
						Patterns destructure values and works in any binding. Patterns slot directly into
						<code>if</code>, <code>while</code>, and <code>for</code> — no nested
						<code>match</code> required.
					</p>
				</div>
				<div class="feature-code"><CodeBlock code={snippets.patterns} /></div>
			</div>

			<div class="feature">
				<div class="feature-meta">
					<h3 class="feature-title">Built-in testing</h3>
					<p class="feature-desc">
						<code>test</code> bindings live alongside the code they test and can call
						<code>local</code> declarations directly. They are compiled out entirely in
						release builds — no runtime cost in production.
					</p>
				</div>
				<div class="feature-code"><CodeBlock code={snippets.testing} /></div>
			</div>
		</div>

		<div class="overview-footer">
			<Button variant="ghost" href="/reference">Read the full reference →</Button>
		</div>
	</section>
</section>

<style>
	.landing {
		max-width: 1040px;
		margin: 0 auto;
		padding: 96px 32px 128px;
		display: flex;
		flex-direction: column;
		gap: 96px;
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 720px;
	}

	.hero-title {
		font-size: clamp(40px, 6vw, var(--fs-2xl));
	}

	.hero-title em {
		font-style: italic;
		color: var(--accent);
	}

	.hero-lede {
		font-size: var(--fs-md);
		color: var(--fg-muted);
		max-width: 56ch;
		line-height: 1.55;
	}

	.hero-actions {
		display: flex;
		gap: 12px;
		margin-top: 8px;
	}

	.examples {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: var(--fs-xl);
	}

	.section-lede {
		color: var(--fg-muted);
		max-width: 60ch;
		margin-bottom: 16px;
	}

	.overview {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.features {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		margin-top: 8px;
	}

	/* Each card: label/desc on left, code on right. */
	.feature {
		display: grid;
		grid-template-columns: 280px 1fr;
		grid-template-rows: auto 1fr;
		column-gap: 0;
		border-bottom: 1px solid var(--border);
	}

	.feature:last-child {
		border-bottom: none;
	}

	.feature-meta {
		grid-column: 1;
		grid-row: 1 / -1;
		padding: 24px 28px;
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.feature-code {
		grid-column: 2;
		grid-row: 1 / -1;
		/* Prevent CodeBlock's margin from creating gaps. */
		display: flex;
		align-items: stretch;
	}

	/* Strip CodeBlock's own margin/border/radius so it flush-fills the cell. */
	.feature-code :global(.ruka-code) {
		flex: 1;
		margin: 0;
		border: none;
		border-radius: 0;
	}

	.feature-title {
		font-size: var(--fs-base);
		font-weight: 600;
		color: var(--fg);
	}

	.feature-desc {
		font-size: var(--fs-sm);
		color: var(--fg-muted);
		line-height: 1.6;
	}

	.feature-desc code {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--fg);
	}

	.overview-footer {
		margin-top: 16px;
		display: flex;
		justify-content: flex-end;
	}

	@media (max-width: 720px) {
		.feature {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
		}

		.feature-meta {
			grid-column: 1;
			grid-row: 1;
			border-right: none;
			border-bottom: 1px solid var(--border);
			padding-bottom: 16px;
		}

		.feature-code {
			grid-column: 1;
			grid-row: 2;
		}
	}
</style>
