import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  document.querySelector('#app').innerHTML = `
    <main class="fatal">
      <section class="fatal-card">
        <h1>Nitra Space Chat</h1>
        <p>Chýbajú premenné VITE_SUPABASE_URL alebo VITE_SUPABASE_ANON_KEY.</p>
        <p>Skontroluj súbor <code>.env</code> a reštartuj Vite.</p>
      </section>
    </main>`
  throw new Error('Missing Supabase environment variables.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 20 } }
})

const sessionKey = 'nitra-space-chat-session'
let sessionId = sessionStorage.getItem(sessionKey)
if (!sessionId) {
  sessionId = crypto.randomUUID()
  sessionStorage.setItem(sessionKey, sessionId)
}

let roomId = null
let channel = null
let state = 'home'
let isStopping = false
let partnerPresent = false
let messages = []
let onlineCount = 1
let onlineChannel = null

const app = document.querySelector('#app')


function updateOnlineBadge() {
  const el = document.querySelector('#onlineCount')
  if (el) el.textContent = String(onlineCount)
}

async function setupOnlinePresence() {
  onlineChannel = supabase.channel('nitra-space-online', {
    config: {
      presence: { key: sessionId }
    }
  })

  onlineChannel.on('presence', { event: 'sync' }, () => {
    const presence = onlineChannel.presenceState()
    onlineCount = Object.keys(presence).length
    updateOnlineBadge()
  })

  onlineChannel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      try {
        await onlineChannel.track({ session_id: sessionId, online_at: new Date().toISOString() })
      } catch (error) {
        console.warn('Online presence tracking failed:', error)
      }
    }
  })
}

function render() {
  if (state === 'home') renderHome()
  else renderChat()
}

function renderHome() {
  app.innerHTML = `
    <main class="home-shell">
      <div class="online-badge" aria-live="polite">
        <span class="online-dot" aria-hidden="true"></span>
        <span><strong id="onlineCount">${onlineCount}</strong> online</span>
      </div>
      <section class="home-card">
        <div class="brand-line">
          <span class="brand-mark" aria-hidden="true">NS</span>
          <span>NITRA SPACE</span>
        </div>

        <h1>Nitra Space Chat</h1>
        <p class="home-lead">Anonymný textový chat s náhodným človekom.</p>

        <div class="feature-row" aria-label="Vlastnosti služby">
          <span>Bez registrácie</span>
          <span>Len text</span>
          <span>Bez histórie správ</span>
        </div>

        <button id="openTerms" class="start-btn" type="button">START CHAT</button>
        <p class="home-note">Pred vstupom potvrdíš pravidlá používania.</p>
      </section>

      <div id="termsModal" class="modal-backdrop" hidden>
        <section class="terms-sheet" role="dialog" aria-modal="true" aria-labelledby="termsTitle">
          <div class="sheet-handle" aria-hidden="true"></div>
          <header class="terms-header">
            <div>
              <span class="eyebrow">PRED VSTUPOM</span>
              <h2 id="termsTitle">Pravidlá Nitra Space Chat</h2>
            </div>
            <button id="closeTerms" class="icon-btn" type="button" aria-label="Zavrieť">×</button>
          </header>

          <div class="terms-scroll">
            <div class="terms-intro">
              <span class="shield-icon" aria-hidden="true">✓</span>
              <p>Chat je anonymný a spája ťa s náhodným človekom. Používaj ho slušne a nezdieľaj citlivé údaje.</p>
            </div>

            <section class="terms-section">
              <h3>Základné pravidlá</h3>
              <ol>
                <li>Musíš mať aspoň <strong>16 rokov</strong>.</li>
                <li>Zakázané sú vyhrážky, obťažovanie, nenávistný alebo násilný obsah a nabádanie k nezákonnej činnosti.</li>
                <li>Nezdieľaj heslá, platobné údaje, presnú adresu ani iné citlivé osobné údaje.</li>
                <li>Zakázaný je sexuálny obsah, najmä obsah zahŕňajúci osoby mladšie ako 18 rokov.</li>
                <li>Zakázané sú podvody, spam, vydávanie sa za inú osobu a úmyselné zneužívanie služby.</li>
                <li>Ak sa cítiš nepríjemne alebo ohrozene, chat okamžite ukonči.</li>
              </ol>
            </section>

            <section class="terms-section">
              <h3>Súkromie a správy</h3>
              <p>Obsah textových správ sa v aplikácii neukladá do databázy a po skončení chatu nie je dostupná história správ. Na prevádzku služby sa však môžu spracúvať nevyhnutné technické údaje poskytovateľmi infraštruktúry, napríklad Supabase alebo Vercel.</p>
            </section>

            <section class="terms-section">
              <h3>Zodpovednosť</h3>
              <p>Každý používateľ zodpovedá za obsah, ktorý odošle. Nitra Space môže pri porušovaní pravidiel obmedziť prístup k službe. Služba negarantuje identitu, vek ani správanie osoby na druhej strane.</p>
            </section>

            <p class="legal-note">Tieto pravidlá sú prevádzkové pravidlá služby, nie náhrada individuálneho právneho poradenstva.</p>
          </div>

          <footer class="terms-footer">
            <label class="consent-row" for="termsConsent">
              <input id="termsConsent" type="checkbox">
              <span>Mám aspoň 16 rokov a súhlasím s pravidlami používania a spracovaním údajov potrebným na prevádzku služby.</span>
            </label>
            <button id="acceptAndStart" class="start-btn" type="button" disabled>POKRAČOVAŤ DO CHATU</button>
          </footer>
        </section>
      </div>
    </main>`

  const modal = document.querySelector('#termsModal')
  const consent = document.querySelector('#termsConsent')
  const accept = document.querySelector('#acceptAndStart')

  const openModal = () => {
    modal.hidden = false
    document.body.classList.add('modal-open')
    setTimeout(() => consent?.focus(), 0)
  }

  const closeModal = () => {
    modal.hidden = true
    document.body.classList.remove('modal-open')
  }

  document.querySelector('#openTerms').addEventListener('click', openModal)
  document.querySelector('#closeTerms').addEventListener('click', closeModal)
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal()
  })
  consent.addEventListener('change', () => {
    accept.disabled = !consent.checked
  })
  accept.addEventListener('click', async () => {
    if (!consent.checked) return
    closeModal()
    await startChat()
  })
}

