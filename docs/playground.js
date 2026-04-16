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
    var toks = [], i = 0, len = src.length, line = 1;
    while (i < len) {
      // newlines advance line counter
      if (src[i] === '\n') { line++; i++; continue; }
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
          if (src[i] === '\\' && i + 1 < len) { raw += src[i] + src[i + 1]; i += 2; }
          else raw += src[i++];
        }
        i++; // closing "
        toks.push({ t: 'STR', v: raw, line: tok_line });
        continue;
      }
      // number
      if (/\d/.test(src[i])) {
        var n = '';
        while (i < len && /[\d.]/.test(src[i])) n += src[i++];
        toks.push({ t: 'NUM', v: parseFloat(n), line: tok_line });
        continue;
      }
      // identifier / keyword
      if (/[a-zA-Z_]/.test(src[i])) {
        var w = '';
        while (i < len && /\w/.test(src[i])) w += src[i++];
        toks.push({ t: KW.has(w) ? w : 'ID', v: w, line: tok_line });
        continue;
      }
      // two-char tokens
      var c2 = src.slice(i, i + 2);
      if (c2 === '==' || c2 === '!=' || c2 === '<=' || c2 === '>=' || c2 === '=>') {
        toks.push({ t: c2, v: c2, line: tok_line }); i += 2; continue;
      }
      // single-char token
      toks.push({ t: src[i], v: src[i], line: tok_line }); i++;
    }
    toks.push({ t: 'EOF', v: '', line: line });
    return toks;
  }

  // ──────────────────────────────────────────────
  // Parser
  // ──────────────────────────────────────────────
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

    // Lookahead: is '(' at current pos the start of a function literal?
    function isFnLiteral() {
      var j = pos + 1, depth = 1;
      while (j < toks.length && depth > 0) {
        if (toks[j].t === '(') depth++;
        else if (toks[j].t === ')') depth--;
        j++;
      }
      return toks[j] && (toks[j].t === '=>' || toks[j].t === 'do');
    }

    function parseProgram() {
      var body = [];
      while (!check('EOF')) body.push(parseStmt());
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
        // skip optional : Type
        if (tryMatch(':')) while (!check('=') && !check('EOF')) pos++;
        eat('=');
        return { k: 'Bind', kw: kw.v, name: name, value: parseExpr(), line: kw.line };
      }
      // plain assignment: ident = expr
      if (check('ID') && toks[pos + 1] && toks[pos + 1].t === '=') {
        var al = toks[pos].line;
        var aname = eat('ID').v;
        eat('=');
        return { k: 'Assign', name: aname, value: parseExpr(), line: al };
      }
      var sl = peek().line;
      return { k: 'ExprStmt', expr: parseExpr(), line: sl };
    }

    function parseExpr() {
      if (check('(') && isFnLiteral()) return parseFn();
      if (check('while'))              return parseWhile();
      return parseIf();
    }

    function parseFn() {
      var l = peek().line;
      eat('(');
      var params = [];
      while (!check(')') && !check('EOF')) {
        tryMatch('*', '&', '$', '@'); // skip mode prefix sigil
        if (check('ID')) params.push(eat('ID').v);
        if (tryMatch(':')) while (!check(',') && !check(')') && !check('EOF')) pos++; // skip type
        tryMatch(',');
      }
      eat(')');
      var body;
      if (tryMatch('=>')) body = parseExpr();
      else { eat('do'); body = parseBlockExpr(); eat('end'); }
      return { k: 'Fn', params: params, body: body, line: l };
    }

    function parseWhile() {
      var l = peek().line;
      eat('while');
      var cond = parseExpr();
      eat('do');
      var body = parseBlockBody();
      eat('end');
      return { k: 'While', cond: cond, body: body, line: l };
    }

    function parseIf() {
      var ifTok = tryMatch('if');
      if (!ifTok) return parseOr();
      var cond = parseOr(); // don't recurse into if inside cond
      var then;
      if (tryMatch('=>')) then = parseExpr();
      else { eat('do'); then = parseBlockExpr(); eat('end'); }
      var else_ = null;
      if (tryMatch('else')) {
        if (check('if'))         else_ = parseIf();      // else-if chain
        else if (tryMatch('=>'))  else_ = parseExpr();
        else { eat('do'); else_ = parseBlockExpr(); eat('end'); }
      }
      return { k: 'If', cond: cond, then: then, else_: else_, line: ifTok.line };
    }

    // Returns a stmt array (stops at 'end', 'else', or EOF)
    function parseBlockBody() {
      var stmts = [];
      while (!check('end') && !check('else') && !check('EOF')) stmts.push(parseStmt());
      return stmts;
    }

    // Returns a Block expr node
    function parseBlockExpr() {
      return { k: 'Block', body: parseBlockBody() };
    }

    function parseOr() {
      var l = parseAnd();
      while (tryMatch('or')) l = { k: 'BinOp', op: 'or', left: l, right: parseAnd() };
      return l;
    }
    function parseAnd() {
      var l = parseCmp();
      while (tryMatch('and')) l = { k: 'BinOp', op: 'and', left: l, right: parseCmp() };
      return l;
    }
    function parseCmp() {
      var l = parseAdd();
      var op = tryMatch('==', '!=', '<', '>', '<=', '>=');
      if (op) l = { k: 'BinOp', op: op.t, left: l, right: parseAdd() };
      return l;
    }
    function parseAdd() {
      var l = parseMul();
      while (check('+') || check('-')) {
        var op = toks[pos++].t;
        l = { k: 'BinOp', op: op, left: l, right: parseMul() };
      }
      return l;
    }
    function parseMul() {
      var l = parseUnary();
      while (check('*') || check('/') || check('%')) {
        var op = toks[pos++].t;
        l = { k: 'BinOp', op: op, left: l, right: parseUnary() };
      }
      return l;
    }
    function parseUnary() {
      if (tryMatch('-'))   return { k: 'Unary', op: '-',   expr: parseUnary() };
      if (tryMatch('not')) return { k: 'Unary', op: 'not', expr: parseUnary() };
      return parseCall();
    }
    function parseCall() {
      var expr = parsePrimary();
      while (true) {
        if (check('(')) {
          var cl = peek().line;
          eat('(');
          var args = [];
          while (!check(')') && !check('EOF')) { args.push(parseExpr()); tryMatch(','); }
          eat(')');
          expr = { k: 'Call', callee: expr, args: args, line: cl };
        } else if (check('.')) {
          var ml = peek().line;
          eat('.');
          expr = { k: 'Member', obj: expr, prop: eat('ID').v, line: ml };
        } else break;
      }
      return expr;
    }
    function parsePrimary() {
      var tok = peek();
      if (tok.t === 'NUM')   { pos++; return { k: 'Lit',   v: tok.v,    line: tok.line }; }
      if (tok.t === 'STR')   { pos++; return { k: 'Str',   raw: tok.v,  line: tok.line }; }
      if (tok.t === 'true')  { pos++; return { k: 'Lit',   v: true,     line: tok.line }; }
      if (tok.t === 'false') { pos++; return { k: 'Lit',   v: false,    line: tok.line }; }
      if (tok.t === 'ID')    { pos++; return { k: 'Ident', name: tok.v, line: tok.line }; }
      if (tok.t === '(')     { eat('('); var e = parseExpr(); eat(')'); return e; }
      if (tok.t === 'do')    { eat('do'); var b = parseBlockExpr(); eat('end'); return b; }
      var ue = new Error("Unexpected token '" + tok.t + "' ('" + tok.v + "')");
      ue.line = tok.line;
      throw ue;
    }

    return parseProgram();
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
      if (v && v._fn) return '<fn>';
      return String(v);
    }

    // Evaluate ${...} interpolations inside a string at runtime
    function interpStr(raw, env) {
      return raw.replace(/\$\{([^}]*)\}/g, function (_, inner) {
        try {
          var toks = tokenize(inner);
          var ast  = parse(toks);
          var val  = null;
          for (var i = 0; i < ast.body.length; i++) val = evalStmt(ast.body[i], env);
          return display(val);
        } catch (e) { return '<err:' + e.message + '>'; }
      });
    }

    function unesc(raw) {
      return raw.replace(/\\n/g,  '\n')
                .replace(/\\t/g,  '\t')
                .replace(/\\\\/g, '\\')
                .replace(/\\"/g,  '"');
    }

    // Attach line to an error only if not already annotated (deepest site wins)
    function annotate(e, line) {
      if (e.line === undefined && line !== undefined) e.line = line;
      return e;
    }

    var globalEnv = mkEnv(null);
    envSet(globalEnv, 'ruka', {
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
        throw new Error('Unknown statement kind: ' + node.k);
      } catch(e) { throw annotate(e, node.line); }
    }

    function evalExpr(node, env) {
      switch (node.k) {

        case 'Lit':   return node.v;
        case 'Str':   return interpStr(unesc(node.raw), env);

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
          while (evalExpr(node.cond, env)) {
            if (++iters > 10000) {
              var te = new Error('Exceeded 10,000 iterations');
              te.line = node.line;
              throw te;
            }
            var iterEnv = mkEnv(env);
            for (var i = 0; i < node.body.length; i++) val = evalStmt(node.body[i], iterEnv);
          }
          return val;
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
            return evalExpr(callee.body, fnEnv);
          } catch(e) { throw annotate(e, node.line); }
        }

        case 'Member': {
          try {
            var obj = evalExpr(node.obj, env);
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
          switch (node.op) {
            case '+':  return (typeof l === 'string' || typeof r === 'string')
                              ? display(l) + display(r) : l + r;
            case '-':  return l - r;
            case '*':  return l * r;
            case '/':  return l / r;
            case '%':  return l % r;
            case '==': return l === r;
            case '!=': return l !== r;
            case '<':  return l < r;
            case '>':  return l > r;
            case '<=': return l <= r;
            case '>=': return l >= r;
            default: throw new Error('Unknown operator: ' + node.op);
          }
        }

        case 'Unary': {
          var v = evalExpr(node.expr, env);
          if (node.op === '-')   return -v;
          if (node.op === 'not') return !v;
          break;
        }

      }
      throw new Error('Unknown node kind: ' + node.k);
    }

    // Evaluate all top-level statements
    for (var i = 0; i < ast.body.length; i++) evalStmt(ast.body[i], globalEnv);

    // Auto-call main() if defined at top level
    if (globalEnv.vars['main'] && globalEnv.vars['main']._fn) {
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
        try {
          parse(tokenize(source));
          // No parse error — already rendered cleanly above, nothing to do
        } catch (e) {
          // Only annotate if the source hasn't changed since the timer was set
          if (textarea && textarea.value === source) {
            setEditorError(codeEl, source, e.line, e.message);
          }
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
          var lines = evaluate(parse(tokenize(textarea.value)));
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
