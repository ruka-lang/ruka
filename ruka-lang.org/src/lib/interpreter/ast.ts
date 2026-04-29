// AST node types. Field names are kept consistent across the codebase: every
// node uses `kind:` as its discriminator; literal `value:` carries the parsed
// payload; positional metadata uses descriptive names.

// ── Type expressions (parser-level) ──────────────────────────────────────
export type TypeExpr =
	| { kind: "UnitType"; line: number }
	| { kind: "ArrayType"; element: TypeExpr; line: number }
	| { kind: "TupleType"; elements: TypeExpr[]; line: number }
	| { kind: "OptionType"; inner: TypeExpr; line: number }
	| { kind: "ResultType"; ok: TypeExpr; err: TypeExpr; line: number }
	| { kind: "NamedType"; name: string; line: number };

// ── Patterns ──────────────────────────────────────────────────────────────
// Used on the left-hand side of `let`:
export type LetPattern =
	| { kind: "IdentifierPattern"; name: string }
	| { kind: "TuplePattern"; names: string[] };

// Used in `match` arms:
export type MatchPattern =
	| { kind: "VariantPattern"; tag: string; binding: BindingPattern | TuplePattern | null }
	| { kind: "RangePattern"; low: Expression; high: Expression; inclusive: boolean }
	| { kind: "LiteralPattern"; expression: Expression }
	| { kind: "GuardPattern"; expression: Expression };

export type BindingPattern = { kind: "BindingPattern"; name: string };
export type TuplePattern = { kind: "TuplePattern"; names: string[] };

// ── Receivers (method/static syntax sugar) ───────────────────────────────
// `resolvedTypeName` is filled in by the type checker once the receiver's
// target type is known; the evaluator reads it to attach the method/static
// to the right value at runtime.
export type Receiver =
	| { kind: "self"; typeAnnotation: TypeExpr | null; resolvedTypeName?: string }
	| { kind: "static"; typeName: string; resolvedTypeName?: string };

// ── Statements ────────────────────────────────────────────────────────────
export type Statement = Binding | Assign | Break | Continue | Return | For | ExpressionStmt;

export type Binding = {
	kind: "Binding";
	local: boolean;
	mode: "*" | "&" | "$" | "@" | null;
	pattern: LetPattern;
	name?: string;
	type: TypeExpr | null;
	receiver?: Receiver | null;
	value: Expression;
	line: number;
};

export type Assign = {
	kind: "Assign";
	name: string;
	value: Expression;
	line: number;
};

export type Break = {
	kind: "Break";
	line: number;
};

export type Continue = {
	kind: "Continue";
	line: number;
};

export type Return = {
	kind: "Return";
	value: Expression;
	line: number;
};

export type For = {
	kind: "For";
	name: string | null;
	iterable: Expression;
	body: Statement[];
	line: number;
};

export type ExpressionStmt = {
	kind: "ExpressionStmt";
	expression: Expression;
	line: number;
};

// ── Expressions ───────────────────────────────────────────────────────────
export type Expression =
	| Literal
	| CharLiteral
	| StringLiteral
	| Ident
	| Unit
	| FunctionExpr
	| Block
	| If
	| While
	| Match
	| BinaryOp
	| Range
	| UnaryOp
	| Call
	| Member
	| Index
	| RecordType
	| VariantType
	| VariantConstructor
	| RecordLiteral
	| ListLiteral;

export type Literal = {
	kind: "Literal";
	value: number | boolean;
	isFloat?: boolean;
	line: number;
};

export type CharLiteral = {
	kind: "CharLiteral";
	value: number;
	line: number;
};

export type StringLiteral = {
	kind: "StringLiteral";
	raw: string;
	line: number;
};

export type Ident = {
	kind: "Ident";
	name: string;
	line: number;
};

export type Unit = {
	kind: "Unit";
	line: number;
};

export type FunctionExpr = {
	kind: "FunctionExpr";
	params: string[];
	paramTypes: (TypeExpr | null)[];
	paramModes: (string | null)[];
	returnType: TypeExpr | null;
	body: Block;
	line: number;
};

export type Block = {
	kind: "Block";
	body: Statement[];
};

export type If = {
	kind: "If";
	condition: Expression;
	thenBranch: Block | Expression;
	elseBranch: Block | Expression | null;
	line: number;
	/** Internal: parser flag indicating this if-chain owns an explicit `end`. */
	_multiline?: boolean;
};

export type While = {
	kind: "While";
	condition: Expression;
	body: Statement[];
	line: number;
};

export type MatchArm = {
	pattern: MatchPattern;
	body: Block;
};

export type Match = {
	kind: "Match";
	subject: Expression;
	arms: MatchArm[];
	elseArm: Block | null;
	line: number;
};

export type BinaryOp = {
	kind: "BinaryOp";
	op: string;
	left: Expression;
	right: Expression;
	line: number;
};

export type Range = {
	kind: "Range";
	start: Expression;
	end: Expression;
	inclusive: boolean;
	line: number;
};

export type UnaryOp = {
	kind: "UnaryOp";
	op: "-" | "not";
	expression: Expression;
};

export type Call = {
	kind: "Call";
	callee: Expression;
	args: Expression[];
	line: number;
};

export type Member = {
	kind: "Member";
	object: Expression;
	property: string;
	line: number;
};

export type Index = {
	kind: "Index";
	object: Expression;
	index: Expression;
	line: number;
};

export type RecordTypeField = {
	name: string;
	type: TypeExpr;
};

export type RecordType = {
	kind: "RecordType";
	fields: RecordTypeField[];
	line: number;
};

export type VariantTag = {
	name: string;
	type: TypeExpr | null;
};

export type VariantType = {
	kind: "VariantType";
	tags: VariantTag[];
	line: number;
};

export type VariantConstructor = {
	kind: "VariantConstructor";
	tag: string;
	payload: Expression | null;
	line: number;
};

export type RecordLiteralField = {
	name: string;
	value: Expression;
};

export type RecordLiteral = {
	kind: "RecordLiteral";
	typeName?: Expression;
	fields: RecordLiteralField[];
	line: number;
	/** Set by the type checker when the literal's target record type is resolved. */
	resolvedTypeName?: string;
};

export type ListLiteral = {
	kind: "ListLiteral";
	typePrefix: TypeExpr | null;
	elements: Expression[];
	line: number;
};

// ── Program ───────────────────────────────────────────────────────────────
export type Program = {
	kind: "Program";
	body: Statement[];
};
