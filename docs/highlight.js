/* ── Ruka syntax highlighter ── */
(function () {
  const KEYWORDS = new Set([
    'let', 'const', 'local', 'do', 'end', 'if', 'else', 'match', 'with',
    'while', 'for', 'in', 'return', 'record', 'variant', 'interface',
    'and', 'or', 'not', 'mut', 'mov', 'stc', 'eva', 'true', 'false', 'self'
  ]);

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function span(cls, s) {
    return '<span class="' + cls + '">' + esc(s) + '</span>';
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

      // String
      if (raw[i] === '"') {
        let j = i + 1, strOut = '"';
        while (j < raw.length && raw[j] !== '"') {
          if (raw[j] === '\\') { strOut += raw[j] + (raw[j + 1] ?? ''); j += 2; continue; }
          if (raw[j] === '$' && raw[j + 1] === '{') {
            out += span('str', strOut);
            strOut = '';
            out += span('str', '${');
            j += 2;
            let depth = 1, inner = '';
            while (j < raw.length && depth > 0) {
              if (raw[j] === '{') depth++;
              else if (raw[j] === '}') { if (--depth === 0) break; }
              inner += raw[j++];
            }
            out += highlight(inner);
            out += span('str', '}');
            j++;
            continue;
          }
          strOut += raw[j++];
        }
        out += span('str', strOut + '"');
        i = j + 1;
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

      // Built-in  @name
      if (raw[i] === '@') {
        let j = i + 1;
        while (j < raw.length && /\w/.test(raw[j])) j++;
        out += span('bi', raw.slice(i, j));
        i = j;
        continue;
      }

      // Number
      if (/\d/.test(raw[i])) {
        let j = i;
        if (raw[i] === '0' && (raw[i + 1] === 'b' || raw[i + 1] === 'x')) {
          j += 2;
          while (j < raw.length && /[\da-fA-F]/.test(raw[j])) j++;
        } else {
          while (j < raw.length && /[\d.]/.test(raw[j])) j++;
        }
        out += span('num', raw.slice(i, j));
        i = j;
        continue;
      }

      // Identifier / keyword / type
      if (/[a-zA-Z_]/.test(raw[i])) {
        let j = i;
        while (j < raw.length && /\w/.test(raw[j])) j++;
        const word = raw.slice(i, j);
        if (KEYWORDS.has(word))      out += span('kw', word);
        else if (/^[A-Z]/.test(word)) out += span('tp', word);
        else                          out += esc(word);
        i = j;
        continue;
      }

      out += esc(raw[i++]);
    }

    return out;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // ── Syntax highlighting ──
    document.querySelectorAll('code.ruka').forEach(function (el) {
      el.innerHTML = highlight(el.textContent);
    });

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
