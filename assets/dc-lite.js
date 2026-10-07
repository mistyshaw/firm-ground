/* Tiny renderer for the sample forms. No dependencies, no network. */
(function () {
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var PROPS = { value: 1, checked: 1, selected: 1, disabled: 1 };

  function look(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    var v = scope[parts[0]];
    for (var i = 1; i < parts.length; i++) v = v == null ? undefined : v[parts[i]];
    return v;
  }
  function str(v) { return v == null || v === false ? '' : String(v); }
  function applyProps(el) {
    var p = el.__p;
    if (!p) return;
    for (var k in p) {
      var val = k === 'value' ? str(p[k]) : !!p[k];
      if (el[k] !== val) el[k] = val;
    }
  }
  function kids(node, scope, parent) {
    for (var c = node.firstChild; c; c = c.nextSibling) build(c, scope, parent);
  }
  function build(node, scope, parent) {
    if (node.nodeType === 3) {
      parent.appendChild(document.createTextNode(node.nodeValue.replace(HOLE, function (m, p) { return str(look(p, scope)); })));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-if') {
      var m = WHOLE.exec(node.getAttribute('value') || '');
      if (m && look(m[1], scope)) kids(node, scope, parent);
      return;
    }
    if (tag === 'sc-for') {
      var lm = WHOLE.exec(node.getAttribute('list') || '');
      var list = (lm && look(lm[1], scope)) || [];
      var as = node.getAttribute('as');
      list.forEach(function (it, i) {
        var s = Object.assign({}, scope); s[as] = it; s.index = i;
        kids(node, s, parent);
      });
      return;
    }
    var el = document.createElementNS(node.namespaceURI, tag);
    el.__h = {}; el.__p = {};
    Array.prototype.forEach.call(node.attributes, function (a) {
      var name = a.name, val = a.value;
      if (name.indexOf('hint-') === 0) return;
      var w = WHOLE.exec(val);
      if (/^on[a-z]+$/i.test(name) && w) { el.__h[name.slice(2).toLowerCase()] = look(w[1], scope); return; }
      if (w && PROPS[name]) { el.__p[name] = look(w[1], scope); return; }
      if (w) {
        var v = look(w[1], scope);
        if (name.indexOf('aria-') === 0 || name.indexOf('data-') === 0) el.setAttribute(name, String(v));
        else if (v === true) el.setAttribute(name, '');
        else if (v != null && v !== false) el.setAttribute(name, String(v));
        return;
      }
      el.setAttribute(name, val.replace(HOLE, function (mm, p) { return str(look(p, scope)); }));
    });
    kids(node, scope, el);
    applyProps(el);
    parent.appendChild(el);
  }

  function patch(live, nw) {
    Array.prototype.slice.call(live.attributes).forEach(function (a) {
      if (!nw.hasAttribute(a.name)) live.removeAttribute(a.name);
    });
    Array.prototype.forEach.call(nw.attributes, function (a) {
      if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
    });
    live.__h = nw.__h; live.__p = nw.__p;
    children(live, nw);
    applyProps(live);
  }
  function children(live, nw) {
    var b = Array.prototype.slice.call(nw.childNodes);
    for (var i = 0; i < b.length; i++) {
      var x = live.childNodes[i], y = b[i];
      if (!x) live.appendChild(y);
      else if (x.nodeType === y.nodeType && x.nodeName === y.nodeName) {
        if (x.nodeType === 3) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; }
        else patch(x, y);
      } else live.replaceChild(y, x);
    }
    while (live.childNodes.length > b.length) live.removeChild(live.lastChild);
  }

  function DCLogic() { this.state = {}; }
  DCLogic.prototype.setState = function (p) {
    if (typeof p === 'function') p = p(this.state);
    this.state = Object.assign({}, this.state, p);
    if (this._render) this._render();
  };

  function mount(Component) {
    var inst = new Component();
    var tpl = document.getElementById('dc-tpl').content;
    var root = document.getElementById('app');
    inst._render = function () {
      var frag = document.createElement('div');
      var vals = inst.renderVals();
      kids(tpl, vals, frag);
      children(root, frag);
    };
    ['click', 'change', 'input', 'submit'].forEach(function (type) {
      root.addEventListener(type, function (e) {
        var key = type === 'input' ? 'change' : type;
        for (var n = e.target; n && n !== root.parentNode; n = n.parentNode) {
          var h = n.__h && n.__h[key];
          if (typeof h === 'function') { h.call(inst, e); return; }
        }
      });
    });
    inst._render();
  }
  window.DCLogic = DCLogic;
  window.DC = { mount: mount };
})();
