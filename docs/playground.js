/* ── Ruka playground interpreter ── */
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // Tokenizer
  // ──────────────────────────────────────────────
  var KW = new Set([
    'let', 'local', 'share', 'do', 'end',
    'if', 'else', 'while', 'return',
    'true', 'false', 'not', 'and', 'or',
    'match', 'with', 'for', 'in', 'break', 'continue',
    'record', 'variant', 'behaviour', 'self', 'test', 'defer'
  ]);

  function tokenize(src) {
    var toks = [], i = 0, len = src.length, line = 1, depth = 0;
    while (i < len) {
      // Newlines emit NL tokens at depth 0 so the parser can treat them as
      // soft block terminators. Inside any bracketed form they are whitespace.
      if (src[i] === '\n') {
        if (depth === 0) toks.push({ t: 'NL', v: '\n', line: line });
        line++; i++; continue;
      }
      if (/\s/.test(src[i])) { i++; continue; }
      // line comment
      if (src[i] === '/' && src[i + 1] === '/') {
        while (i < len && src[i] !== '\n') i++;
        continue;
      }
      var tok_line = line;
      // string literal — preserve raw content including ${...}
      if (src[i] === '"') {
        i++;
        var raw = '';
        while (i < len && src[i] !== '"') {
          if (src[i] === '\\' && i + 1 < len) {
            raw += src[i] + src[i + 1];
            i += 2;
          } else if (src[i] === '$' && src[i + 1] === '{') {
            // Capture the ${...} verbatim, tracking nested braces and strings so
            // that a `"` inside the expression doesn't terminate the outer string.
            // NB: can't name this `depth` — `var` in JS hoists to the function
            // scope and would clobber the outer bracket-depth tracker.
            raw += '${';
            i += 2;
            var interpDepth = 1;
            while (i < len && interpDepth > 0) {
              if (src[i] === '"') {
                raw += src[i++];
                while (i < len && src[i] !== '"') {
                  if (src[i] === '\\' && i + 1 < len) { raw += src[i] + src[i + 1]; i += 2; }
                  else raw += src[i++];
                }
                if (i < len) { raw += src[i++]; }
              } else if (src[i] === '{') {
                interpDepth++;
                raw += src[i++];
              } else if (src[i] === '}') {
                interpDepth--;
                if (interpDepth === 0) { raw += '}'; i++; break; }
                raw += src[i++];
              } else {
                raw += src[i++];
              }
            }
          } else {
            raw += src[i++];
          }
        }
        i++; // closing "
        toks.push({ t: 'STR', v: raw, line: tok_line });
        continue;
      }
      // char literal — single quotes; tokenize as a CHAR (u8 byte value,
      // distinguished from NUM so interpolation can render it as ASCII)
      if (src[i] === "'") {
        i++;
        var cv;
        if (src[i] === '\\' && i + 1 < len) {
          i++;
          var esc = src[i++];
          if      (esc === 'n')  cv = 10;
          else if (esc === 't')  cv = 9;
          else if (esc === 'r')  cv = 13;
          else if (esc === '0')  cv = 0;
          else if (esc === '\\') cv = 92;
          else if (esc === "'")  cv = 39;
          else if (esc === '"')  cv = 34;
          else                   cv = esc.charCodeAt(0);
        } else if (i < len) {
          cv = src.charCodeAt(i++);
        } else {
          cv = 0;
        }
        if (src[i] === "'") i++;
        toks.push({ t: 'CHAR', v: cv, line: tok_line });
        continue;
      }
      // number — stop the fractional part if we hit `..` (range operator).
      // Track float-ness explicitly because parseFloat("2.0") === 2 in JS.
      if (/\d/.test(src[i])) {
        var n = '', isFloat = false;
        while (i < len && /\d/.test(src[i])) n += src[i++];
        if (src[i] === '.' && src[i + 1] !== '.' && /\d/.test(src[i + 1])) {
          isFloat = true;
          n += src[i++];
          while (i < len && /\d/.test(src[i])) n += src[i++];
        }
        toks.push({ t: 'NUM', v: parseFloat(n), isFloat: isFloat, line: tok_line });
        continue;
      }
      // identifier / keyword
      if (/[a-zA-Z_]/.test(src[i])) {
        var w = '';
        while (i < len && /\w/.test(src[i])) w += src[i++];
        toks.push({ t: KW.has(w) ? w : 'ID', v: w, line: tok_line });
        continue;
      }
      // Built-in module sigil — `#` is the only way to reach the ruka built-ins
      // (e.g. `#.println(...)`). Tokenized with t = '#' so the parser can accept
      // it wherever an identifier-producing primary is expected.
      if (src[i] === '#') {
        toks.push({ t: '#', v: '#', line: tok_line });
        i++;
        continue;
      }
      // three-char tokens (must precede two-char)
      var c3 = src.slice(i, i + 3);
      if (c3 === '..=') {
        toks.push({ t: c3, v: c3, line: tok_line }); i += 3; continue;
      }
      // two-char tokens
      var c2 = src.slice(i, i + 2);
      if (c2 === '==' || c2 === '!=' || c2 === '<=' || c2 === '>=' || c2 === '->' || c2 === '..' || c2 === '**' || c2 === '|>') {
        toks.push({ t: c2, v: c2, line: tok_line }); i += 2; continue;
      }
      // single-char token — track bracket depth so NL is suppressed inside
      var ch = src[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      toks.push({ t: ch, v: ch, line: tok_line }); i++;
    }
    toks.push({ t: 'EOF', v: '', line: line });
    return toks;
  }

  // ──────────────────────────────────────────────
  // Parser
  // ──────────────────────────────────────────────
  // Block rules:
  //   `do <expr>`        — single-line; NL (or an enclosing `end`/`else`) terminates.
  //   `do <NL> <stmts>`  — multi-line; `end` is required.
  // `else` follows the same rule; `do` after `else` is optional.
  // Ternary: `<expr> if <cond> else <expr>` (right-associative, lower precedence than `or`).
  function parse(toks) {
    var pos = 0;

    function peek()   { return toks[pos]; }
    function check(t) { return toks[pos].t === t; }
    function eat(t) {
      if (!check(t)) {
        var e = new Error("Expected '" + t + "', got '" + peek().t + "' ('" + peek().v + "')");
        e.line = peek().line;
        throw e;
      }
      return toks[pos++];
    }
    function tryMatch() {
      for (var i = 0; i < arguments.length; i++) {
        if (check(arguments[i])) return toks[pos++];
      }
      return null;
    }
    function skipNL() { while (check('NL')) pos++; }

    // Parse a type expression:
    //   prim   : int | uint | i8..i128 | u8..u128 | float | f32 | f64 | string | bool
    //   unit   : '(' ')'
    //   coll   : '[' type (',' type)* ']'     -- 1 elem = array, 2+ = tuple
    //   option : '?' '(' type ')'   |  'option' '(' type ')'
    //   result : '!' '(' type ',' type ')'   |  'result' '(' type ',' type ')'
    //   named  : <ID>                          -- user-defined / unresolved
    // Primitive names are parsed as TyName and classified in the type checker.
    function parseType() {
      skipNL();
      var tok = peek();
      if (tok.t === '(') {
        eat('('); skipNL(); eat(')');
        return { k: 'TyUnit', line: tok.line };
      }
      if (tok.t === '[') {
        eat('['); skipNL();
        var elems = [parseType()];
        skipNL();
        while (tryMatch(',')) { skipNL(); elems.push(parseType()); skipNL(); }
        eat(']');
        if (elems.length === 1) return { k: 'TyArray', elem: elems[0], line: tok.line };
        return { k: 'TyTuple', elems: elems, line: tok.line };
      }
      if (tok.t === '?') {
        eat('?'); eat('('); skipNL();
        var inner = parseType();
        skipNL(); eat(')');
        return { k: 'TyOption', inner: inner, line: tok.line };
      }
      if (tok.t === '!') {
        eat('!'); eat('('); skipNL();
        var ok = parseType();
        skipNL(); eat(','); skipNL();
        var err = parseType();
        skipNL(); eat(')');
        return { k: 'TyResult', ok: ok, err: err, line: tok.line };
      }
      if (tok.t === 'ID') {
        var name = eat('ID').v;
        if ((name === 'option' || name === 'result') && check('(')) {
          eat('('); skipNL();
          var first = parseType();
          skipNL();
          if (name === 'option') {
            eat(')');
            return { k: 'TyOption', inner: first, line: tok.line };
          }
          eat(','); skipNL();
          var second = parseType();
          skipNL(); eat(')');
          return { k: 'TyResult', ok: first, err: second, line: tok.line };
        }
        return { k: 'TyName', name: name, line: tok.line };
      }
      var e = new Error("Expected type, got '" + tok.t + "' ('" + tok.v + "')");
      e.line = tok.line;
      throw e;
    }

    // Lookahead: is '(' at current pos the start of a function literal?
    // A function literal is `(params) [-> ReturnType] do ...`.
    function isFnLiteral() {
      var j = pos + 1, depth = 1;
      while (j < toks.length && depth > 0) {
        if (toks[j].t === '(') depth++;
        else if (toks[j].t === ')') depth--;
        j++;
      }
      if (toks[j] && toks[j].t === '->') {
        j++;
        while (j < toks.length && toks[j].t !== 'do'
                               && toks[j].t !== 'NL'
                               && toks[j].t !== 'EOF') j++;
      }
      return toks[j] && toks[j].t === 'do';
    }

    function parseProgram() {
      var body = [];
      skipNL();
      while (!check('EOF')) {
        body.push(parseStmt());
        skipNL();
      }
      return { k: 'Program', body: body };
    }

    function parseStmt() {
      // binding: let/local/share name = expr
      var kw = tryMatch('let', 'local', 'share');
      if (kw) {
        var name = eat('ID').v;
        // skip optional (self) / (self: T) receiver annotation
        if (check('(')) {
          var depth = 1; pos++;
          while (depth > 0 && !check('EOF')) {
            if (check('(')) depth++;
            else if (check(')')) depth--;
            pos++;
          }
        }
        var bindType = tryMatch(':') ? parseType() : null;
        eat('=');
        skipNL();
        return { k: 'Bind', kw: kw.v, name: name, type: bindType, value: parseExpr(), line: kw.line };
      }
      // plain assignment: ident = expr
      if (check('ID') && toks[pos + 1] && toks[pos + 1].t === '=') {
        var al = toks[pos].line;
        var aname = eat('ID').v;
        eat('=');
        skipNL();
        return { k: 'Assign', name: aname, value: parseExpr(), line: al };
      }
      // break / continue / return
      if (check('break'))    { var bl = peek().line; pos++; return { k: 'Break',    line: bl }; }
      if (check('continue')) { var ccl = peek().line; pos++; return { k: 'Continue', line: ccl }; }
      if (check('return')) {
        var rl = peek().line; pos++;
        // Explicit `return` always requires a payload. Functions that return
        // unit write `return ()` — the bare form is no longer accepted.
        return { k: 'Return', value: parseExpr(), line: rl };
      }
      // for [name in] iterable do body end
      if (check('for')) return parseFor();
      var sl = peek().line;
      return { k: 'ExprStmt', expr: parseExpr(), line: sl };
    }

    function parseFor() {
      var l = peek().line;
      eat('for');
      // Optional binding: `for name in iter` or pattern-less `for iter`
      var name = null;
      if (check('ID') && toks[pos + 1] && toks[pos + 1].t === 'in') {
        name = eat('ID').v;
        eat('in');
      }
      var iter = parseOr(); // no trailing ternary; `do` opens the body
      eat('do');
      var b = parseDoBody();
      if (b.multiline) eat('end');
      else tryMatch('end');
      return { k: 'For', name: name, iter: iter, body: b.node.body, line: l };
    }

    function parseExpr() {
      if (check('(') && isFnLiteral()) return parseFn();
      if (check('while'))              return parseWhile();
      return parseIf();
    }

    // Parse a block body opened by a `do` token already consumed by the caller.
    // Returns { node, multiline }: the node is always a Block; `multiline` means
    // the block needs an explicit `end` (caller decides — if-chains share one `end`).
    // Single-line = one statement, terminated by NL/else/end.
    // Multi-line  = `do` followed by NL, then statements until a closing `end`.
    function parseDoBody() {
      if (check('NL')) {
        skipNL();
        return { node: { k: 'Block', body: parseBlockBody() }, multiline: true };
      }
      var stmt = parseStmt();
      return { node: { k: 'Block', body: [stmt] }, multiline: false };
    }

    function parseFn() {
      var l = peek().line;
      eat('(');
      var params = [];
      var paramTypes = [];
      var paramModes = [];
      skipNL();
      while (!check(')') && !check('EOF')) {
        var m = tryMatch('*', '&', '$', '@');
        paramModes.push(m ? m.t : null);
        if (check('ID')) params.push(eat('ID').v);
        paramTypes.push(tryMatch(':') ? parseType() : null);
        skipNL();
        if (tryMatch(',')) skipNL();
      }
      eat(')');
      var returnType = tryMatch('->') ? parseType() : null;
      eat('do');
      var b = parseDoBody();
      if (b.multiline) eat('end');
      else tryMatch('end');
      return { k: 'Fn', params: params, paramTypes: paramTypes, paramModes: paramModes, returnType: returnType, body: b.node, line: l };
    }

    function parseWhile() {
      var l = peek().line;
      eat('while');
      var cond = parseOr(); // no trailing ternary; `do` opens the body
      eat('do');
      var b = parseDoBody();
      if (b.multiline) eat('end');
      else tryMatch('end');
      return { k: 'While', cond: cond, body: b.node.body, line: l };
    }

    // `inChain` = this parseIf is the RHS of an enclosing `else if`, so the
    // enclosing call owns the shared trailing `end` (when any branch is multi-line).
    function parseIf(inChain) {
      var ifTok = tryMatch('if');
      if (!ifTok) return parseTernary();
      var cond = parseOr();
      eat('do');
      var t = parseDoBody();
      var then = t.node, thenMultiline = t.multiline;

      // Allow `else` on a new line regardless of single/multi-line then.
      skipNL();
      var else_ = null, elseMultiline = false;
      if (tryMatch('else')) {
        if (check('if')) {
          else_ = parseIf(true);
          elseMultiline = else_._multiline;
        } else {
          tryMatch('do'); // `do` after `else` is optional
          var eBody = parseDoBody();
          else_ = eBody.node;
          elseMultiline = eBody.multiline;
        }
      }

      var multiline = thenMultiline || elseMultiline;
      if (!inChain) {
        skipNL();
        if (multiline) eat('end');
        else tryMatch('end');
      }
      var node = { k: 'If', cond: cond, then: then, else_: else_, line: ifTok.line };
      node._multiline = multiline;
      return node;
    }

    // Ternary: `<expr> if <cond> else <expr>` (right-assoc, below `or`).
    // LHS is an assign/pipeline expression; cond is or-expr per grammar.
    function parseTernary() {
      var a = parsePipeline();
      if (tryMatch('if')) {
        var cond = parseOr();
        skipNL();
        eat('else');
        skipNL();
        var b = parseTernary();
        return { k: 'If', cond: cond, then: a, else_: b, line: a.line };
      }
      return a;
    }

    // Pipeline: `x |> f(a, b)` desugars to `f(x, a, b)`. Left-associative.
    // If the RHS is not a Call (e.g. `x |> f`), synthesize `f(x)`.
    function parsePipeline() {
      var l = parseOr();
      while (check('|>')) {
        pos++;
        skipNL();
        var r = parseOr();
        if (r.k === 'Call') {
          l = { k: 'Call', callee: r.callee, args: [l].concat(r.args), line: r.line };
        } else {
          l = { k: 'Call', callee: r, args: [l], line: r.line || l.line };
        }
      }
      return l;
    }

    // Stops at 'end', 'else', or EOF. NL between statements is filler.
    function parseBlockBody() {
      var stmts = [];
      skipNL();
      while (!check('end') && !check('else') && !check('EOF')) {
        stmts.push(parseStmt());
        skipNL();
      }
      return stmts;
    }

    function parseOr() {
      var l = parseAnd();
      while (check('or')) { pos++; skipNL(); l = { k: 'BinOp', op: 'or', left: l, right: parseAnd() }; }
      return l;
    }
    function parseAnd() {
      var l = parseCmp();
      while (check('and')) { pos++; skipNL(); l = { k: 'BinOp', op: 'and', left: l, right: parseCmp() }; }
      return l;
    }
    function parseCmp() {
      var l = parseRange();
      var op = tryMatch('==', '!=', '<', '>', '<=', '>=');
      if (op) { skipNL(); l = { k: 'BinOp', op: op.t, left: l, right: parseRange() }; }
      return l;
    }
    function parseRange() {
      var l = parseAdd();
      if (check('..') || check('..=')) {
        var inclusive = peek().t === '..=';
        var rl = peek().line;
        pos++;
        skipNL();
        var r = parseAdd();
        return { k: 'Range', start: l, end: r, inclusive: inclusive, line: rl };
      }
      return l;
    }
    function parseAdd() {
      var l = parseMul();
      while (check('+') || check('-')) {
        var op = toks[pos++].t;
        skipNL();
        l = { k: 'BinOp', op: op, left: l, right: parseMul() };
      }
      return l;
    }
    function parseMul() {
      var l = parsePow();
      while (check('*') || check('/') || check('%')) {
        var op = toks[pos++].t;
        skipNL();
        l = { k: 'BinOp', op: op, left: l, right: parsePow() };
      }
      return l;
    }
    function parsePow() {
      var l = parseUnary();
      if (check('**')) {
        pos++;
        skipNL();
        var r = parsePow(); // right-associative
        return { k: 'BinOp', op: '**', left: l, right: r };
      }
      return l;
    }
    function parseUnary() {
      if (tryMatch('-'))   { skipNL(); return { k: 'Unary', op: '-',   expr: parseUnary() }; }
      if (tryMatch('not')) { skipNL(); return { k: 'Unary', op: 'not', expr: parseUnary() }; }
      return parseCall();
    }
    function parseCall() {
      var expr = parsePrimary();
      while (true) {
        if (check('(')) {
          var cl = peek().line;
          eat('(');
          skipNL();
          var args = [];
          while (!check(')') && !check('EOF')) {
            args.push(parseExpr());
            skipNL();
            if (tryMatch(',')) skipNL();
          }
          eat(')');
          expr = { k: 'Call', callee: expr, args: args, line: cl };
        } else if (check('.')) {
          var ml = peek().line;
          eat('.');
          skipNL();
          expr = { k: 'Member', obj: expr, prop: eat('ID').v, line: ml };
        } else if (check('[')) {
          var il = peek().line;
          eat('[');
          skipNL();
          var idx = parseExpr();
          skipNL();
          eat(']');
          expr = { k: 'Index', obj: expr, idx: idx, line: il };
        } else break;
      }
      return expr;
    }
    function parsePrimary() {
      var tok = peek();
      if (tok.t === 'NUM')   { pos++; return { k: 'Lit',   v: tok.v, isFloat: !!tok.isFloat, line: tok.line }; }
      if (tok.t === 'CHAR')  { pos++; return { k: 'Char',  v: tok.v,    line: tok.line }; }
      if (tok.t === 'STR')   { pos++; return { k: 'Str',   raw: tok.v,  line: tok.line }; }
      if (tok.t === 'true')  { pos++; return { k: 'Lit',   v: true,     line: tok.line }; }
      if (tok.t === 'false') { pos++; return { k: 'Lit',   v: false,    line: tok.line }; }
      if (tok.t === 'ID')    { pos++; return { k: 'Ident', name: tok.v, line: tok.line }; }
      // `#` — built-in module reference. Behaves like an identifier binding named "#",
      // so `#.println(...)` parses through the normal Member/Call postfix chain.
      if (tok.t === '#')     { pos++; return { k: 'Ident', name: '#', line: tok.line }; }
      if (tok.t === '(')     {
        eat('('); skipNL();
        // `()` — unit literal. Distinguished from a parenthesised expression by
        // the closing `)` appearing with no expression between the parens.
        if (check(')')) { eat(')'); return { k: 'Unit', line: tok.line }; }
        var e = parseExpr(); skipNL(); eat(')'); return e;
      }
      // Array/tuple literal: .{a, b, c}
      if (tok.t === '.' && toks[pos + 1] && toks[pos + 1].t === '{') {
        var ll = tok.line;
        eat('.'); eat('{');
        skipNL();
        var elements = [];
        while (!check('}') && !check('EOF')) {
          elements.push(parseExpr());
          skipNL();
          if (tryMatch(',')) skipNL();
        }
        eat('}');
        return { k: 'List', typePrefix: null, elements: elements, line: ll };
      }
      // Type-prefixed collection literal: [i32].{2, 3} or [i32, string].{1, "hi"}
      if (tok.t === '[') {
        var pl = tok.line;
        var prefix = parseType(); // consumes through `]`
        eat('.'); eat('{');
        skipNL();
        var elems = [];
        while (!check('}') && !check('EOF')) {
          elems.push(parseExpr());
          skipNL();
          if (tryMatch(',')) skipNL();
        }
        eat('}');
        return { k: 'List', typePrefix: prefix, elements: elems, line: pl };
      }
      if (tok.t === 'do')    {
        eat('do');
        var b = parseDoBody();
        if (b.multiline) eat('end');
        else tryMatch('end');
        return b.node;
      }
      var ue = new Error("Unexpected token '" + tok.t + "' ('" + tok.v + "')");
      ue.line = tok.line;
      throw ue;
    }

    return parseProgram();
  }

  // Split a raw string body into literal text / ${...} parts, respecting
  // nested braces AND nested string literals so that `"outer ${"inner"} end"`
  // round-trips correctly.
  function splitInterp(raw) {
    var parts = [], buf = '', i = 0, len = raw.length;
    while (i < len) {
      if (raw[i] === '\\' && i + 1 < len) {
        buf += raw[i] + raw[i + 1];
        i += 2;
      } else if (raw[i] === '$' && raw[i + 1] === '{') {
        if (buf.length) { parts.push({ text: buf }); buf = ''; }
        i += 2;
        var depth = 1, inner = '';
        while (i < len && depth > 0) {
          if (raw[i] === '"') {
            inner += raw[i++];
            while (i < len && raw[i] !== '"') {
              if (raw[i] === '\\' && i + 1 < len) { inner += raw[i] + raw[i + 1]; i += 2; }
              else inner += raw[i++];
            }
            if (i < len) inner += raw[i++];
          } else if (raw[i] === '{') {
            depth++;
            inner += raw[i++];
          } else if (raw[i] === '}') {
            depth--;
            if (depth === 0) { i++; break; }
            inner += raw[i++];
          } else {
            inner += raw[i++];
          }
        }
        parts.push({ interp: inner });
      } else {
        buf += raw[i++];
      }
    }
    if (buf.length) parts.push({ text: buf });
    return parts;
  }

  function unescText(raw) {
    return raw.replace(/\\n/g,  '\n')
              .replace(/\\t/g,  '\t')
              .replace(/\\\\/g, '\\')
              .replace(/\\"/g,  '"');
  }

  // ──────────────────────────────────────────────
  // Static scope checker  (undeclared identifiers)
  // ──────────────────────────────────────────────
  // Returns an Error with .line set on the first undeclared identifier,
  // or null if the program is clean.
  function checkScope(ast) {
    var BUILTINS = new Set(['#', 'true', 'false', 'self']);

    // Top-level: hoist all binding names so mutually-recursive functions work.
    var topNames = new Set(BUILTINS);
    ast.body.forEach(function (s) { if (s.k === 'Bind') topNames.add(s.name); });

    try {
      ast.body.forEach(function (s) { chkStmt(s, topNames); });
    } catch (e) { return e; }
    return null;

    function chkStmt(node, scope) {
      if (node.k === 'Bind') {
        chkExpr(node.value, scope);
        scope.add(node.name); // available after this point in sequential blocks
      } else if (node.k === 'Assign') {
        if (!scope.has(node.name)) {
          var e = new Error('Undefined: ' + node.name);
          e.line = node.line;
          throw e;
        }
        chkExpr(node.value, scope);
      } else if (node.k === 'ExprStmt') {
        chkExpr(node.expr, scope);
      } else if (node.k === 'For') {
        chkExpr(node.iter, scope);
        var fScope = new Set(scope);
        if (node.name) fScope.add(node.name);
        node.body.forEach(function (s) { chkStmt(s, fScope); });
      } else if (node.k === 'Return') {
        if (node.value) chkExpr(node.value, scope);
      } else if (node.k === 'Break' || node.k === 'Continue') {
        // structural — nothing to resolve
      }
    }

    function chkInterp(raw, scope, line) {
      // Extract each ${...} (balanced braces, nested strings) and statically
      // check it with the enclosing scope. The inner tokenizer restarts its
      // line counter at 1, so any line it emits is meaningless in the outer
      // source — always report on the line of the enclosing string.
      var parts = splitInterp(raw);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].interp !== undefined) {
          try {
            var innerAst = parse(tokenize(parts[i].interp));
            innerAst.body.forEach(function (s) { chkStmt(s, scope); });
          } catch (e) {
            e.line = line;
            throw e;
          }
        }
      }
    }

    function chkExpr(node, scope) {
      if (!node) return;
      switch (node.k) {
        case 'Lit':  return;
        case 'Unit': return;
        case 'Char': return;
        case 'Str':  chkInterp(node.raw, scope, node.line); return;
        case 'Ident':
          if (!scope.has(node.name)) {
            var e = new Error('Undefined: ' + node.name);
            e.line = node.line;
            throw e;
          }
          return;
        case 'Fn': {
          var fnScope = new Set(scope);
          // The fn's own binding name is already in scope (hoisted at top level,
          // or added by chkStmt before we recurse into value).
          node.params.forEach(function (p) { fnScope.add(p); });
          chkExpr(node.body, fnScope);
          return;
        }
        case 'Block': {
          var bScope = new Set(scope);
          node.body.forEach(function (s) { chkStmt(s, bScope); });
          return;
        }
        case 'While': {
          chkExpr(node.cond, scope);
          var wScope = new Set(scope);
          node.body.forEach(function (s) { chkStmt(s, wScope); });
          return;
        }
        case 'If':
          chkExpr(node.cond, scope);
          chkExpr(node.then, scope);
          if (node.else_) chkExpr(node.else_, scope);
          return;
        case 'Call':
          chkExpr(node.callee, scope);
          node.args.forEach(function (a) { chkExpr(a, scope); });
          return;
        case 'Member':
          chkExpr(node.obj, scope);
          // Don't check the property name — it's resolved on the value at runtime
          return;
        case 'Index':
          chkExpr(node.obj, scope);
          chkExpr(node.idx, scope);
          return;
        case 'Range':
          chkExpr(node.start, scope);
          chkExpr(node.end, scope);
          return;
        case 'List':
          node.elements.forEach(function (e) { chkExpr(e, scope); });
          return;
        case 'BinOp':
          chkExpr(node.left, scope);
          chkExpr(node.right, scope);
          return;
        case 'Unary':
          chkExpr(node.expr, scope);
          return;
      }
    }
  }

  // ──────────────────────────────────────────────
  // Type checker (bidirectional inference)
  // ──────────────────────────────────────────────
  // Primitives per docs/reference.html §Built-in Types.
  var INT_TYS = new Set([
    'int', 'uint',
    'i8', 'i16', 'i32', 'i64', 'i128',
    'u8', 'u16', 'u32', 'u64', 'u128'
  ]);
  var FLOAT_TYS = new Set(['float', 'f32', 'f64']);
  var PRIM_TYS = new Set([].concat(
    Array.from(INT_TYS), Array.from(FLOAT_TYS), ['string', 'bool']
  ));
  function isNumericKind(k) { return INT_TYS.has(k) || FLOAT_TYS.has(k); }

  function tyStr(t) {
    if (!t) return '?';
    switch (t.k) {
      case 'unit':    return '()';
      case 'array':   return '[' + tyStr(t.elem) + ']';
      case 'tuple':   return '[' + t.elems.map(tyStr).join(', ') + ']';
      case 'option':  return '?(' + tyStr(t.inner) + ')';
      case 'result':  return '!(' + tyStr(t.ok) + ', ' + tyStr(t.err) + ')';
      case 'range':   return 'range(' + tyStr(t.elem) + ')';
      case 'fn':      return '(' + (t.params||[]).map(tyStr).join(', ') + ') -> ' + tyStr(t.ret);
      case 'module':  return '<module>';
      case 'named':   return t.name;
      case 'unknown': return '?';
      default:        return t.k;   // primitive name stored directly in k
    }
  }

  function tyEq(a, b) {
    if (!a || !b) return false;
    if (a.k === 'unknown' || b.k === 'unknown') return true;
    if (a.k !== b.k) return false;
    switch (a.k) {
      case 'array':  return tyEq(a.elem, b.elem);
      case 'tuple':
        if (a.elems.length !== b.elems.length) return false;
        for (var i = 0; i < a.elems.length; i++) if (!tyEq(a.elems[i], b.elems[i])) return false;
        return true;
      case 'option': return tyEq(a.inner, b.inner);
      case 'result': return tyEq(a.ok, b.ok) && tyEq(a.err, b.err);
      case 'range':  return tyEq(a.elem, b.elem);
      case 'named':  return a.name === b.name;
      case 'fn':
        if ((a.params||[]).length !== (b.params||[]).length) return false;
        for (var j = 0; j < a.params.length; j++) if (!tyEq(a.params[j], b.params[j])) return false;
        return tyEq(a.ret, b.ret);
      default: return true;  // primitive — tag equality suffices
    }
  }

  // Parser type AST → internal Ty
  function astToTy(node) {
    if (!node) return null;
    switch (node.k) {
      case 'TyUnit':   return { k: 'unit' };
      case 'TyArray':  return { k: 'array',  elem: astToTy(node.elem) };
      case 'TyTuple':  return { k: 'tuple',  elems: node.elems.map(astToTy) };
      case 'TyOption': return { k: 'option', inner: astToTy(node.inner) };
      case 'TyResult': return { k: 'result', ok: astToTy(node.ok), err: astToTy(node.err) };
      case 'TyName':   return PRIM_TYS.has(node.name) ? { k: node.name } : { k: 'named', name: node.name };
    }
    return { k: 'unknown' };
  }

  function tyErr(line, msg) { var e = new Error(msg); e.line = line; return e; }

  // Static method resolution for built-in types
  function methodOf(obj, name, line) {
    if (!obj || obj.k === 'unknown') return { k: 'unknown' };
    if (obj.k === 'array') {
      if (name === 'length') return { k: 'fn', params: [], ret: { k: 'int' } };
      if (name === 'append') return { k: 'fn', params: [obj.elem], ret: { k: 'unit' } };
      if (name === 'remove') return { k: 'fn', params: [{ k: 'int' }], ret: obj.elem };
      throw tyErr(line, "no method '" + name + "' on " + tyStr(obj));
    }
    if (obj.k === 'string') {
      if (name === 'length') return { k: 'fn', params: [], ret: { k: 'int' } };
      if (name === 'concat') return { k: 'fn', params: [{ k: 'string' }], ret: { k: 'string' } };
      throw tyErr(line, "no method '" + name + "' on string");
    }
    if (obj.k === 'module') {
      if (name in obj.members) return obj.members[name];
      throw tyErr(line, "no member '" + name + "' on module");
    }
    // named / option / result / tuple — not yet supported here
    return { k: 'unknown' };
  }

  // Check `actual` conforms to `expected`. Unknown tolerated in either direction.
  // Returns the resolved type (prefers `expected` when provided, for literal defaulting).
  function conform(expected, actual, line) {
    if (!expected)             return actual;
    if (actual.k === 'unknown') return expected;
    if (expected.k === 'unknown') return actual;
    if (!tyEq(expected, actual)) {
      throw tyErr(line, 'type mismatch: expected ' + tyStr(expected) + ', got ' + tyStr(actual));
    }
    return actual;
  }

  function checkTypes(ast) {
    var rukaModule = {
      k: 'module',
      members: {
        println:  { k: 'fn', params: [{ k: 'string' }],                             ret: { k: 'unit' } },
        print:    { k: 'fn', params: [{ k: 'string' }],                             ret: { k: 'unit' } },
        assertEq: { k: 'fn', params: [{ k: 'unknown' }, { k: 'unknown' }],          ret: { k: 'unit' } }
      }
    };
    var topEnv = { bindings: Object.create(null), parent: null };
    topEnv.bindings['#']     = rukaModule;
    topEnv.bindings['true']  = { k: 'bool' };
    topEnv.bindings['false'] = { k: 'bool' };
    topEnv.bindings['self']  = { k: 'unknown' };

    // Hoist top-level names — annotated bindings get precise types; others
    // are unknown until the second pass refines them.
    ast.body.forEach(function (s) {
      if (s.k === 'Bind') {
        topEnv.bindings[s.name] = astToTy(s.type) || { k: 'unknown' };
      }
    });

    // Stack of expected return types for the enclosing function(s). Top is the
    // innermost fn. Empty = `return` at file scope, which is a hard error.
    // NB: declared here (before the run) because `var` initializations don't
    // hoist — only the declaration does. Placing it below the try/catch would
    // leave it `undefined` when Fn/Return is visited from inside the try.
    var retTyStack = [];

    try {
      ast.body.forEach(function (s) { checkStmt(s, topEnv); });
    } catch (e) { return e; }
    return null;

    function extend(env) { return { bindings: Object.create(null), parent: env }; }
    function lookup(env, name) {
      while (env) { if (name in env.bindings) return env.bindings[name]; env = env.parent; }
      return null;
    }

    function checkStmt(node, env) {
      if (node.k === 'Bind') {
        var declared = astToTy(node.type);
        var vt = inferExpr(node.value, declared, env);
        env.bindings[node.name] = declared || vt;
        return;
      }
      if (node.k === 'Assign') {
        var t = lookup(env, node.name);
        inferExpr(node.value, t, env);
        return;
      }
      if (node.k === 'ExprStmt') { inferExpr(node.expr, null, env); return; }
      if (node.k === 'Return') {
        if (retTyStack.length === 0) throw tyErr(node.line, "'return' outside function");
        // `return` always carries a value after the parser change — unit-returning
        // functions use `return ()`, which is a Unit literal typed as `unit`.
        inferExpr(node.value, retTyStack[retTyStack.length - 1], env);
        return;
      }
      if (node.k === 'For') {
        var iter = inferExpr(node.iter, null, env);
        var elemTy =
          iter.k === 'range'  ? iter.elem  :
          iter.k === 'array'  ? iter.elem  :
          iter.k === 'string' ? { k: 'u8' } :
                                { k: 'unknown' };
        var fenv = extend(env);
        if (node.name) fenv.bindings[node.name] = elemTy;
        node.body.forEach(function (s) { checkStmt(s, fenv); });
        return;
      }
      // Break / Continue: nothing to check
    }

    function checkInterp(raw, env, line) {
      // Re-parse each ${...} and check in the enclosing env. Same approach as
      // checkScope — errors re-tagged to the string's line.
      var parts = splitInterp(raw);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].interp !== undefined) {
          try {
            var innerAst = parse(tokenize(parts[i].interp));
            innerAst.body.forEach(function (s) { checkStmt(s, env); });
          } catch (e) { e.line = line; throw e; }
        }
      }
    }

    function inferExpr(node, expected, env) {
      switch (node.k) {
        case 'Unit': return conform(expected, { k: 'unit' }, node.line);
        case 'Lit': {
          if (typeof node.v === 'boolean') return conform(expected, { k: 'bool' }, node.line);
          // node.isFloat is authoritative — JS number has no int/float distinction
          // at runtime, so `2.0 === 2` and Number.isInteger can't be trusted here.
          if (!node.isFloat) {
            if (expected && INT_TYS.has(expected.k)) return expected;
            if (expected && expected.k !== 'unknown')
              throw tyErr(node.line, 'expected ' + tyStr(expected) + ', got integer literal');
            return { k: 'int' };
          }
          if (expected && FLOAT_TYS.has(expected.k)) return expected;
          if (expected && expected.k !== 'unknown')
            throw tyErr(node.line, 'expected ' + tyStr(expected) + ', got float literal');
          return { k: 'float' };
        }
        case 'Char': return conform(expected, { k: 'u8' }, node.line);
        case 'Str':
          checkInterp(node.raw, env, node.line);
          return conform(expected, { k: 'string' }, node.line);

        case 'Ident': {
          var t = lookup(env, node.name);
          if (!t) return { k: 'unknown' };   // scope check reports undefined
          return conform(expected, t, node.line);
        }

        case 'Block': {
          var benv = extend(env);
          var bt = { k: 'unit' };
          for (var i = 0; i < node.body.length; i++) {
            var s = node.body[i];
            var isLast = i === node.body.length - 1;
            if (isLast && s.k === 'ExprStmt') bt = inferExpr(s.expr, expected, benv);
            else checkStmt(s, benv);
          }
          return bt;
        }

        case 'While': {
          inferExpr(node.cond, { k: 'bool' }, env);
          var wenv = extend(env);
          var wt = { k: 'unit' };
          for (var i = 0; i < node.body.length; i++) {
            var s = node.body[i];
            var isLast = i === node.body.length - 1;
            if (isLast && s.k === 'ExprStmt') wt = inferExpr(s.expr, null, wenv);
            else checkStmt(s, wenv);
          }
          return wt;
        }

        case 'If': {
          inferExpr(node.cond, { k: 'bool' }, env);
          var thenT = inferExpr(node.then, expected, env);
          if (node.else_) {
            var elseT = inferExpr(node.else_, expected || thenT, env);
            if (thenT.k !== 'unknown' && elseT.k !== 'unknown' && !tyEq(thenT, elseT)) {
              throw tyErr(node.line, 'if branches differ: ' + tyStr(thenT) + ' vs ' + tyStr(elseT));
            }
            if (thenT.k === 'unknown') return elseT;
          }
          return thenT;
        }

        case 'Range': {
          var start = inferExpr(node.start, null, env);
          var end   = inferExpr(node.end,   start, env);
          var elem  = start.k !== 'unknown' ? start : end;
          if (elem.k !== 'unknown' && !isNumericKind(elem.k) && elem.k !== 'u8') {
            throw tyErr(node.line, 'range bound must be numeric, got ' + tyStr(elem));
          }
          return { k: 'range', elem: elem };
        }

        case 'List': {
          var prefix = node.typePrefix ? astToTy(node.typePrefix) : null;
          var ctx = prefix || (expected && (expected.k === 'array' || expected.k === 'tuple') ? expected : null);
          if (ctx) {
            if (ctx.k === 'array') {
              node.elements.forEach(function (el) { inferExpr(el, ctx.elem, env); });
              return conform(expected, ctx, node.line);
            }
            if (ctx.k === 'tuple') {
              if (node.elements.length !== ctx.elems.length) {
                throw tyErr(node.line,
                  'tuple literal has ' + node.elements.length + ' element(s) but type '
                  + tyStr(ctx) + ' expects ' + ctx.elems.length);
              }
              node.elements.forEach(function (el, i) { inferExpr(el, ctx.elems[i], env); });
              return conform(expected, ctx, node.line);
            }
            throw tyErr(node.line, 'invalid collection type ' + tyStr(ctx));
          }
          // No context — infer each element, then apply the spec's rule.
          if (node.elements.length === 0) {
            throw tyErr(node.line, 'empty .{} needs a type context (annotation or [T].{…} prefix)');
          }
          var elemTys = node.elements.map(function (el) { return inferExpr(el, null, env); });
          var allSame = elemTys.every(function (t) { return tyEq(t, elemTys[0]); });
          if (allSame) {
            throw tyErr(node.line,
              'homogeneous .{…} is ambiguous — add an annotation ([' + tyStr(elemTys[0]) + ']) '
              + 'or use the [' + tyStr(elemTys[0]) + '].{…} prefix');
          }
          return { k: 'tuple', elems: elemTys };
        }

        case 'Index': {
          var obj = inferExpr(node.obj, null, env);
          var idx = inferExpr(node.idx, null, env);
          if (idx.k === 'range') {
            if (obj.k === 'string') return conform(expected, { k: 'string' }, node.line);
            if (obj.k === 'array')  return conform(expected, obj, node.line);
            return { k: 'unknown' };
          }
          if (idx.k !== 'unknown' && !INT_TYS.has(idx.k) && idx.k !== 'u8') {
            throw tyErr(node.line, 'index must be integer, got ' + tyStr(idx));
          }
          if (obj.k === 'string') return conform(expected, { k: 'u8' }, node.line);
          if (obj.k === 'array')  return conform(expected, obj.elem, node.line);
          if (obj.k === 'tuple')  return { k: 'unknown' };  // needs literal-index resolution
          return { k: 'unknown' };
        }

        case 'Member': {
          var obj = inferExpr(node.obj, null, env);
          var mt  = methodOf(obj, node.prop, node.line);
          return conform(expected, mt, node.line);
        }

        case 'Call': {
          var fnT = inferExpr(node.callee, null, env);
          if (fnT.k === 'fn') {
            var params = fnT.params || [];
            if (node.args.length !== params.length) {
              throw tyErr(node.line, 'expected ' + params.length + ' arg(s), got ' + node.args.length);
            }
            for (var i = 0; i < node.args.length; i++) {
              inferExpr(node.args[i], params[i], env);
            }
            return conform(expected, fnT.ret || { k: 'unknown' }, node.line);
          }
          // Unknown callee — still walk args so nested expressions get checked.
          node.args.forEach(function (a) { inferExpr(a, null, env); });
          return { k: 'unknown' };
        }

        case 'Fn': {
          var fenv = extend(env);
          var pTys = [];
          for (var i = 0; i < node.params.length; i++) {
            var pt = astToTy(node.paramTypes[i]);
            pTys.push(pt);
            fenv.bindings[node.params[i]] = pt || { k: 'unknown' };
          }
          var declaredRet = astToTy(node.returnType);
          retTyStack.push(declaredRet || { k: 'unknown' });
          var bodyTy;
          try { bodyTy = inferExpr(node.body, declaredRet, fenv); }
          finally { retTyStack.pop(); }
          return { k: 'fn', params: pTys, ret: declaredRet || bodyTy };
        }

        case 'BinOp': {
          var op = node.op;
          if (op === 'and' || op === 'or') {
            inferExpr(node.left,  { k: 'bool' }, env);
            inferExpr(node.right, { k: 'bool' }, env);
            return conform(expected, { k: 'bool' }, node.line);
          }
          if (op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=') {
            var lcmp = inferExpr(node.left, null, env);
            inferExpr(node.right, lcmp, env);
            return conform(expected, { k: 'bool' }, node.line);
          }
          // Arithmetic. Strings no longer concat with `+`; use s.concat(...).
          var hint = (expected && isNumericKind(expected.k)) ? expected : null;
          var lt = inferExpr(node.left,  hint, env);
          var rt = inferExpr(node.right, lt.k === 'unknown' ? hint : lt, env);
          var res = lt.k !== 'unknown' ? lt : rt;
          if (op === '+' && (lt.k === 'string' || rt.k === 'string')) {
            throw tyErr(node.line, "'+' does not concatenate strings — use s.concat(...) instead");
          }
          if (res.k !== 'unknown' && !isNumericKind(res.k) && res.k !== 'u8') {
            throw tyErr(node.line, op + ' requires numeric operands, got ' + tyStr(res));
          }
          return conform(expected, res, node.line);
        }

        case 'Unary': {
          if (node.op === '-') {
            var t = inferExpr(node.expr, expected, env);
            if (t.k !== 'unknown' && !isNumericKind(t.k))
              throw tyErr(node.line, 'unary - requires numeric, got ' + tyStr(t));
            return t;
          }
          if (node.op === 'not') {
            inferExpr(node.expr, { k: 'bool' }, env);
            return conform(expected, { k: 'bool' }, node.line);
          }
          return { k: 'unknown' };
        }
      }
      return { k: 'unknown' };
    }
  }

  // ──────────────────────────────────────────────
  // Evaluator
  // ──────────────────────────────────────────────
  function evaluate(ast) {
    var output = [];

    function mkEnv(parent) { return { vars: Object.create(null), parent: parent }; }

    function envGet(env, name) {
      if (name in env.vars) return env.vars[name];
      if (env.parent)       return envGet(env.parent, name);
      throw new Error('Undefined: ' + name);
    }

    function envSet(env, name, val) { env.vars[name] = val; }

    // Walk up the chain to mutate an existing binding (for = assignment)
    function envUpdate(env, name, val) {
      if (name in env.vars) { env.vars[name] = val; return; }
      if (env.parent)       { envUpdate(env.parent, name, val); return; }
      throw new Error('Undefined: ' + name);
    }

    function display(v) {
      if (v === null || v === undefined) return '()';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (v && v._fn)    return '<fn>';
      if (v && v._char)  return String.fromCharCode(v.v);
      if (v && v._range) {
        var sep = v.inclusive ? '..=' : '..';
        if (v._charRange) {
          return "'" + String.fromCharCode(v.start) + "'" + sep + "'" + String.fromCharCode(v.end) + "'";
        }
        return v.start + sep + v.end;
      }
      if (Array.isArray(v)) return '.{' + v.map(display).join(', ') + '}';
      return String(v);
    }

    // Unwrap a tagged char to its underlying u8 number (or return v unchanged)
    function num(v) { return (v && v._char) ? v.v : v; }

    // Materialise an iterable into a JS array of values
    function iterValues(v, line) {
      if (Array.isArray(v)) return v;
      if (v && v._range) {
        var out = [], step = v.start <= v.end ? 1 : -1;
        var stop = v.inclusive ? v.end + step : v.end;
        for (var n = v.start; n !== stop; n += step) {
          out.push(v._charRange ? { _char: true, v: n } : n);
        }
        return out;
      }
      var e = new Error('Not iterable: ' + display(v));
      e.line = line;
      throw e;
    }

    // Evaluate ${...} interpolations inside a string at runtime. Escape
    // sequences are expanded on literal-text segments only — escapes inside
    // an embedded ${"..."} pass through to the inner tokenizer untouched.
    function interpStr(raw, env) {
      var out = '', parts = splitInterp(raw);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.text !== undefined) {
          out += unescText(p.text);
        } else {
          try {
            var toks = tokenize(p.interp);
            var ast  = parse(toks);
            var val  = null;
            for (var j = 0; j < ast.body.length; j++) val = evalStmt(ast.body[j], env);
            out += display(val);
          } catch (e) { out += '<err:' + e.message + '>'; }
        }
      }
      return out;
    }

    // Attach line to an error only if not already annotated (deepest site wins)
    function annotate(e, line) {
      if (e.line === undefined && line !== undefined) e.line = line;
      return e;
    }

    var globalEnv = mkEnv(null);
    envSet(globalEnv, '#', {
      _obj: true,
      println:  { _fn: true, call: function (a) { output.push(a.map(display).join(' ')); return null; } },
      print:    { _fn: true, call: function (a) { output.push(a.map(display).join(''));  return null; } },
      assertEq: { _fn: true, call: function (a) {
        if (a[0] !== a[1]) throw new Error('assertEq failed: ' + display(a[0]) + ' != ' + display(a[1]));
        return null;
      }},
    });

    function evalStmt(node, env) {
      try {
        if (node.k === 'Bind') {
          var val = evalExpr(node.value, env);
          envSet(env, node.name, val);
          return val;
        }
        if (node.k === 'Assign') {
          var val = evalExpr(node.value, env);
          envUpdate(env, node.name, val);
          return val;
        }
        if (node.k === 'ExprStmt') return evalExpr(node.expr, env);
        if (node.k === 'For')      return evalFor(node, env);
        if (node.k === 'Break')    { var b = new Error('break outside loop');    b._break    = true; throw b; }
        if (node.k === 'Continue') { var c = new Error('continue outside loop'); c._continue = true; throw c; }
        if (node.k === 'Return') {
          var r = new Error('return outside function');
          r._return = true; r.value = evalExpr(node.value, env);
          throw r;
        }
        throw new Error('Unknown statement kind: ' + node.k);
      } catch(e) { throw annotate(e, node.line); }
    }

    function evalFor(node, env) {
      var iter = evalExpr(node.iter, env);
      var values = iterValues(iter, node.line);
      var iters = 0, val = null;
      for (var i = 0; i < values.length; i++) {
        if (++iters > 10000) {
          var te = new Error('Exceeded 10,000 iterations');
          te.line = node.line;
          throw te;
        }
        var fenv = mkEnv(env);
        if (node.name) envSet(fenv, node.name, values[i]);
        try {
          for (var j = 0; j < node.body.length; j++) val = evalStmt(node.body[j], fenv);
        } catch (e) {
          if (e._continue) continue;
          if (e._break)    return val;
          throw e;
        }
      }
      return val;
    }

    function evalExpr(node, env) {
      switch (node.k) {

        case 'Lit':   return node.v;
        case 'Unit':  return null;
        case 'Char':  return { _char: true, v: node.v };
        case 'Str':   return interpStr(node.raw, env);

        case 'Ident': {
          try { return envGet(env, node.name); }
          catch(e) { throw annotate(e, node.line); }
        }

        case 'Block': {
          var lenv = mkEnv(env), val = null;
          for (var i = 0; i < node.body.length; i++) val = evalStmt(node.body[i], lenv);
          return val;
        }

        case 'While': {
          var val = null, iters = 0;
          // Condition is evaluated against the outer env so loop-counter mutations
          // (via envUpdate) are visible to it on the next iteration.
          whileLoop: while (evalExpr(node.cond, env)) {
            if (++iters > 10000) {
              var te = new Error('Exceeded 10,000 iterations');
              te.line = node.line;
              throw te;
            }
            var iterEnv = mkEnv(env);
            try {
              for (var i = 0; i < node.body.length; i++) val = evalStmt(node.body[i], iterEnv);
            } catch (e) {
              if (e._continue) continue whileLoop;
              if (e._break)    break    whileLoop;
              throw e;
            }
          }
          return val;
        }

        case 'Range': {
          var s = evalExpr(node.start, env);
          var e = evalExpr(node.end,   env);
          var isCharRange = (s && s._char) || (e && e._char);
          return { _range: true, start: num(s), end: num(e), inclusive: node.inclusive, _charRange: isCharRange };
        }

        case 'List': {
          return node.elements.map(function (el) { return evalExpr(el, env); });
        }

        case 'Index': {
          try {
            var obj = evalExpr(node.obj, env);
            var idx = evalExpr(node.idx, env);
            // Range index — slice. Works on arrays and strings.
            if (idx && idx._range) {
              var lo = idx.start, hi = idx.inclusive ? idx.end + 1 : idx.end;
              if (typeof obj === 'string')  return obj.slice(lo, hi);
              if (Array.isArray(obj))       return obj.slice(lo, hi);
              throw new Error('Cannot slice ' + display(obj));
            }
            if (Array.isArray(obj))      return obj[num(idx)];
            if (typeof obj === 'string') return { _char: true, v: obj.charCodeAt(num(idx)) };
            throw new Error('Cannot index ' + display(obj));
          } catch(e) { throw annotate(e, node.line); }
        }

        case 'If': {
          if (evalExpr(node.cond, env)) return evalExpr(node.then, env);
          if (node.else_)               return evalExpr(node.else_, env);
          return null;
        }

        case 'Fn': {
          // Capture env by reference — enables recursion (letrec via mutation)
          return { _fn: true, params: node.params, body: node.body, env: env };
        }

        case 'Call': {
          try {
            var callee = evalExpr(node.callee, env);
            var args   = node.args.map(function (a) { return evalExpr(a, env); });
            if (!callee || !callee._fn) throw new Error('Not a function: ' + display(callee));
            if (callee.call) return callee.call(args); // built-in
            var fnEnv = mkEnv(callee.env);
            for (var i = 0; i < callee.params.length; i++)
              envSet(fnEnv, callee.params[i], i < args.length ? args[i] : null);
            try {
              return evalExpr(callee.body, fnEnv);
            } catch (e) {
              if (e._return) return e.value;
              throw e;
            }
          } catch(e) { throw annotate(e, node.line); }
        }

        case 'Member': {
          try {
            var obj = evalExpr(node.obj, env);
            if (Array.isArray(obj)) {
              if (node.prop === 'length') return { _fn: true, call: function () { return obj.length; } };
              if (node.prop === 'append') return { _fn: true, call: function (a) { obj.push(a[0]); return null; } };
              if (node.prop === 'remove') return { _fn: true, call: function (a) {
                var idx = a[0];
                if (idx < 0 || idx >= obj.length) throw new Error('remove: index ' + idx + ' out of bounds (length ' + obj.length + ')');
                return obj.splice(idx, 1)[0];
              } };
              throw new Error("No method '" + node.prop + "' on array");
            }
            if (typeof obj === 'string') {
              if (node.prop === 'length') return { _fn: true, call: function () { return obj.length; } };
              if (node.prop === 'concat') return { _fn: true, call: function (a) {
                return obj + a[0];
              } };
              throw new Error("No method '" + node.prop + "' on string");
            }
            if (obj && typeof obj === 'object' && node.prop in obj) return obj[node.prop];
            throw new Error("No field '" + node.prop + "' on " + display(obj));
          } catch(e) { throw annotate(e, node.line); }
        }

        case 'BinOp': {
          // Short-circuit logical operators
          if (node.op === 'and') return evalExpr(node.left, env) && evalExpr(node.right, env);
          if (node.op === 'or')  return evalExpr(node.left, env) || evalExpr(node.right, env);
          var l = evalExpr(node.left, env);
          var r = evalExpr(node.right, env);
          // Tagged chars behave as u8 numbers for arithmetic and comparison.
          var ln = num(l), rn = num(r);
          switch (node.op) {
            case '+':  return ln + rn;
            case '-':  return ln - rn;
            case '*':  return ln * rn;
            case '/':  return ln / rn;
            case '%':  return ln % rn;
            case '**': return Math.pow(ln, rn);
            case '==': return ln === rn;
            case '!=': return ln !== rn;
            case '<':  return ln <  rn;
            case '>':  return ln >  rn;
            case '<=': return ln <= rn;
            case '>=': return ln >= rn;
            default: throw new Error('Unknown operator: ' + node.op);
          }
        }

        case 'Unary': {
          var v = evalExpr(node.expr, env);
          if (node.op === '-')   return -num(v);
          if (node.op === 'not') return !v;
          break;
        }

      }
      throw new Error('Unknown node kind: ' + node.k);
    }

    // Evaluate all top-level statements
    for (var i = 0; i < ast.body.length; i++) evalStmt(ast.body[i], globalEnv);

    // Auto-call main() only if it was declared as `share` — `local` / `let`
    // bindings are private and should not run as an entry point.
    var mainBind = null;
    for (var i = 0; i < ast.body.length; i++) {
      var s = ast.body[i];
      if (s.k === 'Bind' && s.name === 'main') { mainBind = s; break; }
    }
    if (mainBind && mainBind.kw === 'share'
        && globalEnv.vars['main'] && globalEnv.vars['main']._fn) {
      evalExpr({ k: 'Call', callee: { k: 'Ident', name: 'main' }, args: [] }, globalEnv);
    }

    return output;
  }

  // ──────────────────────────────────────────────
  // Error display helpers
  // ──────────────────────────────────────────────
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Re-render the code view with the error line highlighted and an inline message.
  // Clears automatically the next time the user edits (highlight.js input handler runs).
  function setEditorError(codeEl, source, errLine, errMsg) {
    if (!codeEl) return;
    var hl = window.highlightRuka ? window.highlightRuka(source) : escHtml(source);
    if (errLine) {
      var lines = hl.split('\n');
      var idx = errLine - 1;
      if (idx >= 0 && idx < lines.length) {
        lines[idx] = '<span class="err-line">' + lines[idx] + '</span>'
          + '<span class="err-msg"> \u2190 ' + escHtml(errMsg) + '</span>';
      }
      hl = lines.join('\n');
    }
    codeEl.innerHTML = hl;
  }

  // ──────────────────────────────────────────────
  // Check-as-you-type + Run button
  // ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var runBtn   = document.getElementById('playground-run');
    var textarea = document.getElementById('playground-textarea');
    var output   = document.getElementById('playground-output');
    var panel    = document.getElementById('playground-output-panel');
    var codeEl   = document.getElementById('playground-code');

    if (!runBtn || !textarea || !output) return;

    // Debounce handle for the parse-error check
    var checkTimer = null;

    // Called by highlight.js on every input/Tab event.
    // Re-highlights immediately (fast), then after a short pause checks for
    // parse errors so mid-expression typing doesn't flash spurious errors.
    window.rukaCheckAndHighlight = function (source) {
      // Immediate clean highlight — always snappy
      if (codeEl && window.highlightRuka) codeEl.innerHTML = window.highlightRuka(source);
      // Debounced parse check
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(function () {
        checkTimer = null;
        var err = null;
        try {
          var ast = parse(tokenize(source));
          err = checkScope(ast) || checkTypes(ast);
        } catch (e) {
          err = e;
        }
        if (err && textarea && textarea.value === source) {
          setEditorError(codeEl, source, err.line, err.message);
        }
      }, 400);
    };

    runBtn.addEventListener('click', function () {
      // Cancel any pending check — the run result is authoritative
      if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }
      runBtn.disabled = true;
      runBtn.textContent = 'RUNNING';
      // Yield to the browser so the button state renders before we block
      setTimeout(function () {
        try {
          var ast = parse(tokenize(textarea.value));
          var sErr = checkScope(ast);
          if (sErr) throw sErr;
          var tErr = checkTypes(ast);
          if (tErr) throw tErr;
          var lines = evaluate(ast);
          // Clear any previous error highlight on a successful run
          if (codeEl && window.highlightRuka) codeEl.innerHTML = window.highlightRuka(textarea.value);
          output.textContent = lines.length ? lines.join('\n') : '(no output)';
          if (panel) panel.setAttribute('data-state', 'ok');
        } catch (e) {
          setEditorError(codeEl, textarea.value, e.line, e.message);
          output.textContent = 'Error' + (e.line ? ' (line ' + e.line + ')' : '') + ': ' + e.message;
          if (panel) panel.setAttribute('data-state', 'err');
        }
        runBtn.disabled = false;
        runBtn.textContent = 'RUN';
      }, 0);
    });
  });
})();