function renderChat() {
  const statusText = state === 'searching'
    ? 'Čakám na človeka...'
    : state === 'connected'
      ? 'Pripojený'
      : 'Cudzí človek odišiel.'

  app.innerHTML = `
    <main class="chat-page">
      <header class="chat-header">
        <button id="brandHome" class="brand-home" type="button" aria-label="Späť na úvod">
          <span class="brand-dot" aria-hidden="true"></span>
          <strong>Nitra Space Chat</strong>
        </button>
        <div class="header-right">
          <span class="privacy-label">TEXT • ANONYMNÉ • BEZ HISTÓRIE</span>
          <span class="online-badge online-badge-header" aria-live="polite">
            <span class="online-dot" aria-hidden="true"></span>
            <span><strong id="onlineCount">${onlineCount}</strong> online</span>
          </span>
        </div>
      </header>

      <section class="chat-window" aria-label="Anonymný chat">
        <div class="status-row ${state}">
          <span class="status-dot" aria-hidden="true"></span>
          <span>${statusText}</span>
        </div>

        <div id="messages" class="transcript" aria-live="polite">
          ${messages.length ? messages.map(messageTemplate).join('') : emptyTranscript()}
        </div>

        <div class="controls">
          <button id="next" class="next-btn" type="button">NEXT</button>

          <form id="composer" class="composer">
            <label class="sr-only" for="message">Správa</label>
            <textarea
              id="message"
              maxlength="1000"
              rows="1"
              autocomplete="off"
              placeholder="${state === 'connected' ? 'Napíš správu...' : 'Počkaj na pripojenie...'}"
              ${state === 'connected' ? '' : 'disabled'}
            ></textarea>
            <button class="send-btn" type="submit" ${state === 'connected' ? '' : 'disabled'}>POSLAŤ</button>
          </form>

          <button id="leave" class="leave-btn" type="button">LEAVE</button>
        </div>
      </section>
    </main>`

  document.querySelector('#leave').addEventListener('click', leaveChat)
  document.querySelector('#brandHome').addEventListener('click', leaveChat)
  document.querySelector('#next').addEventListener('click', nextChat)
  document.querySelector('#composer').addEventListener('submit', sendMessage)

  const input = document.querySelector('#message')
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      document.querySelector('#composer').requestSubmit()
    }
  })

  input?.addEventListener('input', () => {
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`
  })

  if (state === 'connected') setTimeout(() => input?.focus(), 0)
  scrollMessages()
}

function emptyTranscript() {
  if (state === 'searching') {
    return `
      <div class="system-message">
        <strong>Hľadám dostupného človeka...</strong>
        <span>Keď sa niekto pripojí, chat sa spustí automaticky.</span>
      </div>`
  }

  if (state === 'ended') {
    return `
      <div class="system-message ended-message">
        <strong>Cudzí človek odišiel.</strong>
        <span>Klikni NEXT a nájdeme ti ďalšieho.</span>
      </div>`
  }

  return `<div class="system-message"><span>Môžeš napísať prvú správu.</span></div>`
}

function messageTemplate(message) {
  return `
    <div class="chat-line ${message.mine ? 'mine' : 'theirs'}">
      <strong>${message.mine ? 'Ty:' : 'Cudzí:'}</strong>
      <span>${escapeHtml(message.text)}</span>
    </div>`
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]))
}

function setStatus(nextState) {
  state = nextState
  render()
}

async function startChat() {
  if (isStopping) return
  state = 'searching'
  messages = []
  partnerPresent = false
  render()
  await findPartner()
}

async function findPartner() {
  try {
    const { data, error } = await supabase.rpc('find_chat_partner', {
      p_session_id: sessionId
    })
    if (error) throw error

    const match = Array.isArray(data) ? data[0] : data
    if (!match?.room_id) throw new Error('Supabase nevrátil room_id.')

    roomId = match.room_id
    await joinRoom(match.partner_session_id)
  } catch (error) {
    console.error(error)
    showFatal('Nepodarilo sa pripojiť k chatu.', error.message)
  }
}

async function joinRoom(partnerSessionId) {
  if (channel) await supabase.removeChannel(channel)

  partnerPresent = Boolean(partnerSessionId)
  channel = supabase.channel(`chat:${roomId}`, {
    config: {
      broadcast: { self: false, ack: true },
      presence: { key: sessionId }
    }
  })

  channel
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      if (payload?.sender === sessionId) return
      if (payload?.room_id !== roomId) return
      messages.push({ text: String(payload.text || ''), mine: false })
      refreshMessages()
    })
    .on('broadcast', { event: 'matched' }, ({ payload }) => {
      if (payload?.room_id !== roomId) return
      partnerPresent = true
      setStatus('connected')
    })
    .on('broadcast', { event: 'left' }, ({ payload }) => {
      if (payload?.room_id !== roomId) return
      partnerPresent = false
      if (!isStopping) setStatus('ended')
    })
    .on('presence', { event: 'sync' }, () => {
      const presence = channel.presenceState()
      const keys = Object.keys(presence)
      if (state === 'connected' && keys.length < 2 && partnerPresent && !isStopping) {
        partnerPresent = false
        setStatus('ended')
      }
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      if (key !== sessionId && !isStopping && state === 'connected') {
        partnerPresent = false
        setStatus('ended')
      }
    })

  await new Promise((resolve, reject) => {
    channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({ session_id: sessionId })
          if (partnerSessionId) {
            partnerPresent = true
            setStatus('connected')
            await broadcast('matched', {})
          }
          resolve()
        } catch (error) {
          reject(error)
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Realtime status: ${status}`))
      }
    })
  })
}

