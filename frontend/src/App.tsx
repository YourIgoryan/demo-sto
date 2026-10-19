import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import demoConfigData from './demo-config.json';
import { ArrowDownRight, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock3, CreditCard, MapPin, Menu, MessageCircle, Minus, Plus, Settings2, ShieldCheck, Sparkles, UserRound, Wrench, X, CarFront, Camera, Phone, Home, CalendarCheck, LogOut, Save, Upload, CircleHelp, Banknote, ClipboardList, Gauge, BellRing } from 'lucide-react';

type Service = {
  id: string;
  title: string;
  description: string;
  price_from: number;
  duration_minutes: number;
  active?: boolean;
  image?: string;
};
type Gallery = {
  id: string;
  image: string;
  caption: string;
};
type Config = {
  slug: string;
  published: boolean;
  name: string;
  description: string;
  phone: string;
  address: string;
  map_url: string;
  timezone: string;
  currency: string;
  theme_color: string;
  hero_image: string;
  logo: string;
  prep_minutes: number;
  cancellation_hours: number;
  hours: Record<string, {
    open?: string;
    close?: string;
    closed?: boolean;
  }>;
  closed_dates: string[];
  boxes: {
    id: string;
    title: string;
    active: boolean;
  }[];
  services: Service[];
  gallery: Gallery[];
  cards: {
    title: string;
    text: string;
  }[];
};
type Booking = {
  id?: number;
  public_id: string;
  service_id: string;
  service_title: string;
  start_at: string;
  end_at: string;
  customer_name: string;
  phone: string;
  car: string;
  note: string;
  status: string;
  created_at?: string;
  box_id?: string;
  duration_minutes?: number;
};
type Slot = {
  start_at: string;
  end_at: string;
  box_id: string;
  label: string;
};
type DaySlots = {
  date: string;
  slots: Slot[];
  busy_slots?: {
    label: string;
  }[];
};
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API = `${API_BASE_URL}/api`;
const DEMO_MODE = import.meta.env.MODE === 'demo';
const DEMO_CONFIG = demoConfigData as Config;
const money = (n: number, currency = 'в‚Ѕ') => `${new Intl.NumberFormat('ru-RU').format(n)} ${currency}`;
const dateLabel = (v: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('ru-RU', opts).format(new Date(v));
const dateTime = (v: string) => {
  const [date, time = '00:00'] = v.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const stamp = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return `${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(stamp)} РІ ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const durationLabel = (minutes: number) => minutes >= 1440 ? `${Math.floor(minutes / 1440)} РґРЅ. ${Math.floor(minutes % 1440 / 60)} С‡` : minutes >= 60 ? `${Math.floor(minutes / 60)} С‡${minutes % 60 ? ` ${minutes % 60} РјРёРЅ` : ''}` : `${minutes} РјРёРЅ`;
const appPath = (path = '') =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

const pathParts = () => {
  const base = import.meta.env.BASE_URL;
  let pathname = window.location.pathname;

  if (pathname.startsWith(base)) {
    pathname = pathname.slice(base.length);
  }

  const p = pathname.split('/').filter(Boolean);

  return {
    owner: p[0] === 'owner',
    slug: p[0] === 's' || p[0] === 'owner'
      ? p[1] || 'sample'
      : 'sample',
  };
};
const todayISO = (timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { ...init, headers });
  const data = await r.json().catch(() => ({ detail: 'РћС€РёР±РєР° РѕС‚РІРµС‚Р° СЃРµСЂРІРµСЂР°' }));
  if (!r.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((item: unknown) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const error = item as { msg?: string; loc?: unknown[]; };
            if (error.msg) {
              const location = Array.isArray(error.loc)
                ? error.loc.filter(Boolean).join('.')
                : '';
              return `${location || 'РџРѕР»Рµ'}: ${error.msg}`;
            }
            return JSON.stringify(item);
          }
          return String(item);
        }).join('; ')
        : detail && typeof detail === 'object'
          ? JSON.stringify(detail)
          : 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ Р·Р°РїСЂРѕСЃ';
    throw new Error(message);
  }
  return data as T;
}
function useReveal(deps: unknown[] = []) {
  useEffect(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; const nodes = [...document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)')]; const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } }), { threshold: .08, rootMargin: '0px 0px -35px 0px' }); nodes.forEach(n => obs.observe(n)); return () => obs.disconnect(); }, deps);
}
function App() {
  const route = useMemo(pathParts, []);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [section, setSection] = useState('home');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [slots, setSlots] = useState<DaySlots[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [customer, setCustomer] = useState({ name: '', phone: '', car: '', note: '' });
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingAttemptKey, setBookingAttemptKey] = useState(uid());
  const [myBooking, setMyBooking] = useState<{
    booking: Booking;
    token: string;
  } | null>(() => { try { return JSON.parse(localStorage.getItem(`autostudio-booking-${route.slug}`) || 'null'); } catch { return null; } });
  const [showMyBooking, setShowMyBooking] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{
    from: 'bot' | 'user';
    text: string;
  }[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [ownerToken, setOwnerToken] = useState(() => sessionStorage.getItem(`autostudio-owner-${route.slug}`) || '');
  const [ownerData, setOwnerData] = useState<any>(null);
  const [ownerError, setOwnerError] = useState('');
  const [ownerTab, setOwnerTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerAnswer, setOwnerAnswer] = useState('');
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  useEffect(() => {
    if (DEMO_MODE) {
      const c = DEMO_CONFIG;
      setConfig(c);
      document.title = `${c.name} вЂ” РґРµРјРѕРІРµСЂСЃРёСЏ`;
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', c.theme_color || '#111311');
      setLoading(false);
      return;
    }
    api<Config>(`/public/${route.slug}/config`).then(c => { setConfig(c); setError(''); document.title = `${c.name} вЂ” Р·Р°РїРёСЃСЊ РІ СЃС‚СѓРґРёСЋ`; let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]'); if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); } link.href = `${API}/public/${route.slug}/manifest.json`; let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]'); if (!apple) { apple = document.createElement('link'); apple.rel = 'apple-touch-icon'; document.head.appendChild(apple); } apple.href = `${API}/public/${route.slug}/icon.png`; const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'); theme?.setAttribute('content', c.theme_color || '#111311'); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [route.slug]);
  useEffect(() => { const listener = (e: Event) => { e.preventDefault(); setInstallPrompt(e); }; window.addEventListener('beforeinstallprompt', listener); return () => window.removeEventListener('beforeinstallprompt', listener); }, []);
  useEffect(() => { if (ownerToken && route.owner) refreshOwner().catch(() => { setOwnerToken(''); sessionStorage.removeItem(`autostudio-owner-${route.slug}`); }); }, [ownerToken, route.owner]);
  useEffect(() => {
    if (!bookingOpen || !selectedService) return;
    setSlotsLoading(true);
    if (DEMO_MODE) {
      const days: DaySlots[] = Array.from({ length: 10 }, (_, i) => {
        const d = new Date(`${selectedDay}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i);
        const date = d.toISOString().slice(0, 10);
        const weekday = String(d.getUTCDay());
        const hours = DEMO_CONFIG.hours[weekday];
        if (!hours || hours.closed || !hours.open || !hours.close) return { date, slots: [] };
        const [openH, openM] = hours.open.split(':').map(Number);
        const [closeH, closeM] = hours.close.split(':').map(Number);
        const duration = DEMO_CONFIG.services.find(x => x.id === selectedService)?.duration_minutes || 60;
        const step = Math.max(30, Math.ceil(duration / 60) * 30);
        const slotsForDay: Slot[] = [];
        for (let minute = openH * 60 + openM; minute + duration <= closeH * 60 + closeM; minute += step) {
          const hh = String(Math.floor(minute / 60)).padStart(2, '0');
          const mm = String(minute % 60).padStart(2, '0');
          const endMinute = minute + duration;
          const endH = String(Math.floor(endMinute / 60)).padStart(2, '0');
          const endM = String(endMinute % 60).padStart(2, '0');
          slotsForDay.push({ start_at: `${date}T${hh}:${mm}`, end_at: `${date}T${endH}:${endM}`, box_id: 'demo-box', label: `${hh}:${mm}` });
        }
        return { date, slots: slotsForDay };
      });
      setSlots(days);
      setSlotsLoading(false);
      return;
    }
    api<{ days: DaySlots[]; }>(`/public/${route.slug}/availability?service_id=${encodeURIComponent(selectedService)}&day=${selectedDay}&days=10`).then(d => setSlots(d.days)).catch(e => { setSlots([]); setToast(e.message); }).finally(() => setSlotsLoading(false));
  }, [bookingOpen, selectedService, selectedDay, route.slug]);
  useReveal([config, section, bookingOpen, ownerData]);
  function notify(s: string) {
    setToast(s);
    window.setTimeout(() => setToast(''), 3200);
  }
  async function refreshOwner() {
    const data = await api<any>(`/owner/${route.slug}/dashboard`, {}, ownerToken);
    setOwnerData(data);
  }
  function openBooking(serviceId?: string) {
    setSelectedService(serviceId || config?.services.find(s => s.active !== false)?.id || '');
    setSelectedDay(todayISO(config?.timezone));
    setSlot(null);
    setPrivacyConsent(false);
    setBookingAttemptKey(uid());
    setBookingOpen(true);
  }
  async function submitBooking(e: FormEvent) {
    e.preventDefault();
    if (!privacyConsent) {
      notify('РџРѕРґС‚РІРµСЂРґРёС‚Рµ СЃРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С….');
      return;
    }
    if (!slot || !selectedService) return;
    setSubmitting(true);
    if (DEMO_MODE) {
      // Demo mode deliberately does not send or persist the entered personal data.
      window.setTimeout(() => {
        setSubmitting(false);
        setBookingOpen(false);
        setCustomer({ name: '', phone: '', car: '', note: '' });
        setSlot(null);
        notify('Р”РµРјРѕ: С„РѕСЂРјР° СЂР°Р±РѕС‚Р°РµС‚, Р·Р°СЏРІРєР° РЅРµ РѕС‚РїСЂР°РІР»СЏР»Р°СЃСЊ');
      }, 250);
      return;
    }
    try {
      const data = await api<{
        booking: Booking;
        cancel_token: string;
        duplicate: boolean;
      }>(`/public/${route.slug}/book`, {
        method: 'POST', headers: { 'Idempotency-Key': bookingAttemptKey }, body: JSON.stringify({
          customer_name: customer.name.trim(),
          phone: customer.phone.trim(),
          car: customer.car.trim(),
          note: customer.note.trim(),
          service_id: selectedService,
          start_at: slot.start_at,
          box_id: slot.box_id,
        })
      });
      const saved = { booking: data.booking, token: data.cancel_token };
      setMyBooking(saved);
      setBookingAttemptKey(uid());
      localStorage.setItem(`autostudio-booking-${route.slug}`, JSON.stringify(saved));
      setBookingOpen(false);
      setShowMyBooking(true);
      setSection('mine');
      notify('Р—Р°РїРёСЃСЊ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°')
        ;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'РћС€РёР±РєР° Р·Р°РїРёСЃРё');
      if (e instanceof Error && e.message.toLowerCase().includes('Р·Р°РЅСЏС‚')) setSlot(null);
    } finally {
      setSubmitting(false);
    }
  }
  async function sendClientMessage(message: string) {
    const m = message.trim();
    if (!m) return;
    setChatMessages(prev => [...prev, { from: 'user', text: m }]);
    setChatInput('');
    if (DEMO_MODE) {
      const q = m.toLowerCase();
      const answer = q.includes('С†РµРЅ') || q.includes('СЃС‚РѕРёРј')
        ? `РЎС‚РѕРёРјРѕСЃС‚СЊ СѓСЃР»СѓРі вЂ” РѕС‚ ${money(Math.min(...DEMO_CONFIG.services.map(x => x.price_from)), DEMO_CONFIG.currency).replace(' в‚Ѕ', ' в‚Ѕ')}. Р’С‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіСѓ РІ РєР°С‚Р°Р»РѕРіРµ РґР»СЏ РїРѕРґСЂРѕР±РЅРѕСЃС‚РµР№.`
        : q.includes('Р°РґСЂРµСЃ') || q.includes('РЅР°Р№С‚Рё')
          ? `РњС‹ РЅР°С…РѕРґРёРјСЃСЏ РїРѕ Р°РґСЂРµСЃСѓ: ${DEMO_CONFIG.address}. РџРѕР·РІРѕРЅРёС‚Рµ ${DEMO_CONFIG.phone}, С‡С‚РѕР±С‹ СѓС‚РѕС‡РЅРёС‚СЊ РґРµС‚Р°Р»Рё.`
          : `Р­С‚Рѕ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ РїРѕРјРѕС‰РЅРёРє ${DEMO_CONFIG.name}. РњРѕРіСѓ РїРѕРґСЃРєР°Р·Р°С‚СЊ РїРѕ СѓСЃР»СѓРіР°Рј, СЃС‚РѕРёРјРѕСЃС‚Рё Рё Р°РґСЂРµСЃСѓ. Р”Р»СЏ Р·Р°РїРёСЃРё РёСЃРїРѕР»СЊР·СѓР№С‚Рµ РєРЅРѕРїРєСѓ В«Р—Р°РїРёСЃР°С‚СЊСЃСЏВ».`;
      setChatMessages(prev => [...prev, { from: 'bot', text: answer }]);
      return;
    }
    try {
      const data = await api<{
        answer: string;
      }>(`/public/${route.slug}/assistant`, { method: 'POST', body: JSON.stringify({ message: m }) });
      setChatMessages(prev => [...prev, { from: 'bot', text: data.answer }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { from: 'bot', text: e instanceof Error ? e.message : 'РџРѕРјРѕС‰РЅРёРє РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ' }]);
    }
  }
  async function login(e: FormEvent) {
    e.preventDefault();
    setOwnerError('');
    try {
      const data = await api<{
        access_token: string;
      }>(`/auth/login`, { method: 'POST', body: JSON.stringify({ tenant: route.slug, email: loginEmail, password: loginPassword }) });
      setOwnerToken(data.access_token);
      sessionStorage.setItem(`autostudio-owner-${route.slug}`, data.access_token);
    } catch (e) {
      setOwnerError(e instanceof Error ? e.message : 'РћС€РёР±РєР° РІС…РѕРґР°');
    }
  }
  async function saveConfig() {
    if (!ownerData) return;
    setSaving(true);
    try {
      const data = await api<{
        config: Config;
      }>(`/owner/${route.slug}/config`, { method: 'PUT', body: JSON.stringify(ownerData.config) }, ownerToken);
      setOwnerData((p: any) => ({ ...p, config: data.config }));
      setConfig(data.config);
      notify('РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅРµРЅС‹');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ');
    } finally {
      setSaving(false);
    }
  }
  async function changeBooking(b: Booking, status: string) {
    try {
      await api(`/owner/${route.slug}/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, ownerToken);
      await refreshOwner();
      notify('РЎС‚Р°С‚СѓСЃ РѕР±РЅРѕРІР»С‘РЅ');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'РћС€РёР±РєР°');
    }
  }
  async function rescheduleBooking(b: Booking) {
    const start_at = window.prompt('РќРѕРІРѕРµ РІСЂРµРјСЏ РЅР°С‡Р°Р»Р° (РЅР°РїСЂРёРјРµСЂ 2026-10-20T10:00)', b.start_at.slice(0, 16));
    if (!start_at) return;
    try {
      await api(`/owner/${route.slug}/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify({ start_at }) }, ownerToken);
      await refreshOwner();
      notify('Р—Р°РїРёСЃСЊ РїРµСЂРµРЅРµСЃРµРЅР°');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРЅРµСЃС‚Рё Р·Р°РїРёСЃСЊ');
    }
  }
  async function recordPayment(b: Booking, kind: 'payment' | 'refund') {
    const amountText = window.prompt(kind === 'payment' ? 'РЎСѓРјРјР° РїРѕР»СѓС‡РµРЅРЅРѕР№ РѕРїР»Р°С‚С‹, в‚Ѕ' : 'РЎСѓРјРјР° РІРѕР·РІСЂР°С‚Р°, в‚Ѕ');
    if (!amountText) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ СЃСѓРјРјСѓ');
      return;
    } const note = window.prompt('РљРѕРјРјРµРЅС‚Р°СЂРёР№ Рє РѕРїРµСЂР°С†РёРё (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)') || '';
    try {
      await api(`/owner/${route.slug}/bookings/${b.id}/payments`, { method: 'POST', body: JSON.stringify({ kind, amount: Math.round(amount), note }) }, ownerToken);
      await refreshOwner();
      notify(kind === 'payment' ? 'РћРїР»Р°С‚Р° Р·Р°РїРёСЃР°РЅР°' : 'Р’РѕР·РІСЂР°С‚ Р·Р°РїРёСЃР°РЅ');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'РћС€РёР±РєР° РѕРїР»Р°С‚С‹');
    }
  }
  async function manualAdd() {
    if (!ownerData) return;
    const serviceId = window.prompt('ID СѓСЃР»СѓРіРё РёР· РЅР°СЃС‚СЂРѕРµРє:\n' + ownerData.config.services.map((s: Service) => `${s.id} вЂ” ${s.title}`).join('\n'));
    if (!serviceId) return;
    const startAt = window.prompt('Р”Р°С‚Р° Рё РІСЂРµРјСЏ РЅР°С‡Р°Р»Р° (РЅР°РїСЂРёРјРµСЂ 2026-10-20T10:00)');
    if (!startAt) return;
    const customer_name = window.prompt('РРјСЏ РєР»РёРµРЅС‚Р°');
    if (!customer_name) return;
    const phone = window.prompt('РўРµР»РµС„РѕРЅ РєР»РёРµРЅС‚Р°') || '';
    const car = window.prompt('РђРІС‚РѕРјРѕР±РёР»СЊ (РјР°СЂРєР° Рё РјРѕРґРµР»СЊ)') || '';
    if (!phone || !car) {
      notify('РўРµР»РµС„РѕРЅ Рё Р°РІС‚РѕРјРѕР±РёР»СЊ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹');
      return;
    } try {
      await api(`/owner/${route.slug}/bookings`, { method: 'POST', body: JSON.stringify({ service_id: serviceId, start_at: startAt, customer_name, phone, car }) }, ownerToken);
      await refreshOwner();
      notify('Р—Р°РїРёСЃСЊ РґРѕР±Р°РІР»РµРЅР°');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р·Р°РїРёСЃСЊ');
    }
  }
  async function askOwner() {
    if (!ownerQuery.trim()) return;
    try {
      const d = await api<{
        answer: string;
      }>(`/owner/${route.slug}/assistant?q=${encodeURIComponent(ownerQuery)}`, {}, ownerToken);
      setOwnerAnswer(d.answer);
    } catch (e) {
      setOwnerAnswer(e instanceof Error ? e.message : 'РћС€РёР±РєР° РїРѕРјРѕС‰РЅРёРєР°');
    }
  }
  async function uploadPhoto(file: File, kind: string, index?: number) {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch(`${API}/owner/${route.slug}/upload?kind=${kind}`, { method: 'POST', headers: { Authorization: `Bearer ${ownerToken}` }, body: form });
    const d = await r.json();
    if (!r.ok) {
      notify(d.detail || 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё');
      return;
    } const cfg = { ...ownerData.config };
    if (kind === 'hero') cfg.hero_image = d.url;
    else if (kind === 'logo') cfg.logo = d.url;
    else if (kind === 'gallery' && typeof index === 'number') {
      cfg.gallery = cfg.gallery.map((g: Gallery, i: number) => i === index ? { ...g, image: d.url } : g);
    } else if (kind === 'gallery') cfg.gallery = [...cfg.gallery, { id: uid(), image: d.url, caption: 'РќРѕРІР°СЏ СЂР°Р±РѕС‚Р°' }];
    setOwnerData((p: any) => ({ ...p, config: cfg }));
    notify('Р¤РѕС‚Рѕ Р·Р°РіСЂСѓР¶РµРЅРѕ вЂ” СЃРѕС…СЂР°РЅРёС‚Рµ РЅР°СЃС‚СЂРѕР№РєРё');
  }
  async function cancelBooking() {
    if (!myBooking) return;
    setCancelLoading(true);
    try {
      await api(`/public/${route.slug}/booking/${myBooking.booking.public_id}/cancel`, { method: 'POST', body: JSON.stringify({ token: myBooking.token }) });
      const next = { ...myBooking, booking: { ...myBooking.booking, status: 'cancelled' } };
      setMyBooking(next);
      localStorage.setItem(`autostudio-booking-${route.slug}`, JSON.stringify(next));
      notify('Р—Р°РїРёСЃСЊ РѕС‚РјРµРЅРµРЅР°');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РјРµРЅРёС‚СЊ');
    } finally {
      setCancelLoading(false);
    }
  }
  const activeServices = (config?.services || []).filter(s => s.active !== false);
  if (window.location.pathname.replace(/\/+$/, '') === '/privacy-policy') return <main className="legal-page">
    <header className="legal-top">
      <a className="legal-brand" href="/">AUTO<span>STUDIO</span></a>
      <a className="legal-back" href="/">в†ђ Р’РµСЂРЅСѓС‚СЊСЃСЏ РЅР° СЃР°Р№С‚</a>
    </header>
    <article className="legal-document">
      <div className="legal-hero">
        <span className="legal-eyebrow">AUTOSTUDIO / РџР РђР’РћР’РђРЇ РРќР¤РћР РњРђР¦РРЇ</span>
        <h1>РџРћР›РРўРРљРђ<br/><em>РћР‘Р РђР‘РћРўРљР РџР•Р РЎРћРќРђР›Р¬РќР«РҐ Р”РђРќРќР«РҐ</em></h1>
        <p>РљР°Рє РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ СЃРІРµРґРµРЅРёСЏ, РєРѕС‚РѕСЂС‹Рµ РІС‹ РѕСЃС‚Р°РІР»СЏРµС‚Рµ РїСЂРё РѕР±СЂР°С‰РµРЅРёРё РІ СЃС‚СѓРґРёСЋ Рё РѕС„РѕСЂРјР»РµРЅРёРё РѕРЅР»Р°Р№РЅ-Р·Р°РїРёСЃРё.</p>
        <div className="legal-meta"><span>Р РµРґР°РєС†РёСЏ: 18 РѕРєС‚СЏР±СЂСЏ 2026 РіРѕРґР°</span><span>Р”Р»СЏ СЃР°Р№С‚Р° Рё СЃРµСЂРІРёСЃР° РѕРЅР»Р°Р№РЅ-Р·Р°РїРёСЃРё AutoStudio</span></div>
      </div>
      <div className="legal-warning"><strong>РџРµСЂРµРґ РїСѓР±Р»РёРєР°С†РёРµР№ Р·Р°РїРѕР»РЅРёС‚Рµ СЃРІРµРґРµРЅРёСЏ РѕР± РѕРїРµСЂР°С‚РѕСЂРµ.</strong><p>Р—Р°РјРµРЅРёС‚Рµ РІСЃРµ РїРѕР»СЏ РІ РєРІР°РґСЂР°С‚РЅС‹С… СЃРєРѕР±РєР°С… РЅР° СЂРµР°Р»СЊРЅС‹Рµ СЂРµРєРІРёР·РёС‚С‹ Рё РїСЂРѕРІРµСЂСЊС‚Рµ С„Р°РєС‚РёС‡РµСЃРєРёРµ РїСЂРѕС†РµСЃСЃС‹ С…СЂР°РЅРµРЅРёСЏ, РїРµСЂРµРґР°С‡Рё Рё СѓРґР°Р»РµРЅРёСЏ РґР°РЅРЅС‹С…. Р­С‚РѕС‚ С€Р°Р±Р»РѕРЅ РЅРµ СЏРІР»СЏРµС‚СЃСЏ СЋСЂРёРґРёС‡РµСЃРєРёРј Р·Р°РєР»СЋС‡РµРЅРёРµРј.</p></div>
      <nav className="legal-index" aria-label="РЎРѕРґРµСЂР¶Р°РЅРёРµ РїРѕР»РёС‚РёРєРё">
        <a href="#policy-1">01. РћР±С‰РёРµ РїРѕР»РѕР¶РµРЅРёСЏ</a><a href="#policy-2">02. РћРїРµСЂР°С‚РѕСЂ</a><a href="#policy-3">03. РљР°РєРёРµ РґР°РЅРЅС‹Рµ РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ</a><a href="#policy-4">04. Р¦РµР»Рё РѕР±СЂР°Р±РѕС‚РєРё</a><a href="#policy-5">05. РћСЃРЅРѕРІР°РЅРёСЏ Рё РїРѕСЂСЏРґРѕРє</a><a href="#policy-6">06. РџРµСЂРµРґР°С‡Р° С‚СЂРµС‚СЊРёРј Р»РёС†Р°Рј</a><a href="#policy-7">07. РЎСЂРѕРєРё С…СЂР°РЅРµРЅРёСЏ</a><a href="#policy-8">08. Р—Р°С‰РёС‚Р° РґР°РЅРЅС‹С…</a><a href="#policy-9">09. РџСЂР°РІР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</a><a href="#policy-10">10. РљРѕРЅС‚Р°РєС‚С‹ Рё РёР·РјРµРЅРµРЅРёСЏ</a>
      </nav>
      <section id="policy-1"><span className="legal-section-num">01 / РћР‘Р©РР• РџРћР›РћР–Р•РќРРЇ</span><h2>Рћ С‡С‘Рј СЌС‚РѕС‚ РґРѕРєСѓРјРµРЅС‚</h2><p>РќР°СЃС‚РѕСЏС‰Р°СЏ РџРѕР»РёС‚РёРєР° РѕР±СЂР°Р±РѕС‚РєРё РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… (РґР°Р»РµРµ вЂ” В«РџРѕР»РёС‚РёРєР°В») РѕРїРёСЃС‹РІР°РµС‚ РїРѕСЂСЏРґРѕРє РѕР±СЂР°Р±РѕС‚РєРё Рё Р·Р°С‰РёС‚С‹ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃР°Р№С‚Р° Рё СЃРµСЂРІРёСЃР° РѕРЅР»Р°Р№РЅ-Р·Р°РїРёСЃРё AutoStudio (РґР°Р»РµРµ вЂ” В«РЎРµСЂРІРёСЃВ»).</p><p>РџРѕР»РёС‚РёРєР° СЃРѕСЃС‚Р°РІР»РµРЅР° СЃ СѓС‡С‘С‚РѕРј Р¤РµРґРµСЂР°Р»СЊРЅРѕРіРѕ Р·Р°РєРѕРЅР° Р Р¤ РѕС‚ 27.07.2006 в„– 152-Р¤Р— В«Рћ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С…В». РћРЅР° РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє СЃРІРµРґРµРЅРёСЏРј, РєРѕС‚РѕСЂС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ РїСЂРё РѕС„РѕСЂРјР»РµРЅРёРё Р·Р°РїРёСЃРё, РѕС‚РїСЂР°РІРєРµ Р·Р°СЏРІРєРё РёР»Рё РѕР±СЂР°С‰РµРЅРёРё Рє РѕРїРµСЂР°С‚РѕСЂСѓ С‡РµСЂРµР· РЎРµСЂРІРёСЃ.</p></section>
      <section id="policy-2"><span className="legal-section-num">02 / РћРџР•Р РђРўРћР </span><h2>РљС‚Рѕ РѕС‚РІРµС‡Р°РµС‚ Р·Р° РґР°РЅРЅС‹Рµ</h2><p>РћРїРµСЂР°С‚РѕСЂ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С…: <strong>[РїРѕР»РЅРѕРµ РЅР°РёРјРµРЅРѕРІР°РЅРёРµ РѕСЂРіР°РЅРёР·Р°С†РёРё РёР»Рё Р¤. Р. Рћ. РёРЅРґРёРІРёРґСѓР°Р»СЊРЅРѕРіРѕ РїСЂРµРґРїСЂРёРЅРёРјР°С‚РµР»СЏ]</strong>.</p><p>РђРґСЂРµСЃ РѕРїРµСЂР°С‚РѕСЂР°: <strong>[СЋСЂРёРґРёС‡РµСЃРєРёР№ Р°РґСЂРµСЃ РёР»Рё Р°РґСЂРµСЃ СЂРµРіРёСЃС‚СЂР°С†РёРё]</strong>.</p><p>РљРѕРЅС‚Р°РєС‚ РґР»СЏ РѕР±СЂР°С‰РµРЅРёР№ РїРѕ РІРѕРїСЂРѕСЃР°Рј РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С…: <strong>[СЂР°Р±РѕС‡РёР№ Р°РґСЂРµСЃ СЌР»РµРєС‚СЂРѕРЅРЅРѕР№ РїРѕС‡С‚С‹]</strong>, С‚РµР»РµС„РѕРЅ: <strong>[РєРѕРЅС‚Р°РєС‚РЅС‹Р№ РЅРѕРјРµСЂ]</strong>.</p><p>Р”Рѕ РїСѓР±Р»РёРєР°С†РёРё Р·Р°РїРѕР»РЅРёС‚Рµ СЌС‚Рё СЃРІРµРґРµРЅРёСЏ. РќРµ РѕСЃС‚Р°РІР»СЏР№С‚Рµ РІ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅРѕР№ РІРµСЂСЃРёРё РїРѕР»СЏ РІ РєРІР°РґСЂР°С‚РЅС‹С… СЃРєРѕР±РєР°С….</p></section>
      <section id="policy-3"><span className="legal-section-num">03 / РЎРћРЎРўРђР’ Р”РђРќРќР«РҐ</span><h2>РљР°РєРёРµ СЃРІРµРґРµРЅРёСЏ РјРѕРіСѓС‚ РѕР±СЂР°Р±Р°С‚С‹РІР°С‚СЊСЃСЏ</h2><ul><li>РёРјСЏ Рё РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°;</li><li>РјР°СЂРєР° Рё РјРѕРґРµР»СЊ Р°РІС‚РѕРјРѕР±РёР»СЏ;</li><li>РІС‹Р±СЂР°РЅРЅР°СЏ СѓСЃР»СѓРіР°, РґР°С‚Р° Рё РІСЂРµРјСЏ Р·Р°РїРёСЃРё, РІС‹Р±СЂР°РЅРЅС‹Р№ Р±РѕРєСЃ;</li><li>РєРѕРјРјРµРЅС‚Р°СЂРёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рє Р·Р°СЏРІРєРµ;</li><li>С‚РµС…РЅРёС‡РµСЃРєРёРµ СЃРІРµРґРµРЅРёСЏ, РЅРµРѕР±С…РѕРґРёРјС‹Рµ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃР°Р№С‚Р°, РµРіРѕ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё Рё РґРёР°РіРЅРѕСЃС‚РёРєРё РѕС€РёР±РѕРє, РЅР°РїСЂРёРјРµСЂ РґР°РЅРЅС‹Рµ Р±СЂР°СѓР·РµСЂР° Рё Р¶СѓСЂРЅР°Р»С‹ Р·Р°РїСЂРѕСЃРѕРІ.</li></ul><p>РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РЅРµ СѓРєР°Р·С‹РІР°Р№С‚Рµ РІ РєРѕРјРјРµРЅС‚Р°СЂРёСЏС… СЃРІРµРґРµРЅРёСЏ, РЅРµ РѕС‚РЅРѕСЃСЏС‰РёРµСЃСЏ Рє Р·Р°РїРёСЃРё, РІ С‚РѕРј С‡РёСЃР»Рµ СЃРїРµС†РёР°Р»СЊРЅС‹Рµ РєР°С‚РµРіРѕСЂРёРё РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С….</p></section>
      <section id="policy-4"><span className="legal-section-num">04 / Р¦Р•Р›Р РћР‘Р РђР‘РћРўРљР</span><h2>Р”Р»СЏ С‡РµРіРѕ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РґР°РЅРЅС‹Рµ</h2><ul><li>СЃРѕР·РґР°РЅРёРµ, РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ, РёР·РјРµРЅРµРЅРёРµ РёР»Рё РѕС‚РјРµРЅР° Р·Р°РїРёСЃРё;</li><li>СЃРІСЏР·СЊ СЃ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј РїРѕ РІРѕРїСЂРѕСЃР°Рј Р·Р°СЏРІРєРё Рё РѕРєР°Р·Р°РЅРёСЏ РІС‹Р±СЂР°РЅРЅРѕР№ СѓСЃР»СѓРіРё;</li><li>СѓС‡С‘С‚ Р·Р°РіСЂСѓР·РєРё Рё СЂР°СЃРїРёСЃР°РЅРёСЏ СЃС‚СѓРґРёРё;</li><li>РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ Р·Р»РѕСѓРїРѕС‚СЂРµР±Р»РµРЅРёР№, РѕР±РµСЃРїРµС‡РµРЅРёРµ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё Рё СЃС‚Р°Р±РёР»СЊРЅРѕР№ СЂР°Р±РѕС‚С‹ РЎРµСЂРІРёСЃР°;</li><li>РёСЃРїРѕР»РЅРµРЅРёРµ РѕР±СЏР·Р°РЅРЅРѕСЃС‚РµР№, РїСЂРµРґСѓСЃРјРѕС‚СЂРµРЅРЅС‹С… Р·Р°РєРѕРЅРѕРґР°С‚РµР»СЊСЃС‚РІРѕРј.</li></ul><p>Р”Р°РЅРЅС‹Рµ РЅРµ РґРѕР»Р¶РЅС‹ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ РґР»СЏ СЂРµРєР»Р°РјРЅС‹С… СЂР°СЃСЃС‹Р»РѕРє Р±РµР· РѕС‚РґРµР»СЊРЅРѕРіРѕ Р·Р°РєРѕРЅРЅРѕРіРѕ РѕСЃРЅРѕРІР°РЅРёСЏ Рё, РєРѕРіРґР° С‚СЂРµР±СѓРµС‚СЃСЏ, РѕС‚РґРµР»СЊРЅРѕРіРѕ СЃРѕРіР»Р°СЃРёСЏ.</p></section>
      <section id="policy-5"><span className="legal-section-num">05 / РћРЎРќРћР’РђРќРРЇ Р РџРћР РЇР”РћРљ</span><h2>РљР°Рє РѕСЃСѓС‰РµСЃС‚РІР»СЏРµС‚СЃСЏ РѕР±СЂР°Р±РѕС‚РєР°</h2><p>РћСЃРЅРѕРІР°РЅРёСЏРјРё РѕР±СЂР°Р±РѕС‚РєРё РјРѕРіСѓС‚ Р±С‹С‚СЊ СЃРѕРіР»Р°СЃРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ, РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚СЊ СЃРѕРІРµСЂС€РµРЅРёСЏ РґРµР№СЃС‚РІРёР№ РїРѕ РµРіРѕ Р·Р°РїСЂРѕСЃСѓ РґРѕ Р·Р°РєР»СЋС‡РµРЅРёСЏ РґРѕРіРѕРІРѕСЂР°, РёСЃРїРѕР»РЅРµРЅРёРµ РґРѕРіРѕРІРѕСЂР° Рё С‚СЂРµР±РѕРІР°РЅРёСЏ Р·Р°РєРѕРЅРѕРґР°С‚РµР»СЊСЃС‚РІР° вЂ” РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РєРѕРЅРєСЂРµС‚РЅРѕР№ С†РµР»Рё.</p><p>РћР±СЂР°Р±РѕС‚РєР° РјРѕР¶РµС‚ РІРєР»СЋС‡Р°С‚СЊ СЃР±РѕСЂ, Р·Р°РїРёСЃСЊ, СЃРёСЃС‚РµРјР°С‚РёР·Р°С†РёСЋ, С…СЂР°РЅРµРЅРёРµ, СѓС‚РѕС‡РЅРµРЅРёРµ, РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ, РїРµСЂРµРґР°С‡Сѓ РІ СЃР»СѓС‡Р°СЏС…, РѕРїРёСЃР°РЅРЅС‹С… РІ РџРѕР»РёС‚РёРєРµ, Р±Р»РѕРєРёСЂРѕРІР°РЅРёРµ Рё СѓРґР°Р»РµРЅРёРµ РґР°РЅРЅС‹С…. РЎРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ Р·Р°РїСЂР°С€РёРІР°РµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ РѕС‚ РёРЅС‹С… РїРѕРґС‚РІРµСЂР¶РґРµРЅРёР№ РёРЅС‚РµСЂС„РµР№СЃР°.</p></section>
      <section id="policy-6"><span className="legal-section-num">06 / РџР•Р Р•Р”РђР§Рђ Р”РђРќРќР«РҐ</span><h2>РљРѕРјСѓ РґР°РЅРЅС‹Рµ РјРѕРіСѓС‚ РїРµСЂРµРґР°РІР°С‚СЊСЃСЏ</h2><p>Р”РѕСЃС‚СѓРї Рє РґР°РЅРЅС‹Рј РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ РѕР±СЉС‘РјРµ, РЅРµРѕР±С…РѕРґРёРјРѕРј РґР»СЏ СЂР°Р±РѕС‚С‹ РЎРµСЂРІРёСЃР° Рё РѕР±СЂР°Р±РѕС‚РєРё Р·Р°РїРёСЃРё. РџСЂРё С„Р°РєС‚РёС‡РµСЃРєРѕРј РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРё РјРѕРіСѓС‚ РїСЂРёРІР»РµРєР°С‚СЊСЃСЏ РїРѕСЃС‚Р°РІС‰РёРєРё С…РѕСЃС‚РёРЅРіР°, СЃРµСЂРІРµСЂРЅРѕР№ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂС‹, С‚РµС…РЅРёС‡РµСЃРєРѕРіРѕ РѕР±СЃР»СѓР¶РёРІР°РЅРёСЏ Рё СЃРµСЂРІРёСЃРѕРІ СѓРІРµРґРѕРјР»РµРЅРёР№.</p><p>РџРµСЂРµРґ РїСѓР±Р»РёРєР°С†РёРµР№ РѕРїРµСЂР°С‚РѕСЂ РґРѕР»Р¶РµРЅ СѓРєР°Р·Р°С‚СЊ С„Р°РєС‚РёС‡РµСЃРєРё РёСЃРїРѕР»СЊР·СѓРµРјС‹С… РїРѕР»СѓС‡Р°С‚РµР»РµР№ Рё РїСЂРѕРІРµСЂРёС‚СЊ СѓСЃР»РѕРІРёСЏ РѕР±СЂР°Р±РѕС‚РєРё, Р»РѕРєР°Р»РёР·Р°С†РёСЋ Р±Р°Р· РґР°РЅРЅС‹С… Рё С‚СЂР°РЅСЃРіСЂР°РЅРёС‡РЅСѓСЋ РїРµСЂРµРґР°С‡Сѓ, РµСЃР»Рё РѕРЅР° РёРјРµРµС‚ РјРµСЃС‚Рѕ. РџРµСЂРµРґР°С‡Р° РґР°РЅРЅС‹С… РЅРµ РґРѕР»Р¶РЅР° РѕСЃСѓС‰РµСЃС‚РІР»СЏС‚СЊСЃСЏ РґР»СЏ С†РµР»РµР№, РЅРµСЃРѕРІРјРµСЃС‚РёРјС‹С… СЃ СѓРєР°Р·Р°РЅРЅС‹РјРё РІ РџРѕР»РёС‚РёРєРµ.</p></section>
      <section id="policy-7"><span className="legal-section-num">07 / РЎР РћРљР РҐР РђРќР•РќРРЇ</span><h2>РљР°Рє РґРѕР»РіРѕ С…СЂР°РЅСЏС‚СЃСЏ РґР°РЅРЅС‹Рµ</h2><p>Р”Р°РЅРЅС‹Рµ С…СЂР°РЅСЏС‚СЃСЏ РЅРµ РґРѕР»СЊС€Рµ, С‡РµРј СЌС‚РѕРіРѕ С‚СЂРµР±СѓСЋС‚ С†РµР»Рё РѕР±СЂР°Р±РѕС‚РєРё, РґРѕРіРѕРІРѕСЂРЅС‹Рµ РѕС‚РЅРѕС€РµРЅРёСЏ Рё РїСЂРёРјРµРЅРёРјС‹Рµ С‚СЂРµР±РѕРІР°РЅРёСЏ Р·Р°РєРѕРЅРѕРґР°С‚РµР»СЊСЃС‚РІР°, РїРѕСЃР»Рµ С‡РµРіРѕ СѓРґР°Р»СЏСЋС‚СЃСЏ РёР»Рё РѕР±РµР·Р»РёС‡РёРІР°СЋС‚СЃСЏ, РµСЃР»Рё РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚ РёРЅС‹Рµ Р·Р°РєРѕРЅРЅС‹Рµ РѕСЃРЅРѕРІР°РЅРёСЏ РґР»СЏ С…СЂР°РЅРµРЅРёСЏ.</p><p>РћРїРµСЂР°С‚РѕСЂСѓ РЅРµРѕР±С…РѕРґРёРјРѕ РѕРїСЂРµРґРµР»РёС‚СЊ Рё Р·Р°РєСЂРµРїРёС‚СЊ С„Р°РєС‚РёС‡РµСЃРєРёРµ СЃСЂРѕРєРё РґР»СЏ Р·Р°СЏРІРѕРє, Р·Р°РїРёСЃРµР№, С‚РµС…РЅРёС‡РµСЃРєРёС… Р¶СѓСЂРЅР°Р»РѕРІ Рё СЂРµР·РµСЂРІРЅС‹С… РєРѕРїРёР№ СЃ СѓС‡С‘С‚РѕРј РёСЃРїРѕР»СЊР·СѓРµРјРѕР№ Р±Р°Р·С‹ РґР°РЅРЅС‹С… Рё РЅР°СЃС‚СЂРѕРµРє СЂРµР·РµСЂРІРЅРѕРіРѕ РєРѕРїРёСЂРѕРІР°РЅРёСЏ.</p></section>
      <section id="policy-8"><span className="legal-section-num">08 / Р—РђР©РРўРђ Р”РђРќРќР«РҐ</span><h2>РљР°Рє Р·Р°С‰РёС‰Р°РµС‚СЃСЏ РёРЅС„РѕСЂРјР°С†РёСЏ</h2><p>РћРїРµСЂР°С‚РѕСЂ РїСЂРёРЅРёРјР°РµС‚ РЅРµРѕР±С…РѕРґРёРјС‹Рµ РѕСЂРіР°РЅРёР·Р°С†РёРѕРЅРЅС‹Рµ Рё С‚РµС…РЅРёС‡РµСЃРєРёРµ РјРµСЂС‹ РґР»СЏ Р·Р°С‰РёС‚С‹ РґР°РЅРЅС‹С… РѕС‚ РЅРµРїСЂР°РІРѕРјРµСЂРЅРѕРіРѕ РґРѕСЃС‚СѓРїР°, РёР·РјРµРЅРµРЅРёСЏ, СЂР°СЃРєСЂС‹С‚РёСЏ, СѓРЅРёС‡С‚РѕР¶РµРЅРёСЏ Рё РёРЅС‹С… РЅРµРїСЂР°РІРѕРјРµСЂРЅС‹С… РґРµР№СЃС‚РІРёР№. РљРѕРЅРєСЂРµС‚РЅС‹Рµ РјРµСЂС‹ РґРѕР»Р¶РЅС‹ СЃРѕРѕС‚РІРµС‚СЃС‚РІРѕРІР°С‚СЊ СЂРµР°Р»СЊРЅРѕР№ Р°СЂС…РёС‚РµРєС‚СѓСЂРµ РЎРµСЂРІРёСЃР°, РЅР°СЃС‚СЂРѕР№РєР°Рј РґРѕСЃС‚СѓРїР°, СЂРµР·РµСЂРІРЅРѕРјСѓ РєРѕРїРёСЂРѕРІР°РЅРёСЋ Рё РёСЃРїРѕР»СЊР·СѓРµРјРѕР№ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂРµ.</p></section>
      <section id="policy-9"><span className="legal-section-num">09 / РџР РђР’Рђ РџРћР›Р¬Р—РћР’РђРўР•Р›РЇ</span><h2>РљР°Рє РЅР°РїСЂР°РІРёС‚СЊ Р·Р°РїСЂРѕСЃ</h2><p>РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РјРѕР¶РµС‚ РѕР±СЂР°С‚РёС‚СЊСЃСЏ Рє РѕРїРµСЂР°С‚РѕСЂСѓ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РёРЅС„РѕСЂРјР°С†РёРё РѕР± РѕР±СЂР°Р±РѕС‚РєРµ СЃРІРѕРёС… РґР°РЅРЅС‹С…, СѓС‚РѕС‡РЅРµРЅРёСЏ РЅРµС‚РѕС‡РЅС‹С… СЃРІРµРґРµРЅРёР№, РѕС‚Р·С‹РІР° СЃРѕРіР»Р°СЃРёСЏ РёР»Рё СЂРµР°Р»РёР·Р°С†РёРё РёРЅС‹С… РїСЂР°РІ, РїСЂРµРґСѓСЃРјРѕС‚СЂРµРЅРЅС‹С… Р·Р°РєРѕРЅРѕРґР°С‚РµР»СЊСЃС‚РІРѕРј.</p><p>Р—Р°РїСЂРѕСЃ РЅР°РїСЂР°РІР»СЏРµС‚СЃСЏ РїРѕ РєРѕРЅС‚Р°РєС‚Р°Рј, СѓРєР°Р·Р°РЅРЅС‹Рј РІ СЂР°Р·РґРµР»Рµ 2. Р”Р»СЏ Р·Р°С‰РёС‚С‹ РґР°РЅРЅС‹С… РѕРїРµСЂР°С‚РѕСЂ РІРїСЂР°РІРµ Р·Р°РїСЂРѕСЃРёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ, РЅРµРѕР±С…РѕРґРёРјСѓСЋ РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ Р»РёС‡РЅРѕСЃС‚Рё Р·Р°СЏРІРёС‚РµР»СЏ. РћС‚Р·С‹РІ СЃРѕРіР»Р°СЃРёСЏ РЅРµ РѕС‚РјРµРЅСЏРµС‚ РѕР±СЂР°Р±РѕС‚РєСѓ, РґР»СЏ РєРѕС‚РѕСЂРѕР№ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РёРЅРѕРµ Р·Р°РєРѕРЅРЅРѕРµ РѕСЃРЅРѕРІР°РЅРёРµ.</p></section>
      <section id="policy-10"><span className="legal-section-num">10 / Р—РђРљР›Р®Р§РРўР•Р›Р¬РќР«Р• РџРћР›РћР–Р•РќРРЇ</span><h2>РљРѕРЅС‚Р°РєС‚С‹ Рё РѕР±РЅРѕРІР»РµРЅРёСЏ</h2><p>РђРєС‚СѓР°Р»СЊРЅР°СЏ РІРµСЂСЃРёСЏ РџРѕР»РёС‚РёРєРё СЂР°Р·РјРµС‰Р°РµС‚СЃСЏ РЅР° СЃС‚СЂР°РЅРёС†Рµ <a href="/privacy-policy">/privacy-policy</a>. РџСЂРё РёР·РјРµРЅРµРЅРёРё С†РµР»РµР№, СЃРѕСЃС‚Р°РІР° РґР°РЅРЅС‹С… РёР»Рё РїРѕСЂСЏРґРєР° РѕР±СЂР°Р±РѕС‚РєРё РџРѕР»РёС‚РёРєР° РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ, Р° РІ СЃР»СѓС‡Р°СЏС…, РїСЂРµРґСѓСЃРјРѕС‚СЂРµРЅРЅС‹С… Р·Р°РєРѕРЅРѕРј, Р·Р°РїСЂР°С€РёРІР°РµС‚СЃСЏ РЅРѕРІРѕРµ СЃРѕРіР»Р°СЃРёРµ.</p><p>Р’РѕРїСЂРѕСЃС‹ РїРѕ РѕР±СЂР°Р±РѕС‚РєРµ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… РЅР°РїСЂР°РІР»СЏР№С‚Рµ РѕРїРµСЂР°С‚РѕСЂСѓ РїРѕ РєРѕРЅС‚Р°РєС‚Р°Рј, СѓРєР°Р·Р°РЅРЅС‹Рј РІ СЂР°Р·РґРµР»Рµ 2.</p></section>
      <aside className="legal-note"><strong>Р’Р°Р¶РЅРѕ РїРµСЂРµРґ Р·Р°РїСѓСЃРєРѕРј.</strong> Р”Рѕ РїСѓР±Р»РёРєР°С†РёРё РЅРµРѕР±С…РѕРґРёРјРѕ Р·Р°РїРѕР»РЅРёС‚СЊ СЂРµРєРІРёР·РёС‚С‹ РѕРїРµСЂР°С‚РѕСЂР°, СѓРєР°Р·Р°С‚СЊ СЂРµР°Р»СЊРЅС‹Рµ РєРѕРЅС‚Р°РєС‚С‹ Рё РїСЂРѕРІРµСЂРёС‚СЊ РёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ СЃРµСЂРІРµСЂС‹, Р±Р°Р·Сѓ РґР°РЅРЅС‹С…, РїРѕСЃС‚Р°РІС‰РёРєРѕРІ С…РѕСЃС‚РёРЅРіР° Рё СЃРµСЂРІРёСЃС‹ СѓРІРµРґРѕРјР»РµРЅРёР№. РўР°РєР¶Рµ РїСЂРѕРІРµСЂСЊС‚Рµ, С‡С‚Рѕ РїСЂРѕС†РµСЃСЃС‹ СЃР°Р№С‚Р° СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‚ СЌС‚РѕР№ РџРѕР»РёС‚РёРєРµ Рё РѕС‚РґРµР»СЊРЅРѕ РѕС„РѕСЂРјР»РµРЅРЅРѕРјСѓ СЃРѕРіР»Р°СЃРёСЋ.</aside>
    </article>
    <footer className="legal-footer"><span>AUTOSTUDIO В· РџР•Р РЎРћРќРђР›Р¬РќР«Р• Р”РђРќРќР«Р•</span><a href="/">в†ђ Р’РµСЂРЅСѓС‚СЊСЃСЏ РЅР° СЃР°Р№С‚</a></footer>
  </main>;
  if (loading) return <div className="loader-screen">
    <div className="loader-mark">A</div>
    <span>РџРѕРґРіРѕС‚Р°РІР»РёРІР°РµРј СЃС‚СѓРґРёСЋвЂ¦</span>
  </div>;
  if (route.owner && DEMO_MODE) return <div className="not-found"><div className="brand-mark"><Wrench /></div><h1>РљР°Р±РёРЅРµС‚ РЅРµРґРѕСЃС‚СѓРїРµРЅ РІ РґРµРјРѕРІРµСЂСЃРёРё</h1><p>Р­С‚Рѕ РїСѓР±Р»РёС‡РЅС‹Р№ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ СЃР°Р№С‚.</p></div>;
  if (route.owner) {
    if (!ownerToken) return <div className="owner-login">
      <a className="back-link" href={`/s/${route.slug}/`}>
        <ArrowLeft size={17} /> Рљ СЃС‚СЂР°РЅРёС†Рµ СЃС‚СѓРґРёРё</a>
      <div className="login-card">
        <div className="brand-mark">
          <Wrench size={22} />
        </div>
        <p className="eyebrow">AUTOSTUDIO / OWNER</p>
        <h1>РљР°Р±РёРЅРµС‚ СЃС‚СѓРґРёРё</h1>
        <p className="muted">РЈРїСЂР°РІР»СЏР№С‚Рµ Р·Р°РїРёСЃСЏРјРё, СЂР°СЃРїРёСЃР°РЅРёРµРј Рё РѕРїР»Р°С‚Р°РјРё.</p>
        <form onSubmit={login} className="stack-form">
          <label>РџРѕС‡С‚Р°<input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoComplete="username" placeholder="owner@studio.ru" />
          </label>
          <label>РџР°СЂРѕР»СЊ<input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required autoComplete="current-password" placeholder="Р’РІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ" />
          </label>{ownerError && <p className="error-text">{ownerError}</p>}<button className="button primary full" type="submit">Р’РѕР№С‚Рё РІ РєР°Р±РёРЅРµС‚ <ArrowRight size={17} />
          </button>
        </form>
        <p className="fine-print">Р’С…РѕРґ РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РІР»Р°РґРµР»СЊС†Сѓ СЌС‚РѕР№ СЃС‚СѓРґРёРё.</p>
      </div>
    </div>;
    if (!ownerData) return <div className="loader-screen">Р—Р°РіСЂСѓР¶Р°РµРј РєР°Р±РёРЅРµС‚вЂ¦</div>;
    return <div className="owner-shell">
      <aside className="owner-sidebar">
        <a href={`/s/${route.slug}/`} className="owner-brand">
          <span className="brand-mark">
            <Wrench size={21} />
          </span>
          <span>
            <b>{ownerData?.config?.name || 'AutoStudio'}</b>
            <small>РџР°РЅРµР»СЊ СѓРїСЂР°РІР»РµРЅРёСЏ</small>
          </span>
        </a>
        <nav className="owner-menu">
          <button className={ownerTab === 'overview' ? 'active' : ''} onClick={() => setOwnerTab('overview')}>
            <Gauge size={18} />РћР±Р·РѕСЂ</button>
          <button className={ownerTab === 'bookings' ? 'active' : ''} onClick={() => setOwnerTab('bookings')}>
            <CalendarDays size={18} />Р—Р°РїРёСЃРё</button>
          <button className={ownerTab === 'settings' ? 'active' : ''} onClick={() => setOwnerTab('settings')}>
            <Settings2 size={18} />РќР°СЃС‚СЂРѕР№РєРё</button>
          <button className={ownerTab === 'gallery' ? 'active' : ''} onClick={() => setOwnerTab('gallery')}>
            <Camera size={18} />Р¤РѕС‚РѕРіСЂР°С„РёРё</button>
        </nav>
        <div className="owner-side-bottom">
          <span className="online-dot" /> Р”Р°РЅРЅС‹Рµ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅС‹<button onClick={() => {
            sessionStorage.removeItem(`autostudio-owner-${route.slug}`);
            setOwnerToken('');
            setOwnerData(null);
          }}>
            <LogOut size={16} /> Р’С‹Р№С‚Рё</button>
        </div>
      </aside>
      <main className="owner-main">
        <header className="owner-topbar">
          <div>
            <p className="eyebrow">Р РђР‘РћР§Р•Р• РџР РћРЎРўР РђРќРЎРўР’Рћ</p>
            <h1>{ownerTab === 'overview' ? 'Р”РѕР±СЂРѕ РїРѕР¶Р°Р»РѕРІР°С‚СЊ' : ownerTab === 'bookings' ? 'Р—Р°РїРёСЃРё СЃС‚СѓРґРёРё' : ownerTab === 'settings' ? 'РќР°СЃС‚СЂРѕР№РєРё СЃС‚СѓРґРёРё' : 'Р“Р°Р»РµСЂРµСЏ СЂР°Р±РѕС‚'}</h1>
          </div>
          <a className="button soft" href={`/s/${route.slug}/`} target="_blank" rel="noreferrer">РћС‚РєСЂС‹С‚СЊ СЃС‚СЂР°РЅРёС†Сѓ <ArrowRight size={16} />
          </a>
        </header>
        {ownerTab === 'overview' && <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Р—Р°РµР·РґРѕРІ СЃРµРіРѕРґРЅСЏ</span>
              <strong>{ownerData?.stats?.today_arrivals || 0}</strong>
              <small>
                <CalendarCheck size={14} /> РќР° СЃРµРіРѕРґРЅСЏ</small>
            </div>
            <div className="stat-card">
              <span>РњР°С€РёРЅ Р·Р° РЅРµРґРµР»СЋ</span>
              <strong>{ownerData?.stats?.week_arrivals || 0}</strong>
              <small>
                <CarFront size={14} /> РђРєС‚РёРІРЅС‹Рµ Р·Р°РїРёСЃРё</small>
            </div>
            <div className="stat-card">
              <span>Р—Р°РІРµСЂС€РµРЅРѕ СЂР°Р±РѕС‚</span>
              <strong>{ownerData?.stats?.week_completed || 0}</strong>
              <small>
                <Check size={14} /> Р—Р° СЌС‚Сѓ РЅРµРґРµР»СЋ</small>
            </div>
            <div className="stat-card">
              <span>РџРѕР»СѓС‡РµРЅРѕ Р·Р° РЅРµРґРµР»СЋ</span>
              <strong>{money(ownerData?.stats?.week_received || 0)}</strong>
              <small>
                <Banknote size={14} /> РћРїР»Р°С‚С‹ РјРёРЅСѓСЃ РІРѕР·РІСЂР°С‚С‹</small>
            </div>
          </div>
          <section className="owner-panel">
            <div className="panel-heading">
              <div>
                <h2>РЎРµРіРѕРґРЅСЏ РІ СЃС‚СѓРґРёРё</h2>
                <p>РџР»Р°РЅ Р·Р°РµР·РґРѕРІ Рё С‚РµРєСѓС‰РёР№ СЃС‚Р°С‚СѓСЃ СЂР°Р±РѕС‚</p>
              </div>
              <button className="text-button" onClick={() => setOwnerTab('bookings')}>Р’СЃРµ Р·Р°РїРёСЃРё <ArrowRight size={15} />
              </button>
            </div>
            <BookingTable rows={ownerData?.today || []} onStatus={changeBooking} onPayment={recordPayment} onReschedule={rescheduleBooking} />
          </section>
          <section className="owner-panel assistant-owner">
            <div className="panel-heading">
              <div>
                <h2>
                  <Sparkles size={19} /> РџРѕРјРѕС‰РЅРёРє РІР»Р°РґРµР»СЊС†Р°</h2>
                <p>РћС‚РІРµС‚С‹ РїРѕ С„Р°РєС‚РёС‡РµСЃРєРёРј Р·Р°РїРёСЃСЏРј Рё РѕРїР»Р°С‚Р°Рј</p>
              </div>
            </div>
            <div className="owner-ask">
              <input value={ownerQuery} onChange={e => setOwnerQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && askOwner()} placeholder="РќР°РїСЂРёРјРµСЂ: СЃРєРѕР»СЊРєРѕ РґРµРЅРµРі РїРѕР»СѓС‡РµРЅРѕ?" />
              <button className="button primary" onClick={askOwner}>РЎРїСЂРѕСЃРёС‚СЊ <ArrowRight size={16} />
              </button>
            </div>
            <div className="quick-asks">
              <button onClick={() => {
                setOwnerQuery('Р§С‚Рѕ Сѓ РјРµРЅСЏ Р·Р°РІС‚СЂР°?');
                setTimeout(() => api<{ answer: string; }>(`/owner/${route.slug}/assistant?q=${encodeURIComponent('Р§С‚Рѕ Сѓ РјРµРЅСЏ Р·Р°РІС‚СЂР°?')}`, {}, ownerToken).then(d => setOwnerAnswer(d.answer)), 0);
              }}>Р§С‚Рѕ Сѓ РјРµРЅСЏ Р·Р°РІС‚СЂР°?</button>
              <button onClick={() => {
                setOwnerQuery('РЎРєРѕР»СЊРєРѕ РјР°С€РёРЅ Р±С‹Р»Рѕ РЅР° РЅРµРґРµР»Рµ?');
                api<{
                  answer: string;
                }>(`/owner/${route.slug}/assistant?q=${encodeURIComponent('РЎРєРѕР»СЊРєРѕ РјР°С€РёРЅ Р±С‹Р»Рѕ РЅР° РЅРµРґРµР»Рµ?')}`, {}, ownerToken).then(d => setOwnerAnswer(d.answer));
              }}>РњР°С€РёРЅ Р·Р° РЅРµРґРµР»СЋ</button>
              <button onClick={() => {
                setOwnerQuery('РЎРєРѕР»СЊРєРѕ РґРµРЅРµРі РїРѕР»СѓС‡РµРЅРѕ?');
                api<{
                  answer: string;
                }>(`/owner/${route.slug}/assistant?q=${encodeURIComponent('РЎРєРѕР»СЊРєРѕ РґРµРЅРµРі РїРѕР»СѓС‡РµРЅРѕ?')}`, {}, ownerToken).then(d => setOwnerAnswer(d.answer));
              }}>РЎРєРѕР»СЊРєРѕ РґРµРЅРµРі РїРѕР»СѓС‡РµРЅРѕ?</button>
            </div>{ownerAnswer && <div className="assistant-answer">{ownerAnswer}</div>}</section>
        </>}
        {ownerTab === 'bookings' && <section className="owner-panel">
          <div className="panel-heading">
            <div>
              <h2>Р‘Р»РёР¶Р°Р№С€РёРµ Р·Р°РїРёСЃРё</h2>
              <p>Р”Р°РЅРЅС‹Рµ СЌС‚РѕР№ СЃС‚СѓРґРёРё, РѕС‚СЃРѕСЂС‚РёСЂРѕРІР°РЅС‹ РїРѕ РІСЂРµРјРµРЅРё</p>
            </div>
            <button className="button primary" onClick={manualAdd}>
              <Plus size={16} /> Р”РѕР±Р°РІРёС‚СЊ Р·Р°РїРёСЃСЊ</button>
          </div>
          <BookingTable rows={ownerData?.week || []} onStatus={changeBooking} onPayment={recordPayment} full />
        </section>}
        {ownerTab === 'settings' && ownerData && <section className="owner-panel settings-panel">
          <div className="panel-heading">
            <div>
              <h2>РћСЃРЅРѕРІРЅС‹Рµ РґР°РЅРЅС‹Рµ</h2>
              <p>РР·РјРµРЅРµРЅРёСЏ РїСЂРёРјРµРЅСЏС‚СЃСЏ Рє РїСѓР±Р»РёС‡РЅРѕР№ СЃС‚СЂР°РЅРёС†Рµ РїРѕСЃР»Рµ СЃРѕС…СЂР°РЅРµРЅРёСЏ</p>
            </div>
            <button className="button primary" onClick={saveConfig} disabled={saving}>
              <Save size={16} />{saving ? 'РЎРѕС…СЂР°РЅСЏРµРјвЂ¦' : 'РЎРѕС…СЂР°РЅРёС‚СЊ'}</button>
          </div>
          <div className="settings-grid">
            <label>РќР°Р·РІР°РЅРёРµ СЃС‚СѓРґРёРё<input value={ownerData.config.name} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, name: e.target.value } }))} />
            </label>
            <label>РўРµР»РµС„РѕРЅ<input value={ownerData.config.phone || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, phone: e.target.value } }))} />
            </label>
            <label className="wide">РћРїРёСЃР°РЅРёРµ<textarea rows={3} value={ownerData.config.description || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, description: e.target.value } }))} />
            </label>
            <label className="wide">РђРґСЂРµСЃ<input value={ownerData.config.address || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, address: e.target.value } }))} />
            </label>
            <label className="wide">РЎСЃС‹Р»РєР° РЅР° РєР°СЂС‚Сѓ<input value={ownerData.config.map_url || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, map_url: e.target.value } }))} />
            </label>
            <label>РџРѕРґРіРѕС‚РѕРІРєР° РјРµР¶РґСѓ РјР°С€РёРЅР°РјРё, РјРёРЅ<input type="number" min="0" value={ownerData.config.prep_minutes || 0} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, prep_minutes: Number(e.target.value) } }))} />
            </label>
            <label>РћС‚РјРµРЅР° РЅРµ РїРѕР·РґРЅРµРµ, С‡<input type="number" min="0" value={ownerData.config.cancellation_hours || 0} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, cancellation_hours: Number(e.target.value) } }))} />
            </label>
          </div>
          <h3 className="settings-subtitle">Р Р°Р±РѕС‡РµРµ РІСЂРµРјСЏ</h3>
          <div className="hours-editor">{['РџРѕРЅРµРґРµР»СЊРЅРёРє', 'Р’С‚РѕСЂРЅРёРє', 'РЎСЂРµРґР°', 'Р§РµС‚РІРµСЂРі', 'РџСЏС‚РЅРёС†Р°', 'РЎСѓР±Р±РѕС‚Р°', 'Р’РѕСЃРєСЂРµСЃРµРЅСЊРµ'].map((day, i) => {
            const h = ownerData.config.hours?.[String(i)] || { closed: true }; return <div className="hours-row" key={day}>
              <b>{day}</b>
              <label className="toggle-label">
                <input type="checkbox" checked={!h.closed} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, hours: { ...p.config.hours, [String(i)]: e.target.checked ? { open: '10:00', close: '19:00' } : { closed: true } } } }))} /> Р Р°Р±РѕС‚Р°РµС‚</label>{!h.closed && <>
                  <input type="time" value={h.open || '10:00'} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, hours: { ...p.config.hours, [String(i)]: { ...h, open: e.target.value } } } }))} />
                  <span>вЂ”</span>
                  <input type="time" value={h.close || '19:00'} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, hours: { ...p.config.hours, [String(i)]: { ...h, close: e.target.value } } } }))} />
                </>}</div>
              ;
})}</div>
          <h3 className="settings-subtitle">Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РІС‹С…РѕРґРЅС‹Рµ</h3>
          <label className="closed-dates-field">Р—Р°РєСЂС‹С‚С‹Рµ РґР°С‚С‹ (С‡РµСЂРµР· Р·Р°РїСЏС‚СѓСЋ, YYYY-MM-DD)<input value={(ownerData.config.closed_dates || []).join(', ')} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, closed_dates: e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) } }))} placeholder="2026-12-31, 2027-01-01" />
          </label>
          <h3 className="settings-subtitle">РЈСЃР»СѓРіРё Рё С†РµРЅС‹</h3>
          <div className="service-edit-list">{ownerData.config.services.map((s: Service, i: number) =>
            <div className="service-edit" key={s.id}>
              <label>РќР°Р·РІР°РЅРёРµ<input value={s.title} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, title: e.target.value } : x) } }))} />
              </label>
              <label>РћРїРёСЃР°РЅРёРµ<input value={s.description || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, description: e.target.value } : x) } }))} />
              </label>
              <label>Р¦РµРЅР° РѕС‚<input type="number" min="0" value={s.price_from} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, price_from: Number(e.target.value) } : x) } }))} />
              </label>
              <label>Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ, РјРёРЅ<input type="number" min="15" step="15" value={s.duration_minutes} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, duration_minutes: Number(e.target.value) } : x) } }))} />
              </label>
              <button className="icon-button danger" title="РЈРґР°Р»РёС‚СЊ СѓСЃР»СѓРіСѓ" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.filter((_: Service, j: number) => j !== i) } }))}>
                <X size={16} />
              </button>
            </div>)}<button className="button soft" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: [...p.config.services, { id: `service-${uid()}`, title: 'РќРѕРІР°СЏ СѓСЃР»СѓРіР°', description: '', price_from: 0, duration_minutes: 60, active: true }] } }))}>
              <Plus size={16} /> Р”РѕР±Р°РІРёС‚СЊ СѓСЃР»СѓРіСѓ</button>
          </div>
          <h3 className="settings-subtitle">Р‘РѕРєСЃС‹</h3>
          <div className="service-edit-list">{ownerData.config.boxes.map((b: any, i: number) =>
            <div className="service-edit" key={b.id}>
              <label>РќР°Р·РІР°РЅРёРµ Р±РѕРєСЃР°<input value={b.title} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: p.config.boxes.map((x: any, j: number) => j === i ? { ...x, title: e.target.value } : x) } }))} />
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={b.active !== false} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: p.config.boxes.map((x: any, j: number) => j === i ? { ...x, active: e.target.checked } : x) } }))} /> РђРєС‚РёРІРµРЅ</label>
              <button className="icon-button danger" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: p.config.boxes.filter((_: any, j: number) => j !== i) } }))}>
                <X size={16} />
              </button>
            </div>)}<button className="button soft" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: [...p.config.boxes, { id: `box-${uid()}`, title: `Р‘РѕРєСЃ ${p.config.boxes.length + 1}`, active: true }] } }))}>
              <Plus size={16} /> Р”РѕР±Р°РІРёС‚СЊ Р±РѕРєСЃ</button>
          </div>
          <h3 className="settings-subtitle">Р“Р»Р°РІРЅРѕРµ С„РѕС‚Рѕ Рё РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹Рµ РєР°СЂС‚РѕС‡РєРё</h3>
          <div className="hero-upload">
            <img src={ownerData.config.hero_image} alt="Р“Р»Р°РІРЅРѕРµ С„РѕС‚Рѕ" />
            <label className="button soft upload-button">
              <Upload size={16} /> Р—Р°РјРµРЅРёС‚СЊ РіР»Р°РІРЅРѕРµ С„РѕС‚Рѕ<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'hero')} />
            </label>
            <label className="button soft upload-button">
              <Upload size={16} /> Р—Р°РіСЂСѓР·РёС‚СЊ Р»РѕРіРѕС‚РёРї<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'logo')} />
            </label>
          </div>
          <div className="settings-grid cards-edit">{(ownerData.config.cards || []).map((c: any, i: number) =>
            <div className="info-card-edit" key={i}>
              <b>РљР°СЂС‚РѕС‡РєР° {i + 1}</b>
              <label>Р—Р°РіРѕР»РѕРІРѕРє<input value={c.title} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, cards: p.config.cards.map((x: any, j: number) => j === i ? { ...x, title: e.target.value } : x) } }))} />
              </label>
              <label>РўРµРєСЃС‚<textarea rows={3} value={c.text} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, cards: p.config.cards.map((x: any, j: number) => j === i ? { ...x, text: e.target.value } : x) } }))} />
              </label>
            </div>)}</div>
        </section>}
        {ownerTab === 'gallery' && ownerData && <section className="owner-panel">
          <div className="panel-heading">
            <div>
              <h2>Р Р°Р±РѕС‚С‹ СЃС‚СѓРґРёРё</h2>
              <p>Р¤РѕС‚Рѕ РјРѕР¶РЅРѕ РґРѕР±Р°РІР»СЏС‚СЊ, Р·Р°РјРµРЅСЏС‚СЊ РїРѕ РѕРґРЅРѕР№ Рё РїРѕРґРїРёСЃС‹РІР°С‚СЊ РѕС‚РґРµР»СЊРЅРѕ</p>
            </div>
            <label className="button primary">
              <Plus size={16} /> Р”РѕР±Р°РІРёС‚СЊ РєР°СЂС‚РѕС‡РєСѓ<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'gallery')} />
            </label>
          </div>
          <div className="gallery-admin">{ownerData.config.gallery.map((g: Gallery, i: number) =>
            <div className="gallery-admin-card" key={g.id}>
              <img src={g.image} alt={g.caption} />
              <div className="gallery-admin-body">
                <label>РџРѕРґРїРёСЃСЊ<input value={g.caption} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, gallery: p.config.gallery.map((x: Gallery, j: number) => j === i ? { ...x, caption: e.target.value } : x) } }))} />
                </label>
                <div className="gallery-actions">
                  <label className="button soft small">
                    <Camera size={15} /> Р—Р°РјРµРЅРёС‚СЊ С„РѕС‚Рѕ<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'gallery', i)} />
                  </label>
                  <button className="button danger-soft small" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, gallery: p.config.gallery.filter((_: Gallery, j: number) => j !== i) } }))}>
                    <X size={15} /> РЈРґР°Р»РёС‚СЊ</button>
                </div>
              </div>
            </div>)}</div>
          <div className="save-gallery">
            <button className="button primary" onClick={saveConfig} disabled={saving}>
              <Save size={16} /> РЎРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ РіР°Р»РµСЂРµРё</button>
          </div>
        </section>}
      </main>
    </div>
      ;
  }
  if (error || !config) return <div className="not-found">
    <div className="brand-mark">
      <Wrench />
    </div>
    <h1>РЎС‚СѓРґРёСЏ РїРѕРєР° РЅРµРґРѕСЃС‚СѓРїРЅР°</h1>
    <p>{error || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё.'}</p>
    <span>РџСЂРѕРІРµСЂСЊС‚Рµ СЃСЃС‹Р»РєСѓ РёР»Рё РѕР±СЂР°С‚РёС‚РµСЃСЊ Рє РІР»Р°РґРµР»СЊС†Сѓ СЃС‚СѓРґРёРё.</span>
  </div>;
  return <div className="app-shell" style={{ '--accent': config.theme_color || '#c8f169' } as CSSProperties}>
    {DEMO_MODE && <div className="demo-ribbon">Р”Р•РњРћР’Р•Р РЎРРЇ В· Р·Р°СЏРІРєРё РЅРµ РѕС‚РїСЂР°РІР»СЏСЋС‚СЃСЏ</div>}
    <header className="topbar">
      <a className="brand" href="#top" onClick={() => setSection('home')}>
        <span className="brand-symbol">{config.logo ? <img src={config.logo} alt="" /> : <Wrench size={19} />}</span>
        <span>
          <b>{config.name}</b>
          <small>CARE В· DETAIL В· DRIVE</small>
        </span>
      </a>
      <nav className="desktop-nav">
        <button className={section === 'home' ? 'active' : ''} onClick={() => {
          setSection('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}><span className="desktop-nav-label">Р“Р»Р°РІРЅР°СЏ</span></button>
        <button className={section === 'services' ? 'active' : ''} onClick={() => {
          setSection('services');
          document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
        }}><span className="desktop-nav-label">РЈСЃР»СѓРіРё</span></button>
        <button className={section === 'mine' ? 'active' : ''} onClick={() => {
          setSection('mine');
          setShowMyBooking(true);
        }}><CalendarCheck size={17} /><span className="desktop-nav-label">РњРѕРё Р·Р°РїРёСЃРё</span></button>
        <button onClick={() => {
          setAssistantOpen(true);
          if (!chatMessages.length) setChatMessages([{ from: 'bot', text: `Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! РЇ РїРѕРјРѕС‰РЅРёРє СЃС‚СѓРґРёРё ${config.name}. РњРѕРіСѓ РїРѕРґСЃРєР°Р·Р°С‚СЊ С†РµРЅС‹, Р°РґСЂРµСЃ Рё Р±Р»РёР¶Р°Р№С€РёРµ СЃРІРѕР±РѕРґРЅС‹Рµ РѕРєРЅР°.` }]);
        }}><span className="desktop-nav-label">РџРѕРјРѕС‰РЅРёРє</span><MessageCircle size={15} />
        </button>
      </nav>
      <div className="top-actions">{installPrompt && <button className="button soft install-button" onClick={async () => {
        await installPrompt.prompt();
        setInstallPrompt(null);
      }}>РЈСЃС‚Р°РЅРѕРІРёС‚СЊ <Plus size={14} />
      </button>}<a className="phone-link" href={`tel:${config.phone.replace(/[^+\d]/g, '')}`}>
          <Phone size={15} />{config.phone}</a>
        <button className="button primary top-book" onClick={() => openBooking()}>Р—Р°РїРёСЃР°С‚СЊСЃСЏ <ArrowRight size={16} />
        </button>
        <a
          className="owner-shortcut"
          href={appPath(`owner/${route.slug}/`)}
          aria-label="РљР°Р±РёРЅРµС‚ РІР»Р°РґРµР»СЊС†Р°"
        >
          <Settings2 size={18} />
        </a>
      </div>
    </header>
    <main id="top">
      <section className="hero">
        <div className="hero-photo" aria-hidden="true"><img className="hero-image" src={config.hero_image} alt="" loading="eager" fetchPriority="high" decoding="async" /></div>
        <div className="hero-content">
          <div className="eyebrow hero-eyebrow">
            <span className="live-dot" /> РџР Р•РњРРђР›Р¬РќР«Р™ РЈРҐРћР” Р—Рђ РђР’РўРћРњРћР‘РР›Р•Рњ</div>
          <h1>{config.name}<br />
            <em>РІ РґРµС‚Р°Р»СЏС….</em>
          </h1>
          <p>{config.description}</p>
          <div className="hero-badges">
            <span>
              <ShieldCheck size={16} /> Р‘РµСЂРµР¶РЅС‹Р№ СѓС…РѕРґ</span>
            <span>
              <Sparkles size={16} /> РџСЂРµРјРёСѓРј-СЃРѕСЃС‚Р°РІС‹</span>
          </div>
          <button className="hero-book glass-button" onClick={() => openBooking()}>
            <span>
              <CalendarCheck size={20} />
            </span>
            <b>Р—Р°РїРёСЃР°С‚СЊСЃСЏ</b>
            <ArrowDownRight size={22} />
          </button>
          <div className="hero-footnote">
            <span>01 / CARE THAT SHOWS</span>
            <span>Р›РёСЃС‚Р°Р№С‚Рµ, С‡С‚РѕР±С‹ СѓР·РЅР°С‚СЊ Р±РѕР»СЊС€Рµ <ArrowRight size={14} />
            </span>
          </div>
        </div>
        <div className="hero-stamp">
          <span>DETAILING</span>
          <b>STUDIO</b>
          <small>EST. FOR YOUR CAR</small>
        </div>
      </section>
      <section className="trust-strip">
        <div>
          <span className="trust-icon">
            <ShieldCheck />
          </span>
          <span>
            <b>Р’РЅРёРјР°РЅРёРµ Рє РґРµС‚Р°Р»СЏРј</b>
            <small>РўРѕС‡РЅС‹Р№ РїРѕРґС…РѕРґ Рє РєР°Р¶РґРѕРјСѓ Р°РІС‚Рѕ</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Clock3 />
          </span>
          <span>
            <b>РџРѕ Р·Р°РїРёСЃРё</b>
            <small>Р‘РµР· РѕР¶РёРґР°РЅРёСЏ РІ РѕС‡РµСЂРµРґРё</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Wrench />
          </span>
          <span>
            <b>РџРѕРЅСЏС‚РЅС‹Р№ РїСЂР°Р№СЃ</b>
            <small>РЎС‚РѕРёРјРѕСЃС‚СЊ РґРѕ РЅР°С‡Р°Р»Р° СЂР°Р±РѕС‚</small>
          </span>
        </div>
        <div className="strip-number">
          <b>01вЂ”04</b>
          <small>РќРђРЁ РџРћР”РҐРћР”</small>
        </div>
      </section>
      <section className="section services-section" id="services">
        <div className="section-heading reveal">
          <div>
            <p className="eyebrow">РЈРЎР›РЈР“Р / 01</p>
            <h2>РЈС…РѕРґ, РєРѕС‚РѕСЂС‹Р№<br />
              <em>РІРёРґРЅРѕ СЃСЂР°Р·Сѓ.</em>
            </h2>
          </div>
          <p className="section-intro">Р’С‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіСѓ вЂ” РїРѕРєР°Р¶РµРј Р°РєС‚СѓР°Р»СЊРЅСѓСЋ СЃС‚РѕРёРјРѕСЃС‚СЊ, РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ Рё РґРѕСЃС‚СѓРїРЅРѕРµ РІСЂРµРјСЏ РґР»СЏ РІРёР·РёС‚Р°.</p>
        </div>
        <div className="service-grid">{activeServices.map((s, i) =>
          <article className="service-card reveal" key={s.id}>
            <div className="service-image">{s.image ? <img src={s.image} alt={s.title} loading="lazy" decoding="async" fetchPriority="low" /> : <div className="service-image-placeholder">
              <Wrench size={34} />
            </div>}<span className="service-number">0{i + 1}</span>
              <button className="circle-arrow" aria-label={`Р—Р°РїРёСЃР°С‚СЊСЃСЏ: ${s.title}`} onClick={() => openBooking(s.id)}>
                <ArrowUpRightIcon />
              </button>
            </div>
            <div className="service-info">
              <div className="service-title-line">
                <h3>{s.title}</h3>
                <span>{durationLabel(s.duration_minutes)}</span>
              </div>
              <p>{s.description}</p>
              <div className="service-price">
                <span>РѕС‚ <b>{money(s.price_from, config.currency)}</b>
                </span>
                <button onClick={() => openBooking(s.id)}>Р’С‹Р±СЂР°С‚СЊ <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </article>)}</div>
        <div className="service-bottom-note">
          <span>
            <CircleHelp size={16} /> РЎС‚РѕРёРјРѕСЃС‚СЊ РјРѕР¶РµС‚ Р·Р°РІРёСЃРµС‚СЊ РѕС‚ РєР»Р°СЃСЃР° Рё СЃРѕСЃС‚РѕСЏРЅРёСЏ Р°РІС‚РѕРјРѕР±РёР»СЏ.</span>
          <button onClick={() => {
            setAssistantOpen(true);
            setChatMessages([{ from: 'bot', text: `Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! РЎРїСЂРѕСЃРёС‚Рµ РјРµРЅСЏ Рѕ СЃС‚РѕРёРјРѕСЃС‚Рё Р»СЋР±РѕР№ СѓСЃР»СѓРіРё РІ ${config.name}.` }]);
          }}>РЎРїСЂРѕСЃРёС‚СЊ РїРѕРјРѕС‰РЅРёРєР° <MessageCircle size={15} />
          </button>
        </div>
      </section>
      <section className="section why-section">
        <div className="why-visual reveal">
          <img src={config.gallery[0]?.image || config.hero_image} alt="Р”РµС‚РµР№Р»РёРЅРі Р°РІС‚РѕРјРѕР±РёР»СЏ" loading="lazy" decoding="async" fetchPriority="low" />
          <div className="image-caption">
            <span>DETAILS MATTER</span>
            <b>РљР°Р¶РґР°СЏ Р»РёРЅРёСЏ РёРјРµРµС‚ Р·РЅР°С‡РµРЅРёРµ.</b>
          </div>
          <span className="visual-index">FIG. 01 вЂ” PROCESS</span>
        </div>
        <div className="why-content reveal">
          <p className="eyebrow">РќРђРЁ РџРћР”РҐРћР” / 02</p>
          <h2>РќРµ РїСЂРѕСЃС‚Рѕ С‡РёСЃС‚Рѕ.<br />
            <em>РџРѕ-РЅР°СЃС‚РѕСЏС‰РµРјСѓ</em>
            <br />Р±РµСЂРµР¶РЅРѕ.</h2>
          <p className="why-copy">РњС‹ СЂР°Р±РѕС‚Р°РµРј СЃ Р°РІС‚РѕРјРѕР±РёР»РµРј РєР°Рє СЃ СЃРёСЃС‚РµРјРѕР№ РґРµС‚Р°Р»РµР№: РѕС‚ РїРѕРґРіРѕС‚РѕРІРєРё РїРѕРІРµСЂС…РЅРѕСЃС‚Рё РґРѕ С„РёРЅР°Р»СЊРЅРѕРіРѕ РєРѕРЅС‚СЂРѕР»СЏ СЂРµР·СѓР»СЊС‚Р°С‚Р°.</p>
          <div className="info-cards">{(config.cards || []).map((c, i) =>
            <div className="info-card" key={i}>
              <span>0{i + 1}</span>
              <div>
                <b>{c.title}</b>
                <p>{c.text}</p>
              </div>
              <ArrowUpRightIcon />
            </div>)}</div>
          <button className="button outline" onClick={() => openBooking()}>РџРѕРґРѕР±СЂР°С‚СЊ РІСЂРµРјСЏ <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="section gallery-section" id="works">
        <div className="section-heading reveal">
          <div>
            <p className="eyebrow">РџРћР РўР¤РћР›РРћ / 03</p>
            <h2>Р РµР·СѓР»СЊС‚Р°С‚ РіРѕРІРѕСЂРёС‚<br />
              <em>СЃР°Рј Р·Р° СЃРµР±СЏ.</em>
            </h2>
          </div>
          <p className="section-intro">РќРµСЃРєРѕР»СЊРєРѕ РґРµС‚Р°Р»РµР№ РЅР°С€РµР№ СЂР°Р±РѕС‚С‹. РљР°Р¶РґС‹Р№ Р°РІС‚РѕРјРѕР±РёР»СЊ С‚СЂРµР±СѓРµС‚ СЃРІРѕРµРіРѕ СЂРµС€РµРЅРёСЏ Рё РІРЅРёРјР°С‚РµР»СЊРЅРѕРіРѕ РїРѕРґС…РѕРґР°.</p>
        </div>
        <div className="gallery-grid">{(config.gallery || []).map((g, i) =>
          <article className={`gallery-card gallery-card-${i % 3} reveal`} key={g.id}>
            <img src={g.image} alt={g.caption} loading="lazy" decoding="async" fetchPriority="low" />
            <div className="gallery-overlay">
              <span>Р РђР‘РћРўРђ / 0{i + 1}</span>
              <b>{g.caption}</b>
              <ArrowUpRightIcon />
            </div>
          </article>)}</div>{!config.gallery?.length && <div className="empty-gallery">Р¤РѕС‚РѕРіСЂР°С„РёРё СЂР°Р±РѕС‚ СЃРєРѕСЂРѕ РїРѕСЏРІСЏС‚СЃСЏ.</div>}</section>
      <section className="booking-banner reveal">
        <div>
          <p className="eyebrow">Р’РђРЁ РђР’РўРћРњРћР‘РР›Р¬ Р“РћРўРћР’ Рљ РџР•Р Р•РњР•РќРђРњ?</p>
          <h2>Р—Р°РїР»Р°РЅРёСЂСѓРµРј<br />
            <em>РёРґРµР°Р»СЊРЅС‹Р№ СѓС…РѕРґ.</em>
          </h2>
        </div>
        <button className="glass-button banner-book" onClick={() => openBooking()}>
          <span>
            <CalendarCheck size={20} />
          </span>
          <b>Р—Р°РїРёСЃР°С‚СЊСЃСЏ РІ СЃС‚СѓРґРёСЋ</b>
          <ArrowDownRight size={22} />
        </button>
        <div className="banner-watermark">DETAIL<br />LAB.</div>
      </section>
      <section className="section contact-section">
        <div className="contact-main reveal">
          <p className="eyebrow">РљРћРќРўРђРљРўР« / 04</p>
          <h2>Р—Р°РµР·Р¶Р°Р№С‚Рµ<br />
            <em>РЅР° СЂРµР·СѓР»СЊС‚Р°С‚.</em>
          </h2>
          <p className="contact-copy">Р‘СѓРґРµРј СЂР°РґС‹ РїРѕРґРѕР±СЂР°С‚СЊ СѓСЃР»СѓРіСѓ Рё СѓРґРѕР±РЅРѕРµ РІСЂРµРјСЏ РґР»СЏ РІР°С€РµРіРѕ Р°РІС‚РѕРјРѕР±РёР»СЏ.</p>
          <div className="contact-location-row">
            <a className="contact-address" href={`https://yandex.ru/maps/?text=${encodeURIComponent(config.address || '')}`} target="_blank" rel="noreferrer">
              <span>
                <MapPin size={20} />
              </span>
              <div>
                <small>РђР”Р Р•РЎ РЎРўРЈР”РР</small>
                <b>{config.address}</b>
                <em>РџРѕСЃС‚СЂРѕРёС‚СЊ РјР°СЂС€СЂСѓС‚ <ArrowUpRightIcon /></em>
              </div>
            </a>
            <div className="contact-map-frame">
              <iframe
                title={`РЇРЅРґРµРєСЃ РљР°СЂС‚С‹ вЂ” ${config.address}`}
                src={`https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(config.address || '')}&z=16&l=map`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
          <a className="contact-phone" href={`tel:${config.phone.replace(/[^+\d]/g, '')}`}>
            <span>
              <Phone size={20} />
            </span>
            <div>
              <small>РџРћР—Р’РћРќРРўР¬ РќРђРњ</small>
              <b>{config.phone}</b>
            </div>
          </a>
        </div>
        <div className="hours-panel reveal">
          <div className="panel-title">
            <Clock3 size={19} />
            <h3>Р’СЂРµРјСЏ СЂР°Р±РѕС‚С‹</h3>
          </div>{['РџРѕРЅРµРґРµР»СЊРЅРёРє', 'Р’С‚РѕСЂРЅРёРє', 'РЎСЂРµРґР°', 'Р§РµС‚РІРµСЂРі', 'РџСЏС‚РЅРёС†Р°', 'РЎСѓР±Р±РѕС‚Р°', 'Р’РѕСЃРєСЂРµСЃРµРЅСЊРµ'].map((day, i) => {
            const h = config.hours?.[String(i)]; return <div className={`hours-line ${h?.closed || !h ? 'closed' : ''}`} key={day}>
              <span>{day}</span>
              <b>{!h || h.closed ? 'Р’С‹С…РѕРґРЅРѕР№' : `${h.open} вЂ” ${h.close}`}</b>
            </div>
              ;
})}<div className="hours-foot">
            <span className="live-dot" /> Р—Р°РїРёСЃСЊ РѕРЅР»Р°Р№РЅ РґРѕСЃС‚СѓРїРЅР° РєСЂСѓРіР»РѕСЃСѓС‚РѕС‡РЅРѕ</div>
        </div>
      </section>

    </main>
    <footer className="footer">
      <a className="brand" href="#top">
        <span className="brand-symbol">
          <Wrench size={19} />
        </span>
        <span>
          <b>{config.name}</b>
          <small>CARE В· DETAIL В· DRIVE</small>
        </span>
      </a>
      <span>РљР°С‡РµСЃС‚РІРµРЅРЅС‹Р№ СѓС…РѕРґ РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ РІРЅРёРјР°РЅРёСЏ Рє РґРµС‚Р°Р»СЏРј.</span>
      <a className="footer-policy-link" href="/privacy-policy" target="_blank" rel="noreferrer">РџРѕР»РёС‚РёРєР° РѕР±СЂР°Р±РѕС‚РєРё РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С…</a>
      <span>В© {new Date().getFullYear()} {config.name}</span>
    </footer>
    <nav className="mobile-nav" aria-label="РћСЃРЅРѕРІРЅР°СЏ РЅР°РІРёРіР°С†РёСЏ">
      <button className={section === 'home' ? 'active' : ''} onClick={() => {
        setSection('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}>
        <Home size={20} />
        <span>Р“Р»Р°РІРЅР°СЏ</span>
      </button>
      <button className={section === 'services' ? 'active' : ''} onClick={() => {
        setSection('services');
        document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
      }}>
        <Wrench size={20} />
        <span>РЈСЃР»СѓРіРё</span>
      </button>
      <button className={section === 'mine' ? 'active' : ''} onClick={() => {
        setSection('mine');
        setShowMyBooking(true);
      }}>
        <CalendarCheck size={20} />
        <span>РњРѕРё Р·Р°РїРёСЃРё</span>
      </button>
    </nav>
    {bookingOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setBookingOpen(false)}>
      <div className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">РћРќР›РђР™Рќ-Р—РђРџРРЎР¬</p>
            <h2 id="booking-title">Р—Р°РїРёСЃСЊ РІ СЃС‚СѓРґРёСЋ</h2>
            <p>Р’С‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіСѓ Рё СЃРІРѕР±РѕРґРЅРѕРµ РІСЂРµРјСЏ.</p>
          </div>
          <button className="icon-button" onClick={() => setBookingOpen(false)} aria-label="Р—Р°РєСЂС‹С‚СЊ">
            <X />
          </button>
        </div>
        <form onSubmit={submitBooking} className="booking-form">
          <label className="form-label">РЈСЃР»СѓРіР°<select value={selectedService} onChange={e => {
            setSelectedService(e.target.value);
            setSlot(null);
            setBookingAttemptKey(uid());
          }} required>
            <option value="" disabled>Р’С‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіСѓ</option>{activeServices.map(s =>
              <option key={s.id} value={s.id}>{s.title} вЂ” РѕС‚ {money(s.price_from, config.currency)}</option>)}</select>
          </label>{selectedService && <div className="selected-service-summary">
            <span className="selected-service-title">{activeServices.find(s => s.id === selectedService)?.title}</span>
            <div className="selected-service-duration">{durationLabel(activeServices.find(s => s.id === selectedService)?.duration_minutes || 60)}</div>
          </div>}<div className="form-label">
            <div className="field-label-row">
              <span>Р”Р°С‚Р° Рё РІСЂРµРјСЏ</span>
            </div>
            <div className="date-scroller">{Array.from({ length: 10 }, (_, i) => {
              const d = new Date(`${todayISO(config.timezone)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); const iso = d.toISOString().slice(0, 10); return <button type="button" className={`date-chip ${selectedDay === iso ? 'selected' : ''}`} key={iso} onClick={() => { setSelectedDay(iso); setSlot(null); setBookingAttemptKey(uid()); }}>
                <small>{i === 0 ? 'РЎРµРіРѕРґРЅСЏ' : i === 1 ? 'Р—Р°РІС‚СЂР°' : new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(d)}</small>
                <b>{d.getUTCDate()}</b>
                <small>{new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(d)}</small>
              </button>
                ;
})}</div>
            <div className="slots-grid">{slotsLoading ? <p className="slot-message">РС‰РµРј СЃРІРѕР±РѕРґРЅС‹Рµ РѕРєРЅР°вЂ¦</p> : !selectedService ? <p className="slot-message">РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіСѓ.</p> : !(slots.find(d => d.date === selectedDay)?.slots || []).length && !(slots.find(d => d.date === selectedDay)?.busy_slots || []).length ? <p className="slot-message">РќР° СЌС‚Сѓ РґР°С‚Сѓ РЅРµС‚ РґРѕСЃС‚СѓРїРЅС‹С… РѕРєРѕРЅ. Р’С‹Р±РµСЂРёС‚Рµ РґСЂСѓРіРѕР№ РґРµРЅСЊ.</p> : <>{[...(slots.find(d => d.date === selectedDay)?.slots || []).map(s => ({ ...s, busy: false })), ...(slots.find(d => d.date === selectedDay)?.busy_slots || []).map(s => ({ ...s, busy: true }))].sort((a, b) => a.label.localeCompare(b.label)).map((s: any) => <button type="button" disabled={s.busy} className={`slot-chip ${s.busy ? 'busy' : ''} ${slot?.start_at === s.start_at ? 'selected' : ''}`} key={s.start_at || s.label} onClick={() => { if (!s.busy) { setSlot(s); setBookingAttemptKey(uid()); } }}>{s.busy ? <>{s.label}<small>Р—Р°РЅСЏС‚Рѕ</small></> : s.label}</button>)}</>}</div>
          </div>
          <div className="form-divider" />
          <div className="form-two">
            <label className="form-label">Р’Р°С€Рµ РёРјСЏ<input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="РљР°Рє Рє РІР°Рј РѕР±СЂР°С‰Р°С‚СЊСЃСЏ" required minLength={2} />
            </label>
            <label className="form-label">РўРµР»РµС„РѕРЅ<input type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="+7 900 000-00-00" required minLength={5} />
            </label>
          </div>
          <label className="form-label">РђРІС‚РѕРјРѕР±РёР»СЊ<input value={customer.car} onChange={e => setCustomer({ ...customer, car: e.target.value })} placeholder="РњР°СЂРєР° Рё РјРѕРґРµР»СЊ" required minLength={2} />
          </label>
          <label className="form-label">РљРѕРјРјРµРЅС‚Р°СЂРёР№ <span className="optional">(РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)</span>
            <textarea rows={2} value={customer.note} onChange={e => setCustomer({ ...customer, note: e.target.value })} placeholder="РџРѕР¶РµР»Р°РЅРёСЏ РёР»Рё РѕСЃРѕР±РµРЅРЅРѕСЃС‚Рё Р°РІС‚РѕРјРѕР±РёР»СЏ" />
          </label>
          <p className="privacy-note">
            <ShieldCheck size={15} /> Р”Р°РЅРЅС‹Рµ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё СЌС‚РѕР№ Р·Р°РїРёСЃРё.</p>
          <label className="privacy-consent">
            <input type="checkbox" checked={privacyConsent} onChange={e => setPrivacyConsent(e.target.checked)} required />
            <span>РЇ РґР°СЋ СЃРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… РґР»СЏ СЂР°СЃСЃРјРѕС‚СЂРµРЅРёСЏ Р·Р°СЏРІРєРё Рё РѕСЂРіР°РЅРёР·Р°С†РёРё Р·Р°РїРёСЃРё.</span>
          </label>
          <p className="privacy-consent-policy">РџРµСЂРµРґ РѕС‚РїСЂР°РІРєРѕР№ Р·Р°СЏРІРєРё РѕР·РЅР°РєРѕРјСЊС‚РµСЃСЊ СЃ <a href="/privacy-policy" target="_blank" rel="noreferrer">РџРѕР»РёС‚РёРєРѕР№ РѕР±СЂР°Р±РѕС‚РєРё РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С…</a>.</p>
          <button type="submit" className="button primary full confirm-button" disabled={!slot || !selectedService || !privacyConsent || submitting}>{submitting ? 'РџРѕРґС‚РІРµСЂР¶РґР°РµРјвЂ¦' : 'РџРѕРґС‚РІРµСЂРґРёС‚СЊ Р·Р°РїРёСЃСЊ'} <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>}
    {showMyBooking && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowMyBooking(false)}>
      <div className="my-booking-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Р’РђРЁ Р’РР—РРў</p>
            <h2>РњРѕРё Р·Р°РїРёСЃРё</h2>
          </div>
          <button className="icon-button" onClick={() => setShowMyBooking(false)}>
            <X />
          </button>
        </div>{myBooking ? <>
          <div className={`booking-status ${myBooking.booking.status === 'cancelled' ? 'cancelled' : ''}`}>
            <span>{myBooking.booking.status === 'cancelled' ? <X size={18} /> : <Check size={18} />}</span>
            <div>
              <b>{myBooking.booking.status === 'cancelled' ? 'Р—Р°РїРёСЃСЊ РѕС‚РјРµРЅРµРЅР°' : 'Р—Р°РїРёСЃСЊ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°'}</b>
              <small>{myBooking.booking.status === 'cancelled' ? 'Р•СЃР»Рё РїР»Р°РЅС‹ РёР·РјРµРЅСЏС‚СЃСЏ, СЃРѕР·РґР°Р№С‚Рµ РЅРѕРІСѓСЋ Р·Р°РїРёСЃСЊ.' : 'РЎРѕС…СЂР°РЅРёС‚Рµ РґРµС‚Р°Р»Рё РІРёР·РёС‚Р° РёР»Рё РґРѕР±Р°РІСЊС‚Рµ РµРіРѕ РІ РєР°Р»РµРЅРґР°СЂСЊ.'}</small>
            </div>
          </div>
          <div className="booking-details">
            <div>
              <small>РЈРЎР›РЈР“Рђ</small>
              <b>{myBooking.booking.service_title}</b>
            </div>
            <div>
              <small>Р”РђРўРђ Р Р’Р Р•РњРЇ</small>
              <b>{dateTime(myBooking.booking.start_at)}</b>
            </div>
            <div>
              <small>РРњРЇ</small>
              <b>{myBooking.booking.customer_name}</b>
            </div>
            <div>
              <small>РђР’РўРћРњРћР‘РР›Р¬</small>
              <b>{myBooking.booking.car}</b>
            </div>
            <div>
              <small>РўР•Р›Р•Р¤РћРќ</small>
              <b>{myBooking.booking.phone}</b>
            </div>
          </div>
          <div className="booking-actions">
            <a className="button primary full" href={`${API}/public/${route.slug}/booking/${myBooking.booking.public_id}/calendar.ics?token=${encodeURIComponent(myBooking.token)}`}>
              <CalendarDays size={17} /> Р”РѕР±Р°РІРёС‚СЊ РІ РєР°Р»РµРЅРґР°СЂСЊ</a>
            <button className="button soft full" onClick={async () => {
              if (!('Notification' in window)) {
                notify('РЈРІРµРґРѕРјР»РµРЅРёСЏ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ вЂ” РґРѕР±Р°РІСЊС‚Рµ Р·Р°РїРёСЃСЊ РІ РєР°Р»РµРЅРґР°СЂСЊ');
                return;
              } const scheduleReminder = () => {
                const delay = new Date(myBooking.booking.start_at).getTime() - Date.now() - 24 * 60 * 60 * 1000;
                if (delay <= 0) {
                  notify('Р”Рѕ РІРёР·РёС‚Р° РјРµРЅСЊС€Рµ СЃСѓС‚РѕРє. Р”РѕР±Р°РІСЊС‚Рµ Р·Р°РїРёСЃСЊ РІ РєР°Р»РµРЅРґР°СЂСЊ РґР»СЏ РЅР°РїРѕРјРёРЅР°РЅРёСЏ.');
                  return;
                } window.setTimeout(() => { if (Notification.permission === 'granted') new Notification(config.name, { body: `Р—Р°РІС‚СЂР° РІРёР·РёС‚: ${myBooking.booking.service_title} РІ ${myBooking.booking.start_at.slice(11, 16)}` }); }, Math.min(delay, 2147480000));
                notify('РќР°РїРѕРјРёРЅР°РЅРёРµ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРѕ, РїРѕРєР° СЃС‚СЂР°РЅРёС†Р° РѕС‚РєСЂС‹С‚Р°. Р”Р»СЏ РЅР°РґС‘Р¶РЅРѕРіРѕ РЅР°РїРѕРјРёРЅР°РЅРёСЏ РґРѕР±Р°РІСЊС‚Рµ Р·Р°РїРёСЃСЊ РІ РєР°Р»РµРЅРґР°СЂСЊ.');
              };
              if (Notification.permission === 'granted') {
                scheduleReminder();
              } else {
                const p = await Notification.requestPermission();
                if (p === 'granted') scheduleReminder();
                else notify('Р”РѕР±Р°РІСЊС‚Рµ Р·Р°РїРёСЃСЊ РІ РєР°Р»РµРЅРґР°СЂСЊ, С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ РЅР°РґС‘Р¶РЅРѕРµ РЅР°РїРѕРјРёРЅР°РЅРёРµ.');
              }
            }}>
              <BellRing size={17} /> Р’РєР»СЋС‡РёС‚СЊ РЅР°РїРѕРјРёРЅР°РЅРёРµ</button>{['booked', 'confirmed'].includes(myBooking.booking.status) && <button className="cancel-booking" onClick={cancelBooking} disabled={cancelLoading}>{cancelLoading ? 'РћС‚РјРµРЅСЏРµРјвЂ¦' : `РћС‚РјРµРЅРёС‚СЊ Р·Р°РїРёСЃСЊ${config.cancellation_hours ? ` (РЅРµ РїРѕР·РґРЅРµРµ С‡РµРј Р·Р° ${config.cancellation_hours} С‡.)` : ''}`}</button>}</div>
        </> : <div className="no-booking">
          <CalendarDays size={34} />
          <h3>Р—РґРµСЃСЊ РїРѕСЏРІРёС‚СЃСЏ РІР°С€Р° Р·Р°РїРёСЃСЊ</h3>
          <p>РџРѕСЃР»Рµ РѕС‚РїСЂР°РІРєРё Р·Р°СЏРІРєРё РµС‘ РґРµС‚Р°Р»Рё Р±СѓРґСѓС‚ РґРѕСЃС‚СѓРїРЅС‹ Р·РґРµСЃСЊ РЅР° СЌС‚РѕРј СѓСЃС‚СЂРѕР№СЃС‚РІРµ.</p>
          <button className="button primary" onClick={() => {
            setShowMyBooking(false);
            openBooking();
          }}>Р—Р°РїРёСЃР°С‚СЊСЃСЏ <ArrowRight size={16} />
          </button>
        </div>}</div>
    </div>}
    {assistantOpen && <div className="assistant-panel">
      <div className="assistant-head">
        <div className="assistant-avatar">
          <Sparkles size={20} />
        </div>
        <div>
          <b>РџРѕРјРѕС‰РЅРёРє СЃС‚СѓРґРёРё</b>
          <small>
            <span className="live-dot" /> РћС‚РІРµС‡Р°СЋ РїРѕ РґР°РЅРЅС‹Рј {config.name}</small>
        </div>
        <button className="icon-button" onClick={() => setAssistantOpen(false)}>
          <X />
        </button>
      </div>
      <div className="assistant-messages">{(chatMessages.length ? chatMessages : [{ from: 'bot' as const, text: `Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! РЇ РїРѕРјРѕС‰РЅРёРє СЃС‚СѓРґРёРё ${config.name}. Р§С‚Рѕ РїРѕРґСЃРєР°Р·Р°С‚СЊ?` }]).map((m, i) =>
        <div className={`chat-bubble ${m.from}`} key={i}>{m.text}</div>)}</div>
      <div className="assistant-prompts">
        <button onClick={() => sendClientMessage('РљРѕРіРґР° Р±Р»РёР¶Р°Р№С€РµРµ РѕРєРЅРѕ?')}>РљРѕРіРґР° Р±Р»РёР¶Р°Р№С€РµРµ РѕРєРЅРѕ?</button>
        <button onClick={() => sendClientMessage('РЎРєРѕР»СЊРєРѕ СЃС‚РѕРёС‚ РїРѕР»РёСЂРѕРІРєР°?')}>РЎРєРѕР»СЊРєРѕ СЃС‚РѕРёС‚ РїРѕР»РёСЂРѕРІРєР°?</button>
        <button onClick={() => sendClientMessage('РљР°Рє РЅР°Р№С‚Рё СЃС‚СѓРґРёСЋ?')}>РљР°Рє РЅР°Р№С‚Рё СЃС‚СѓРґРёСЋ?</button>
      </div>
      <form className="assistant-input" onSubmit={e => {
        e.preventDefault();
        sendClientMessage(chatInput);
      }}>
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="РќР°РїРёС€РёС‚Рµ РІРѕРїСЂРѕСЃвЂ¦" />
        <button type="submit" disabled={!chatInput.trim()} aria-label="РћС‚РїСЂР°РІРёС‚СЊ">
          <ArrowRight size={19} />
        </button>
      </form>
      <p className="assistant-footnote">РћС‚РІРµС‚С‹ С„РѕСЂРјРёСЂСѓСЋС‚СЃСЏ РїРѕ РїСЂР°Р№СЃСѓ, Р°РґСЂРµСЃСѓ Рё СЃРІРѕР±РѕРґРЅРѕРјСѓ РІСЂРµРјРµРЅРё СЃС‚СѓРґРёРё.</p>
    </div>}
    <button className="assistant-fab" onClick={() => {
      setAssistantOpen(v => !v);
      if (!chatMessages.length) setChatMessages([{ from: 'bot', text: `Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ! РЇ РїРѕРјРѕС‰РЅРёРє СЃС‚СѓРґРёРё ${config.name}. РњРѕРіСѓ РїРѕРґСЃРєР°Р·Р°С‚СЊ С†РµРЅС‹, Р°РґСЂРµСЃ Рё Р±Р»РёР¶Р°Р№С€РёРµ СЃРІРѕР±РѕРґРЅС‹Рµ РѕРєРЅР°.` }]);
    }} aria-label="РћС‚РєСЂС‹С‚СЊ РїРѕРјРѕС‰РЅРёРєР°">
      <MessageCircle size={21} />
      <span>РџРѕРјРѕС‰РЅРёРє</span>
    </button>{toast && <div className="toast">
      <Check size={17} />{toast}</div>}
  </div>;
}

function ArrowUpRightIcon() {
  return <ArrowRight size={17} className="arrow-up-right" />;
}
function BookingTable({ rows, onStatus, onPayment, onReschedule, full = false }: { rows: Booking[]; onStatus: (b: Booking, s: string) => void; onPayment?: (b: Booking, k: 'payment' | 'refund') => void; onReschedule?: (b: Booking) => void; full?: boolean; }) {
  if (!rows.length) return <div className="table-empty">
    <CalendarDays size={28} />
    <b>РџРѕРєР° РЅРµС‚ Р·Р°РїРёСЃРµР№</b>
    <span>РќРѕРІС‹Рµ Р·Р°РїРёСЃРё РєР»РёРµРЅС‚РѕРІ РїРѕСЏРІСЏС‚СЃСЏ Р·РґРµСЃСЊ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.</span>
  </div>;
  return <div className="booking-table-wrap">
    <table className="booking-table">
      <thead>
        <tr>
          <th>Р’СЂРµРјСЏ</th>
          <th>РљР»РёРµРЅС‚ / Р°РІС‚Рѕ</th>
          <th>РЈСЃР»СѓРіР°</th>
          <th>РЎС‚Р°С‚СѓСЃ</th>
          <th>РР·РјРµРЅРёС‚СЊ</th>
          <th>Р”РµР№СЃС‚РІРёСЏ</th>
        </tr>
      </thead>
      <tbody>{rows.map((b, i) =>
        <tr key={b.public_id || i}>
          <td>
            <b>{dateTime(b.start_at)}</b>
            <small>{b.box_id || ''}</small>
          </td>
          <td>
            <b>{b.customer_name}</b>
            <small>{b.car} В· {b.phone}</small>
          </td>
          <td>{b.service_title}</td>
          <td>
            <span className={`status-pill status-${b.status}`}>{({ booked: 'РќРѕРІР°СЏ', confirmed: 'РџРѕРґС‚РІРµСЂР¶РґРµРЅР°', arrived: 'РџСЂРёРЅСЏС‚Р°', in_progress: 'Р’ СЂР°Р±РѕС‚Рµ', ready: 'Р“РѕС‚РѕРІР°', completed: 'Р—Р°РІРµСЂС€РµРЅР°', cancelled: 'РћС‚РјРµРЅРµРЅР°', rejected: 'РћС‚РєР»РѕРЅРµРЅР°' } as Record<string, string>)[b.status] || b.status}</span>
          </td>
          <td>
            <select aria-label="РР·РјРµРЅРёС‚СЊ СЃС‚Р°С‚СѓСЃ" value={b.status} onChange={e => onStatus(b, e.target.value)}>
              <option value="booked">РќРѕРІР°СЏ</option>
              <option value="confirmed">РџРѕРґС‚РІРµСЂР¶РґРµРЅР°</option>
              <option value="arrived">РџСЂРёРЅСЏС‚Р°</option>
              <option value="in_progress">Р’ СЂР°Р±РѕС‚Рµ</option>
              <option value="ready">Р“РѕС‚РѕРІР°</option>
              <option value="completed">Р—Р°РІРµСЂС€РµРЅР°</option>
              <option value="cancelled">РћС‚РјРµРЅРёС‚СЊ</option>
            </select>
          </td>
          <td>
            <div className="payment-actions">
              <button onClick={() => onReschedule?.(b)} title="РџРµСЂРµРЅРµСЃС‚Рё Р·Р°РїРёСЃСЊ">
                <CalendarDays size={14} />
              </button>
              <button onClick={() => onPayment?.(b, 'payment')} title="Р—Р°РїРёСЃР°С‚СЊ РѕРїР»Р°С‚Сѓ">
                <CreditCard size={14} /> +</button>
              <button onClick={() => onPayment?.(b, 'refund')} title="Р—Р°РїРёСЃР°С‚СЊ РІРѕР·РІСЂР°С‚">
                <Minus size={14} /> в†©</button>
            </div>
          </td>
        </tr>)}</tbody>
    </table>
  </div>
    ;
}
export default App;
