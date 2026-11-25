/* ══════════════════════════════════════════════════════════════════
   PickFlow · Registro de órdenes y pickeos
   ══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://scqbsmqudbrttyfyxiox.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Bdd1fmoV3u9j8zXGoJDafA_0Wp46Rnr';
  const TABLE = 'registros_pickeos';
  const fields = ['cambio', 'orden', 'linea', 'pickeos', 'column5', 'column6', 'column7', 'column8'];
  const columnNames = ['Cambio', 'Orden', 'Línea', 'Pickeos', 'Columna 5', 'Columna 6', 'Columna 7', 'Columna 8'];
  const DEFAULT_PAGE_SIZE = 8;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = id => document.getElementById(id);
  const el = {
    form: $('recordForm'), tableBody: $('tableBody'), empty: $('emptyMessage'),
    loading: $('loadingState'), saveBtn: $('saveBtn'), cancelBtn: $('cancelBtn'),
    status: $('status'), count: $('recordCount'), dateInput: $('filterDate'),
    dateLabel: $('activeDateLabel'), dateHint: $('activeDateHint'), pagination: $('pagination'),
    pageInfo: $('pageInfo'), prev: $('prevPage'), next: $('nextPage'),
    search: $('searchInput'), sort: $('sortSelect'), confirm: $('confirmOverlay'),
    toastStack: $('toastStack'), formPanel: document.querySelector('.form-panel'),
    selectAll: $('selectAll'), bulkBar: $('bulkBar'), bulkCount: $('bulkCount'),
    emptyText: $('emptyText'), clearFilters: $('clearFiltersBtn'), pageSizeSelect: $('pageSizeSelect')
  };

  const state = {
    records: [], editingId: null, activeDate: '', search: '', statusFilter: 'all',
    sort: 'fecha_desc', page: 1, pageSize: DEFAULT_PAGE_SIZE, loading: false, selected: new Set()
  };
  const DRAFT_KEY = 'pickflow-draft';

  function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function prettyDate(value) {
    if (!value) return 'Vista completa';
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return value;
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      .format(new Date(y, m - 1, d));
  }
  function showStatus(message, isError = false) {
    el.status.textContent = message;
    el.status.classList.toggle('is-error', isError);
  }
  const node = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const icon = id => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#${id}`);
    svg.appendChild(use);
    return svg;
  };

  /* ── Tema ────────────────────────────────────────────────────── */
  function isDark() { return document.documentElement.dataset.theme === 'dark'; }
  function syncThemeButton() {
    $('themeBtn').setAttribute('aria-label', isDark() ? 'Activar tema claro' : 'Activar tema oscuro');
    $('themeBtn').title = isDark() ? 'Activar tema claro' : 'Activar tema oscuro';
  }
  syncThemeButton();
  $('themeBtn').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pickflow-theme', next); } catch (e) { /* modo privado */ }
    syncThemeButton();
    toast(next === 'dark' ? 'Tema oscuro activado.' : 'Tema claro activado.', 'info');
  });

  /* ── Toasts ──────────────────────────────────────────────────── */
  const toastMeta = {
    success: { icon: 'i-check', title: 'Listo' },
    error: { icon: 'i-alert', title: 'Atención' },
    info: { icon: 'i-spinner', title: 'Información' }
  };
  function toast(message, type = 'info') {
    const meta = toastMeta[type] || toastMeta.info;
    const item = node('div', `toast toast--${type}`);
    const badge = node('span', 'toast__icon');
    const ico = icon(meta.icon);
    if (type === 'info') ico.classList.add('spinning');
    badge.appendChild(ico);
    const body = node('div', 'toast__body');
    body.append(node('strong', '', meta.title), node('span', '', message));
    const close = node('button', 'toast__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar notificación');
    close.appendChild(icon('i-x'));
    item.append(badge, body, close);
    el.toastStack.appendChild(item);
    requestAnimationFrame(() => item.classList.add('is-in'));

    let timer;
    const dismiss = () => {
      clearTimeout(timer);
      item.classList.add('is-out');
      item.addEventListener('transitionend', () => item.remove(), { once: true });
      if (reduceMotion) item.remove();
    };
    close.addEventListener('click', dismiss);
    timer = setTimeout(dismiss, 4200);
  }

  /* ── Modal de confirmación ───────────────────────────────────── */
  let confirmResolve = null;
  function askConfirm({ title, message, confirmLabel = 'Confirmar' }) {
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    $('confirmAccept').textContent = confirmLabel;
    el.confirm.hidden = false;
    $('confirmCancel').focus();
    return new Promise(resolve => { confirmResolve = resolve; });
  }
  function closeConfirm(result) {
    el.confirm.hidden = true;
    if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
  }
  $('confirmCancel').addEventListener('click', () => closeConfirm(false));
  $('confirmAccept').addEventListener('click', () => closeConfirm(true));
  el.confirm.addEventListener('click', event => { if (event.target === el.confirm) closeConfirm(false); });

  /* ── Efecto ripple ───────────────────────────────────────────── */
  if (!reduceMotion) {
    document.addEventListener('click', event => {
      const btn = event.target.closest('.btn');
      if (!btn || btn.disabled) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = node('span', 'ripple');
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  /* ── Contadores animados ─────────────────────────────────────── */
  function animateValue(element, target) {
    const from = Number(element.dataset.value || 0);
    element.dataset.value = String(target);
    if (reduceMotion || from === target) { element.textContent = target; return; }
    const duration = 650;
    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      element.textContent = Math.round(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── Cliente de Supabase ─────────────────────────────────────── */
  if (!window.supabase?.createClient) {
    document.querySelector('.shell').hidden = true;
    $('fatalState').hidden = false;
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  /* ── Acceso ──────────────────────────────────────────────────── */
  function ensureLoginOverlay() {
    let overlay = $('authOverlay');
    if (overlay) return overlay;
    overlay = node('div', 'auth-overlay');
    overlay.id = 'authOverlay';
    const card = node('section', 'auth-card');
    card.setAttribute('aria-labelledby', 'authTitle');
    const mark = node('span', 'auth-card__mark');
    mark.appendChild(icon('i-box'));
    const heading = node('h2', '', 'Acceso de administrador');
    heading.id = 'authTitle';
    const intro = node('p', '', 'Inicia sesión para consultar y administrar los registros. La sesión se mantendrá activa en tus próximas visitas.');
    const form = node('form');
    form.id = 'loginForm';

    const emailLabel = node('label', '', 'Correo electrónico');
    emailLabel.htmlFor = 'loginEmail';
    const emailWrap = node('div', 'input-wrap');
    emailWrap.appendChild(icon('i-tag'));
    const email = node('input');
    email.id = 'loginEmail'; email.type = 'email'; email.autocomplete = 'username'; email.required = true;
    emailWrap.appendChild(email);

    const passLabel = node('label', '', 'Contraseña');
    passLabel.htmlFor = 'loginPassword';
    const passWrap = node('div', 'input-wrap');
    passWrap.appendChild(icon('i-shield'));
    const pass = node('input');
    pass.id = 'loginPassword'; pass.type = 'password'; pass.autocomplete = 'current-password'; pass.required = true;
    passWrap.appendChild(pass);

    const submit = node('button', 'btn btn--primary');
    submit.type = 'submit';
    submit.appendChild(icon('i-logout'));
    submit.appendChild(node('span', '', 'Iniciar sesión'));
    const loginStatus = node('div', 'status');
    loginStatus.id = 'loginStatus';
    loginStatus.setAttribute('role', 'status');
    loginStatus.setAttribute('aria-live', 'polite');

    form.append(emailLabel, emailWrap, passLabel, passWrap, submit, loginStatus);
    card.append(mark, heading, intro, form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    email.focus();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const label = submit.querySelector('span');
      const ico = submit.querySelector('.icon');
      submit.disabled = true;
      ico.classList.add('spinning');
      label.textContent = 'Verificando acceso…';
      loginStatus.classList.remove('is-error');
      loginStatus.textContent = '';
      const { error } = await db.auth.signInWithPassword({
        email: email.value.trim(), password: pass.value
      });
      submit.disabled = false;
      ico.classList.remove('spinning');
      label.textContent = 'Iniciar sesión';
      if (error) {
        loginStatus.textContent = 'No se pudo iniciar sesión. Revisa el correo y la contraseña.';
        loginStatus.classList.add('is-error');
        card.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
          { duration: 360 }
        );
        return;
      }
      overlay.remove();
      toast('Sesión iniciada correctamente.', 'success');
      await loadRecords(state.activeDate);
    });
    return overlay;
  }

  async function requireSession() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session) { ensureLoginOverlay(); return false; }
    $('authOverlay')?.remove();
    return true;
  }

  $('signOutBtn').addEventListener('click', async () => {
    const { error } = await db.auth.signOut();
    if (error) { toast('No se pudo cerrar la sesión.', 'error'); return; }
    toast('Sesión cerrada.', 'info');
  });

  /* ── Carga ───────────────────────────────────────────────────── */
  function setLoading(value) {
    state.loading = value;
    el.loading.hidden = !value;
    el.tableBody.hidden = value;
    if (value) el.empty.hidden = true;
  }

  async function loadRecords(date = state.activeDate) {
    if (!(await requireSession())) return;
    setLoading(true);
    showStatus('Sincronizando registros…');
    let query = db.from(TABLE).select('*')
      .order('fecha', { ascending: false }).order('id', { ascending: false });
    if (date) query = query.eq('fecha', date);
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      state.records = [];
      render();
      showStatus('Error al cargar. Revisa las columnas y las políticas RLS.', true);
      toast('No se pudieron cargar los registros.', 'error');
      return;
    }
    state.records = data || [];
    state.page = 1;
    render();
    showStatus(date ? `Registros del ${date} sincronizados.` : 'Todos los registros sincronizados.');
  }

  /* ── Filtrado y orden ────────────────────────────────────────── */
  function getFiltered() {
    const q = state.search.trim().toLowerCase();
    const list = state.records.filter(record => {
      const matchesText = !q || fields.some(key => String(record[key] ?? '').toLowerCase().includes(q));
      const matchesStatus = state.statusFilter === 'all' ||
        (state.statusFilter === 'received' ? Boolean(record.recibido) : !record.recibido);
      return matchesText && matchesStatus;
    });
    const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
    const byDate = (a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')) || (b.id - a.id);
    const sorters = {
      fecha_desc: byDate,
      fecha_asc: (a, b) => -byDate(a, b),
      orden_asc: (a, b) => collator.compare(String(a.orden ?? ''), String(b.orden ?? '')),
      orden_desc: (a, b) => -collator.compare(String(a.orden ?? ''), String(b.orden ?? '')),
      recibido: (a, b) => Number(Boolean(b.recibido)) - Number(Boolean(a.recibido)) || byDate(a, b)
    };
    return list.sort(sorters[state.sort] || byDate);
  }

  /* ── Render ──────────────────────────────────────────────────── */
  function updateDateChip() {
    el.dateLabel.textContent = prettyDate(state.activeDate);
    el.dateHint.textContent = state.activeDate ? 'Filtrando por día' : 'Vista completa';
  }
  function renderStats() {
    const received = state.records.filter(r => r.recibido).length;
    const values = {
      total: state.records.length,
      received,
      pending: state.records.length - received,
      orders: new Set(state.records.map(r => r.orden).filter(Boolean)).size
    };
    Object.entries(values).forEach(([key, value]) => {
      const target = document.querySelector(`[data-stat="${key}"]`);
      if (target) animateValue(target, value);
    });
    el.count.textContent = `${state.records.length} ${state.records.length === 1 ? 'registro' : 'registros'}`;
  }
  function renderChips() {
    const received = state.records.filter(r => r.recibido).length;
    const counts = { all: state.records.length, received, pending: state.records.length - received };
    Object.entries(counts).forEach(([key, value]) => {
      const target = document.querySelector(`[data-chip-count="${key}"]`);
      if (target) target.textContent = value;
    });
  }
  function syncSelectionUI(visible) {
    const ids = visible.map(record => String(record.id));
    const selectedVisible = ids.filter(id => state.selected.has(id)).length;
    el.bulkBar.hidden = state.selected.size === 0;
    el.bulkCount.textContent = state.selected.size;
    el.selectAll.checked = ids.length > 0 && selectedVisible === ids.length;
    el.selectAll.indeterminate = selectedVisible > 0 && selectedVisible < ids.length;
  }

  function renderTable() {
    // Descartar selecciones de registros que ya no están cargados
    const validIds = new Set(state.records.map(record => String(record.id)));
    [...state.selected].forEach(id => { if (!validIds.has(id)) state.selected.delete(id); });

    const list = getFiltered();
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * state.pageSize;
    const visible = list.slice(start, start + state.pageSize);

    el.tableBody.replaceChildren();
    el.empty.hidden = total !== 0;
    el.tableBody.hidden = total === 0;
    el.pagination.hidden = total <= state.pageSize;
    el.pageInfo.textContent = `Mostrando ${start + 1}–${Math.min(start + state.pageSize, total)} de ${total} registros`;
    el.prev.disabled = state.page <= 1;
    el.next.disabled = state.page >= pages;

    const hasFilters = Boolean(state.search.trim() || state.statusFilter !== 'all');
    el.clearFilters.hidden = !hasFilters;
    el.emptyText.textContent = hasFilters
      ? 'No hay resultados con los filtros actuales. Prueba con otros criterios.'
      : 'Agrega el primer registro para comenzar.';

    visible.forEach((record, index) => {
      const id = String(record.id);
      const row = node('tr', 'row-enter');
      row.style.setProperty('--d', `${index * 45}ms`);
      if (state.selected.has(id)) row.classList.add('is-selected');
      if (state.editingId !== null && String(state.editingId) === id) row.classList.add('is-editing');

      const checkCell = node('td', 'col-check');
      const check = node('input');
      check.type = 'checkbox';
      check.checked = state.selected.has(id);
      check.setAttribute('aria-label', `Seleccionar orden ${record.orden ?? ''}`);
      check.addEventListener('change', () => {
        if (check.checked) state.selected.add(id);
        else state.selected.delete(id);
        row.classList.toggle('is-selected', check.checked);
        syncSelectionUI(visible);
      });
      checkCell.appendChild(check);
      row.appendChild(checkCell);

      const dateCell = node('td');
      dateCell.appendChild(node('span', 'cell-date', record.fecha || '—'));
      row.appendChild(dateCell);

      fields.forEach(key => {
        const isOrder = key === 'orden';
        const cell = node('td', isOrder || key === 'pickeos' ? 'cell-strong' : '', record[key] || '—');
        if (isOrder && record[key]) {
          cell.classList.add('cell-copy');
          cell.title = 'Clic para copiar el número de orden';
          cell.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(String(record[key]));
              toast(`Orden ${record[key]} copiada al portapapeles.`, 'success');
            } catch (e) {
              showStatus(`Número de orden: ${record[key]}`);
            }
          });
        }
        row.appendChild(cell);
      });

      const actionCell = node('td');
      const actions = node('div', 'row-actions');

      const edit = node('button', 'row-btn row-btn--edit');
      edit.type = 'button'; edit.title = 'Editar'; edit.setAttribute('aria-label', `Editar orden ${record.orden ?? ''}`);
      edit.appendChild(icon('i-edit'));
      edit.addEventListener('click', () => startEdit(record));

      const remove = node('button', 'row-btn row-btn--delete');
      remove.type = 'button'; remove.title = 'Eliminar'; remove.setAttribute('aria-label', `Eliminar orden ${record.orden ?? ''}`);
      remove.appendChild(icon('i-trash'));
      remove.addEventListener('click', () => deleteRecord(record));

      const toggle = node('button', `status-toggle${record.recibido ? ' is-on' : ''}`);
      toggle.type = 'button';
      toggle.setAttribute('aria-pressed', String(Boolean(record.recibido)));
      toggle.appendChild(node('span', 'dot'));
      if (record.recibido) toggle.appendChild(icon('i-check'));
      toggle.appendChild(node('span', '', record.recibido ? 'Recibido' : 'Pendiente'));
      toggle.addEventListener('click', () => toggleReceived(record));

      actions.append(edit, remove, toggle);
      actionCell.appendChild(actions);
      row.appendChild(actionCell);
      el.tableBody.appendChild(row);
    });

    syncSelectionUI(visible);
  }
  function render() {
    updateDateChip();
    renderStats();
    renderChips();
    if (!state.loading) renderTable();
  }

  /* ── Formulario ──────────────────────────────────────────────── */
  function getFormData() {
    return Object.fromEntries(fields.map(id => [id, $(id).value.trim()]));
  }
  function clearInvalid() {
    fields.forEach(id => $(id).classList.remove('is-invalid'));
  }
  function startEdit(record) {
    state.editingId = record.id;
    fields.forEach(key => { $(key).value = record[key] ?? ''; });
    el.saveBtn.querySelector('span').textContent = 'Guardar cambios';
    el.saveBtn.querySelector('use').setAttribute('href', '#i-check');
    el.cancelBtn.hidden = false;
    $('formTitle').textContent = 'Editar registro';
    showStatus(`Editando la orden ${record.orden}.`);
    clearInvalid();
    renderTable();
    el.formPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    el.formPanel.animate(
      [{ boxShadow: '0 0 0 0 var(--primary)' }, { boxShadow: '0 0 0 4px var(--primary-soft)' }, { boxShadow: '0 0 0 0 transparent' }],
      { duration: 900, easing: 'ease-out' }
    );
    $('orden').focus({ preventScroll: true });
  }
  function resetEditor() {
    state.editingId = null;
    el.form.reset();
    clearDraft();
    clearInvalid();
    el.saveBtn.querySelector('span').textContent = 'Agregar registro';
    el.saveBtn.querySelector('use').setAttribute('href', '#i-plus');
    el.cancelBtn.hidden = true;
    $('formTitle').textContent = 'Datos del registro';
    if (!state.loading) renderTable();
  }

  /* ── Borrador local ──────────────────────────────────────────── */
  function saveDraft() {
    if (state.editingId !== null) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(getFormData())); } catch (e) { /* almacenamiento no disponible */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* almacenamiento no disponible */ }
  }
  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      let restored = false;
      fields.forEach(key => {
        if (draft[key]) { $(key).value = draft[key]; restored = true; }
      });
      if (restored) showStatus('Recuperamos tu borrador sin guardar.');
    } catch (e) { /* borrador inválido */ }
  }
  let draftTimer;
  $('fields').addEventListener('input', () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 300);
  });
  restoreDraft();

  el.form.addEventListener('submit', async event => {
    event.preventDefault();
    clearInvalid();
    const record = getFormData();
    const missing = ['orden', 'linea', 'pickeos'].filter(key => !record[key]);
    if (missing.length) {
      missing.forEach(key => $(key).classList.add('is-invalid'));
      showStatus('Completa los campos obligatorios: Orden, Línea y Pickeos.', true);
      toast('Hay campos obligatorios sin completar.', 'error');
      $(missing[0]).focus();
      return;
    }

    const payload = { ...record };
    const wasEditing = state.editingId !== null;
    const labelEl = el.saveBtn.querySelector('span');
    const previousLabel = labelEl.textContent;
    el.saveBtn.disabled = true;
    labelEl.textContent = 'Guardando…';

    let result;
    if (wasEditing) {
      result = await db.from(TABLE).update(payload).eq('id', state.editingId).select().single();
    } else {
      payload.fecha = state.activeDate || todayLocal();
      result = await db.from(TABLE).insert(payload).select().single();
    }
    el.saveBtn.disabled = false;
    labelEl.textContent = previousLabel;

    if (result.error) {
      showStatus('No se pudo guardar. Revisa tu sesión y las políticas de Supabase.', true);
      toast('No se pudo guardar el registro.', 'error');
      return;
    }
    resetEditor();
    await loadRecords(state.activeDate);
    toast(wasEditing ? `Orden ${record.orden} actualizada.` : `Orden ${record.orden} guardada.`, 'success');
  });

  $('resetBtn').addEventListener('click', () => { resetEditor(); showStatus('Campos limpios.'); });
  el.cancelBtn.addEventListener('click', () => { resetEditor(); showStatus('Edición cancelada.'); });
  $('emptyActionBtn').addEventListener('click', () => {
    el.formPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    $('orden').focus({ preventScroll: true });
  });

  /* ── Acciones sobre registros ────────────────────────────────── */
  async function deleteRecord(record) {
    const ok = await askConfirm({
      title: 'Eliminar registro',
      message: `¿Eliminar la orden ${record.orden}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar'
    });
    if (!ok) return;
    const { error } = await db.from(TABLE).delete().eq('id', record.id);
    if (error) { toast('No se pudo eliminar el registro.', 'error'); return; }
    if (state.editingId === record.id) resetEditor();
    await loadRecords(state.activeDate);
    toast(`Orden ${record.orden} eliminada.`, 'success');
  }

  async function toggleReceived(record) {
    const next = !record.recibido;
    record.recibido = next;           // actualización optimista para que la animación sea inmediata
    render();
    const { error } = await db.from(TABLE).update({ recibido: next }).eq('id', record.id);
    if (error) {
      record.recibido = !next;        // revertir
      render();
      showStatus('No se pudo actualizar el estado. Verifica la columna recibido (boolean).', true);
      toast('No se pudo actualizar el estado.', 'error');
      return;
    }
    showStatus(next ? `Orden ${record.orden} marcada como recibida.` : `Se quitó el estado recibido de la orden ${record.orden}.`);
  }

  $('clearBtn').addEventListener('click', async () => {
    if (!state.records.length) { showStatus('No hay registros en esta vista.'); return; }
    const scope = state.activeDate ? `del ${state.activeDate}` : 'completos';
    const ok = await askConfirm({
      title: 'Limpiar vista',
      message: `¿Eliminar todos los registros ${scope}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar todo'
    });
    if (!ok) return;
    let query = db.from(TABLE).delete().not('id', 'is', null);
    if (state.activeDate) query = query.eq('fecha', state.activeDate);
    const { error } = await query;
    if (error) { toast('No se pudieron eliminar los registros.', 'error'); return; }
    resetEditor();
    await loadRecords(state.activeDate);
    toast('Registros eliminados de la vista actual.', 'success');
  });

  /* ── Selección y acciones masivas ────────────────────────────── */
  function selectedIds() {
    return [...state.selected]
      .map(stringId => state.records.find(record => String(record.id) === stringId)?.id)
      .filter(id => id !== undefined);
  }
  el.selectAll.addEventListener('change', () => {
    const visible = getFiltered().slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    visible.forEach(record => {
      const id = String(record.id);
      if (el.selectAll.checked) state.selected.add(id);
      else state.selected.delete(id);
    });
    renderTable();
  });
  $('bulkClear').addEventListener('click', () => {
    state.selected.clear();
    renderTable();
    showStatus('Selección limpiada.');
  });
  $('bulkReceived').addEventListener('click', async () => {
    const ids = selectedIds();
    if (!ids.length) return;
    const { error } = await db.from(TABLE).update({ recibido: true }).in('id', ids);
    if (error) { toast('No se pudieron actualizar los registros.', 'error'); return; }
    state.selected.forEach(stringId => {
      const record = state.records.find(item => String(item.id) === stringId);
      if (record) record.recibido = true;
    });
    render();
    toast(`${ids.length} registros marcados como recibidos.`, 'success');
  });
  $('bulkDelete').addEventListener('click', async () => {
    const ids = selectedIds();
    if (!ids.length) return;
    const ok = await askConfirm({
      title: 'Eliminar selección',
      message: `¿Eliminar ${ids.length} registros seleccionados? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar'
    });
    if (!ok) return;
    const { error } = await db.from(TABLE).delete().in('id', ids);
    if (error) { toast('No se pudieron eliminar los registros.', 'error'); return; }
    if (ids.some(id => String(id) === String(state.editingId))) resetEditor();
    state.selected.clear();
    await loadRecords(state.activeDate);
    toast(`${ids.length} registros eliminados.`, 'success');
  });

  /* ── Exportar CSV ────────────────────────────────────────────── */
  $('exportBtn').addEventListener('click', () => {
    const list = getFiltered();
    if (!list.length) { toast('No hay registros para exportar.', 'info'); return; }
    const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Fecha', ...columnNames, 'Recibido'].map(escape).join(',');
    const rows = list.map(r =>
      [r.fecha, ...fields.map(key => r[key] ?? ''), r.recibido ? 'Sí' : 'No'].map(escape).join(',')
    );
    const blob = new Blob(['\uFEFF', header, '\r\n', rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pickflow_${state.activeDate || 'todos'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${list.length} registros exportados a CSV.`, 'success');
  });

  /* ── Filtros, búsqueda, orden y paginación ───────────────────── */
  $('filterBtn').addEventListener('click', async () => {
    state.activeDate = el.dateInput.value;
    await loadRecords(state.activeDate);
  });
  $('showAllBtn').addEventListener('click', async () => {
    state.activeDate = '';
    el.dateInput.value = '';
    await loadRecords('');
    toast('Mostrando todos los registros.', 'info');
  });
  $('todayBtn').addEventListener('click', async () => {
    state.activeDate = todayLocal();
    el.dateInput.value = state.activeDate;
    await loadRecords(state.activeDate);
    toast('Volviendo a la fecha de hoy.', 'info');
  });
  el.clearFilters.addEventListener('click', () => {
    state.search = '';
    el.search.value = '';
    state.statusFilter = 'all';
    document.querySelectorAll('.chip').forEach(chip =>
      chip.classList.toggle('is-active', chip.dataset.status === 'all')
    );
    state.page = 1;
    renderTable();
    showStatus('Filtros limpiados.');
  });

  let searchTimer;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = el.search.value;
      state.page = 1;
      renderTable();
    }, 160);
  });
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.statusFilter = chip.dataset.status;
      state.page = 1;
      renderTable();
    });
  });
  function syncSortHeaders() {
    document.querySelectorAll('.th-sort').forEach(button => {
      const key = button.dataset.sort;
      button.classList.toggle('is-asc', state.sort === `${key}_asc`);
      button.classList.toggle('is-desc', state.sort === `${key}_desc`);
      button.setAttribute('aria-label', `Ordenar por ${key.toLowerCase()}`);
    });
  }
  function setSort(value) {
    state.sort = value;
    el.sort.value = value;
    state.page = 1;
    syncSortHeaders();
    renderTable();
  }
  el.sort.addEventListener('change', () => setSort(el.sort.value));
  document.querySelectorAll('.th-sort').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      setSort(state.sort === `${key}_desc` ? `${key}_asc` : `${key}_desc`);
    });
  });
  el.pageSizeSelect.addEventListener('change', () => {
    state.pageSize = Number(el.pageSizeSelect.value) || DEFAULT_PAGE_SIZE;
    state.page = 1;
    renderTable();
  });
  el.prev.addEventListener('click', () => {
    if (state.page > 1) { state.page--; renderTable(); }
  });
  el.next.addEventListener('click', () => {
    state.page++;
    renderTable();
  });

  /* ── Atajos de teclado ───────────────────────────────────────── */
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      el.search.focus();
      el.search.select();
    }
    if (event.key === 'Escape') {
      if (!el.confirm.hidden) { closeConfirm(false); return; }
      if (state.editingId !== null) { resetEditor(); showStatus('Edición cancelada.'); }
    }
    if (event.key === 'Tab' && !el.confirm.hidden) {
      const focusables = [...el.confirm.querySelectorAll('button')];
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  /* ── Inicio ──────────────────────────────────────────────────── */
  el.dateInput.value = todayLocal();
  state.activeDate = el.dateInput.value;
  setSort(el.sort.value);

  db.auth.onAuthStateChange((_event, session) => {
    if (session) $('authOverlay')?.remove();
    else ensureLoginOverlay();
  });

  // Sincronización en tiempo real entre pestañas y usuarios (requiere publicación Realtime en Supabase)
  let realtimeTimer;
  db.channel('pickflow-registros')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
      clearTimeout(realtimeTimer);
      realtimeTimer = setTimeout(() => {
        if (document.visibilityState === 'visible') loadRecords(state.activeDate);
      }, 500);
    })
    .subscribe();

  loadRecords(state.activeDate);
})();

