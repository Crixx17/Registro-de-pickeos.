(() => {
  const SUPABASE_URL = 'https://scqbsmqudbrttyfyxiox.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Bdd1fmoV3u9j8zXGoJDafA_0Wp46Rnr';
  const fields = ['cambio','orden','linea','pickeos','column5','column6','column7','column8'];
  const form = document.getElementById('recordForm');
  const tableBody = document.getElementById('tableBody');
  const emptyMessage = document.getElementById('emptyMessage');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const status = document.getElementById('status');
  const count = document.getElementById('recordCount');
  const dateInput = document.getElementById('filterDate');
  let records = [];
  let editingId = null;
  let activeDate = '';

  if (!window.supabase?.createClient) {
    showStatus('No se pudo cargar Supabase. Recarga la página y revisa tu conexión.');
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  function showStatus(message) { status.textContent = message; }
  function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  dateInput.value = todayLocal();
  activeDate = dateInput.value;

  function ensureLoginOverlay() {
    let overlay = document.getElementById('authOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `<section class="auth-card" aria-labelledby="authTitle">
      <h2 id="authTitle">Acceso de administrador</h2>
      <p>Inicia sesión para consultar y administrar los registros. La página se abrirá directamente en tus próximas visitas mientras la sesión siga activa.</p>
      <form id="loginForm">
        <label for="loginEmail">Correo electrónico</label><input id="loginEmail" type="email" autocomplete="username" required>
        <label for="loginPassword">Contraseña</label><input id="loginPassword" type="password" autocomplete="current-password" required>
        <div class="actions"><button class="primary" type="submit">Iniciar sesión</button></div>
        <div class="status" id="loginStatus" role="status" aria-live="polite"></div>
      </form></section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#loginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const loginStatus = overlay.querySelector('#loginStatus');
      const button = overlay.querySelector('button[type="submit"]');
      button.disabled = true;
      loginStatus.textContent = 'Verificando acceso…';
      const { error } = await db.auth.signInWithPassword({
        email: overlay.querySelector('#loginEmail').value.trim(),
        password: overlay.querySelector('#loginPassword').value
      });
      button.disabled = false;
      if (error) { loginStatus.textContent = 'No se pudo iniciar sesión. Revisa el correo y la contraseña.'; return; }
      overlay.remove();
      await loadRecords(activeDate);
    });
    return overlay;
  }

  async function requireSession() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session) { ensureLoginOverlay(); return false; }
    document.getElementById('authOverlay')?.remove();
    return true;
  }

  function getFormData() {
    return Object.fromEntries(fields.map(id => [id, document.getElementById(id).value.trim()]));
  }
  function render() {
    tableBody.replaceChildren();
    emptyMessage.hidden = records.length !== 0;
    count.textContent = `${records.length} ${records.length === 1 ? 'registro' : 'registros'}`;
    records.forEach(record => {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      dateCell.textContent = record.fecha || '—';
      row.appendChild(dateCell);
      fields.forEach(key => {
        const cell = document.createElement('td');
        cell.textContent = record[key] || '—';
        row.appendChild(cell);
      });
      const actionCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'secondary mini'; edit.textContent = 'Editar';
      edit.addEventListener('click', () => startEdit(record));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'danger mini'; remove.textContent = 'Eliminar';
      remove.addEventListener('click', () => deleteRecord(record));
      const received = document.createElement('button');
      received.type = 'button';
      received.className = `received mini${record.recibido ? ' is-received' : ''}`;
      received.textContent = record.recibido ? '✓ Recibido' : '☐ Recibido';
      received.setAttribute('aria-pressed', String(Boolean(record.recibido)));
      received.addEventListener('click', () => toggleReceived(record));
      actions.append(edit, remove, received);
      actionCell.appendChild(actions);
      row.appendChild(actionCell);
      tableBody.appendChild(row);
    });
  }

  async function loadRecords(date = '') {
    if (!(await requireSession())) return;
    showStatus('Cargando registros…');
    let query = db.from('registros_pickeos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false });
    if (date) query = query.eq('fecha', date);
    const { data, error } = await query;
    if (error) { showStatus('Error al cargar registros. Verifica las columnas de la tabla y las políticas RLS.'); return; }
    records = data || [];
    render();
    showStatus(date ? `Registros del ${date} cargados.` : 'Registros cargados correctamente.');
  }

  function startEdit(record) {
    editingId = record.id;
    fields.forEach(key => { document.getElementById(key).value = record[key] || ''; });
    saveBtn.textContent = 'Guardar cambios';
    cancelBtn.hidden = false;
    document.getElementById('formTitle').textContent = 'Editar registro';
    showStatus(`Editando la orden ${record.orden}.`);
    document.querySelector('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function resetEditor() {
    editingId = null;
    form.reset();
    saveBtn.textContent = '＋ Agregar registro';
    cancelBtn.hidden = true;
    document.getElementById('formTitle').textContent = 'Datos del registro';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const record = getFormData();
    if (!record.orden || !record.linea || !record.pickeos) {
      showStatus('Completa los campos obligatorios: Orden, Línea y Pickeos.'); return;
    }
    const payload = { ...record };
    let result;
    if (editingId !== null) {
      result = await db.from('registros_pickeos').update(payload).eq('id', editingId).select().single();
    } else {
      payload.fecha = activeDate || todayLocal();
      result = await db.from('registros_pickeos').insert(payload).select().single();
    }
    if (result.error) { showStatus('No se pudo guardar. Revisa tu sesión, las columnas y las políticas de Supabase.'); return; }
    const wasEditing = editingId !== null;
    resetEditor();
    await loadRecords(activeDate);
    showStatus(wasEditing ? 'Registro actualizado correctamente.' : 'Registro guardado permanentemente en Supabase.');
  });

  async function deleteRecord(record) {
    if (!confirm(`¿Deseas eliminar el registro de la orden ${record.orden}?`)) return;
    const { error } = await db.from('registros_pickeos').delete().eq('id', record.id);
    if (error) { showStatus('No se pudo eliminar el registro.'); return; }
    await loadRecords(activeDate);
    showStatus(`Se eliminó la orden ${record.orden}.`);
  }

  async function toggleReceived(record) {
    const { error } = await db.from('registros_pickeos').update({ recibido: !record.recibido }).eq('id', record.id);
    if (error) { showStatus('No se pudo actualizar el estado recibido. Comprueba que exista la columna recibido (boolean).'); return; }
    await loadRecords(activeDate);
    showStatus(!record.recibido ? `Orden ${record.orden} marcada como recibida.` : `Se quitó el estado recibido de la orden ${record.orden}.`);
  }

  cancelBtn.addEventListener('click', () => { resetEditor(); showStatus('Edición cancelada.'); });
  document.getElementById('filterBtn').addEventListener('click', async () => {
    activeDate = dateInput.value;
    await loadRecords(activeDate);
  });
  document.getElementById('showAllBtn').addEventListener('click', async () => {
    activeDate = '';
    dateInput.value = '';
    await loadRecords('');
  });
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (!records.length) { showStatus('No hay registros en esta vista.'); return; }
    if (!confirm('¿Seguro que deseas eliminar todos los registros de esta vista? Esta acción no se puede deshacer.')) return;
    let query = db.from('registros_pickeos').delete().not('id', 'is', null);
    if (activeDate) query = query.eq('fecha', activeDate);
    const { error } = await query;
    if (error) { showStatus('No se pudieron eliminar los registros.'); return; }
    resetEditor();
    await loadRecords(activeDate);
    showStatus('Registros eliminados de la vista actual.');
  });

  db.auth.onAuthStateChange((_event, session) => {
    if (session) { document.getElementById('authOverlay')?.remove(); }
    else ensureLoginOverlay();
  });
  loadRecords(activeDate);
})();