async function broadcast(event, payload) {
  if (!channel) return
  const response = await channel.send({
    type: 'broadcast',
    event,
    payload: { ...payload, room_id: roomId, sender: sessionId }
  })
  if (response !== 'ok') console.warn('Broadcast response:', response)
}

async function sendMessage(event) {
  event.preventDefault()
  if (state !== 'connected' || !channel) return

  const input = document.querySelector('#message')
  const text = input.value.trim()
  if (!text) return

  messages.push({ text, mine: true })
  input.value = ''
  input.style.height = 'auto'
  refreshMessages()
  await broadcast('message', { text })
  input.focus()
}

function refreshMessages() {
  const list = document.querySelector('#messages')
  if (!list) return
  list.innerHTML = messages.length ? messages.map(messageTemplate).join('') : emptyTranscript()
  scrollMessages()
}

function scrollMessages() {
  const list = document.querySelector('#messages')
  if (list) list.scrollTop = list.scrollHeight
}

async function closeCurrentRoom() {
  if (!roomId) return

  try {
    await broadcast('left', {})
    await supabase.rpc('close_chat_room', { p_room_id: roomId })
  } catch (error) {
    console.warn('Closing room failed:', error)
  } finally {
    if (channel) {
      await supabase.removeChannel(channel)
      channel = null
    }
    roomId = null
  }
}

async function nextChat() {
  if (isStopping) return
  isStopping = true
  await closeCurrentRoom()
  isStopping = false
  state = 'searching'
  messages = []
  partnerPresent = false
  render()
  await findPartner()
}

async function leaveChat() {
  if (isStopping) return
  isStopping = true
  await closeCurrentRoom()
  isStopping = false
  state = 'home'
  messages = []
  partnerPresent = false
  render()
}

function showFatal(title, detail) {
  app.innerHTML = `
    <main class="fatal">
      <section class="fatal-card">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(detail || 'Skontroluj Supabase nastavenie a skús to znova.')}</p>
        <button id="back" class="start-btn" type="button">SPÄŤ</button>
      </section>
    </main>`

  document.querySelector('#back').addEventListener('click', () => {
    state = 'home'
    render()
  })
}

window.addEventListener('beforeunload', () => {
  if (roomId) {
    channel?.send({
      type: 'broadcast',
      event: 'left',
      payload: { room_id: roomId, sender: sessionId }
    })
  }
})

render()
setupOnlinePresence()
