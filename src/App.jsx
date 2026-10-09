import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { processImage } from './image'

function Auth() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [mode, setMode] = useState('in'), [msg, setMsg] = useState('')
  async function submit(e) {
    e.preventDefault(); setMsg('')
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (error) setMsg(error.message)
    else if (mode === 'up') setMsg('Account created. Confirm your email, then sign in.')
  }
  return (
    <main className="auth">
      <h1>Academic Hub</h1>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Need an account? Create one' : 'Have an account? Sign in'}
        </button>
        {msg && <p role="alert">{msg}</p>}
      </form>
    </main>
  )
}

function Attachments({ note, userId }) {
  const [items, setItems] = useState([]), [urls, setUrls] = useState({})
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('attachments').select('*').eq('note_id', note.id).order('created_at')
    if (error) return setStatus('Could not load images: ' + error.message)
    setItems(data)
    if (data.length) {
      const { data: signed } = await supabase.storage.from('attachments').createSignedUrls(data.map(a => a.thumb_path), 3600)
      setUrls(Object.fromEntries((signed || []).map((s, i) => [data[i].id, s.signedUrl])))
    }
  }, [note.id])
  useEffect(() => { load() }, [load])

  async function upload(file) {
    const uploaded = []
    try {
      setStatus('Processing image…')
      const { display, thumb } = await processImage(file)
      const id = crypto.randomUUID(), base = `${userId}/${note.id}/${id}`
      const ext = file.type.split('/')[1]
      const paths = { original_path: `${base}/original.${ext}`, display_path: `${base}/display.webp`, thumb_path: `${base}/thumb.webp` }
      setStatus('Uploading…')
      for (const [path, blob, type] of [
        [paths.original_path, file, file.type], [paths.display_path, display.blob, 'image/webp'], [paths.thumb_path, thumb.blob, 'image/webp']]) {
        const { error } = await supabase.storage.from('attachments').upload(path, blob, { contentType: type })
        if (error) throw error
        uploaded.push(path)
      }
      const { error } = await supabase.from('attachments').insert({
        id, note_id: note.id, ...paths, mime: file.type, original_bytes: file.size,
        display_bytes: display.blob.size, width: display.w, height: display.h, alt_text: file.name,
      })
      if (error) throw error
      const { data: check } = await supabase.from('attachments').select('id').eq('id', id).single()
      if (!check) throw new Error('Saved record could not be read back.')
      setStatus(`Saved. ${(file.size / 1024).toFixed(0)} KB original, ${(display.blob.size / 1024).toFixed(0)} KB display copy.`)
      load()
    } catch (e) {
      if (uploaded.length) await supabase.storage.from('attachments').remove(uploaded)
      setStatus('Upload failed: ' + (e.message || e) + ' Nothing was saved.')
    }
  }

  async function remove(a) {
    if (!confirm('Delete this image and all its stored versions?')) return
    const { error } = await supabase.from('attachments').delete().eq('id', a.id)
    if (error) return setStatus('Delete failed: ' + error.message)
    await supabase.storage.from('attachments').remove([a.original_path, a.display_path, a.thumb_path])
    load()
  }

  async function view(a) {
    const { data } = await supabase.storage.from('attachments').createSignedUrl(a.display_path, 300)
    if (data) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="attach"
      onPaste={e => { const f = [...e.clipboardData.files].find(f => f.type.startsWith('image/')); if (f) upload(f) }}
      onDrop={e => { e.preventDefault(); [...e.dataTransfer.files].forEach(upload) }} onDragOver={e => e.preventDefault()}>
      <label className="drop">Add images: choose, drop or paste
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => [...e.target.files].forEach(upload)} />
      </label>
      <p aria-live="polite">{status}</p>
      <ul className="thumbs">
        {items.map(a => (
          <li key={a.id}>
            {urls[a.id] && <img src={urls[a.id]} alt={a.alt_text || ''} onClick={() => view(a)} />}
            <button className="link" onClick={() => remove(a)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Notes({ session }) {
  const [notes, setNotes] = useState([]), [q, setQ] = useState('')
  const [title, setTitle] = useState(''), [body, setBody] = useState('')
  const [open, setOpen] = useState(null), [err, setErr] = useState('')

  const load = useCallback(async () => {
    let query = supabase.from('notes').select('*').order('created_at', { ascending: false })
    const t = q.trim().replace(/[,%()]/g, ' ')
    if (t) query = query.or(`title.ilike.%${t}%,body.ilike.%${t}%`)
    const { data, error } = await query
    if (error) setErr(error.message); else { setErr(''); setNotes(data) }
  }, [q])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('notes').insert({ title, body })
    if (error) return setErr('Could not save note: ' + error.message)
    setTitle(''); setBody(''); load()
  }
  async function del(n) {
    if (!confirm(`Delete "${n.title}" and its images?`)) return
    const { data: atts } = await supabase.from('attachments').select('original_path,display_path,thumb_path').eq('note_id', n.id)
    const { error } = await supabase.from('notes').delete().eq('id', n.id)
    if (error) return setErr('Delete failed: ' + error.message)
    const files = (atts || []).flatMap(a => [a.original_path, a.display_path, a.thumb_path])
    if (files.length) await supabase.storage.from('attachments').remove(files)
    load()
  }

  return (
    <main className="app">
      <header>
        <h1>Academic Hub</h1>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <form onSubmit={add}>
        <input placeholder="Note title" value={title} onChange={e => setTitle(e.target.value)} required />
        <textarea placeholder="Write your note…" value={body} onChange={e => setBody(e.target.value)} rows={4} />
        <button>Save note</button>
      </form>
      <input className="search" type="search" placeholder="Search notes" value={q} onChange={e => setQ(e.target.value)} />
      {err && <p role="alert">{err}</p>}
      {!notes.length && !err && <p className="empty">No notes yet. Write one above, then attach a lecture photo to it.</p>}
      <ul className="notes">
        {notes.map(n => (
          <li key={n.id}>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
            <button className="link" onClick={() => setOpen(open === n.id ? null : n.id)}>{open === n.id ? 'Hide images' : 'Images'}</button>
            <button className="link" onClick={() => del(n)}>Delete</button>
            {open === n.id && <Attachments note={n} userId={session.user.id} />}
          </li>
        ))}
      </ul>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <p className="empty">Loading…</p>
  return session ? <Notes session={session} /> : <Auth />
}
