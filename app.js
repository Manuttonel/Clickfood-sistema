/* ClickFood — protótipo de cantina com retirada no balcão.
 * Tudo roda no navegador: os dados ficam no localStorage (compartilhado entre abas)
 * e a sessão de login fica no sessionStorage (cada aba pode ser um usuário diferente).
 * Abra uma aba como cantina e outra como aluno para ver pedidos e chat em tempo real.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- constantes
  const DB_KEY = 'clickfood:db:v1';
  const SESSION_KEY = 'clickfood:session';
  const CART_KEY = 'clickfood:cart';

  const CATEGORIES = [
    { id: 'salgados', label: 'Salgados', icon: '🥟' },
    { id: 'lanches', label: 'Lanches', icon: '🍔' },
    { id: 'bebidas', label: 'Bebidas', icon: '🥤' },
    { id: 'doces', label: 'Doces', icon: '🍰' },
  ];

  const STATUS = {
    pago: { label: 'Pago · aguardando', short: 'Pago' },
    preparo: { label: 'Em preparo', short: 'Preparo' },
    reservado: { label: 'Pronto p/ retirada', short: 'Pronto' },
    retirado: { label: 'Retirado', short: 'Retirado' },
    cancelado: { label: 'Cancelado', short: 'Cancelado' },
  };
  const FLOW = ['pago', 'preparo', 'reservado', 'retirado'];

  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  // ---------------------------------------------------------------- dados iniciais
  function seed() {
    const p = (name, category, price, emoji, desc) => ({
      id: uid('p'), name, category, price, emoji, desc, image: '', available: true, createdAt: Date.now(),
    });
    return {
      seq: 100,
      users: [
        { id: 'u_admin', name: 'Cantina Central', email: 'admin@cantina.com', password: 'cantina123', role: 'admin', createdAt: Date.now() },
        { id: 'u_aluno', name: 'Aluno Teste', email: 'aluno@faculdade.com', password: 'aluno123', role: 'aluno', createdAt: Date.now() },
      ],
      products: [
        p('Coxinha de frango', 'salgados', 7, '🍗', 'Massa crocante e recheio cremoso de frango com catupiry.'),
        p('Pão de queijo', 'salgados', 5, '🧀', 'Quentinho, saído do forno. Unidade grande.'),
        p('Pastel de carne', 'salgados', 8, '🥟', 'Carne moída temperada, frito na hora.'),
        p('Esfiha de frango', 'salgados', 6.5, '🥙', 'Esfiha aberta de frango com requeijão.'),
        p('Enroladinho de salsicha', 'salgados', 6, '🌭', 'Massa folhada assada com salsicha.'),
        p('X-Burguer', 'lanches', 15, '🍔', 'Pão, hambúrguer, queijo, alface e tomate.'),
        p('Misto quente', 'lanches', 9, '🥪', 'Pão de forma na chapa com presunto e queijo.'),
        p('Wrap de frango', 'lanches', 14, '🌯', 'Frango grelhado, folhas e molho especial.'),
        p('Coca-Cola lata', 'bebidas', 6, '🥤', 'Lata 350 ml, gelada.'),
        p('Suco natural', 'bebidas', 8, '🧃', 'Laranja, limão ou maracujá — 400 ml.'),
        p('Água mineral', 'bebidas', 3.5, '💧', 'Garrafa 500 ml, com ou sem gás.'),
        p('Café expresso', 'bebidas', 4.5, '☕', 'Café espresso curto ou longo.'),
        p('Brigadeiro', 'doces', 3, '🍫', 'Brigadeiro gourmet de chocolate belga.'),
        p('Bolo de pote', 'doces', 10, '🍰', 'Ninho com morango ou chocolate.'),
        p('Brownie', 'doces', 7.5, '🍪', 'Brownie molhadinho com castanhas.'),
        p('Sonho', 'doces', 6, '🍩', 'Recheado com creme de baunilha.'),
      ],
      orders: [],
      messages: [],
    };
  }

  // ---------------------------------------------------------------- utilitários
  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hhmm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isToday = (t) => new Date(t).toDateString() === new Date().toDateString();
  const when = (t) => (isToday(t) ? 'hoje ' : new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ') + hhmm(t);
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const catOf = (id) => CATEGORIES.find((c) => c.id === id) || { label: id, icon: '🍽️' };

  function makeCode() {
    let c = '';
    const rnd = crypto.getRandomValues(new Uint32Array(4));
    for (let i = 0; i < 4; i++) c += CODE_CHARS[rnd[i] % CODE_CHARS.length];
    return c;
  }

  function safeGet(store, key) {
    try { return store.getItem(key); } catch { return null; }
  }
  function safeSet(store, key, val) {
    try { store.setItem(key, val); return true; } catch { return false; }
  }

  // ---------------------------------------------------------------- banco (localStorage)
  let db = loadDb();

  function loadDb() {
    try {
      const raw = safeGet(localStorage, DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* cai no seed */ }
    const fresh = seed();
    safeSet(localStorage, DB_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function commit() {
    if (!safeSet(localStorage, DB_KEY, JSON.stringify(db))) {
      toast('Não foi possível salvar (armazenamento cheio). Use fotos menores.', 'err');
    }
    render();
  }

  // ---------------------------------------------------------------- estado da aba
  const state = {
    userId: safeGet(sessionStorage, SESSION_KEY),
    cart: (() => { try { return JSON.parse(safeGet(sessionStorage, CART_KEY)) || {}; } catch { return {}; } })(),
    authTab: 'login',
    authError: '',
    filter: 'todos',
    search: '',
    drafts: {},
    validateMsg: null,
  };

  const me = () => db.users.find((u) => u.id === state.userId) || null;
  const isAdmin = () => me()?.role === 'admin';
  const myRole = () => (isAdmin() ? 'cantina' : 'aluno');

  function saveCart() { safeSet(sessionStorage, CART_KEY, JSON.stringify(state.cart)); }

  function route() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
    return { page: parts[0] || '', id: parts[1] || '' };
  }
  function go(hash) {
    if (location.hash === hash) render(); else location.hash = hash;
  }

  // ---------------------------------------------------------------- regras de negócio
  function postMessage(orderId, from, text) {
    db.messages.push({
      id: uid('m'), orderId, from, text, at: Date.now(),
      readAluno: from === 'aluno', readCantina: from !== 'aluno',
    });
  }

  function createOrder(payment) {
    const user = me();
    const items = Object.entries(state.cart)
      .map(([pid, qty]) => {
        const p = db.products.find((x) => x.id === pid);
        return p && p.available && qty > 0 ? { productId: p.id, name: p.name, emoji: p.emoji, price: p.price, qty } : null;
      })
      .filter(Boolean);
    if (!items.length) return null;
    db.seq += 1;
    let code = makeCode();
    while (db.orders.some((o) => o.code === code && !['retirado', 'cancelado'].includes(o.status))) code = makeCode();
    const order = {
      id: uid('o'), num: db.seq, userId: user.id, userName: user.name, userEmail: user.email,
      items, total: items.reduce((s, i) => s + i.price * i.qty, 0), payment, status: 'pago', code,
      createdAt: Date.now(), history: [{ status: 'pago', at: Date.now() }],
    };
    db.orders.push(order);
    postMessage(order.id, 'system',
      `Pedido #${order.num} pago (${payment === 'pix' ? 'Pix' : 'cartão'}) — ${money(order.total)}. ` +
      `Seu código de retirada é ${order.code}. A cantina vai avisar aqui quando estiver reservado no balcão.`);
    state.cart = {};
    saveCart();
    commit();
    return order;
  }

  function setStatus(order, status) {
    order.status = status;
    order.history.push({ status, at: Date.now() });
    const msgs = {
      preparo: `A cantina começou a preparar o pedido #${order.num}. 👩‍🍳`,
      reservado: `Pedido #${order.num} reservado no balcão de retirada ✅. Vá até a cantina e informe seu código (${order.code}) — pode mandar aqui no chat ou mostrar no balcão.`,
      retirado: `Pedido #${order.num} retirado. Bom apetite! 😋`,
      cancelado: `Pedido #${order.num} cancelado pela cantina. O valor de ${money(order.total)} será estornado (simulação).`,
    };
    if (msgs[status]) postMessage(order.id, 'system', msgs[status]);
    commit();
  }

  function unreadFor(orderId) {
    const role = myRole();
    return db.messages.filter((m) => m.orderId === orderId && (role === 'aluno' ? !m.readAluno : (m.from === 'aluno' && !m.readCantina))).length;
  }
  function myOrders() {
    return isAdmin() ? db.orders : db.orders.filter((o) => o.userId === state.userId);
  }
  function totalUnread() {
    return myOrders().reduce((s, o) => s + unreadFor(o.id), 0);
  }
  function markRead(orderId) {
    const role = myRole();
    let changed = false;
    db.messages.forEach((m) => {
      if (m.orderId !== orderId) return;
      if (role === 'aluno' && !m.readAluno) { m.readAluno = true; changed = true; }
      if (role === 'cantina' && !m.readCantina) { m.readCantina = true; changed = true; }
    });
    if (changed) safeSet(localStorage, DB_KEY, JSON.stringify(db));
  }

  // ---------------------------------------------------------------- toast & modal
  function toast(text, kind = '') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  let modalRender = null;
  function openModal(fn) { modalRender = fn; renderModal(); }
  function closeModal() { modalRender = null; renderModal(); }
  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!modalRender) { root.innerHTML = ''; return; }
    root.innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true">${modalRender()}</div></div>`;
    const auto = root.querySelector('[autofocus]');
    if (auto) auto.focus();
  }

  // ---------------------------------------------------------------- render principal
  function render() {
    const active = document.activeElement;
    const focusId = active && active.id;
    const caret = active && 'selectionStart' in active ? active.selectionStart : null;

    const app = document.getElementById('app');
    if (!me()) {
      app.innerHTML = viewAuth();
    } else {
      const r = route();
      const pages = isAdmin()
        ? { painel: viewAdminOrders, cardapio: viewAdminMenu, chat: viewChat }
        : { cardapio: viewMenu, pedidos: viewMyOrders, chat: viewChat };
      const def = isAdmin() ? 'painel' : 'cardapio';
      const page = pages[r.page] ? r.page : def;
      if (!pages[r.page] && r.page !== '') { location.replace('#/' + def); }
      app.innerHTML = viewShell(page, pages[page](r));
      if (page === 'chat' && r.id) {
        markRead(r.id);
        const box = app.querySelector('.chat-msgs');
        if (box) box.scrollTop = box.scrollHeight;
        refreshBadges();
      }
    }

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (caret != null && 'setSelectionRange' in el) { try { el.setSelectionRange(caret, caret); } catch { /* ignore */ } }
      }
    }
    if (modalRender) renderModal();
  }

  function refreshBadges() {
    const n = totalUnread();
    document.querySelectorAll('[data-badge="chat"]').forEach((b) => {
      b.textContent = n; b.classList.toggle('hidden', !n);
    });
  }

  // ---------------------------------------------------------------- views: auth
  function viewAuth() {
    const login = state.authTab === 'login';
    return `
    <div class="auth">
      <div class="auth-card">
        <div class="logo"><div class="mark">🍔</div><span>Click<b>Food</b></span></div>
        <p class="muted" style="margin:10px 0 0">Peça pelo app, pague e retire no balcão da cantina — sem fila.</p>
        <div class="tabs" role="tablist">
          <button class="${login ? 'active' : ''}" data-act="auth-tab" data-tab="login">Entrar</button>
          <button class="${!login ? 'active' : ''}" data-act="auth-tab" data-tab="signup">Criar conta</button>
        </div>
        <form class="form" data-form="${login ? 'login' : 'signup'}" novalidate>
          ${login ? '' : `<label class="field">Nome<input class="input" name="name" id="f-name" autocomplete="name" placeholder="Seu nome" required></label>`}
          <label class="field">E-mail<input class="input" type="email" name="email" id="f-email" autocomplete="email" placeholder="voce@faculdade.com" required></label>
          <label class="field">Senha<input class="input" type="password" name="password" id="f-pass" autocomplete="${login ? 'current-password' : 'new-password'}" placeholder="${login ? 'Sua senha' : 'Mínimo 4 caracteres'}" required></label>
          ${state.authError ? `<div class="error">${esc(state.authError)}</div>` : ''}
          <button class="btn btn-primary btn-block" type="submit">${login ? 'Entrar' : 'Criar conta de aluno'}</button>
        </form>
        <div class="demo-box">
          <b>Acessos de demonstração</b>
          <div class="row"><span>🏪 Cantina: admin@cantina.com · cantina123</span><button class="btn btn-sm btn-ghost" data-act="demo" data-who="admin">Usar</button></div>
          <div class="row"><span>🎓 Aluno: aluno@faculdade.com · aluno123</span><button class="btn btn-sm btn-ghost" data-act="demo" data-who="aluno">Usar</button></div>
          <span class="muted">Dica: abra uma aba como cantina e outra como aluno para ver os pedidos e o chat chegando em tempo real.</span>
        </div>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------- views: shell
  function viewShell(page, content) {
    const user = me();
    const unread = totalUnread();
    const links = isAdmin()
      ? [['painel', '📋', 'Pedidos'], ['cardapio', '🍽️', 'Cardápio'], ['chat', '💬', 'Chat']]
      : [['cardapio', '🍽️', 'Cardápio'], ['pedidos', '🧾', 'Meus pedidos'], ['chat', '💬', 'Chat']];
    const badge = (id) => (id === 'chat' ? `<span class="badge ${unread ? '' : 'hidden'}" data-badge="chat">${unread}</span>` : '');
    const active = (id) => (id === page ? 'active' : '');
    return `
    <header class="topbar"><div class="topbar-in">
      <div class="logo"><div class="mark">🍔</div><span>Click<b>Food</b></span></div>
      <span class="role-pill">${isAdmin() ? 'Painel da cantina' : 'Aluno'}</span>
      <nav class="nav">${links.map(([id, ic, lb]) => `<a href="#/${id}" class="${active(id)}">${ic} ${lb} ${badge(id)}</a>`).join('')}</nav>
      <div class="spacer"></div>
      <span class="small muted" title="${esc(user.email)}">Olá, <b>${esc(user.name.split(' ')[0])}</b></span>
      <button class="icon-btn" title="Sair" aria-label="Sair" data-act="logout">⎋</button>
    </div></header>
    <main class="main">${content}</main>
    <nav class="bottom-nav">${links.map(([id, ic, lb]) => `<a href="#/${id}" class="${active(id)}"><span class="ic">${ic}</span>${lb}${badge(id)}</a>`).join('')}</nav>`;
  }

  // ---------------------------------------------------------------- views: aluno
  function thumb(p) {
    return p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : `<span aria-hidden="true">${esc(p.emoji || '🍽️')}</span>`;
  }

  function viewMenu() {
    const q = state.search.trim().toLowerCase();
    const list = db.products
      .filter((p) => state.filter === 'todos' || p.category === state.filter)
      .filter((p) => !q || (p.name + ' ' + p.desc).toLowerCase().includes(q))
      .sort((a, b) => Number(b.available) - Number(a.available));
    const cartCount = Object.values(state.cart).reduce((s, n) => s + n, 0);
    const cartTotal = Object.entries(state.cart).reduce((s, [id, n]) => s + (db.products.find((p) => p.id === id)?.price || 0) * n, 0);
    const ready = myOrders().filter((o) => o.status === 'reservado');

    return `
    ${ready.length ? `<a href="#/pedidos" class="code-box" style="text-decoration:none;color:inherit;margin-bottom:16px">
      <span>✅ <b>Pedido #${ready[0].num} pronto!</b> Retire no balcão com o código</span><span class="code">${esc(ready[0].code)}</span></a>` : ''}
    <section class="hero">
      <div><h1>Bateu a fome, <span>${esc(me().name.split(' ')[0])}</span>?</h1>
        <p>Peça agora, pague pelo app e retire no balcão da cantina — sem fila.</p>
        <span class="tag">⚡ Pronto em poucos minutos</span></div>
      <div class="emojis" aria-hidden="true">🍔🥤🍩</div>
    </section>
    <div class="page-head">
      <div><h1>Cardápio</h1></div>
      <label class="search"><input class="input" id="menu-search" data-input="search" placeholder="Buscar coxinha, suco..." value="${esc(state.search)}" aria-label="Buscar no cardápio"></label>
    </div>
    <div class="chips">
      <button class="chip ${state.filter === 'todos' ? 'active' : ''}" data-act="filter" data-cat="todos">Todos</button>
      ${CATEGORIES.map((c) => `<button class="chip ${state.filter === c.id ? 'active' : ''}" data-act="filter" data-cat="${c.id}">${c.icon} ${c.label}</button>`).join('')}
    </div>
    ${list.length ? `<div class="grid">${list.map((p) => {
      const qty = state.cart[p.id] || 0;
      return `<article class="product">
        <div class="thumb">${thumb(p)}${p.available ? '' : '<div class="sold-out">ESGOTADO</div>'}</div>
        <div class="body">
          <span class="small muted">${catOf(p.category).icon} ${catOf(p.category).label}</span>
          <div class="name">${esc(p.name)}</div>
          <div class="desc">${esc(p.desc)}</div>
          <div class="foot">
            <span class="price">${money(p.price)}</span>
            ${!p.available ? '' : qty
              ? `<span class="stepper"><button data-act="qty" data-id="${p.id}" data-d="-1" aria-label="Remover">−</button><span>${qty}</span><button data-act="qty" data-id="${p.id}" data-d="1" aria-label="Adicionar">+</button></span>`
              : `<button class="btn btn-primary btn-sm" data-act="qty" data-id="${p.id}" data-d="1">Adicionar</button>`}
          </div>
        </div>
      </article>`;
    }).join('')}</div>` : `<div class="panel muted" style="text-align:center">Nenhum produto encontrado.</div>`}
    ${cartCount ? `<button class="cart-bar" data-act="open-cart"><span class="count">${cartCount}</span><span>Ver carrinho</span><span class="spacer"></span><span>${money(cartTotal)}</span></button>` : ''}`;
  }

  function timeline(o) {
    if (o.status === 'cancelado') return '';
    const idx = FLOW.indexOf(o.status);
    return `<div class="timeline">${FLOW.map((s, i) => `<div class="step ${i <= idx ? 'done' : ''}"><div class="bar"></div>${STATUS[s].short}</div>`).join('')}</div>`;
  }
  const itemsText = (o) => o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(', ');
  const statusPill = (s) => `<span class="status ${s}">${STATUS[s].label}</span>`;

  function viewMyOrders() {
    const list = myOrders().slice().sort((a, b) => b.createdAt - a.createdAt);
    return `
    <div class="page-head"><div><h1>Meus pedidos</h1><p class="muted" style="margin:4px 0 0">Acompanhe o status e use o código para retirar.</p></div></div>
    ${list.length ? `<div class="list">${list.map((o) => {
      const un = unreadFor(o.id);
      const active = !['retirado', 'cancelado'].includes(o.status);
      return `<div class="order st-${o.status}">
        <div class="order-head"><span class="order-num">Pedido #${o.num}</span>${statusPill(o.status)}</div>
        <div class="order-items">${itemsText(o)} · <b style="color:var(--text)">${money(o.total)}</b> · ${when(o.createdAt)}</div>
        ${timeline(o)}
        ${active ? `<div class="code-box">
            <div><div class="small muted">${o.status === 'reservado' ? 'Pronto! Informe este código no balcão' : 'Seu código de retirada'}</div><span class="code">${esc(o.code)}</span></div>
            <span class="small muted" style="max-width:240px">${o.status === 'reservado' ? 'Seu pedido está reservado no balcão de retirada.' : 'Aguarde a cantina avisar que está pronto.'}</span>
          </div>` : ''}
        <div class="order-actions">
          <a class="btn btn-ghost btn-sm" href="#/chat/${o.id}" style="text-decoration:none">💬 Chat com a cantina ${un ? `<span class="badge">${un}</span>` : ''}</a>
        </div>
      </div>`;
    }).join('')}</div>`
      : `<div class="panel" style="text-align:center"><p class="muted">Você ainda não fez pedidos.</p><a class="btn btn-primary" href="#/cardapio" style="text-decoration:none">Ver cardápio</a></div>`}`;
  }

  // ---------------------------------------------------------------- carrinho / pagamento
  function cartModal() {
    const lines = Object.entries(state.cart)
      .map(([id, qty]) => ({ p: db.products.find((x) => x.id === id), qty }))
      .filter((l) => l.p && l.qty > 0);
    if (!lines.length) {
      return `<div class="modal-head"><h2>Carrinho</h2><button class="icon-btn" data-act="close">✕</button></div><p class="muted">Seu carrinho está vazio.</p>`;
    }
    const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const unavailable = lines.some((l) => !l.p.available);
    return `
      <div class="modal-head"><h2>Seu pedido</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
      ${lines.map((l) => `<div class="cart-line">
        <span style="font-size:24px">${esc(l.p.emoji || '🍽️')}</span>
        <span class="n">${esc(l.p.name)}${l.p.available ? '' : ' <span class="error">(esgotou)</span>'}<br><span class="small muted">${money(l.p.price)} cada</span></span>
        <span class="stepper"><button data-act="qty" data-id="${l.p.id}" data-d="-1">−</button><span>${l.qty}</span><button data-act="qty" data-id="${l.p.id}" data-d="1">+</button></span>
      </div>`).join('')}
      <div class="total-row"><span>Total</span><span>${money(total)}</span></div>
      <div class="small muted" style="margin-bottom:8px">Forma de pagamento <i>(simulado — nenhum dado real é cobrado)</i></div>
      <div class="pay-opts">
        <label class="pay-opt"><input type="radio" name="pay" value="pix" checked> ⚡ Pix</label>
        <label class="pay-opt"><input type="radio" name="pay" value="cartao"> 💳 Cartão salvo na plataforma</label>
      </div>
      <div class="small muted" style="margin-bottom:14px">🏪 Retirada no balcão da cantina — sem entrega.</div>
      <button class="btn btn-primary btn-block" data-act="pay" ${unavailable ? 'disabled' : ''}>Pagar ${money(total)}</button>`;
  }

  function fakeQr() {
    // QR ilustrativo (não é um Pix real)
    const n = 21, cells = [];
    const finder = (x, y) => [[x, y], [x + 6, y], [x, y + 6]].some(([fx, fy]) => false);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const inF = (fx, fy) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
      if (inF(0, 0) || inF(n - 7, 0) || inF(0, n - 7)) continue;
      if (Math.random() > 0.55) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    void finder;
    const fp = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg class="fake-qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="#2a211b" aria-label="QR code ilustrativo">${fp(0, 0)}${fp(n - 7, 0)}${fp(0, n - 7)}${cells.join('')}</svg>`;
  }

  function pixModal(total) {
    const qr = fakeQr();
    return () => `
      <div class="modal-head"><h2>Pagar com Pix</h2><button class="icon-btn" data-act="open-cart" aria-label="Voltar">←</button></div>
      <div class="pix-box">
        ${qr}
        <div class="price">${money(total)}</div>
        <p class="small muted" style="margin:0">Protótipo: este QR é ilustrativo. Clique abaixo para simular a confirmação do pagamento.</p>
        <button class="btn btn-ok btn-block" data-act="confirm-pay" data-method="pix">Já paguei (simular confirmação)</button>
      </div>`;
  }

  function successModal(o) {
    return () => `
      <div style="text-align:center;display:grid;gap:12px;justify-items:center">
        <div style="font-size:52px">🎉</div>
        <h2>Pedido #${o.num} confirmado!</h2>
        <p class="muted" style="margin:0">Pagamento aprovado. A cantina já recebeu seu pedido e vai avisar no chat quando estiver reservado no balcão.</p>
        <div class="code-box" style="width:100%;justify-content:center;flex-direction:column">
          <span class="small muted">Seu código de retirada</span><span class="code">${esc(o.code)}</span>
        </div>
        <div class="row2" style="width:100%">
          <button class="btn btn-ghost" data-act="close-go" data-to="#/pedidos">Ver pedido</button>
          <button class="btn btn-primary" data-act="close-go" data-to="#/chat/${o.id}">💬 Abrir chat</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- views: cantina
  function viewAdminOrders() {
    const today = db.orders.filter((o) => isToday(o.createdAt) && o.status !== 'cancelado');
    const byStatus = (s) => db.orders.filter((o) => o.status === s).sort((a, b) => a.createdAt - b.createdAt);
    const history = db.orders.filter((o) => ['retirado', 'cancelado'].includes(o.status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
    const vm = state.validateMsg;

    const card = (o) => {
      const un = unreadFor(o.id);
      const actions = {
        pago: `<button class="btn btn-primary btn-sm" data-act="status" data-id="${o.id}" data-s="preparo">👩‍🍳 Iniciar preparo</button>
               <button class="btn btn-danger btn-sm" data-act="cancel" data-id="${o.id}">Cancelar</button>`,
        preparo: `<button class="btn btn-ok btn-sm" data-act="status" data-id="${o.id}" data-s="reservado">✅ Reservar no balcão</button>
                  <button class="btn btn-danger btn-sm" data-act="cancel" data-id="${o.id}">Cancelar</button>`,
        reservado: `<button class="btn btn-primary btn-sm" data-act="ask-code" data-id="${o.id}">🔑 Confirmar retirada</button>`,
      }[o.status] || '';
      return `<div class="order st-${o.status}">
        <div class="order-head"><span class="order-num">#${o.num} · ${esc(o.userName)}</span><span class="small muted">${hhmm(o.createdAt)}</span></div>
        <div class="order-items">${itemsText(o)}</div>
        <div class="order-head"><b>${money(o.total)}</b><span class="small muted">${o.payment === 'pix' ? '⚡ Pix' : '💳 Cartão'} · pago</span></div>
        <div class="order-actions">${actions}
          <a class="btn btn-ghost btn-sm" href="#/chat/${o.id}" style="text-decoration:none">💬 ${un ? `<span class="badge">${un}</span>` : ''}</a>
        </div>
      </div>`;
    };
    const col = (s, title, icon) => {
      const list = byStatus(s);
      return `<section class="board-col"><h3>${icon} ${title} <span class="status ${s}">${list.length}</span></h3>
        <div class="list">${list.length ? list.map(card).join('') : '<div class="empty-col">Nenhum pedido</div>'}</div></section>`;
    };

    return `
    <div class="page-head"><div><h1>Pedidos</h1><p class="muted" style="margin:4px 0 0">Prepare, reserve no balcão e confirme a retirada pelo código.</p></div></div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">Pedidos hoje</div><div class="val">${today.length}</div></div>
      <div class="kpi"><div class="lbl">A preparar</div><div class="val">${byStatus('pago').length + byStatus('preparo').length}</div></div>
      <div class="kpi"><div class="lbl">Aguardando retirada</div><div class="val">${byStatus('reservado').length}</div></div>
      <div class="kpi"><div class="lbl">Faturamento hoje</div><div class="val">${money(today.reduce((s, o) => s + o.total, 0))}</div></div>
    </div>
    <form class="panel validate" data-form="validate">
      <b>🔑 Retirada no balcão</b>
      <input class="input" id="validate-code" name="code" maxlength="4" placeholder="CÓDIGO" autocomplete="off" aria-label="Código de retirada">
      <button class="btn btn-primary" type="submit">Validar código</button>
      ${vm ? `<span class="${vm.ok ? '' : 'error'} small">${esc(vm.text)}</span>` : '<span class="small muted">O aluno informa o código no balcão ou pelo chat.</span>'}
    </form>
    <div class="board">
      ${col('pago', 'Novos', '🆕')}
      ${col('preparo', 'Em preparo', '👩‍🍳')}
      ${col('reservado', 'No balcão', '✅')}
    </div>
    <h3 style="margin:26px 0 10px">Histórico recente</h3>
    ${history.length ? `<div class="panel table-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Aluno</th><th>Itens</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${history.map((o) => `<tr><td>#${o.num}<br><span class="small muted">${when(o.createdAt)}</span></td><td>${esc(o.userName)}</td><td class="small">${itemsText(o)}</td><td>${money(o.total)}</td><td>${statusPill(o.status)}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="panel muted small">Pedidos retirados aparecem aqui.</div>'}
    <p style="margin-top:24px"><button class="btn btn-ghost btn-sm" data-act="reset">↺ Restaurar dados de demonstração</button></p>`;
  }

  function viewAdminMenu() {
    const list = db.products.slice().sort((a, b) => CATEGORIES.findIndex((c) => c.id === a.category) - CATEGORIES.findIndex((c) => c.id === b.category) || a.name.localeCompare(b.name));
    return `
    <div class="page-head">
      <div><h1>Cardápio</h1><p class="muted" style="margin:4px 0 0">${list.length} produtos · ${list.filter((p) => p.available).length} disponíveis</p></div>
      <button class="btn btn-primary" data-act="edit-product">＋ Novo produto</button>
    </div>
    <div class="panel table-wrap"><table class="tbl">
      <thead><tr><th></th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Disponível</th><th></th></tr></thead>
      <tbody>${list.map((p) => `<tr>
        <td><div class="mini">${thumb(p)}</div></td>
        <td><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.desc)}</span></td>
        <td class="small">${catOf(p.category).icon} ${catOf(p.category).label}</td>
        <td><b>${money(p.price)}</b></td>
        <td><label class="switch" title="Disponível"><input type="checkbox" data-act="toggle-av" data-id="${p.id}" ${p.available ? 'checked' : ''}><span></span></label></td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-act="edit-product" data-id="${p.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-act="del-product" data-id="${p.id}" aria-label="Excluir">🗑</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  let draftImage = null;
  function productModal(id) {
    const p = db.products.find((x) => x.id === id) || { name: '', category: 'salgados', price: '', emoji: '🍽️', desc: '', image: '', available: true };
    draftImage = p.image || '';
    return () => `
      <div class="modal-head"><h2>${id ? 'Editar produto' : 'Novo produto'}</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
      <form class="form" data-form="product" data-id="${id || ''}">
        <div class="photo-pick">
          <div class="prev" id="photo-prev">${draftImage ? `<img src="${esc(draftImage)}" alt="">` : esc(p.emoji)}</div>
          <div style="display:grid;gap:6px">
            <label class="btn btn-ghost btn-sm">📷 Anexar foto<input type="file" accept="image/*" data-input="photo" hidden></label>
            <button type="button" class="btn btn-ghost btn-sm ${draftImage ? '' : 'hidden'}" id="photo-clear" data-act="photo-clear">Remover foto</button>
          </div>
        </div>
        <label class="field">Nome<input class="input" name="name" value="${esc(p.name)}" required autofocus placeholder="Ex.: Coxinha de frango"></label>
        <div class="row2">
          <label class="field">Categoria<select class="input" name="category">${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === p.category ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}</select></label>
          <label class="field">Preço (R$)<input class="input" name="price" inputmode="decimal" value="${p.price === '' ? '' : String(p.price).replace('.', ',')}" placeholder="7,00" required></label>
        </div>
        <div class="row2">
          <label class="field">Ícone (se não tiver foto)<input class="input" name="emoji" value="${esc(p.emoji)}" maxlength="4"></label>
          <label class="field">Disponível<select class="input" name="available"><option value="1" ${p.available ? 'selected' : ''}>Sim</option><option value="0" ${p.available ? '' : 'selected'}>Esgotado</option></select></label>
        </div>
        <label class="field">Descrição<textarea class="input" name="desc" rows="2" placeholder="Opcional">${esc(p.desc)}</textarea></label>
        <div class="error hidden" id="product-err"></div>
        <button class="btn btn-primary btn-block" type="submit">Salvar produto</button>
      </form>`;
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const max = 480;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function codeModal(orderId) {
    const o = db.orders.find((x) => x.id === orderId);
    return () => `
      <div class="modal-head"><h2>Retirada · Pedido #${o.num}</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
      <p class="muted" style="margin-top:0">${esc(o.userName)} · ${itemsText(o)}</p>
      <form class="form" data-form="pickup" data-id="${o.id}">
        <label class="field">Código informado pelo aluno<input class="input" name="code" maxlength="4" autocomplete="off" autofocus style="text-transform:uppercase;letter-spacing:.2em;font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:22px;text-align:center" placeholder="____"></label>
        <div class="error hidden" id="pickup-err"></div>
        <button class="btn btn-ok btn-block" type="submit">Conferir e entregar</button>
      </form>`;
  }

  function deliverModal(orderId) {
    const o = db.orders.find((x) => x.id === orderId);
    return () => `
      <div class="modal-head"><h2>✅ Código confere</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
      <p style="margin-top:0"><b>Pedido #${o.num}</b> de <b>${esc(o.userName)}</b></p>
      <div class="panel" style="box-shadow:none;background:var(--surface-2);margin-bottom:14px">
        ${o.items.map((i) => `<div>${esc(i.emoji || '')} ${i.qty}× ${esc(i.name)}</div>`).join('')}
      </div>
      <button class="btn btn-ok btn-block" data-act="deliver" data-id="${o.id}">Entregar pedido e marcar como retirado</button>`;
  }

  // ---------------------------------------------------------------- views: chat
  function highlightCode(text, code) {
    const safe = esc(text);
    if (!code) return safe;
    return safe.replace(new RegExp(`\\b(${code})\\b`, 'gi'), '<span class="code-inline">$1</span>');
  }

  function viewChat(r) {
    const role = myRole();
    const lastMsg = (o) => db.messages.filter((m) => m.orderId === o.id).pop();
    const threads = myOrders().slice().sort((a, b) => (lastMsg(b)?.at || b.createdAt) - (lastMsg(a)?.at || a.createdAt));
    const active = threads.find((o) => o.id === r.id);

    if (!threads.length) {
      return `<div class="page-head"><h1>Chat</h1></div><div class="panel" style="text-align:center"><p class="muted">${role === 'aluno' ? 'Faça um pedido para conversar com a cantina.' : 'As conversas com os alunos aparecem aqui quando chegarem pedidos.'}</p>${role === 'aluno' ? '<a class="btn btn-primary" href="#/cardapio" style="text-decoration:none">Ver cardápio</a>' : ''}</div>`;
    }

    const threadList = threads.map((o) => {
      const lm = lastMsg(o);
      const un = o.id === r.id ? 0 : unreadFor(o.id);
      const who = role === 'cantina' ? o.userName : 'Cantina Central';
      return `<a class="thread ${o.id === r.id ? 'active' : ''}" href="#/chat/${o.id}" style="text-decoration:none;color:inherit">
        <div class="avatar">${role === 'cantina' ? esc(initials(o.userName)) : '🏪'}</div>
        <div class="t-body">
          <div class="t-top"><span>${esc(who)} · #${o.num}</span><span class="small muted" style="font-weight:500">${lm ? hhmm(lm.at) : ''}</span></div>
          <div class="t-last">${lm ? esc((lm.from === role ? 'Você: ' : '') + lm.text) : ''}</div>
        </div>
        ${un ? `<span class="badge">${un}</span>` : ''}
      </a>`;
    }).join('');

    let chat = `<div class="chat-empty"><div><div style="font-size:40px">💬</div>Selecione uma conversa</div></div>`;
    if (active) {
      const msgs = db.messages.filter((m) => m.orderId === active.id);
      const quick = role === 'aluno'
        ? ['Estou a caminho 🚶', 'Cheguei no balcão!', `Meu código é ${active.code}`]
        : ['Seu pedido está em preparo 👩‍🍳', 'Pronto! Pode retirar no balcão ✅', 'Por favor, informe seu código de retirada.'];
      const canSend = !['cancelado'].includes(active.status);
      chat = `
        <div class="chat-head">
          <a class="icon-btn back-btn" href="#/chat" aria-label="Voltar">←</a>
          <div style="flex:1;min-width:0">
            <b>${role === 'cantina' ? esc(active.userName) : '🏪 Cantina Central'} · Pedido #${active.num}</b>
            <div class="small muted">${itemsText(active)} · ${money(active.total)}</div>
          </div>
          ${statusPill(active.status)}
          ${role === 'cantina' && active.status === 'reservado' ? `<button class="btn btn-primary btn-sm" data-act="ask-code" data-id="${active.id}">🔑 Confirmar retirada</button>` : ''}
          ${role === 'cantina' && active.status === 'pago' ? `<button class="btn btn-primary btn-sm" data-act="status" data-id="${active.id}" data-s="preparo">Iniciar preparo</button>` : ''}
          ${role === 'cantina' && active.status === 'preparo' ? `<button class="btn btn-ok btn-sm" data-act="status" data-id="${active.id}" data-s="reservado">Reservar no balcão</button>` : ''}
        </div>
        <div class="chat-msgs">
          ${msgs.map((m) => {
            if (m.from === 'system') return `<div class="msg system">${highlightCode(m.text, role === 'aluno' ? active.code : '')}<div class="meta">${hhmm(m.at)}</div></div>`;
            const mine = m.from === role;
            const hasCode = m.from === 'aluno' && m.text.toUpperCase().includes(active.code);
            let detect = '';
            if (role === 'cantina' && hasCode) {
              detect = active.status === 'reservado'
                ? `<div class="code-detect"><span class="status reservado">✓ Código confere com o pedido #${active.num}</span><button class="btn btn-ok btn-sm" data-act="deliver" data-id="${active.id}">Entregar e confirmar retirada</button></div>`
                : active.status === 'retirado' ? `<div class="code-detect"><span class="status retirado">✓ Pedido já retirado</span></div>`
                  : `<div class="code-detect"><span class="status preparo">Código confere — pedido ainda não está no balcão</span></div>`;
            }
            return `<div class="msg ${mine ? 'me' : 'them'}">${highlightCode(m.text, active.code)}<div class="meta">${hhmm(m.at)}</div>${detect}</div>`;
          }).join('')}
        </div>
        ${canSend ? `<div class="quick">${quick.map((q) => `<button data-act="quick" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <form class="chat-input" data-form="chat" data-id="${active.id}">
          <input class="input" id="chat-text" name="text" autocomplete="off" placeholder="Escreva uma mensagem..." value="${esc(state.drafts[active.id] || '')}" data-input="draft" data-id="${active.id}">
          <button class="btn btn-primary" type="submit" aria-label="Enviar">Enviar</button>
        </form>` : '<div class="chat-input small muted">Pedido cancelado — conversa encerrada.</div>'}`;
    }

    return `<div class="chat-layout ${active ? 'has-active' : ''}"><aside class="threads">${threadList}</aside><section class="chat">${chat}</section></div>`;
  }

  function sendChat(orderId, text) {
    text = text.trim();
    if (!text) return;
    postMessage(orderId, myRole(), text.slice(0, 600));
    state.drafts[orderId] = '';
    commit();
  }

  // ---------------------------------------------------------------- eventos
  const actions = {
    'auth-tab': (el) => { state.authTab = el.dataset.tab; state.authError = ''; render(); },
    demo: (el) => {
      const u = db.users.find((x) => x.id === (el.dataset.who === 'admin' ? 'u_admin' : 'u_aluno'));
      if (!u) { toast('Usuário de demonstração não encontrado. Restaure os dados.', 'err'); return; }
      login(u);
    },
    logout: () => {
      state.userId = null; state.cart = {}; saveCart();
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      state.authTab = 'login';
      history.replaceState(null, '', location.pathname);
      render();
    },
    filter: (el) => { state.filter = el.dataset.cat; render(); },
    qty: (el) => {
      const id = el.dataset.id;
      const n = Math.max(0, (state.cart[id] || 0) + Number(el.dataset.d));
      if (n) state.cart[id] = Math.min(n, 20); else delete state.cart[id];
      saveCart(); render();
      if (modalRender) renderModal();
    },
    'open-cart': () => openModal(cartModal),
    close: () => closeModal(),
    'modal-bg': (el, e) => { if (e.target === el) closeModal(); },
    'close-go': (el) => { closeModal(); go(el.dataset.to); },
    pay: () => {
      const method = document.querySelector('input[name="pay"]:checked')?.value || 'pix';
      const total = Object.entries(state.cart).reduce((s, [id, n]) => s + (db.products.find((p) => p.id === id)?.price || 0) * n, 0);
      if (method === 'pix') { openModal(pixModal(total)); return; }
      openModal(() => `<div style="text-align:center;padding:30px 0"><div style="font-size:40px">💳</div><p>Processando pagamento no cartão salvo…</p></div>`);
      setTimeout(() => finishPayment('cartao'), 1100);
    },
    'confirm-pay': (el) => finishPayment(el.dataset.method),
    status: (el) => {
      const o = db.orders.find((x) => x.id === el.dataset.id);
      if (!o) return;
      setStatus(o, el.dataset.s);
      toast(el.dataset.s === 'reservado' ? `Pedido #${o.num} reservado no balcão. O aluno foi avisado.` : `Pedido #${o.num}: ${STATUS[o.status].label}`, 'ok');
    },
    cancel: (el) => {
      const o = db.orders.find((x) => x.id === el.dataset.id);
      if (o && confirm(`Cancelar o pedido #${o.num}? O aluno será avisado no chat.`)) setStatus(o, 'cancelado');
    },
    'ask-code': (el) => openModal(codeModal(el.dataset.id)),
    deliver: (el) => {
      const o = db.orders.find((x) => x.id === el.dataset.id);
      if (!o || o.status !== 'reservado') return;
      closeModal();
      state.validateMsg = { ok: true, text: `Pedido #${o.num} entregue para ${o.userName}.` };
      setStatus(o, 'retirado');
      toast(`Pedido #${o.num} retirado ✔`, 'ok');
    },
    'edit-product': (el) => openModal(productModal(el.dataset.id)),
    'del-product': (el) => {
      const p = db.products.find((x) => x.id === el.dataset.id);
      if (p && confirm(`Excluir "${p.name}" do cardápio?`)) {
        db.products = db.products.filter((x) => x.id !== p.id);
        commit(); toast('Produto excluído');
      }
    },
    'toggle-av': (el) => {
      const p = db.products.find((x) => x.id === el.dataset.id);
      if (!p) return;
      p.available = el.checked;
      commit(); toast(p.available ? `${p.name} disponível` : `${p.name} marcado como esgotado`);
    },
    'photo-clear': () => {
      draftImage = '';
      const prev = document.getElementById('photo-prev');
      const emoji = document.querySelector('[data-form="product"] [name="emoji"]')?.value || '🍽️';
      if (prev) prev.textContent = emoji;
      document.getElementById('photo-clear')?.classList.add('hidden');
    },
    quick: (el) => {
      const form = document.querySelector('[data-form="chat"]');
      if (form) sendChat(form.dataset.id, el.dataset.text);
    },
    reset: () => {
      if (!confirm('Apagar pedidos, mensagens e contas criadas e voltar ao cardápio de exemplo?')) return;
      db = seed(); state.validateMsg = null;
      const keep = db.users.some((u) => u.id === state.userId);
      if (!keep) state.userId = null;
      commit(); toast('Dados de demonstração restaurados', 'ok');
    },
  };

  function finishPayment(method) {
    const o = createOrder(method);
    if (!o) { closeModal(); toast('Carrinho vazio ou itens esgotados.', 'err'); return; }
    openModal(successModal(o));
  }

  function login(u) {
    state.userId = u.id;
    state.authError = '';
    safeSet(sessionStorage, SESSION_KEY, u.id);
    location.hash = u.role === 'admin' ? '#/painel' : '#/cardapio';
    render();
    toast(`Bem-vindo(a), ${u.name.split(' ')[0]}!`, 'ok');
  }

  const forms = {
    login: (f) => {
      const email = f.email.value.trim().toLowerCase();
      const u = db.users.find((x) => x.email.toLowerCase() === email && x.password === f.password.value);
      if (!u) { state.authError = 'E-mail ou senha incorretos.'; render(); return; }
      login(u);
    },
    signup: (f) => {
      const name = f.name.value.trim(), email = f.email.value.trim().toLowerCase(), pass = f.password.value;
      if (name.length < 2) state.authError = 'Informe seu nome.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) state.authError = 'E-mail inválido.';
      else if (pass.length < 4) state.authError = 'A senha precisa ter pelo menos 4 caracteres.';
      else if (db.users.some((u) => u.email.toLowerCase() === email)) state.authError = 'Já existe uma conta com esse e-mail.';
      else state.authError = '';
      if (state.authError) { render(); return; }
      const u = { id: uid('u'), name, email, password: pass, role: 'aluno', createdAt: Date.now() };
      db.users.push(u);
      safeSet(localStorage, DB_KEY, JSON.stringify(db));
      login(u);
    },
    chat: (f) => sendChat(f.dataset.id, f.text.value),
    validate: (f) => {
      const code = f.code.value.trim().toUpperCase();
      if (!code) return;
      const found = db.orders.filter((o) => o.code === code).sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!found) state.validateMsg = { ok: false, text: `Código ${code} não encontrado.` };
      else if (found.status === 'reservado') { state.validateMsg = null; f.code.value = ''; openModal(deliverModal(found.id)); render(); return; }
      else if (found.status === 'retirado') state.validateMsg = { ok: false, text: `Pedido #${found.num} já foi retirado.` };
      else if (found.status === 'cancelado') state.validateMsg = { ok: false, text: `Pedido #${found.num} foi cancelado.` };
      else state.validateMsg = { ok: false, text: `Pedido #${found.num} ainda não está no balcão (${STATUS[found.status].label}).` };
      render();
    },
    pickup: (f) => {
      const o = db.orders.find((x) => x.id === f.dataset.id);
      const err = document.getElementById('pickup-err');
      if (f.code.value.trim().toUpperCase() !== o.code) {
        err.textContent = 'Código não confere com este pedido.'; err.classList.remove('hidden'); f.code.select(); return;
      }
      openModal(deliverModal(o.id));
    },
    product: (f) => {
      const err = document.getElementById('product-err');
      const name = f.name.value.trim();
      const price = Number(f.price.value.replace(/\./g, '').replace(',', '.'));
      const fail = (t) => { err.textContent = t; err.classList.remove('hidden'); };
      if (!name) return fail('Informe o nome do produto.');
      if (!Number.isFinite(price) || price <= 0) return fail('Informe um preço válido (ex.: 7,50).');
      const data = {
        name, price: Math.round(price * 100) / 100, category: f.category.value,
        emoji: f.emoji.value.trim() || '🍽️', desc: f.desc.value.trim(), image: draftImage || '', available: f.available.value === '1',
      };
      const id = f.dataset.id;
      if (id) Object.assign(db.products.find((x) => x.id === id), data);
      else db.products.push({ id: uid('p'), createdAt: Date.now(), ...data });
      closeModal(); commit(); toast(id ? 'Produto atualizado' : 'Produto adicionado ao cardápio', 'ok');
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = actions[el.dataset.act];
    if (fn) { if (el.tagName === 'BUTTON' && el.type !== 'submit') e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('input[data-act]')) actions[el.dataset.act]?.(el, e);
    if (el.matches('[data-input="photo"]') && el.files[0]) {
      resizeImage(el.files[0]).then((url) => {
        draftImage = url;
        const prev = document.getElementById('photo-prev');
        if (prev) prev.innerHTML = `<img src="${url}" alt="">`;
        document.getElementById('photo-clear')?.classList.remove('hidden');
      }).catch(() => toast('Não foi possível ler essa imagem.', 'err'));
    }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.input === 'search') { state.search = el.value; render(); }
    if (el.dataset.input === 'draft') state.drafts[el.dataset.id] = el.value;
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    forms[f.dataset.form]?.(f);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalRender) closeModal(); });
  window.addEventListener('hashchange', render);

  // Sincroniza com outras abas (pedido novo, mensagem nova, status alterado)
  window.addEventListener('storage', (e) => {
    if (e.key !== DB_KEY || !e.newValue) return;
    const prev = db;
    try { db = JSON.parse(e.newValue); } catch { return; }
    notifyChanges(prev, db);
    render();
  });

  function notifyChanges(prev, next) {
    const user = me();
    if (!user) return;
    const role = myRole();
    const prevIds = new Set(prev.messages.map((m) => m.id));
    const mine = new Set((isAdmin() ? next.orders : next.orders.filter((o) => o.userId === user.id)).map((o) => o.id));
    const r = route();
    next.messages.filter((m) => !prevIds.has(m.id) && mine.has(m.orderId) && m.from !== role).forEach((m) => {
      const o = next.orders.find((x) => x.id === m.orderId);
      if (role === 'cantina' && m.from === 'system') {
        if (o && o.history.length === 1) toast(`🆕 Novo pedido #${o.num} de ${o.userName}`, 'ok');
        return;
      }
      if (r.page === 'chat' && r.id === m.orderId) return;
      toast(m.from === 'system' ? `📦 ${m.text.split('.')[0]}` : `💬 #${o?.num}: ${m.text.slice(0, 60)}`);
    });
  }

  render();
})();
