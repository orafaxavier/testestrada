/* STRADA H&G · boot
   Liga o app (app.js, o mesmo código do artifact) ao Supabase.
   O app pede window.claude.use('db' | 'assets' | 'artifact' | 'sample'); aqui cada um
   desses recursos é atendido pelo Supabase:
   - artifact.publish  -> tabela app_state (linha "main"): a logística que os ADM editam
   - db                -> tabela docs (ao vivo, chat, reações, reconhecimento, recebidos)
   - assets            -> Storage, bucket "recon" (fotos do reconhecimento)
   - sample            -> desligado na versão de teste (o app guarda o material em Recebidos)
*/
(function () {
  'use strict';
  var CFG = window.STRADA_CONFIG || {};
  var CLIENT = 'c' + Math.random().toString(36).slice(2, 10);
  var CACHE_KEY = 'strada:cache:state';
  var sb = null, loadedAt = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function bootMsg(t, sub) {
    var b = document.getElementById('boot');
    if (b) b.innerHTML = '<img src="/icons/icon-192.png" alt=""><div>' + t + '</div>' + (sub ? '<p>' + sub + '</p>' : '');
  }
  function errCode(e) {
    var s = e && (e.status || e.statusCode), c = e && e.code;
    if (s === 401 || s === 403 || c === '42501' || c === 'PGRST301') return 'not_granted';
    return c || 'error';
  }
  function fail(e) { var x = new Error((e && e.message) || 'erro'); x.code = errCode(e); return x; }

  /* ---------- estado da turnê (app_state) ---------- */
  function seed() { return fetch('/seed-state.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }); }

  function loadState() {
    if (!sb) return seed();
    // Sinal fraco: se o banco não responde em 7 s, abre com a última cópia salva no celular.
    var slow = new Promise(function (_, no) { setTimeout(function () { no(new Error('timeout')); }, 7000); });
    return Promise.race([fetchState(), slow]).catch(function () {
      var c = lsGet(CACHE_KEY);
      if (c) { try { return JSON.parse(c); } catch (e) {} }
      return seed();
    });
  }
  function fetchState() {
    return sb.from('app_state').select('data,updated_at').eq('id', 'main').maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      if (r.data) { loadedAt = r.data.updated_at; lsSet(CACHE_KEY, JSON.stringify(r.data.data)); return r.data.data; }
      // Primeira vez: o banco está vazio, sobe a logística atual do protótipo.
      return seed().then(function (s) {
        return sb.from('app_state').upsert({ id: 'main', data: s, updated_by: 'seed' }, { onConflict: 'id', ignoreDuplicates: true })
          .select('updated_at').then(function () { return fetchState(); });
      });
    });
  }

  function publish(html) {
    var m = /id="state">([\s\S]*?)<\/script>/.exec(String(html || ''));
    if (!m) return Promise.reject(fail({ message: 'estado não encontrado' }));
    var data = JSON.parse(m[1]);
    var now = new Date().toISOString();
    // Abriu sem sinal (cópia do celular): não sobrescreve o banco, recarrega a versão atual primeiro.
    if (!loadedAt) { var c0 = new Error('conflict'); c0.code = 'conflict'; setTimeout(function () { location.reload(); }, 2500); return Promise.reject(c0); }
    var q = sb.from('app_state').update({ data: data, updated_at: now, updated_by: CLIENT }).eq('id', 'main').eq('updated_at', loadedAt);
    return q.select('updated_at').then(function (r) {
      if (r.error) throw fail(r.error);
      if (!r.data || !r.data.length) {
        var x = new Error('conflict'); x.code = 'conflict';
        setTimeout(function () { location.reload(); }, 2500);
        throw x;
      }
      loadedAt = r.data[0].updated_at; lsSet(CACHE_KEY, JSON.stringify(data));
      return { ok: true };
    });
  }

  function watchState() {
    sb.channel('state').on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, function (p) {
      var n = p.new || {};
      if (n.updated_by === CLIENT || !n.updated_at || n.updated_at === loadedAt) return;
      if (document.hidden) { location.reload(); return; }
      if (document.getElementById('strada-upd')) return;
      var b = document.createElement('button');
      b.id = 'strada-upd'; b.type = 'button'; b.textContent = 'Logística atualizada · toque para ver';
      b.onclick = function () { location.reload(); };
      document.body.appendChild(b);
    }).subscribe();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && document.getElementById('strada-upd')) location.reload();
    });
  }

  /* ---------- coleções (docs) ---------- */
  var listeners = [];
  function toSnap(rows) {
    return { docs: rows.map(function (r) { return { id: r.id, data: function () { return r.data || {}; } }; }) };
  }
  function runQuery(L) {
    sb.from('docs').select('id,data').eq('collection', L.col).order('at', { ascending: L.asc, nullsFirst: false }).limit(L.lim)
      .then(function (r) { if (r.error) { if (L.err) L.err(fail(r.error)); return; } if (!L.off) L.cb(toSnap(r.data || [])); });
  }
  var pend = {}, pendT = 0;
  function refresh(col) {
    pend[col || '*'] = 1; clearTimeout(pendT);
    pendT = setTimeout(function () {
      var all = pend['*']; var cols = pend; pend = {};
      listeners.forEach(function (L) { if (!L.off && (all || cols[L.col])) runQuery(L); });
    }, 150);
  }
  function watchDocs() {
    sb.channel('docs').on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, function (p) {
      refresh((p.new && p.new.collection) || (p.old && p.old.collection) || '*');
    }).subscribe(function (status) { if (status === 'SUBSCRIBED') refresh('*'); });
    // celular volta do bolso, sinal volta: recarrega tudo
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh('*'); });
    window.addEventListener('online', function () { refresh('*'); });
    setInterval(function () { if (!document.hidden) refresh('*'); }, 45000);
  }
  function query(col, field, dir, lim) {
    return {
      limit: function (n) { return query(col, field, dir, n); },
      onSnapshot: function (cb, err) {
        var L = { col: col, asc: dir !== 'desc', lim: lim || 500, cb: cb, err: err };
        listeners.push(L); runQuery(L);
        return function () { L.off = true; };
      }
    };
  }
  function docRef(col, id) {
    return {
      set: function (data) { return sb.from('docs').upsert({ collection: col, id: id, data: data }).then(function (r) { if (r.error) throw fail(r.error); refresh(col); }); },
      delete: function () { return sb.from('docs').delete().eq('collection', col).eq('id', id).then(function (r) { if (r.error) throw fail(r.error); refresh(col); }); },
      get: function () { return sb.from('docs').select('data').eq('collection', col).eq('id', id).maybeSingle().then(function (r) { if (r.error) throw fail(r.error); var d = r.data && r.data.data; return { id: id, exists: !!d, data: function () { return d; } }; }); }
    };
  }
  var db = {
    collection: function (col) {
      return {
        add: function (data) {
          return sb.from('docs').insert({ collection: col, data: data }).select('id').single()
            .then(function (r) { if (r.error) throw fail(r.error); refresh(col); return { id: r.data.id }; });
        },
        doc: function (id) { return docRef(col, id); },
        orderBy: function (field, dir) { return query(col, field, dir); }
      };
    }
  };

  /* ---------- fotos (Storage) ---------- */
  var assets = {
    upload: function (blob) {
      var ext = /png/.test(blob.type) ? 'png' : 'jpg';
      var path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      return sb.storage.from('recon').upload(path, blob, { contentType: blob.type || 'image/jpeg' }).then(function (r) {
        if (r.error) throw fail(r.error);
        return { id: path, url: sb.storage.from('recon').getPublicUrl(path).data.publicUrl };
      });
    },
    delete: function (id) { return sb.storage.from('recon').remove([id]).then(function (r) { if (r.error) throw fail(r.error); }); }
  };

  /* ---------- liga tudo ---------- */
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: false } });
    window.claude = {
      use: function (cap) {
        if (cap === 'db') return Promise.resolve(db);
        if (cap === 'assets') return Promise.resolve(assets);
        if (cap === 'artifact') return Promise.resolve({ publish: publish });
        return Promise.resolve(null); // 'sample' (leitor automático) fica para a versão definitiva
      }
    };
  }

  loadState().then(function (state) {
    document.getElementById('state').textContent = JSON.stringify(state).replace(/</g, '\\u003c');
    var b = document.getElementById('boot'); if (b) b.remove();
    var s = document.createElement('script');
    s.src = '/app.js';
    s.onload = function () { if (sb) { watchState(); watchDocs(); } };
    document.body.appendChild(s);
  }).catch(function () {
    bootMsg('Não foi possível abrir', 'Verifique a internet e abra de novo.');
  });

  if (!sb) console.warn('STRADA: sem Supabase configurado (config.js). Rodando só com os dados de exemplo, sem salvar.');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
})();
