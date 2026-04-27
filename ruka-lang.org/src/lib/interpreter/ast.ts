// AST node types. Field names are kept identical to the JS playground so the
// type checker and evaluator can port verbatim against the same structure.

// ── Types ──────────────────────────────────────────────────────────────
export type Ty =
	| { k: "TyUnit"; line: number }
	| { k: "TyArray"; elem: Ty; line: number }
	| { k: "TyTuple"; elems: Ty[]; line: number }
	| { k: "TyOption"; inner: Ty; line: number }
	| { k: "TyResult"; ok: Ty; err: Ty; line: number }
	| { k: "TyName"; name: string; line: number };

// ── Patterns ───────────────────────────────────────────────────────────
// Used in `let` bindings:
export type BindTarget = { k: "IdentPat"; name: string } | { k: "TuplePat"; names: string[] };

// Used in `match` arms:
export type MatchPat =
	| { k: "VariantPat"; tag: string; binding: BindPat | TuplePat | null }
	| { k: "RangePat"; lo: Expr; hi: Expr; inclusive: boolean }
	| { k: "LitPat"; expr: Expr }
	| { k: "GuardPat"; expr: Expr };

export type BindPat = { k: "BindPat"; name: string };
export type TuplePat = { k: "TuplePat"; names: string[] };

// ── Receivers (method/static syntax sugar) ─────────────────────────────
export type Receiver = { kind: "self"; tyAnno: Ty | null } | { kind: "static"; tyName: string };

// ── Statements ─────────────────────────────────────────────────────────
export type Stmt = Bind | Assign | Break | Continue | Return | For | ExprStmt;

export interface Bind {
	k: "Bind";
	local: boolean;
	mode: "*" | "&" | "$" | "@" | null;
	pat: BindTarget;
	name?: string;
	type: Ty | null;
	receiver?: Receiver | null;
	value: Expr;
	line: number;
}
export interface Assign {
	k: "Assign";
	name: string;
	value: Expr;
	line: number;
}
export interface Break {
	k: "Break";
	line: number;
}
export interface Continue {
	k: "Continue";
	line: number;
}
export interface Return {
	k: "Return";
	value: Expr;
	line: number;
}
export interface For {
	k: "For";
	name: string | null;
	iter: Expr;
	body: Stmt[];
	line: number;
}
export interface ExprStmt {
	k: "ExprStmt";
	expr: Expr;
	line: number;
}

// ── Expressions ────────────────────────────────────────────────────────
export type Expr =
	| Lit
	| CharLit
	| StrLit
	| Ident
	| Unit
	| Fn
	| Block
	| If
	| While
	| Match
	| BinOp
	| Range
	| Unary
	| Call
	| Member
	| Index
	| RecordType
	| VariantType
	| VariantCtor
	| RecordLit
	| ListLit;

export interface Lit {
	k: "Lit";
	v: number | boolean;
	isFloat?: boolean;
	line: number;
}
export interface CharLit {
	k: "Char";
	v: number;
	line: number;
}
export interface StrLit {
	k: "Str";
	raw: string;
	line: number;
}
export interface Ident {
	k: "Ident";
	name: string;
	line: number;
}
export interface Unit {
	k: "Unit";
	line: number;
}

export interface Fn {
	k: "Fn";
	params: string[];
	paramTypes: (Ty | null)[];
	paramModes: (string | null)[];
	returnType: Ty | null;
	body: Block;
	line: number;
}

export interface Block {
	k: "Block";
	body: Stmt[];
}

export interface If {
	k: "If";
	cond: Expr;
	then: Block | Expr;
	else_: Block | Expr | null;
	line: number;
	/** Internal: parser flag indicating this if-chain owns an explicit `end`. */
	_multiline?: boolean;
}

export interface While {
	k: "While";
	cond: Expr;
	body: Stmt[];
	line: number;
}

export interface MatchArm {
	pat: MatchPat;
	body: Block;
}
export interface Match {
	k: "Match";
	subject: Expr;
	arms: MatchArm[];
	elseArm: Block | null;
	line: number;
}

export interface BinOp {
	k: "BinOp";
	op: string;
	left: Expr;
	right: Expr;
}
export interface Range {
	k: "Range";
	start: Expr;
	end: Expr;
	inclusive: boolean;
	line: number;
}
export interface Unary {
	k: "Unary";
	op: "-" | "not";
	expr: Expr;
}

export interface Call {
	k: "Call";
	callee: Expr;
	args: Expr[];
	line: number;
}
export interface Member {
	k: "Member";
	obj: Expr;
	prop: string;
	line: number;
}
export interface Index {
	k: "Index";
	obj: Expr;
	idx: Expr;
	line: number;
}

export interface RecordTypeField {
	name: string;
	type: Ty;
}
export interface RecordType {
	k: "RecordType";
	fields: RecordTypeField[];
	line: number;
}

export interface VariantTag {
	name: string;
	type: Ty | null;
}
export interface VariantType {
	k: "VariantType";
	tags: VariantTag[];
	line: number;
}

export interface VariantCtor {
	k: "VariantCtor";
	tag: string;
	payload: Expr | null;
	line: number;
}

export interface RecordLitField {
	name: string;
	value: Expr;
}
export interface RecordLit {
	k: "RecordLit";
	typeName?: Expr;
	fields: RecordLitField[];
	line: number;
}

export interface ListLit {
	k: "List";
	typePrefix: Ty | null;
	elements: Expr[];
	line: number;
}

// ── Program ────────────────────────────────────────────────────────────
export interface Program {
	k: "Program";
	body: Stmt[];
}
