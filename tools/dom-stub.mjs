/* Minimal DOM stub — just enough of the browser for this app to run in Node. */

class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach((x) => this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
  toggle(c, on) {
    const want = on === undefined ? !this.set.has(c) : Boolean(on);
    if (want) this.set.add(c); else this.set.delete(c);
    return want;
  }
}

class Style {
  setProperty(k, v) { this[k] = v; }
}

let idc = 0;

export class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.childNodes = this.children;
    this._text = '';
    this.style = new Style();
    this.dataset = {};
    this.attrs = {};
    this.classList = new ClassList();
    this.listeners = {};
    this.parent = null;
    this.uid = ++idc;
  }
  get className() { return [...this.classList.set].join(' '); }
  set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this._text || this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children.length = 0; }
  set innerHTML(v) { this._text = String(v); }
  append(...kids) {
    for (const k of kids.flat()) {
      if (k === null || k === undefined || k === false) continue;
      const n = k.nodeType ? k : new Text(String(k));
      n.parent = this;
      this.children.push(n);
    }
  }
  removeChild(n) { this.children.splice(this.children.indexOf(n), 1); }
  remove() { this.parent?.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener() {}
  dispatch(type, ev = {}) {
    (this.listeners[type] || []).forEach((fn) => fn({ currentTarget: this, target: this, ...ev }));
  }
  /** Supports only the `.class` selectors this app uses. */
  querySelectorAll(sel) {
    const want = sel.replace('.', '');
    const out = [];
    const walk = (n) => {
      if (n.classList?.contains(want)) out.push(n);
      n.children?.forEach(walk);
    };
    this.children.forEach(walk);
    return out;
  }
}

class Text extends Node {
  constructor(t) { super('#text'); this.nodeType = 3; this._text = t; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
}

export function makeDom() {
  const body = new Node('body');
  const document = {
    body,
    createElement: (t) => new Node(t),
    createElementNS: (_ns, t) => new Node(t),
    createTextNode: (t) => new Text(t),
    getElementById: () => null,
    addEventListener() {},
    hidden: false,
  };
  globalThis.document = document;
  globalThis.window = globalThis;
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate() {} }, configurable: true, writable: true,
  });
  globalThis.localStorage = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
  };
  return document;
}
