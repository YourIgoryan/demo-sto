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
const money = (n: number, currency = '₽') => `${new Intl.NumberFormat('ru-RU').format(n)} ${currency}`;
const dateLabel = (v: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('ru-RU', opts).format(new Date(v));
const dateTime = (v: string) => {
  const [date, time = '00:00'] = v.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const stamp = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return `${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(stamp)} в ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const durationLabel = (minutes: number) => minutes >= 1440 ? `${Math.floor(minutes / 1440)} дн. ${Math.floor(minutes % 1440 / 60)} ч` : minutes >= 60 ? `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}` : `${minutes} мин`;
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
  const data = await r.json().catch(() => ({ detail: 'Ошибка ответа сервера' }));
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
              return `${location || 'Поле'}: ${error.msg}`;
            }
            return JSON.stringify(item);
          }
          return String(item);
        }).join('; ')
        : detail && typeof detail === 'object'
          ? JSON.stringify(detail)
          : 'Не удалось выполнить запрос';
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
  } | null>(() => {
    const storageKey = `autostudio-booking-${route.slug}`;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      const status = String(saved?.booking?.status || '').trim().toLowerCase();
      // A cancelled/rejected booking must not remain in the customer's “Мои записи”.
      if (['cancelled', 'canceled', 'rejected', 'отменена', 'отменено', 'отменён', 'отменено', 'отклонена', 'отклонено'].includes(status)) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return saved;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  });
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
      document.title = `${c.name} — демоверсия`;
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', c.theme_color || '#111311');
      setLoading(false);
      return;
    }
    api<Config>(`/public/${route.slug}/config`).then(c => { setConfig(c); setError(''); document.title = `${c.name} — запись в студию`; let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]'); if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); } link.href = `${API}/public/${route.slug}/manifest.json`; let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]'); if (!apple) { apple = document.createElement('link'); apple.rel = 'apple-touch-icon'; document.head.appendChild(apple); } apple.href = `${API}/public/${route.slug}/icon.png`; const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'); theme?.setAttribute('content', c.theme_color || '#111311'); }).catch(e => setError(e.message)).finally(() => setLoading(false));
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
    const controller = new AbortController();
    setSlotsLoading(true);
    api<{ days: DaySlots[]; }>(
      `/public/${route.slug}/availability?service_id=${encodeURIComponent(selectedService)}&day=${selectedDay}&days=10`,
      { signal: controller.signal, cache: 'no-store' },
    ).then(d => {
      if (!controller.signal.aborted) setSlots(d.days);
    }).catch(e => {
      if (!controller.signal.aborted) {
        setSlots([]);
        setToast(e instanceof Error ? e.message : 'Не удалось загрузить свободное время');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setSlotsLoading(false);
    });
    return () => controller.abort();
  }, [bookingOpen, selectedService, route.slug]);
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
      notify('Подтвердите согласие на обработку персональных данных.');
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
        notify('Демо: форма работает, заявка не отправлялась');
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
      notify('Запись подтверждена')
        ;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Ошибка записи');
      if (e instanceof Error && e.message.toLowerCase().includes('занят')) setSlot(null);
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
      const answer = q.includes('цен') || q.includes('стоим')
        ? `Стоимость услуг — от ${money(Math.min(...DEMO_CONFIG.services.map(x => x.price_from)), DEMO_CONFIG.currency).replace(' ₽', ' ₽')}. Выберите услугу в каталоге для подробностей.`
        : q.includes('адрес') || q.includes('найти')
          ? `Мы находимся по адресу: ${DEMO_CONFIG.address}. Позвоните ${DEMO_CONFIG.phone}, чтобы уточнить детали.`
          : `Это демонстрационный помощник ${DEMO_CONFIG.name}. Могу подсказать по услугам, стоимости и адресу. Для записи используйте кнопку «Записаться».`;
      setChatMessages(prev => [...prev, { from: 'bot', text: answer }]);
      return;
    }
    try {
      const data = await api<{
        answer: string;
      }>(`/public/${route.slug}/assistant`, { method: 'POST', body: JSON.stringify({ message: m }) });
      setChatMessages(prev => [...prev, { from: 'bot', text: data.answer }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { from: 'bot', text: e instanceof Error ? e.message : 'Помощник временно недоступен' }]);
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
      setOwnerError(e instanceof Error ? e.message : 'Ошибка входа');
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
      notify('Настройки сохранены');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }
  async function changeBooking(b: Booking, status: string) {
    try {
      await api(`/owner/${route.slug}/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, ownerToken);
      await refreshOwner();
      notify('Статус обновлён');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Ошибка');
    }
  }
  async function rescheduleBooking(b: Booking) {
    const start_at = window.prompt('Новое время начала (например 2026-10-20T10:00)', b.start_at.slice(0, 16));
    if (!start_at) return;
    try {
      await api(`/owner/${route.slug}/bookings/${b.id}`, { method: 'PATCH', body: JSON.stringify({ start_at }) }, ownerToken);
      await refreshOwner();
      notify('Запись перенесена');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Не удалось перенести запись');
    }
  }
  async function recordPayment(b: Booking, kind: 'payment' | 'refund') {
    const amountText = window.prompt(kind === 'payment' ? 'Сумма полученной оплаты, ₽' : 'Сумма возврата, ₽');
    if (!amountText) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('Введите корректную сумму');
      return;
    } const note = window.prompt('Комментарий к операции (необязательно)') || '';
    try {
      await api(`/owner/${route.slug}/bookings/${b.id}/payments`, { method: 'POST', body: JSON.stringify({ kind, amount: Math.round(amount), note }) }, ownerToken);
      await refreshOwner();
      notify(kind === 'payment' ? 'Оплата записана' : 'Возврат записан');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Ошибка оплаты');
    }
  }
  async function manualAdd() {
    if (!ownerData) return;
    const serviceId = window.prompt('ID услуги из настроек:\n' + ownerData.config.services.map((s: Service) => `${s.id} — ${s.title}`).join('\n'));
    if (!serviceId) return;
    const startAt = window.prompt('Дата и время начала (например 2026-10-20T10:00)');
    if (!startAt) return;
    const customer_name = window.prompt('Имя клиента');
    if (!customer_name) return;
    const phone = window.prompt('Телефон клиента') || '';
    const car = window.prompt('Автомобиль (марка и модель)') || '';
    if (!phone || !car) {
      notify('Телефон и автомобиль обязательны');
      return;
    } try {
      await api(`/owner/${route.slug}/bookings`, { method: 'POST', body: JSON.stringify({ service_id: serviceId, start_at: startAt, customer_name, phone, car }) }, ownerToken);
      await refreshOwner();
      notify('Запись добавлена');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Не удалось создать запись');
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
      setOwnerAnswer(e instanceof Error ? e.message : 'Ошибка помощника');
    }
  }
  async function uploadPhoto(file: File, kind: string, index?: number) {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch(`${API}/owner/${route.slug}/upload?kind=${kind}`, { method: 'POST', headers: { Authorization: `Bearer ${ownerToken}` }, body: form });
    const d = await r.json();
    if (!r.ok) {
      notify(d.detail || 'Ошибка загрузки');
      return;
    } const cfg = { ...ownerData.config };
    if (kind === 'hero') cfg.hero_image = d.url;
    else if (kind === 'logo') cfg.logo = d.url;
    else if (kind === 'gallery' && typeof index === 'number') {
      cfg.gallery = cfg.gallery.map((g: Gallery, i: number) => i === index ? { ...g, image: d.url } : g);
    } else if (kind === 'gallery') cfg.gallery = [...cfg.gallery, { id: uid(), image: d.url, caption: 'Новая работа' }];
    setOwnerData((p: any) => ({ ...p, config: cfg }));
    notify('Фото загружено — сохраните настройки');
  }
  async function cancelBooking() {
    if (!myBooking) return;
    setCancelLoading(true);
    try {
      await api(`/public/${route.slug}/booking/${myBooking.booking.public_id}/cancel`, { method: 'POST', body: JSON.stringify({ token: myBooking.token }) });
      // Remove the cancelled booking from this device as well as cancelling it on the server.
      // The server-side cancellation already frees the time slot; localStorage must not keep a stale card.
      localStorage.removeItem(`autostudio-booking-${route.slug}`);
      setMyBooking(null);
      notify('Запись отменена');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Не удалось отменить');
    } finally {
      setCancelLoading(false);
    }
  }
  const activeServices = (config?.services || []).filter(s => s.active !== false);
  if (window.location.pathname.replace(/\/+$/, '') === '/privacy-policy') return <main className="legal-page">
    <header className="legal-top">
      <a className="legal-brand" href="/">AUTO<span>STUDIO</span></a>
      <a className="legal-back" href="/">← Вернуться на сайт</a>
    </header>
    <article className="legal-document">
      <div className="legal-hero">
        <span className="legal-eyebrow">AUTOSTUDIO / ПРАВОВАЯ ИНФОРМАЦИЯ</span>
        <h1>ПОЛИТИКА<br/><em>ОБРАБОТКИ ПЕРСОНАЛЬНЫХ ДАННЫХ</em></h1>
        <p>Как используются сведения, которые вы оставляете при обращении в студию и оформлении онлайн-записи.</p>
        <div className="legal-meta"><span>Редакция: 18 октября 2026 года</span><span>Для сайта и сервиса онлайн-записи AutoStudio</span></div>
      </div>
      <div className="legal-warning"><strong>Перед публикацией заполните сведения об операторе.</strong><p>Замените все поля в квадратных скобках на реальные реквизиты и проверьте фактические процессы хранения, передачи и удаления данных. Этот шаблон не является юридическим заключением.</p></div>
      <nav className="legal-index" aria-label="Содержание политики">
        <a href="#policy-1">01. Общие положения</a><a href="#policy-2">02. Оператор</a><a href="#policy-3">03. Какие данные обрабатываются</a><a href="#policy-4">04. Цели обработки</a><a href="#policy-5">05. Основания и порядок</a><a href="#policy-6">06. Передача третьим лицам</a><a href="#policy-7">07. Сроки хранения</a><a href="#policy-8">08. Защита данных</a><a href="#policy-9">09. Права пользователя</a><a href="#policy-10">10. Контакты и изменения</a>
      </nav>
      <section id="policy-1"><span className="legal-section-num">01 / ОБЩИЕ ПОЛОЖЕНИЯ</span><h2>О чём этот документ</h2><p>Настоящая Политика обработки персональных данных (далее — «Политика») описывает порядок обработки и защиты персональных данных пользователей сайта и сервиса онлайн-записи AutoStudio (далее — «Сервис»).</p><p>Политика составлена с учётом Федерального закона РФ от 27.07.2006 № 152-ФЗ «О персональных данных». Она применяется к сведениям, которые пользователь предоставляет при оформлении записи, отправке заявки или обращении к оператору через Сервис.</p></section>
      <section id="policy-2"><span className="legal-section-num">02 / ОПЕРАТОР</span><h2>Кто отвечает за данные</h2><p>Оператор персональных данных: <strong>[полное наименование организации или Ф. И. О. индивидуального предпринимателя]</strong>.</p><p>Адрес оператора: <strong>[юридический адрес или адрес регистрации]</strong>.</p><p>Контакт для обращений по вопросам персональных данных: <strong>[рабочий адрес электронной почты]</strong>, телефон: <strong>[контактный номер]</strong>.</p><p>До публикации заполните эти сведения. Не оставляйте в опубликованной версии поля в квадратных скобках.</p></section>
      <section id="policy-3"><span className="legal-section-num">03 / СОСТАВ ДАННЫХ</span><h2>Какие сведения могут обрабатываться</h2><ul><li>имя и номер телефона;</li><li>марка и модель автомобиля;</li><li>выбранная услуга, дата и время записи, выбранный бокс;</li><li>комментарий пользователя к заявке;</li><li>технические сведения, необходимые для работы сайта, его безопасности и диагностики ошибок, например данные браузера и журналы запросов.</li></ul><p>Пожалуйста, не указывайте в комментариях сведения, не относящиеся к записи, в том числе специальные категории персональных данных.</p></section>
      <section id="policy-4"><span className="legal-section-num">04 / ЦЕЛИ ОБРАБОТКИ</span><h2>Для чего используются данные</h2><ul><li>создание, подтверждение, изменение или отмена записи;</li><li>связь с пользователем по вопросам заявки и оказания выбранной услуги;</li><li>учёт загрузки и расписания студии;</li><li>предотвращение злоупотреблений, обеспечение безопасности и стабильной работы Сервиса;</li><li>исполнение обязанностей, предусмотренных законодательством.</li></ul><p>Данные не должны использоваться для рекламных рассылок без отдельного законного основания и, когда требуется, отдельного согласия.</p></section>
      <section id="policy-5"><span className="legal-section-num">05 / ОСНОВАНИЯ И ПОРЯДОК</span><h2>Как осуществляется обработка</h2><p>Основаниями обработки могут быть согласие пользователя, необходимость совершения действий по его запросу до заключения договора, исполнение договора и требования законодательства — в зависимости от конкретной цели.</p><p>Обработка может включать сбор, запись, систематизацию, хранение, уточнение, использование, передачу в случаях, описанных в Политике, блокирование и удаление данных. Согласие на обработку запрашивается отдельно от иных подтверждений интерфейса.</p></section>
      <section id="policy-6"><span className="legal-section-num">06 / ПЕРЕДАЧА ДАННЫХ</span><h2>Кому данные могут передаваться</h2><p>Доступ к данным предоставляется только в объёме, необходимом для работы Сервиса и обработки записи. При фактическом использовании могут привлекаться поставщики хостинга, серверной инфраструктуры, технического обслуживания и сервисов уведомлений.</p><p>Перед публикацией оператор должен указать фактически используемых получателей и проверить условия обработки, локализацию баз данных и трансграничную передачу, если она имеет место. Передача данных не должна осуществляться для целей, несовместимых с указанными в Политике.</p></section>
      <section id="policy-7"><span className="legal-section-num">07 / СРОКИ ХРАНЕНИЯ</span><h2>Как долго хранятся данные</h2><p>Данные хранятся не дольше, чем этого требуют цели обработки, договорные отношения и применимые требования законодательства, после чего удаляются или обезличиваются, если отсутствуют иные законные основания для хранения.</p><p>Оператору необходимо определить и закрепить фактические сроки для заявок, записей, технических журналов и резервных копий с учётом используемой базы данных и настроек резервного копирования.</p></section>
      <section id="policy-8"><span className="legal-section-num">08 / ЗАЩИТА ДАННЫХ</span><h2>Как защищается информация</h2><p>Оператор принимает необходимые организационные и технические меры для защиты данных от неправомерного доступа, изменения, раскрытия, уничтожения и иных неправомерных действий. Конкретные меры должны соответствовать реальной архитектуре Сервиса, настройкам доступа, резервному копированию и используемой инфраструктуре.</p></section>
      <section id="policy-9"><span className="legal-section-num">09 / ПРАВА ПОЛЬЗОВАТЕЛЯ</span><h2>Как направить запрос</h2><p>Пользователь может обратиться к оператору для получения информации об обработке своих данных, уточнения неточных сведений, отзыва согласия или реализации иных прав, предусмотренных законодательством.</p><p>Запрос направляется по контактам, указанным в разделе 2. Для защиты данных оператор вправе запросить информацию, необходимую для подтверждения личности заявителя. Отзыв согласия не отменяет обработку, для которой сохраняется иное законное основание.</p></section>
      <section id="policy-10"><span className="legal-section-num">10 / ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</span><h2>Контакты и обновления</h2><p>Актуальная версия Политики размещается на странице <a href="/privacy-policy">/privacy-policy</a>. При изменении целей, состава данных или порядка обработки Политика обновляется, а в случаях, предусмотренных законом, запрашивается новое согласие.</p><p>Вопросы по обработке персональных данных направляйте оператору по контактам, указанным в разделе 2.</p></section>
      <aside className="legal-note"><strong>Важно перед запуском.</strong> До публикации необходимо заполнить реквизиты оператора, указать реальные контакты и проверить используемые серверы, базу данных, поставщиков хостинга и сервисы уведомлений. Также проверьте, что процессы сайта соответствуют этой Политике и отдельно оформленному согласию.</aside>
    </article>
    <footer className="legal-footer"><span>AUTOSTUDIO · ПЕРСОНАЛЬНЫЕ ДАННЫЕ</span><a href="/">← Вернуться на сайт</a></footer>
  </main>;
  if (loading) return <div className="loader-screen">
    <div className="loader-mark">A</div>
    <span>Подготавливаем студию…</span>
  </div>;
  if (route.owner && DEMO_MODE) return <div className="not-found"><div className="brand-mark"><Wrench /></div><h1>Кабинет недоступен в демоверсии</h1><p>Это публичный демонстрационный сайт.</p></div>;
  if (route.owner) {
    if (!ownerToken) return <div className="owner-login">
      <a className="back-link" href={`/s/${route.slug}/`}>
        <ArrowLeft size={17} /> К странице студии</a>
      <div className="login-card">
        <div className="brand-mark">
          <Wrench size={22} />
        </div>
        <p className="eyebrow">AUTOSTUDIO / OWNER</p>
        <h1>Кабинет студии</h1>
        <p className="muted">Управляйте записями, расписанием и оплатами.</p>
        <form onSubmit={login} className="stack-form">
          <label>Почта<input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoComplete="username" placeholder="owner@studio.ru" />
          </label>
          <label>Пароль<input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required autoComplete="current-password" placeholder="Введите пароль" />
          </label>{ownerError && <p className="error-text">{ownerError}</p>}<button className="button primary full" type="submit">Войти в кабинет <ArrowRight size={17} />
          </button>
        </form>
        <p className="fine-print">Вход доступен только владельцу этой студии.</p>
      </div>
    </div>;
    if (!ownerData) return <div className="loader-screen">Загружаем кабинет…</div>;
    return <div className="owner-shell">
      <aside className="owner-sidebar">
        <a href={`/s/${route.slug}/`} className="owner-brand">
          <span className="brand-mark">
            <Wrench size={21} />
          </span>
          <span>
            <b>{ownerData?.config?.name || 'AutoStudio'}</b>
            <small>Панель управления</small>
          </span>
        </a>
        <nav className="owner-menu">
          <button className={ownerTab === 'overview' ? 'active' : ''} onClick={() => setOwnerTab('overview')}>
            <Gauge size={18} />Обзор</button>
          <button className={ownerTab === 'bookings' ? 'active' : ''} onClick={() => setOwnerTab('bookings')}>
            <CalendarDays size={18} />Записи</button>
          <button className={ownerTab === 'settings' ? 'active' : ''} onClick={() => setOwnerTab('settings')}>
            <Settings2 size={18} />Настройки</button>
          <button className={ownerTab === 'gallery' ? 'active' : ''} onClick={() => setOwnerTab('gallery')}>
            <Camera size={18} />Фотографии</button>
        </nav>
        <div className="owner-side-bottom">
          <span className="online-dot" /> Данные синхронизированы<button onClick={() => {
            sessionStorage.removeItem(`autostudio-owner-${route.slug}`);
            setOwnerToken('');
            setOwnerData(null);
          }}>
            <LogOut size={16} /> Выйти</button>
        </div>
      </aside>
      <main className="owner-main">
        <header className="owner-topbar">
          <div>
            <p className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</p>
            <h1>{ownerTab === 'overview' ? 'Добро пожаловать' : ownerTab === 'bookings' ? 'Записи студии' : ownerTab === 'settings' ? 'Настройки студии' : 'Галерея работ'}</h1>
          </div>
          <a className="button soft" href={`/s/${route.slug}/`} target="_blank" rel="noreferrer">Открыть страницу <ArrowRight size={16} />
          </a>
        </header>
        {ownerTab === 'overview' && <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Заездов сегодня</span>
              <strong>{ownerData?.stats?.today_arrivals || 0}</strong>
              <small>
                <CalendarCheck size={14} /> На сегодня</small>
            </div>
            <div className="stat-card">
              <span>Машин за неделю</span>
              <strong>{ownerData?.stats?.week_arrivals || 0}</strong>
              <small>
                <CarFront size={14} /> Активные записи</small>
            </div>
            <div className="stat-card">
              <span>Завершено работ</span>
              <strong>{ownerData?.stats?.week_completed || 0}</strong>
              <small>
                <Check size={14} /> За эту неделю</small>
            </div>
            <div className="stat-card">
              <span>Получено за неделю</span>
              <strong>{money(ownerData?.stats?.week_received || 0)}</strong>
              <small>
                <Banknote size={14} /> Оплаты минус возвраты</small>
            </div>
          </div>
          <section className="owner-panel">
            <div className="panel-heading">
              <div>
                <h2>Сегодня в студии</h2>
                <p>План заездов и текущий статус работ</p>
              </div>
              <button className="text-button" onClick={() => setOwnerTab('bookings')}>Все записи <ArrowRight size={15} />
              </button>
            </div>
            <BookingTable rows={ownerData?.today || []} onStatus={changeBooking} onPayment={recordPayment} onReschedule={rescheduleBooking} />
          </section>
          <section className="owner-panel assistant-owner">
            <div className="panel-heading">
              <div>
                <h2>
                  <Sparkles size={19} /> Помощник владельца</h2>
                <p>Ответы по фактическим записям и оплатам</p>
              </div>
            </div>
            <div className="owner-ask">
              <input value={ownerQuery} onChange={e => setOwnerQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && askOwner()} placeholder="Например: сколько денег получено?" />
              <button className="button primary" onClick={askOwner}>Спросить <ArrowRight size={16} />
              </button>
            </div>
            <div className="quick-asks">
              <button onClick={() => {
                setOwnerQuery('Что у меня завтра?');
                setTimeout(() => api<{ answer: string; }>(`/owner/${route.slug}/assistant?q=${encodeURIComponent('Что у меня завтра?')}`, {}, ownerToken).then(d => setOwnerAnswer(d.answer)), 0);
              }}>Что у меня завтра?</button>
              <button onClick={() => {
                setOwnerQuery('Сколько машин было на неделе?');
                api<{
                  answer: string;
                }>(`/owner/${route.slug}/assistant?q=${encodeURIComponent('Сколько машин было на неделе?')}`, {}, ownerToken).then(d => setOwnerAnswer(d.answer));
              }}>Машин за неделю</button>
              <button onClick={() => {
                setOwnerQuery('Сколько денег получено?');
                api<{
                  answer: string;
                }>(`/owner/${route.slug}/assistant?q=${encodeURIComponent('Сколько денег получено?')}`, {}, ownerToken).then(d => setOwnerAnswer(d.answer));
              }}>Сколько денег получено?</button>
            </div>{ownerAnswer && <div className="assistant-answer">{ownerAnswer}</div>}</section>
        </>}
        {ownerTab === 'bookings' && <section className="owner-panel">
          <div className="panel-heading">
            <div>
              <h2>Ближайшие записи</h2>
              <p>Данные этой студии, отсортированы по времени</p>
            </div>
            <button className="button primary" onClick={manualAdd}>
              <Plus size={16} /> Добавить запись</button>
          </div>
          <BookingTable rows={ownerData?.week || []} onStatus={changeBooking} onPayment={recordPayment} full />
        </section>}
        {ownerTab === 'settings' && ownerData && <section className="owner-panel settings-panel">
          <div className="panel-heading">
            <div>
              <h2>Основные данные</h2>
              <p>Изменения применятся к публичной странице после сохранения</p>
            </div>
            <button className="button primary" onClick={saveConfig} disabled={saving}>
              <Save size={16} />{saving ? 'Сохраняем…' : 'Сохранить'}</button>
          </div>
          <div className="settings-grid">
            <label>Название студии<input value={ownerData.config.name} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, name: e.target.value } }))} />
            </label>
            <label>Телефон<input value={ownerData.config.phone || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, phone: e.target.value } }))} />
            </label>
            <label className="wide">Описание<textarea rows={3} value={ownerData.config.description || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, description: e.target.value } }))} />
            </label>
            <label className="wide">Адрес<input value={ownerData.config.address || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, address: e.target.value } }))} />
            </label>
            <label className="wide">Ссылка на карту<input value={ownerData.config.map_url || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, map_url: e.target.value } }))} />
            </label>
            <label>Подготовка между машинами, мин<input type="number" min="0" value={ownerData.config.prep_minutes || 0} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, prep_minutes: Number(e.target.value) } }))} />
            </label>
            <label>Отмена не позднее, ч<input type="number" min="0" value={ownerData.config.cancellation_hours || 0} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, cancellation_hours: Number(e.target.value) } }))} />
            </label>
          </div>
          <h3 className="settings-subtitle">Рабочее время</h3>
          <div className="hours-editor">{['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map((day, i) => {
            const h = ownerData.config.hours?.[String(i)] || { closed: true }; return <div className="hours-row" key={day}>
              <b>{day}</b>
              <label className="toggle-label">
                <input type="checkbox" checked={!h.closed} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, hours: { ...p.config.hours, [String(i)]: e.target.checked ? { open: '10:00', close: '19:00' } : { closed: true } } } }))} /> Работает</label>{!h.closed && <>
                  <input type="time" value={h.open || '10:00'} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, hours: { ...p.config.hours, [String(i)]: { ...h, open: e.target.value } } } }))} />
                  <span>—</span>
                  <input type="time" value={h.close || '19:00'} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, hours: { ...p.config.hours, [String(i)]: { ...h, close: e.target.value } } } }))} />
                </>}</div>
              ;
})}</div>
          <h3 className="settings-subtitle">Дополнительные выходные</h3>
          <label className="closed-dates-field">Закрытые даты (через запятую, YYYY-MM-DD)<input value={(ownerData.config.closed_dates || []).join(', ')} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, closed_dates: e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) } }))} placeholder="2026-12-31, 2027-01-01" />
          </label>
          <h3 className="settings-subtitle">Услуги и цены</h3>
          <div className="service-edit-list">{ownerData.config.services.map((s: Service, i: number) =>
            <div className="service-edit" key={s.id}>
              <label>Название<input value={s.title} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, title: e.target.value } : x) } }))} />
              </label>
              <label>Описание<input value={s.description || ''} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, description: e.target.value } : x) } }))} />
              </label>
              <label>Цена от<input type="number" min="0" value={s.price_from} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, price_from: Number(e.target.value) } : x) } }))} />
              </label>
              <label>Длительность, мин<input type="number" min="15" step="15" value={s.duration_minutes} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.map((x: Service, j: number) => j === i ? { ...x, duration_minutes: Number(e.target.value) } : x) } }))} />
              </label>
              <button className="icon-button danger" title="Удалить услугу" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: p.config.services.filter((_: Service, j: number) => j !== i) } }))}>
                <X size={16} />
              </button>
            </div>)}<button className="button soft" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, services: [...p.config.services, { id: `service-${uid()}`, title: 'Новая услуга', description: '', price_from: 0, duration_minutes: 60, active: true }] } }))}>
              <Plus size={16} /> Добавить услугу</button>
          </div>
          <h3 className="settings-subtitle">Боксы</h3>
          <div className="service-edit-list">{ownerData.config.boxes.map((b: any, i: number) =>
            <div className="service-edit" key={b.id}>
              <label>Название бокса<input value={b.title} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: p.config.boxes.map((x: any, j: number) => j === i ? { ...x, title: e.target.value } : x) } }))} />
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={b.active !== false} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: p.config.boxes.map((x: any, j: number) => j === i ? { ...x, active: e.target.checked } : x) } }))} /> Активен</label>
              <button className="icon-button danger" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: p.config.boxes.filter((_: any, j: number) => j !== i) } }))}>
                <X size={16} />
              </button>
            </div>)}<button className="button soft" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, boxes: [...p.config.boxes, { id: `box-${uid()}`, title: `Бокс ${p.config.boxes.length + 1}`, active: true }] } }))}>
              <Plus size={16} /> Добавить бокс</button>
          </div>
          <h3 className="settings-subtitle">Главное фото и информационные карточки</h3>
          <div className="hero-upload">
            <img src={ownerData.config.hero_image} alt="Главное фото" />
            <label className="button soft upload-button">
              <Upload size={16} /> Заменить главное фото<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'hero')} />
            </label>
            <label className="button soft upload-button">
              <Upload size={16} /> Загрузить логотип<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'logo')} />
            </label>
          </div>
          <div className="settings-grid cards-edit">{(ownerData.config.cards || []).map((c: any, i: number) =>
            <div className="info-card-edit" key={i}>
              <b>Карточка {i + 1}</b>
              <label>Заголовок<input value={c.title} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, cards: p.config.cards.map((x: any, j: number) => j === i ? { ...x, title: e.target.value } : x) } }))} />
              </label>
              <label>Текст<textarea rows={3} value={c.text} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, cards: p.config.cards.map((x: any, j: number) => j === i ? { ...x, text: e.target.value } : x) } }))} />
              </label>
            </div>)}</div>
        </section>}
        {ownerTab === 'gallery' && ownerData && <section className="owner-panel">
          <div className="panel-heading">
            <div>
              <h2>Работы студии</h2>
              <p>Фото можно добавлять, заменять по одной и подписывать отдельно</p>
            </div>
            <label className="button primary">
              <Plus size={16} /> Добавить карточку<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'gallery')} />
            </label>
          </div>
          <div className="gallery-admin">{ownerData.config.gallery.map((g: Gallery, i: number) =>
            <div className="gallery-admin-card" key={g.id}>
              <img src={g.image} alt={g.caption} />
              <div className="gallery-admin-body">
                <label>Подпись<input value={g.caption} onChange={e => setOwnerData((p: any) => ({ ...p, config: { ...p.config, gallery: p.config.gallery.map((x: Gallery, j: number) => j === i ? { ...x, caption: e.target.value } : x) } }))} />
                </label>
                <div className="gallery-actions">
                  <label className="button soft small">
                    <Camera size={15} /> Заменить фото<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'gallery', i)} />
                  </label>
                  <button className="button danger-soft small" onClick={() => setOwnerData((p: any) => ({ ...p, config: { ...p.config, gallery: p.config.gallery.filter((_: Gallery, j: number) => j !== i) } }))}>
                    <X size={15} /> Удалить</button>
                </div>
              </div>
            </div>)}</div>
          <div className="save-gallery">
            <button className="button primary" onClick={saveConfig} disabled={saving}>
              <Save size={16} /> Сохранить изменения галереи</button>
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
    <h1>Студия пока недоступна</h1>
    <p>{error || 'Не удалось загрузить настройки.'}</p>
    <span>Проверьте ссылку или обратитесь к владельцу студии.</span>
  </div>;
  return <div className="app-shell" style={{ '--accent': config.theme_color || '#c8f169' } as CSSProperties}>
    {DEMO_MODE && <div className="demo-ribbon">ДЕМОВЕРСИЯ · заявки не отправляются</div>}
    <header className="topbar">
      <a className="brand" href="#top" onClick={() => setSection('home')}>
        <span className="brand-symbol">{config.logo ? <img src={config.logo} alt="" /> : <Wrench size={19} />}</span>
        <span>
          <b>{config.name}</b>
          <small>CARE · DETAIL · DRIVE</small>
        </span>
      </a>
      <nav className="desktop-nav">
        <button className={section === 'home' ? 'active' : ''} onClick={() => {
          setSection('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}><span className="desktop-nav-label">Главная</span></button>
        <button className={section === 'services' ? 'active' : ''} onClick={() => {
          setSection('services');
          document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
        }}><span className="desktop-nav-label">Услуги</span></button>
        <button className={section === 'mine' ? 'active' : ''} onClick={() => {
          setSection('mine');
          setShowMyBooking(true);
        }}><CalendarCheck size={17} /><span className="desktop-nav-label">Мои записи</span></button>
        <button onClick={() => {
          setAssistantOpen(true);
          if (!chatMessages.length) setChatMessages([{ from: 'bot', text: `Здравствуйте! Я помощник студии ${config.name}. Могу подсказать цены, адрес и ближайшие свободные окна.` }]);
        }}><span className="desktop-nav-label">Помощник</span><MessageCircle size={15} />
        </button>
      </nav>
      <div className="top-actions">{installPrompt && <button className="button soft install-button" onClick={async () => {
        await installPrompt.prompt();
        setInstallPrompt(null);
      }}>Установить <Plus size={14} />
      </button>}<a className="phone-link" href={`tel:${config.phone.replace(/[^+\d]/g, '')}`}>
          <Phone size={15} />{config.phone}</a>
        <a
          className="owner-shortcut"
          href={appPath(`owner/${route.slug}/`)}
          aria-label="Кабинет владельца"
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
            <span className="live-dot" /> ПРЕМИАЛЬНЫЙ УХОД ЗА АВТОМОБИЛЕМ</div>
          <h1>{config.name}<br />
            <em>в деталях.</em>
          </h1>
          <p>{config.description}</p>
          <div className="hero-badges">
            <span>
              <ShieldCheck size={16} /> Бережный уход</span>
            <span>
              <Sparkles size={16} /> Премиум-составы</span>
          </div>
          <button className="hero-book glass-button" onClick={() => openBooking()}>
            <span>
              <CalendarCheck size={20} />
            </span>
            <b>Записаться</b>
            <ArrowDownRight size={22} />
          </button>
          <div className="hero-footnote">
            <span>01 / CARE THAT SHOWS</span>
            <span>Листайте, чтобы узнать больше <ArrowRight size={14} />
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
            <b>Внимание к деталям</b>
            <small>Точный подход к каждому авто</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Clock3 />
          </span>
          <span>
            <b>По записи</b>
            <small>Без ожидания в очереди</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Wrench />
          </span>
          <span>
            <b>Понятный прайс</b>
            <small>Стоимость до начала работ</small>
          </span>
        </div>
        <div className="strip-number">
          <b>01—04</b>
          <small>НАШ ПОДХОД</small>
        </div>
      </section>
      <section className="section services-section" id="services">
        <div className="section-heading reveal">
          <div>
            <p className="eyebrow">УСЛУГИ / 01</p>
            <h2>Уход, который<br />
              <em>видно сразу.</em>
            </h2>
          </div>
          <p className="section-intro">Выберите услугу — покажем актуальную стоимость, длительность и доступное время для визита.</p>
        </div>
        <div className="service-grid">{activeServices.map((s, i) =>
          <article className="service-card reveal" key={s.id}>
            <div className="service-image">{s.image ? <img src={s.image} alt={s.title} loading="lazy" decoding="async" fetchPriority="low" /> : <div className="service-image-placeholder">
              <Wrench size={34} />
            </div>}<span className="service-number">0{i + 1}</span>
              <button className="circle-arrow" aria-label={`Записаться: ${s.title}`} onClick={() => openBooking(s.id)}>
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
                <span>от <b>{money(s.price_from, config.currency)}</b>
                </span>
                <button onClick={() => openBooking(s.id)}>Выбрать <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </article>)}</div>
        <div className="service-bottom-note">
          <span>
            <CircleHelp size={16} /> Стоимость может зависеть от класса и состояния автомобиля.</span>
          <button onClick={() => {
            setAssistantOpen(true);
            setChatMessages([{ from: 'bot', text: `Здравствуйте! Спросите меня о стоимости любой услуги в ${config.name}.` }]);
          }}>Спросить помощника <MessageCircle size={15} />
          </button>
        </div>
      </section>
      <section className="section why-section">
        <div className="why-visual reveal">
          <img src={config.gallery[0]?.image || config.hero_image} alt="Детейлинг автомобиля" loading="lazy" decoding="async" fetchPriority="low" />
          <div className="image-caption">
            <span>DETAILS MATTER</span>
            <b>Каждая линия имеет значение.</b>
          </div>
          <span className="visual-index">FIG. 01 — PROCESS</span>
        </div>
        <div className="why-content reveal">
          <p className="eyebrow">НАШ ПОДХОД / 02</p>
          <h2>Не просто чисто.<br />
            <em>По-настоящему</em>
            <br />бережно.</h2>
          <p className="why-copy">Мы работаем с автомобилем как с системой деталей: от подготовки поверхности до финального контроля результата.</p>
          <div className="info-cards">{(config.cards || []).map((c, i) =>
            <div className="info-card" key={i}>
              <span>0{i + 1}</span>
              <div>
                <b>{c.title}</b>
                <p>{c.text}</p>
              </div>
              <ArrowUpRightIcon />
            </div>)}</div>
          <button className="button outline" onClick={() => openBooking()}>Подобрать время <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="section gallery-section" id="works">
        <div className="section-heading reveal">
          <div>
            <p className="eyebrow">ПОРТФОЛИО / 03</p>
            <h2>Результат говорит<br />
              <em>сам за себя.</em>
            </h2>
          </div>
          <p className="section-intro">Несколько деталей нашей работы. Каждый автомобиль требует своего решения и внимательного подхода.</p>
        </div>
        <div className="gallery-grid">{(config.gallery || []).map((g, i) =>
          <article className={`gallery-card gallery-card-${i % 3} reveal`} key={g.id}>
            <img src={g.image} alt={g.caption} loading="lazy" decoding="async" fetchPriority="low" />
            <div className="gallery-overlay">
              <span>РАБОТА / 0{i + 1}</span>
              <b>{g.caption}</b>
              <ArrowUpRightIcon />
            </div>
          </article>)}</div>{!config.gallery?.length && <div className="empty-gallery">Фотографии работ скоро появятся.</div>}</section>
      <section className="booking-banner reveal">
        <div>
          <p className="eyebrow">ВАШ АВТОМОБИЛЬ ГОТОВ К ПЕРЕМЕНАМ?</p>
          <h2>Запланируем<br />
            <em>идеальный уход.</em>
          </h2>
        </div>
        <button className="glass-button banner-book" onClick={() => openBooking()}>
          <span>
            <CalendarCheck size={20} />
          </span>
          <b>Записаться в студию</b>
          <ArrowDownRight size={22} />
        </button>
        <div className="banner-watermark">DETAIL<br />LAB.</div>
      </section>
      <section className="section contact-section">
        <div className="contact-main reveal">
          <p className="eyebrow">КОНТАКТЫ / 04</p>
          <h2>Заезжайте<br />
            <em>на результат.</em>
          </h2>
          <p className="contact-copy">Будем рады подобрать услугу и удобное время для вашего автомобиля.</p>
          <div className="contact-location-row">
            <a className="contact-address" href={`https://yandex.ru/maps/?text=${encodeURIComponent(config.address || '')}`} target="_blank" rel="noreferrer">
              <span>
                <MapPin size={20} />
              </span>
              <div>
                <small>АДРЕС СТУДИИ</small>
                <b>{config.address}</b>
                <em>Построить маршрут <ArrowUpRightIcon /></em>
              </div>
            </a>
            <div className="contact-map-frame">
              <iframe
                title={`Яндекс Карты — ${config.address}`}
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
              <small>ПОЗВОНИТЬ НАМ</small>
              <b>{config.phone}</b>
            </div>
          </a>
        </div>
        <div className="hours-panel reveal">
          <div className="panel-title">
            <Clock3 size={19} />
            <h3>Время работы</h3>
          </div>{['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map((day, i) => {
            const h = config.hours?.[String(i)]; return <div className={`hours-line ${h?.closed || !h ? 'closed' : ''}`} key={day}>
              <span>{day}</span>
              <b>{!h || h.closed ? 'Выходной' : `${h.open} — ${h.close}`}</b>
            </div>
              ;
})}<div className="hours-foot">
            <span className="live-dot" /> Запись онлайн доступна круглосуточно</div>
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
          <small>CARE · DETAIL · DRIVE</small>
        </span>
      </a>
      <span>Качественный уход начинается с внимания к деталям.</span>
      <a className="footer-policy-link" href="/privacy-policy" target="_blank" rel="noreferrer">Политика обработки персональных данных</a>
      <span>В© {new Date().getFullYear()} {config.name}</span>
    </footer>
    <nav className="mobile-nav" aria-label="Основная навигация">
      <button className={section === 'home' ? 'active' : ''} onClick={() => {
        setSection('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}>
        <Home size={20} />
        <span>Главная</span>
      </button>
      <button className={section === 'services' ? 'active' : ''} onClick={() => {
        setSection('services');
        document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
      }}>
        <Wrench size={20} />
        <span>Услуги</span>
      </button>
      <button className={section === 'mine' ? 'active' : ''} onClick={() => {
        setSection('mine');
        setShowMyBooking(true);
      }}>
        <CalendarCheck size={20} />
        <span>Мои записи</span>
      </button>
    </nav>
    {bookingOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setBookingOpen(false)}>
      <div className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">ОНЛАЙН-ЗАПИСЬ</p>
            <h2 id="booking-title">Запись в студию</h2>
            <p>Выберите услугу и свободное время.</p>
          </div>
          <button className="icon-button" onClick={() => setBookingOpen(false)} aria-label="Закрыть">
            <X />
          </button>
        </div>
        <form onSubmit={submitBooking} className="booking-form">
          <label className="form-label">Услуга<select value={selectedService} onChange={e => {
            setSelectedService(e.target.value);
            setSlot(null);
            setBookingAttemptKey(uid());
          }} required>
            <option value="" disabled>Выберите услугу</option>{activeServices.map(s =>
              <option key={s.id} value={s.id}>{s.title} — от {money(s.price_from, config.currency)}</option>)}</select>
          </label>{selectedService && <div className="selected-service-summary">
            <span className="selected-service-title">{activeServices.find(s => s.id === selectedService)?.title}</span>
            <div className="selected-service-duration">{durationLabel(activeServices.find(s => s.id === selectedService)?.duration_minutes || 60)}</div>
          </div>}<div className="form-label">
            <div className="field-label-row">
              <span>Дата и время</span>
            </div>
            <div className="date-scroller">{Array.from({ length: 10 }, (_, i) => {
              const d = new Date(`${todayISO(config.timezone)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); const iso = d.toISOString().slice(0, 10); return <button type="button" className={`date-chip ${selectedDay === iso ? 'selected' : ''}`} key={iso} onClick={() => { setSelectedDay(iso); setSlot(null); setBookingAttemptKey(uid()); }}>
                <small>{i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(d)}</small>
                <b>{d.getUTCDate()}</b>
                <small>{new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(d)}</small>
              </button>
                ;
})}</div>
            <div className="slots-grid">{slotsLoading ? <p className="slot-message">Ищем свободные окна…</p> : !selectedService ? <p className="slot-message">Сначала выберите услугу.</p> : !(slots.find(d => d.date === selectedDay)?.slots || []).length && !(slots.find(d => d.date === selectedDay)?.busy_slots || []).length ? <p className="slot-message">На эту дату нет доступных окон. Выберите другой день.</p> : <>{[...(slots.find(d => d.date === selectedDay)?.slots || []).map(s => ({ ...s, busy: false })), ...(slots.find(d => d.date === selectedDay)?.busy_slots || []).map(s => ({ ...s, busy: true }))].sort((a, b) => a.label.localeCompare(b.label)).map((s: any) => <button type="button" disabled={s.busy} className={`slot-chip ${s.busy ? 'busy' : ''} ${slot?.start_at === s.start_at ? 'selected' : ''}`} key={s.start_at || s.label} onClick={() => { if (!s.busy) { setSlot(s); setBookingAttemptKey(uid()); } }}>{s.busy ? <>{s.label}<small>Занято</small></> : s.label}</button>)}</>}</div>
          </div>
          <div className="form-divider" />
          <div className="form-two">
            <label className="form-label">Ваше имя<input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="Как к вам обращаться" required minLength={2} />
            </label>
            <label className="form-label">Телефон<input type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="+7 900 000-00-00" required minLength={5} />
            </label>
          </div>
          <label className="form-label">Автомобиль<input value={customer.car} onChange={e => setCustomer({ ...customer, car: e.target.value })} placeholder="Марка и модель" required minLength={2} />
          </label>
          <label className="form-label">Комментарий <span className="optional">(необязательно)</span>
            <textarea rows={2} value={customer.note} onChange={e => setCustomer({ ...customer, note: e.target.value })} placeholder="Пожелания или особенности автомобиля" />
          </label>
          <p className="privacy-note">
            <ShieldCheck size={15} /> Данные используются только для обработки этой записи.</p>
          <label className="privacy-consent">
            <input type="checkbox" checked={privacyConsent} onChange={e => setPrivacyConsent(e.target.checked)} required />
            <span>Я даю согласие на обработку персональных данных для рассмотрения заявки и организации записи.</span>
          </label>
          <p className="privacy-consent-policy">Перед отправкой заявки ознакомьтесь с <a href="/privacy-policy" target="_blank" rel="noreferrer">Политикой обработки персональных данных</a>.</p>
          <button type="submit" className="button primary full confirm-button" disabled={!slot || !selectedService || !privacyConsent || submitting}>{submitting ? 'Подтверждаем…' : 'Подтвердить запись'} <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>}
    {showMyBooking && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowMyBooking(false)}>
      <div className="my-booking-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">ВАШ ВИЗИТ</p>
            <h2>Мои записи</h2>
          </div>
          <button className="icon-button" onClick={() => setShowMyBooking(false)}>
            <X />
          </button>
        </div>{myBooking ? <>
          <div className={`booking-status ${myBooking.booking.status === 'cancelled' ? 'cancelled' : ''}`}>
            <span>{myBooking.booking.status === 'cancelled' ? <X size={18} /> : <Check size={18} />}</span>
            <div>
              <b>{myBooking.booking.status === 'cancelled' ? 'Запись отменена' : 'Запись подтверждена'}</b>
              <small>{myBooking.booking.status === 'cancelled' ? 'Если планы изменятся, создайте новую запись.' : 'Сохраните детали визита или добавьте его в календарь.'}</small>
            </div>
          </div>
          <div className="booking-details">
            <div>
              <small>УСЛУГА</small>
              <b>{myBooking.booking.service_title}</b>
            </div>
            <div>
              <small>ДАТА И ВРЕМЯ</small>
              <b>{dateTime(myBooking.booking.start_at)}</b>
            </div>
            <div>
              <small>ИМЯ</small>
              <b>{myBooking.booking.customer_name}</b>
            </div>
            <div>
              <small>АВТОМОБИЛЬ</small>
              <b>{myBooking.booking.car}</b>
            </div>
            <div>
              <small>ТЕЛЕФОН</small>
              <b>{myBooking.booking.phone}</b>
            </div>
          </div>
          <div className="booking-actions">
            <a className="button primary full" href={`${API}/public/${route.slug}/booking/${myBooking.booking.public_id}/calendar.ics?token=${encodeURIComponent(myBooking.token)}`}>
              <CalendarDays size={17} /> Добавить в календарь</a>
            <button className="button soft full" onClick={async () => {
              if (!('Notification' in window)) {
                notify('Уведомления не поддерживаются — добавьте запись в календарь');
                return;
              } const scheduleReminder = () => {
                const delay = new Date(myBooking.booking.start_at).getTime() - Date.now() - 24 * 60 * 60 * 1000;
                if (delay <= 0) {
                  notify('До визита меньше суток. Добавьте запись в календарь для напоминания.');
                  return;
                } window.setTimeout(() => { if (Notification.permission === 'granted') new Notification(config.name, { body: `Завтра визит: ${myBooking.booking.service_title} в ${myBooking.booking.start_at.slice(11, 16)}` }); }, Math.min(delay, 2147480000));
                notify('Напоминание запланировано, пока страница открыта. Для надёжного напоминания добавьте запись в календарь.');
              };
              if (Notification.permission === 'granted') {
                scheduleReminder();
              } else {
                const p = await Notification.requestPermission();
                if (p === 'granted') scheduleReminder();
                else notify('Добавьте запись в календарь, чтобы получить надёжное напоминание.');
              }
            }}>
              <BellRing size={17} /> Включить напоминание</button>{['booked', 'confirmed'].includes(myBooking.booking.status) && <button className="cancel-booking" onClick={cancelBooking} disabled={cancelLoading}>{cancelLoading ? 'Отменяем…' : `Отменить запись${config.cancellation_hours ? ` (не позднее чем за ${config.cancellation_hours} ч.)` : ''}`}</button>}</div>
        </> : <div className="no-booking">
          <CalendarDays size={34} />
          <h3>Здесь появится ваша запись</h3>
          <p>После отправки заявки её детали будут доступны здесь на этом устройстве.</p>
          <button className="button primary" onClick={() => {
            setShowMyBooking(false);
            openBooking();
          }}>Записаться <ArrowRight size={16} />
          </button>
        </div>}</div>
    </div>}
    {assistantOpen && <div className="assistant-panel">
      <div className="assistant-head">
        <div className="assistant-avatar">
          <Sparkles size={20} />
        </div>
        <div>
          <b>Помощник студии</b>
          <small>
            <span className="live-dot" /> Отвечаю по данным {config.name}</small>
        </div>
        <button className="icon-button" onClick={() => setAssistantOpen(false)}>
          <X />
        </button>
      </div>
      <div className="assistant-messages">{(chatMessages.length ? chatMessages : [{ from: 'bot' as const, text: `Здравствуйте! Я помощник студии ${config.name}. Что подсказать?` }]).map((m, i) =>
        <div className={`chat-bubble ${m.from}`} key={i}>{m.text}</div>)}</div>
      <div className="assistant-prompts">
        <button onClick={() => sendClientMessage('Когда ближайшее окно?')}>Когда ближайшее окно?</button>
        <button onClick={() => sendClientMessage('Сколько стоит полировка?')}>Сколько стоит полировка?</button>
        <button onClick={() => sendClientMessage('Как найти студию?')}>Как найти студию?</button>
      </div>
      <form className="assistant-input" onSubmit={e => {
        e.preventDefault();
        sendClientMessage(chatInput);
      }}>
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Напишите вопрос…" />
        <button type="submit" disabled={!chatInput.trim()} aria-label="Отправить">
          <ArrowRight size={19} />
        </button>
      </form>
      <p className="assistant-footnote">Ответы формируются по прайсу, адресу и свободному времени студии.</p>
    </div>}
    <button className="assistant-fab" onClick={() => {
      setAssistantOpen(v => !v);
      if (!chatMessages.length) setChatMessages([{ from: 'bot', text: `Здравствуйте! Я помощник студии ${config.name}. Могу подсказать цены, адрес и ближайшие свободные окна.` }]);
    }} aria-label="Открыть помощника">
      <MessageCircle size={21} />
      <span>Помощник</span>
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
    <b>Пока нет записей</b>
    <span>Новые записи клиентов появятся здесь автоматически.</span>
  </div>;
  return <div className="booking-table-wrap">
    <table className="booking-table">
      <thead>
        <tr>
          <th>Время</th>
          <th>Клиент / авто</th>
          <th>Услуга</th>
          <th>Статус</th>
          <th>Изменить</th>
          <th>Действия</th>
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
            <small>{b.car} · {b.phone}</small>
          </td>
          <td>{b.service_title}</td>
          <td>
            <span className={`status-pill status-${b.status}`}>{({ booked: 'Новая', confirmed: 'Подтверждена', arrived: 'Принята', in_progress: 'В работе', ready: 'Готова', completed: 'Завершена', cancelled: 'Отменена', rejected: 'Отклонена' } as Record<string, string>)[b.status] || b.status}</span>
          </td>
          <td>
            <select aria-label="Изменить статус" value={b.status} onChange={e => onStatus(b, e.target.value)}>
              <option value="booked">Новая</option>
              <option value="confirmed">Подтверждена</option>
              <option value="arrived">Принята</option>
              <option value="in_progress">В работе</option>
              <option value="ready">Готова</option>
              <option value="completed">Завершена</option>
              <option value="cancelled">Отменить</option>
            </select>
          </td>
          <td>
            <div className="payment-actions">
              <button onClick={() => onReschedule?.(b)} title="Перенести запись">
                <CalendarDays size={14} />
              </button>
              <button onClick={() => onPayment?.(b, 'payment')} title="Записать оплату">
                <CreditCard size={14} /> +</button>
              <button onClick={() => onPayment?.(b, 'refund')} title="Записать возврат">
                <Minus size={14} /> ↩</button>
            </div>
          </td>
        </tr>)}</tbody>
    </table>
  </div>
    ;
}
export default App;
