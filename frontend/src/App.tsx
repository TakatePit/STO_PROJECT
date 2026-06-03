import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { api, formatCurrency } from './lib/api';
import type { Role } from './lib/roles';
import { roleSections } from './lib/roles';

type User = { id: number; email?: string; role: Role; client_id?: number };
type Client = { id: number; full_name: string; phone: string; notes: string };
type ClientCard = Client & { vehicles: Vehicle[] };
type Vehicle = { id: number; client_id: number; brand: string; model: string; vin: string; plate: string; year: number | null; owner_name?: string };
type OrderItemRow = { id: number; service_title: string; qty: number; unit_price: number; line_total: number };
type Order = {
  id: number;
  status: string;
  description: string;
  total_cost: number;
  brand?: string;
  model?: string;
  plate?: string;
  vehicle_id: number;
  items?: OrderItemRow[];
};
type Service = { id: number; title: string; price: number; type: string; is_active?: boolean };
type Appointment = { id: number; client_id?: number; vehicle_id?: number | null; starts_at: string; ends_at: string; status: string; comment: string; client_name?: string };

type PortalProfile = { profile: { id: number; full_name: string; phone: string; notes: string; email: string } | null; vehicles: Vehicle[] };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function mondayYmdFromDate(from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return ymdFromDate(d);
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, dd] = ymd.split('-').map(Number);
  return new Date(y, m - 1, dd);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmdLocal(ymd);
  d.setDate(d.getDate() + days);
  return ymdFromDate(d);
}

function datetimeLocalFromParts(ymd: string, hour: number, minute: number): string {
  return `${ymd}T${pad2(hour)}:${pad2(minute)}`;
}

function formatHm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const CAL_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const CAL_QUICK_HOURS = [9, 11, 13, 15, 17];

const ORDER_COLUMNS = [
  { id: 'new', label: 'Нові' },
  { id: 'in_progress', label: 'У роботі' },
  { id: 'done', label: 'Завершені' },
  { id: 'cancelled', label: 'Скасовані' },
];

const STATUS_UA_LABELS = {
  new: 'Нове',
  in_progress: 'У роботі',
  done: 'Завершене',
  cancelled: 'Скасоване',
  pending: 'Очікує підтвердження',
  confirmed: 'Підтверджене',
};

function statusUa(status: string) {
  return STATUS_UA_LABELS[status as keyof typeof STATUS_UA_LABELS] || status;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('sto_token') || '');
  const [role, setRole] = useState<Role>(() => (localStorage.getItem('sto_role') as Role) || 'admin');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<string>(() => localStorage.getItem('sto_screen') || 'dashboard');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  /** Після перезавантаження сторінки з токеном чекаємо /auth/me */
  const [sessionReady, setSessionReady] = useState(() => !localStorage.getItem('sto_token'));
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('sto_sidebar_open') !== 'false';
  });
  const [registerForm, setRegisterForm] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [portalProfile, setPortalProfile] = useState<PortalProfile | null>(null);
  const [portalOrders, setPortalOrders] = useState<Order[]>([]);
  const [profileForm, setProfileForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [dragOrderId, setDragOrderId] = useState<number | null>(null);
  const [clientProfileForm, setClientProfileForm] = useState({ full_name: '', phone: '' });
  const [clientVehicleForm, setClientVehicleForm] = useState({ brand: '', model: '', vin: '', plate: '', year: '' });
  const [services, setServices] = useState<Service[]>([]);
  const [serviceForm, setServiceForm] = useState({ title: '', price: '', type: 'work' as 'work' | 'part' });
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [orderLineDrafts, setOrderLineDrafts] = useState<Record<number, { service_id: number; qty: number }>>({});

  const [clientForm, setClientForm] = useState({ id: 0, full_name: '', phone: '', notes: '' });
  const [vehicleForm, setVehicleForm] = useState({ id: 0, client_id: 0, brand: '', model: '', vin: '', plate: '', year: '' });
  const [orderForm, setOrderForm] = useState({ vehicle_id: 0, description: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [clientPhoneFilter, setClientPhoneFilter] = useState('');
  const [clientCard, setClientCard] = useState<ClientCard | null>(null);
  const [clientCardLoading, setClientCardLoading] = useState(false);
  const [clientCardError, setClientCardError] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'done' | 'cancelled'>('all');
  const [orderVehicleFilter, setOrderVehicleFilter] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({ client_id: 0, vehicle_id: 0, starts_at: '', ends_at: '', comment: '' });
  const [calendarWeekMonday, setCalendarWeekMonday] = useState(() => mondayYmdFromDate(new Date()));

  const todayCalendarYmd = ymdFromDate(new Date());
  const clientVehicles = useMemo(() => vehicles.filter((v) => v.client_id === Number(vehicleForm.client_id || 0)), [vehicles, vehicleForm.client_id]);
  const appointmentVehicles = useMemo(
    () => vehicles.filter((v) => v.client_id === Number(appointmentForm.client_id || 0)),
    [vehicles, appointmentForm.client_id],
  );

  const calendarWeekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysYmd(calendarWeekMonday, i)),
    [calendarWeekMonday],
  );

  const appointmentsByCalendarDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (let i = 0; i < 7; i += 1) {
      m.set(addDaysYmd(calendarWeekMonday, i), []);
    }
    for (const a of appointments) {
      const key = ymdFromDate(new Date(a.starts_at));
      if (!m.has(key)) continue;
      m.get(key)!.push(a);
    }
    for (const list of m.values()) {
      list.sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
    }
    return m;
  }, [appointments, calendarWeekMonday]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const p = clientPhoneFilter.trim();
    return clients.filter((c) => {
      const nameHit = q === '' || c.full_name.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q);
      const phoneHit = p === '' || c.phone.includes(p);
      return nameHit && phoneHit;
    });
  }, [clients, clientSearch, clientPhoneFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      const statusHit = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      const vehicleHit = orderVehicleFilter === 0 || o.vehicle_id === orderVehicleFilter;
      const text = `${o.id} ${o.brand || ''} ${o.model || ''} ${o.plate || ''} ${o.description || ''}`.toLowerCase();
      const queryHit = q === '' || text.includes(q);
      return statusHit && vehicleHit && queryHit;
    });
  }, [orders, orderSearch, orderStatusFilter, orderVehicleFilter]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) || null : null),
    [orders, selectedOrderId],
  );

  const dashboardStats = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status === 'new' || o.status === 'in_progress').length;
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 7);
    const recentAppointments = appointments.filter((a) => new Date(a.starts_at) >= weekStart).length;
    const revenue = orders.reduce((acc, o) => acc + Number(o.total_cost || 0), 0);
    return {
      clients: clients.length,
      vehicles: vehicles.length,
      activeOrders,
      orders: orders.length,
      recentAppointments,
      revenue,
    };
  }, [clients, vehicles, orders, appointments]);

  function applyCalendarQuickSlot(ymd: string, startHour: number) {
    const start = datetimeLocalFromParts(ymd, startHour, 0);
    const end = datetimeLocalFromParts(ymd, startHour + 1, 0);
    setAppointmentForm((s) => ({ ...s, starts_at: start, ends_at: end }));
  }

  useEffect(() => {
    localStorage.setItem('sto_token', token);
    localStorage.setItem('sto_role', role);
    localStorage.setItem('sto_screen', screen);
  }, [token, role, screen]);

  useEffect(() => {
    localStorage.setItem('sto_sidebar_open', sidebarOpen ? 'true' : 'false');
  }, [sidebarOpen]);

  useEffect(() => {
    if (!token) {
      setSessionReady(true);
      return;
    }
    setSessionReady(false);
    let cancelled = false;
    api<User>('/auth/me', { token })
      .then((me) => {
        if (cancelled || !me) return;
        setCurrentUser(me);
        setRole(me.role);
      })
      .catch(() => {
        if (!cancelled) doLogout();
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const allowed = roleSections[role].map((item) => item.id);
    setScreen((current) => (allowed.includes(current) ? current : allowed[0]));
  }, [token, role]);

  useEffect(() => {
    if (screen !== 'clients' || !clientCard?.id) return;
    const refreshed = buildClientCardFromLocal(clientCard.id);
    if (refreshed) setClientCard(refreshed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- оновлення списку авто на картці
  }, [clients, vehicles, screen]);

  async function guarded<T>(task: () => Promise<T>) {
    setError('');
    setMessage('');
    try {
      return await task();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    }
  }

  async function doLogin() {
    const res = await guarded(() => api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email: authEmail, password: authPassword } }));
    if (!res) return;
    setToken(res.token);
    setCurrentUser(res.user);
    setRole(res.user.role);
    setScreen(res.user.role === 'client' ? 'portal' : 'dashboard');
    setMessage('Успішний вхід');
  }

  async function doRegister() {
    const { full_name, phone, email, password } = registerForm;
    if (!full_name.trim() || !phone.trim() || !email.trim() || !password) {
      return setError('Заповніть усі поля реєстрації');
    }
    const res = await guarded(() =>
      api<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: { full_name: full_name.trim(), phone: phone.trim(), email: email.trim(), password },
      }),
    );
    if (!res) return;
    setToken(res.token);
    setCurrentUser(res.user);
    setRole(res.user.role);
    setScreen('portal');
    setRegisterForm({ full_name: '', phone: '', email: '', password: '' });
    setAuthTab('login');
    setMessage('Обліковий запис створено. Вітаємо у кабінеті клієнта!');
  }

  async function saveClientProfile() {
    const { full_name, phone } = clientProfileForm;
    if (!full_name.trim() || !phone.trim()) return setError('ПІБ та телефон обов\'язкові');
    await guarded(async () => {
      await api('/client/profile', { method: 'PATCH', token, body: { full_name: full_name.trim(), phone: phone.trim() } });
      await loadScreenData('portal');
      setMessage('Дані профілю оновлено');
    });
  }

  async function addClientVehicle() {
    if (!clientVehicleForm.brand.trim() || !clientVehicleForm.plate.trim()) return setError('Марка і держномер обов\'язкові');
    await guarded(async () => {
      await api('/client/vehicles', {
        method: 'POST', token,
        body: { ...clientVehicleForm, year: clientVehicleForm.year ? Number(clientVehicleForm.year) : null },
      });
      setClientVehicleForm({ brand: '', model: '', vin: '', plate: '', year: '' });
      await loadScreenData('portal');
      setMessage('Авто додано');
    });
  }

  async function deleteClientVehicle(vehicleId: number) {
    await guarded(async () => {
      await api(`/client/vehicles/${vehicleId}`, { method: 'DELETE', token });
      await loadScreenData('portal');
      setMessage('Авто видалено');
    });
  }

  async function changePassword() {
    if (!profileForm.new_password) return setError('Введіть новий пароль');
    if (profileForm.new_password !== profileForm.confirm_password) return setError('Паролі не збігаються');
    await guarded(async () => {
      await api('/auth/me', { method: 'PATCH', token, body: { current_password: profileForm.current_password, new_password: profileForm.new_password } });
      setProfileForm({ current_password: '', new_password: '', confirm_password: '' });
      setMessage('Пароль успішно змінено');
    });
  }

  function doLogout() {
    setToken('');
    setCurrentUser(null);
    setRole('admin');
    setScreen('dashboard');
    setClients([]);
    setVehicles([]);
    setOrders([]);
    setPortalProfile(null);
    setPortalOrders([]);
    setServices([]);
    setOrderLineDrafts({});
    localStorage.removeItem('sto_token');
    localStorage.removeItem('sto_role');
    localStorage.removeItem('sto_screen');
  }

  async function loadScreenData(target = screen) {
    if (!token) return;
    await guarded(async () => {
      if (target === 'clients') {
        setClients(await api('/clients', { token }));
        setVehicles(await api('/vehicles', { token }));
      }
      if (target === 'dashboard') {
        const [clientsData, vehiclesData, ordersData, appointmentsData] = await Promise.all([
          api<Client[]>('/clients', { token }),
          api<Vehicle[]>('/vehicles', { token }),
          api<Order[]>('/orders', { token }),
          api<Appointment[]>('/appointments', { token }),
        ]);
        setClients(clientsData);
        setVehicles(vehiclesData);
        setOrders(ordersData);
        setAppointments(appointmentsData);
      }
      if (target === 'orders') {
        const [ordersData, vehiclesData, servicesData] = await Promise.all([
          api<Order[]>('/orders', { token }),
          api<Vehicle[]>('/vehicles', { token }),
          api<Service[]>('/services', { token }),
        ]);
        setOrders(ordersData);
        setVehicles(vehiclesData);
        setServices(servicesData);
        if (selectedOrderId && !ordersData.some((o) => o.id === selectedOrderId)) {
          setSelectedOrderId(null);
        }
      }
      if (target === 'services') setServices(await api('/services', { token }));
      if (target === 'appointments') {
        setAppointments(await api('/appointments', { token }));
        if (role === 'admin' || role === 'manager') {
          const [c, v] = await Promise.all([api<Client[]>('/clients', { token }), api<Vehicle[]>('/vehicles', { token })]);
          setClients(c);
          setVehicles(v);
        }
      }
      if (target === 'portal') {
        const [profile, ordersData] = await Promise.all([
          api<PortalProfile>('/client/profile', { token }),
          api<Order[]>('/client/orders', { token }),
        ]);
        setPortalProfile(profile);
        setPortalOrders(ordersData);
        if (profile?.profile) {
          setClientProfileForm({ full_name: profile.profile.full_name, phone: profile.profile.phone });
        }
      }
    });
  }

  function buildClientCardFromLocal(clientId: number): ClientCard | null {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;
    return {
      ...client,
      vehicles: vehicles.filter((v) => Number(v.client_id) === clientId),
    };
  }

  function applyClientCard(data: ClientCard) {
    const normalized: ClientCard = {
      ...data,
      vehicles: Array.isArray(data.vehicles) ? data.vehicles : [],
    };
    setClientCard(normalized);
    setClientForm({
      id: normalized.id,
      full_name: normalized.full_name,
      phone: normalized.phone,
      notes: normalized.notes,
    });
  }

  async function openClientCard(clientId: number) {
    setClientCardError('');
    const local = buildClientCardFromLocal(clientId);
    if (local) {
      applyClientCard(local);
    }
    setClientCardLoading(true);
    try {
      const data = await api<ClientCard>(`/clients/${clientId}`, { token });
      applyClientCard(data);
    } catch (e) {
      if (!local) {
        setClientCard(null);
        setClientCardError((e as Error).message || 'Не вдалося завантажити картку клієнта');
      }
    } finally {
      setClientCardLoading(false);
    }
  }

  async function saveClient() {
    if (!clientForm.full_name || !clientForm.phone) return setError('Вкажіть ПІБ і телефон клієнта');
    await guarded(async () => {
      if (clientForm.id) {
        await api(`/clients/${clientForm.id}`, { method: 'PATCH', token, body: clientForm });
      } else {
        await api('/clients', { method: 'POST', token, body: clientForm });
      }
      const savedId = clientForm.id;
      setClientForm({ id: 0, full_name: '', phone: '', notes: '' });
      setMessage('Клієнта збережено');
      await loadScreenData('clients');
      if (savedId) await openClientCard(savedId);
    });
  }

  async function removeClient(id: number) {
    if (!window.confirm('Видалити клієнта та пов’язані дані?')) return;
    await guarded(async () => {
      await api(`/clients/${id}`, { method: 'DELETE', token });
      if (clientCard?.id === id) setClientCard(null);
      setMessage('Клієнта видалено');
      await loadScreenData('clients');
    });
  }

  async function saveVehicle() {
    if (!vehicleForm.client_id || !vehicleForm.brand || !vehicleForm.model || !vehicleForm.vin || !vehicleForm.plate) {
      return setError('Заповніть усі обовʼязкові поля авто');
    }
    await guarded(async () => {
      const payload = { ...vehicleForm, year: vehicleForm.year ? Number(vehicleForm.year) : null };
      if (vehicleForm.id) {
        await api(`/vehicles/${vehicleForm.id}`, { method: 'PATCH', token, body: payload });
      } else {
        await api('/vehicles', { method: 'POST', token, body: payload });
      }
      const clientId = vehicleForm.client_id;
      setVehicleForm({ id: 0, client_id: clientId, brand: '', model: '', vin: '', plate: '', year: '' });
      setMessage('Автомобіль збережено');
      await loadScreenData('clients');
      if (clientId) await openClientCard(clientId);
    });
  }

  async function removeVehicle(id: number) {
    await guarded(async () => {
      const vehicle = vehicles.find((v) => v.id === id);
      await api(`/vehicles/${id}`, { method: 'DELETE', token });
      setMessage('Автомобіль видалено');
      await loadScreenData('clients');
      if (vehicle?.client_id) await openClientCard(vehicle.client_id);
    });
  }

  async function createOrder() {
    if (!orderForm.vehicle_id) return setError('Оберіть авто для замовлення');
    await guarded(async () => {
      await api('/orders', { method: 'POST', token, body: { vehicle_id: Number(orderForm.vehicle_id), description: orderForm.description, items: [] } });
      setOrderForm({ vehicle_id: 0, description: '' });
      setMessage('Замовлення створено');
      await loadScreenData('orders');
    });
  }

  async function moveOrder(id: number, status: string) {
    await guarded(async () => {
      await api(`/orders/${id}`, { method: 'PATCH', token, body: { status } });
      await loadScreenData('orders');
    });
  }

  async function deleteOrderItem(orderId: number, itemId: number) {
    await guarded(async () => {
      await api(`/orders/${orderId}/items/${itemId}`, { method: 'DELETE', token });
      await loadScreenData('orders');
    });
  }

  async function deleteOrder(id: number) {
    await guarded(async () => {
      await api(`/orders/${id}`, { method: 'DELETE', token });
      setMessage('Замовлення видалено');
      await loadScreenData('orders');
    });
  }

  async function addOrderLineToOrder(orderId: number) {
    const draft = orderLineDrafts[orderId] || { service_id: 0, qty: 1 };
    if (!draft.service_id) return setError('Оберіть послугу з довідника');
    await guarded(async () => {
      await api(`/orders/${orderId}/items`, { method: 'POST', token, body: { service_id: draft.service_id, qty: draft.qty || 1 } });
      setMessage('Роботу додано до наряду');
      await loadScreenData('orders');
    });
  }

  async function saveService() {
    if (!serviceForm.title || !serviceForm.price) return setError('Вкажіть назву та ціну');
    await guarded(async () => {
      await api('/admin/services', {
        method: 'POST',
        token,
        body: { title: serviceForm.title, price: Number(serviceForm.price), type: serviceForm.type },
      });
      setServiceForm({ title: '', price: '', type: 'work' });
      setMessage('Позицію довідника додано');
      await loadScreenData('services');
    });
  }

  async function commitServiceEdit() {
    if (!editingService) return;
    await guarded(async () => {
      await api(`/admin/services/${editingService.id}`, {
        method: 'PATCH',
        token,
        body: { title: editingService.title, price: editingService.price, type: editingService.type },
      });
      setEditingService(null);
      setMessage('Довідник оновлено');
      await loadScreenData('services');
    });
  }

  async function archiveService(id: number) {
    await guarded(async () => {
      await api(`/admin/services/${id}/archive`, { method: 'PATCH', token });
      setMessage('Позицію приховано з довідника');
      await loadScreenData('services');
    });
  }

  async function updateAppointmentStatus(id: number, status: 'confirmed' | 'cancelled') {
    await guarded(async () => {
      await api(`/appointments/${id}`, { method: 'PATCH', token, body: { status } });
      await loadScreenData('appointments');
      setMessage(status === 'confirmed' ? 'Запис підтверджено' : 'Запис скасовано');
    });
  }

  async function saveAppointment() {
    if (!appointmentForm.starts_at || !appointmentForm.ends_at) return setError('Вкажіть дату та час початку/завершення');
    if ((role === 'admin' || role === 'manager') && !appointmentForm.client_id) return setError('Оберіть клієнта для запису');
    await guarded(async () => {
      const body: Record<string, unknown> = {
        starts_at: new Date(appointmentForm.starts_at).toISOString(),
        ends_at: new Date(appointmentForm.ends_at).toISOString(),
        comment: appointmentForm.comment,
      };
      if ((role === 'admin' || role === 'manager') && appointmentForm.client_id) {
        body.client_id = appointmentForm.client_id;
        if (appointmentForm.vehicle_id) body.vehicle_id = appointmentForm.vehicle_id;
      }
      await api('/appointments', { method: 'POST', token, body });
      setAppointmentForm({ client_id: 0, vehicle_id: 0, starts_at: '', ends_at: '', comment: '' });
      setMessage('Онлайн-запис створено');
      await loadScreenData('appointments');
    });
  }

  const isAuthUi = Boolean(token) && sessionReady;

  return (
    <div className={`app-shell${!token ? ' app-shell--guest-auth' : ''}`}>
      {isAuthUi ? (
        <header className="topbar">
          <div className="topbar-brand">
            <span className="brand-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <strong className="topbar-title">CarFlow</strong>
              <p className="topbar-subtitle">Сервіс у потоці</p>
            </div>
          </div>
          <div className="auth-inline">
            <button type="button" className="btn secondary" onClick={doLogout}>Вийти</button>
          </div>
        </header>
      ) : null}

      {!token ? (
        <header className="guest-shell-header">
          <div className="guest-shell-brand">
            <span className="guest-shell-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="guest-shell-titles">
              <span className="guest-shell-title">CarFlow</span>
              <span className="guest-shell-tagline">Сервіс у потоці</span>
            </div>
          </div>
        </header>
      ) : null}

      <div
        className={`workspace${isAuthUi ? '' : ' workspace--guest workspace--guest-auth'}${isAuthUi && !sidebarOpen ? ' workspace--sidebar-hidden' : ''}`}
      >
        {isAuthUi && sidebarOpen ? (
          <div className="sidebar-with-toggle">
            <Sidebar role={role} active={screen} onChange={(id) => { setScreen(id); loadScreenData(id); }} />
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setSidebarOpen(false)}
              aria-expanded
              aria-controls="app-sidebar"
              title="Згорнути меню"
              aria-label="Згорнути меню розділів"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
        ) : null}
        {isAuthUi && !sidebarOpen ? (
          <button
            type="button"
            className="sidebar-expand-rail"
            onClick={() => setSidebarOpen(true)}
            aria-expanded={false}
            title="Показати меню"
            aria-label="Показати меню розділів"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ) : null}
        <main className={`content${!token ? ' content--guest content--guest-auth-main' : ''}`}>
          {!token && (
            <div className="auth-landing">
              <div className="auth-landing-intro">
                <h1 className="auth-landing-title">Вхід / Реєстрація</h1>
                <p className="auth-landing-lead">Увійдіть у свій акаунт або створіть новий.</p>
              </div>
              <div className="auth-panel-wrap">
                <Card title="Доступ до системи">
                  <div className="auth-mode-switch" role="tablist" aria-label="Режим авторизації">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authTab === 'login'}
                      data-testid="auth-tab-login"
                      className={`auth-mode-btn${authTab === 'login' ? ' auth-mode-btn--active' : ''}`}
                      onClick={() => setAuthTab('login')}
                    >
                      Увійти
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authTab === 'register'}
                      data-testid="auth-tab-register"
                      className={`auth-mode-btn${authTab === 'register' ? ' auth-mode-btn--active' : ''}`}
                      onClick={() => setAuthTab('register')}
                    >
                      Створити акаунт
                    </button>
                  </div>

                  {authTab === 'login' && (
                    <>
                      <div className="auth-form-stack">
                        <input className="input" data-testid="auth-login-email" autoComplete="username" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" />
                        <div className="password-row">
                          <input
                            className="input"
                            data-testid="auth-login-password"
                            autoComplete="current-password"
                            type={showLoginPassword ? 'text' : 'password'}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="Пароль"
                          />
                          <button
                            type="button"
                            className="btn secondary password-toggle"
                            aria-pressed={showLoginPassword}
                            data-testid="auth-login-password-toggle"
                            onClick={() => setShowLoginPassword((v) => !v)}
                          >
                            {showLoginPassword ? 'Приховати' : 'Показати'}
                          </button>
                        </div>
                      </div>
                      <button type="button" className="btn" data-testid="auth-login-submit" onClick={doLogin}>Увійти</button>
                    </>
                  )}

                  {authTab === 'register' && (
                    <>
                      <p className="auth-panel-hint">
                        Реєстрація доступна для <strong>клієнтів</strong>. Після створення акаунта відкриється кабінет клієнта; якщо в системі вже є картка за вашим телефоном — обліковий запис підключиться до неї.
                      </p>
                      <div className="form-grid">
                        <input className="input" data-testid="auth-register-fullname" placeholder="ПІБ" value={registerForm.full_name} onChange={(e) => setRegisterForm((s) => ({ ...s, full_name: e.target.value }))} />
                        <input className="input" data-testid="auth-register-phone" placeholder="Телефон" autoComplete="tel" value={registerForm.phone} onChange={(e) => setRegisterForm((s) => ({ ...s, phone: e.target.value }))} />
                        <input className="input" data-testid="auth-register-email" placeholder="Email (логін)" autoComplete="email" type="email" value={registerForm.email} onChange={(e) => setRegisterForm((s) => ({ ...s, email: e.target.value }))} />
                      </div>
                      <div className="password-row password-row--register">
                        <input
                          className="input"
                          data-testid="auth-register-password"
                          placeholder="Пароль"
                          autoComplete="new-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm((s) => ({ ...s, password: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="btn secondary password-toggle"
                          aria-pressed={showRegisterPassword}
                          data-testid="auth-register-password-toggle"
                          onClick={() => setShowRegisterPassword((v) => !v)}
                        >
                          {showRegisterPassword ? 'Приховати' : 'Показати'}
                        </button>
                      </div>
                      <button type="button" className="btn" data-testid="auth-register-submit" onClick={doRegister}>Створити обліковий запис</button>
                    </>
                  )}
                </Card>
              </div>
            </div>
          )}

          {isAuthUi && screen === 'dashboard' && (
            <Card title="Дашборд">
              <div className="metric-grid">
                <article className="metric"><span>Клієнти</span><strong>{dashboardStats.clients}</strong></article>
                <article className="metric"><span>Авто</span><strong>{dashboardStats.vehicles}</strong></article>
                <article className="metric"><span>Активні замовлення</span><strong>{dashboardStats.activeOrders}</strong></article>
                <article className="metric"><span>Усі замовлення</span><strong>{dashboardStats.orders}</strong></article>
                <article className="metric"><span>Записів за 7 днів</span><strong>{dashboardStats.recentAppointments}</strong></article>
                <article className="metric"><span>Сума по замовленнях</span><strong>{formatCurrency(dashboardStats.revenue)}</strong></article>
              </div>
            </Card>
          )}

          {isAuthUi && screen === 'clients' && (
            <Card title="Клієнти та автомобілі">
              <p className="section-lead">Клікніть по рядку в таблиці — картка клієнта та його авто з’явиться праворуч.</p>
              <h3 className="clients-forms-title">Форма клієнта</h3>
              <div className="form-grid">
                <input className="input" placeholder="ПІБ" value={clientForm.full_name} onChange={(e) => setClientForm((s) => ({ ...s, full_name: e.target.value }))} />
                <input className="input" placeholder="Телефон" value={clientForm.phone} onChange={(e) => setClientForm((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <input className="input" placeholder="Нотатки" value={clientForm.notes} onChange={(e) => setClientForm((s) => ({ ...s, notes: e.target.value }))} />
              <div className="action-row">
                <button className="btn" onClick={saveClient}>{clientForm.id ? 'Оновити клієнта' : 'Додати клієнта'}</button>
                <button className="btn secondary" onClick={() => setClientForm({ id: 0, full_name: '', phone: '', notes: '' })}>Очистити</button>
              </div>
              <div className="form-grid clients-filters">
                <input
                  className="input"
                  placeholder="Пошук за ПІБ або нотатками"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Фільтр за телефоном"
                  value={clientPhoneFilter}
                  onChange={(e) => setClientPhoneFilter(e.target.value)}
                />
              </div>

              <div className="clients-layout">
                <div className="clients-list-panel">
                  <table className="table table--clients">
                    <caption className="table-caption">Знайдено клієнтів: {filteredClients.length}</caption>
                    <thead>
                      <tr>
                        <th className="col-narrow">№</th>
                        <th>ПІБ</th>
                        <th>Телефон</th>
                        <th className="col-actions">Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="table-empty">Клієнтів не знайдено. Додайте нового в формі нижче.</td>
                        </tr>
                      ) : filteredClients.map((c) => (
                        <tr
                          key={c.id}
                          className={clientCard?.id === c.id ? 'table-row-active' : ''}
                          onClick={() => openClientCard(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openClientCard(c.id);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-current={clientCard?.id === c.id ? 'true' : undefined}
                        >
                          <td>{c.id}</td>
                          <td className="cell-primary">{c.full_name}</td>
                          <td>{c.phone}</td>
                          <td className="col-actions">
                            <div className="table-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                              <button type="button" className="btn-icon btn-icon--view" title="Відкрити картку" aria-label={`Картка: ${c.full_name}`} onClick={() => openClientCard(c.id)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.75" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" /></svg>
                              </button>
                              <button type="button" className="btn-icon" title="Редагувати" aria-label={`Редагувати: ${c.full_name}`} onClick={() => { openClientCard(c.id); setClientForm(c); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                              <button type="button" className="btn-icon btn-icon--danger" title="Видалити" aria-label={`Видалити: ${c.full_name}`} onClick={() => removeClient(c.id)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <aside className={`client-card-panel${clientCard ? ' client-card-panel--open' : ''}`} aria-live="polite">
                  {clientCardLoading ? <div className="client-card-progress" aria-hidden="true" /> : null}
                  {clientCardError ? <p className="client-card-error">{clientCardError}</p> : null}
                  {clientCard ? (
                    <>
                      <div className="client-card-header">
                        <div>
                          <p className="client-card-kicker">Картка клієнта</p>
                          <h3 className="client-card-name">{clientCard.full_name}</h3>
                        </div>
                        <button type="button" className="btn secondary" onClick={() => setClientCard(null)}>Закрити</button>
                      </div>
                      <dl className="client-card-meta">
                        <div><dt>Телефон</dt><dd>{clientCard.phone}</dd></div>
                        <div><dt>ID</dt><dd>{clientCard.id}</dd></div>
                        {clientCard.notes ? (
                          <div className="client-card-notes"><dt>Нотатки</dt><dd>{clientCard.notes}</dd></div>
                        ) : null}
                      </dl>
                      <h4 className="client-card-vehicles-title">
                        Автомобілі ({clientCard.vehicles.length})
                      </h4>
                      {clientCard.vehicles.length === 0 ? (
                        <p className="client-card-empty">У клієнта ще немає зареєстрованих авто.</p>
                      ) : (
                        <ul className="client-card-vehicles">
                          {clientCard.vehicles.map((v) => (
                            <li key={v.id} className="client-card-vehicle">
                              <strong>{v.brand} {v.model}</strong>
                              <span>{v.plate}</span>
                              <span className="client-card-vehicle-meta">VIN: {v.vin}{v.year ? ` · ${v.year} р.` : ''}</span>
                              <div className="action-row">
                                <button
                                  type="button"
                                  className="btn secondary"
                                  onClick={() => setVehicleForm({
                                    id: v.id,
                                    client_id: v.client_id,
                                    brand: v.brand,
                                    model: v.model,
                                    vin: v.vin,
                                    plate: v.plate,
                                    year: v.year ? String(v.year) : '',
                                  })}
                                >
                                  Редагувати авто
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setVehicleForm({
                          id: 0,
                          client_id: clientCard.id,
                          brand: '',
                          model: '',
                          vin: '',
                          plate: '',
                          year: '',
                        })}
                      >
                        Додати авто клієнту
                      </button>
                    </>
                  ) : (
                    <p className="client-card-empty">Оберіть клієнта зі списку.</p>
                  )}
                </aside>
              </div>

              <h3>Форма авто</h3>
              <div className="form-grid">
                <select className="select" value={vehicleForm.client_id} onChange={(e) => setVehicleForm((s) => ({ ...s, client_id: Number(e.target.value) }))}>
                  <option value={0}>Оберіть клієнта</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
                <input className="input" placeholder="Марка" value={vehicleForm.brand} onChange={(e) => setVehicleForm((s) => ({ ...s, brand: e.target.value }))} />
                <input className="input" placeholder="Модель" value={vehicleForm.model} onChange={(e) => setVehicleForm((s) => ({ ...s, model: e.target.value }))} />
                <input className="input" placeholder="VIN" value={vehicleForm.vin} onChange={(e) => setVehicleForm((s) => ({ ...s, vin: e.target.value }))} />
                <input className="input" placeholder="Номер" value={vehicleForm.plate} onChange={(e) => setVehicleForm((s) => ({ ...s, plate: e.target.value }))} />
                <input className="input" placeholder="Рік" value={vehicleForm.year} onChange={(e) => setVehicleForm((s) => ({ ...s, year: e.target.value }))} />
              </div>
              <div className="action-row">
                <button className="btn" onClick={saveVehicle}>{vehicleForm.id ? 'Оновити авто' : 'Додати авто'}</button>
                <button className="btn secondary" onClick={() => setVehicleForm({ id: 0, client_id: 0, brand: '', model: '', vin: '', plate: '', year: '' })}>Очистити</button>
              </div>
              <table className="table">
                <thead><tr><th>ID</th><th>Клієнт</th><th>Авто</th><th>Номер</th><th>Дії</th></tr></thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td>{v.id}</td><td>{v.owner_name || v.client_id}</td><td>{v.brand} {v.model}</td><td>{v.plate}</td>
                      <td className="action-row">
                        <button className="btn secondary" onClick={() => setVehicleForm({ id: v.id, client_id: v.client_id, brand: v.brand, model: v.model, vin: v.vin, plate: v.plate, year: v.year ? String(v.year) : '' })}>Редагувати</button>
                        <button className="btn secondary" onClick={() => removeVehicle(v.id)}>Видалити</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {isAuthUi && screen === 'services' && (
            <Card title="Довідник послуг та робіт CarFlow">
              <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Єдиний каталог робіт і матеріалів для наповнення нарядів (аналог довідника робіт у комерційних CRM).
              </p>
              <h3>Нова позиція</h3>
              <div className="form-grid">
                <input className="input" placeholder="Назва" value={serviceForm.title} onChange={(e) => setServiceForm((s) => ({ ...s, title: e.target.value }))} />
                <input className="input" type="number" min={0} step={0.01} placeholder="Ціна, грн" value={serviceForm.price} onChange={(e) => setServiceForm((s) => ({ ...s, price: e.target.value }))} />
                <select className="select" value={serviceForm.type} onChange={(e) => setServiceForm((s) => ({ ...s, type: e.target.value as 'work' | 'part' }))}>
                  <option value="work">Робота</option>
                  <option value="part">Матеріал / запчастина</option>
                </select>
              </div>
              <button type="button" className="btn" onClick={saveService}>Додати у довідник</button>

              {editingService && (
                <>
                  <h3>Редагування #{editingService.id}</h3>
                  <div className="form-grid">
                    <input className="input" value={editingService.title} onChange={(e) => setEditingService((s) => (s ? { ...s, title: e.target.value } : s))} />
                    <input className="input" type="number" min={0} step={0.01} value={editingService.price} onChange={(e) => setEditingService((s) => (s ? { ...s, price: Number(e.target.value) } : s))} />
                    <select className="select" value={editingService.type} onChange={(e) => setEditingService((s) => (s ? { ...s, type: e.target.value } : s))}>
                      <option value="work">Робота</option>
                      <option value="part">Матеріал</option>
                    </select>
                  </div>
                  <div className="action-row">
                    <button type="button" className="btn" onClick={commitServiceEdit}>Зберегти зміни</button>
                    <button type="button" className="btn secondary" onClick={() => setEditingService(null)}>Скасувати</button>
                  </div>
                </>
              )}

              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Назва</th>
                    <th>Тип</th>
                    <th>Ціна</th>
                    <th>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.title}</td>
                      <td>{s.type === 'part' ? 'Матеріал' : 'Робота'}</td>
                      <td>{formatCurrency(s.price)}</td>
                      <td className="action-row">
                        <button type="button" className="btn secondary" onClick={() => setEditingService({ ...s })}>Змінити</button>
                        <button type="button" className="btn secondary" onClick={() => archiveService(s.id)}>Прибрати</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {isAuthUi && screen === 'orders' && (
            <Card title="Канбан замовлень">
              <h3>Список замовлень: фільтри</h3>
              <div className="form-grid">
                <input
                  className="input"
                  placeholder="Пошук: ID, авто, номер або опис"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
                <select className="select" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value as typeof orderStatusFilter)}>
                  <option value="all">Усі статуси</option>
                  <option value="new">Нові</option>
                  <option value="in_progress">У роботі</option>
                  <option value="done">Завершені</option>
                  <option value="cancelled">Скасовані</option>
                </select>
                <select className="select" value={orderVehicleFilter} onChange={(e) => setOrderVehicleFilter(Number(e.target.value))}>
                  <option value={0}>Усі авто</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                </select>
              </div>
              <div className="form-grid">
                <select className="select" value={orderForm.vehicle_id} onChange={(e) => setOrderForm((s) => ({ ...s, vehicle_id: Number(e.target.value) }))}>
                  <option value={0}>Оберіть авто</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                </select>
                <input className="input" placeholder="Опис робіт" value={orderForm.description} onChange={(e) => setOrderForm((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <button type="button" className="btn" onClick={createOrder}>Створити замовлення</button>
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                У картці наряду додавайте рядки з довідника послуг — сума перераховується автоматично.
              </p>
              {selectedOrder ? (
                <div className="card" style={{ marginTop: '0.85rem' }}>
                  <h3 style={{ marginTop: 0 }}>Детальна сторінка замовлення #{selectedOrder.id}</h3>
                  <p>Авто: {selectedOrder.brand} {selectedOrder.model} ({selectedOrder.plate})</p>
                  <p>Статус: {statusUa(selectedOrder.status)}</p>
                  <p>Опис: {selectedOrder.description || '—'}</p>
                  <p>Сума: <strong>{formatCurrency(selectedOrder.total_cost)}</strong></p>
                  <p style={{ marginBottom: '0.45rem' }}>Позиції замовлення:</p>
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                    <ul style={{ marginTop: 0 }}>
                      {selectedOrder.items.map((it) => (
                        <li key={it.id}>{it.service_title} ×{it.qty} — {formatCurrency(it.line_total)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>Поки що немає доданих позицій.</p>
                  )}
                  <button type="button" className="btn secondary" onClick={() => setSelectedOrderId(null)}>Закрити деталі</button>
                </div>
              ) : null}
              <div className="kanban-grid">
                {ORDER_COLUMNS.map((col) => (
                  <div
                    key={col.id}
                    className={`kanban-col${dragOrderId !== null ? ' kanban-col--drop-target' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragOrderId !== null) {
                        moveOrder(dragOrderId, col.id);
                        setDragOrderId(null);
                      }
                    }}
                  >
                    <h3>{col.label}</h3>
                    {filteredOrders.filter((o) => o.status === col.id).map((o) => {
                      const lineItems = Array.isArray(o.items) ? o.items : [];
                      const draft = orderLineDrafts[o.id] || { service_id: 0, qty: 1 };
                      return (
                        <div
                          key={o.id}
                          className={`kanban-card kanban-card--draggable${dragOrderId === o.id ? ' kanban-card--dragging' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            setDragOrderId(o.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => setDragOrderId(null)}
                        >
                          <strong>#{o.id}</strong>
                          <p>{o.brand} {o.model} {o.plate}</p>
                          <p>{o.description || 'Без опису'}</p>
                          <p><strong>{formatCurrency(o.total_cost)}</strong></p>
                          {lineItems.length > 0 && (
                            <ul style={{ margin: '0.35rem 0', paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {lineItems.map((it) => (
                                <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' }}>
                                  <span>{it.service_title} ×{it.qty} — {formatCurrency(it.line_total)}</span>
                                  <button
                                    type="button"
                                    title="Видалити рядок"
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.2rem', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
                                    onClick={() => deleteOrderItem(o.id, it.id)}
                                  >×</button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="form-grid" style={{ marginTop: '0.5rem' }}>
                            <select
                              className="select"
                              value={draft.service_id}
                              onChange={(e) => setOrderLineDrafts((prev) => ({
                                ...prev,
                                [o.id]: { service_id: Number(e.target.value), qty: draft.qty || 1 },
                              }))}
                            >
                              <option value={0}>Оберіть послугу</option>
                              {services.map((s) => (
                                <option key={s.id} value={s.id}>{s.title} — {formatCurrency(s.price)}</option>
                              ))}
                            </select>
                            <input
                              className="input"
                              type="number"
                              min={1}
                              value={draft.qty}
                              onChange={(e) => setOrderLineDrafts((prev) => ({
                                ...prev,
                                [o.id]: { service_id: draft.service_id, qty: Math.max(1, Number(e.target.value) || 1) },
                              }))}
                            />
                          </div>
                          <button type="button" className="btn secondary" style={{ marginTop: '0.35rem', width: '100%' }} onClick={() => addOrderLineToOrder(o.id)}>
                            + Додати послугу
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {isAuthUi && screen === 'appointments' && (
            <Card title="Онлайн-запис">
              <section style={{ marginBottom: '1.25rem' }} aria-labelledby="appointments-cal-title">
                <h3 id="appointments-cal-title" style={{ margin: '0 0 0.35rem' }}>Календар записів</h3>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Тиждень з понеділка; натискайте годину, щоб підставити час у форму нижче. Записи з інших тижнів залишаються у таблиці.
                </p>
                <div className="cal-toolbar">
                  <div className="action-row">
                    <button type="button" className="btn secondary" onClick={() => setCalendarWeekMonday((k) => addDaysYmd(k, -7))}>← Попередній тиждень</button>
                    <button type="button" className="btn secondary" onClick={() => setCalendarWeekMonday(mondayYmdFromDate(new Date()))}>Сьогодні</button>
                    <button type="button" className="btn secondary" onClick={() => setCalendarWeekMonday((k) => addDaysYmd(k, 7))}>Наступний тиждень →</button>
                  </div>
                  <p className="cal-toolbar-label">
                    {parseYmdLocal(calendarWeekMonday).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
                    {' — '}
                    {parseYmdLocal(addDaysYmd(calendarWeekMonday, 6)).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="cal-week">
                  {calendarWeekKeys.map((ymd, i) => {
                    const dayAppointments = appointmentsByCalendarDay.get(ymd) || [];
                    return (
                      <div key={ymd} className={`cal-day${ymd === todayCalendarYmd ? ' cal-day--today' : ''}`}>
                        <div className="cal-day-head">
                          <span className="cal-day-dow">{CAL_WEEKDAYS[i]}</span>
                          <span className="cal-day-date">
                            {parseYmdLocal(ymd).toLocaleDateString('uk-UA', { day: 'numeric', month: 'numeric' })}
                          </span>
                        </div>
                        <div className="cal-day-body">
                          <div className="cal-slot-row">
                            {CAL_QUICK_HOURS.map((h) => (
                              <button
                                key={h}
                                type="button"
                                className="cal-slot-btn"
                                title="Підставити у форму «Час візиту»"
                                onClick={() => applyCalendarQuickSlot(ymd, h)}
                              >
                                {`${h}:00`}
                              </button>
                            ))}
                          </div>
                          {dayAppointments.map((a) => (
                            <article key={a.id} className="cal-appt">
                              <time>
                                {formatHm(new Date(a.starts_at))}
                                {' — '}
                                {formatHm(new Date(a.ends_at))}
                              </time>
                              <p className="cal-appt-client">{a.client_name || `Клієнт #${a.client_id ?? ''}`}</p>
                              {a.comment ? <p className="cal-appt-comment">{a.comment}</p> : null}
                              <span
                                className={`cal-status cal-status--${a.status === 'cancelled' ? 'cancelled' : a.status === 'confirmed' ? 'confirmed' : 'pending'}`}
                              >
                                {statusUa(a.status)}
                              </span>
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {(role === 'admin' || role === 'manager') && (
                <>
                  <h3>Клієнт і авто</h3>
                  <div className="form-grid">
                    <select
                      className="select"
                      value={appointmentForm.client_id}
                      onChange={(e) => setAppointmentForm((s) => ({
                        ...s,
                        client_id: Number(e.target.value),
                        vehicle_id: 0,
                      }))}
                    >
                      <option value={0}>Оберіть клієнта</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                    <select
                      className="select"
                      value={appointmentForm.vehicle_id}
                      onChange={(e) => setAppointmentForm((s) => ({ ...s, vehicle_id: Number(e.target.value) }))}
                    >
                      <option value={0}>Авто (необовʼязково)</option>
                      {appointmentVehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <h3>Час візиту</h3>
              <div className="form-grid">
                <input className="input" type="datetime-local" value={appointmentForm.starts_at} onChange={(e) => setAppointmentForm((s) => ({ ...s, starts_at: e.target.value }))} />
                <input className="input" type="datetime-local" value={appointmentForm.ends_at} onChange={(e) => setAppointmentForm((s) => ({ ...s, ends_at: e.target.value }))} />
              </div>
              <input className="input" placeholder="Коментар" value={appointmentForm.comment} onChange={(e) => setAppointmentForm((s) => ({ ...s, comment: e.target.value }))} />
              <button type="button" className="btn" onClick={saveAppointment}>Створити запис</button>
              <h3 style={{ margin: '1.25rem 0 0.5rem' }}>Повний список записів</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Клієнт</th>
                    <th>Початок</th>
                    <th>Кінець</th>
                    <th>Статус</th>
                    <th>Коментар</th>
                    {(role === 'admin' || role === 'manager') && <th>Дії</th>}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id} style={a.status === 'pending' ? { background: 'rgba(234, 179, 8, 0.06)' } : undefined}>
                      <td>{a.client_name || `#${a.client_id ?? ''}`}</td>
                      <td>{new Date(a.starts_at).toLocaleString('uk-UA')}</td>
                      <td>{new Date(a.ends_at).toLocaleString('uk-UA')}</td>
                      <td>
                        <span className={`appt-status appt-status--${a.status}`}>{statusUa(a.status)}</span>
                      </td>
                      <td>{a.comment}</td>
                      {(role === 'admin' || role === 'manager') && (
                        <td>
                          {a.status === 'pending' && (
                            <div className="table-actions">
                              <button type="button" className="btn" style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }} onClick={() => updateAppointmentStatus(a.id, 'confirmed')}>
                                Підтвердити
                              </button>
                              <button type="button" className="btn secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }} onClick={() => updateAppointmentStatus(a.id, 'cancelled')}>
                                Скасувати
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {isAuthUi && screen === 'portal' && (
            <Card title="Кабінет клієнта">
              <div className="portal-grid">
                <section>
                  <h3>Мої дані</h3>
                  <div className="form-grid" style={{ maxWidth: 400 }}>
                    <input
                      className="input"
                      placeholder="ПІБ"
                      value={clientProfileForm.full_name}
                      onChange={(e) => setClientProfileForm((s) => ({ ...s, full_name: e.target.value }))}
                    />
                    <input
                      className="input"
                      placeholder="Телефон"
                      value={clientProfileForm.phone}
                      onChange={(e) => setClientProfileForm((s) => ({ ...s, phone: e.target.value }))}
                    />
                    <div>
                      <label className="label">Email</label>
                      <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{portalProfile?.profile?.email ?? currentUser?.email ?? '—'}</p>
                    </div>
                  </div>
                  <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={saveClientProfile}>
                    Зберегти дані
                  </button>

                  <h3 style={{ marginTop: '2rem' }}>Мої авто</h3>
                  {(portalProfile?.vehicles ?? []).length === 0 && (
                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Авто не додано</p>
                  )}
                  {(portalProfile?.vehicles ?? []).map((v) => (
                    <div key={v.id} className="kanban-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <strong>{v.brand} {v.model}</strong>
                        <p style={{ margin: '2px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {v.plate}{v.vin ? ` · VIN: ${v.vin}` : ''}{v.year ? ` · ${v.year} р.` : ''}
                        </p>
                      </div>
                      <button type="button" className="btn secondary" onClick={() => deleteClientVehicle(v.id)}>
                        Видалити
                      </button>
                    </div>
                  ))}

                  <h4 style={{ margin: '1.25rem 0 0.5rem' }}>Додати авто</h4>
                  <div className="form-grid" style={{ maxWidth: 400 }}>
                    <input className="input" placeholder="Марка *" value={clientVehicleForm.brand} onChange={(e) => setClientVehicleForm((s) => ({ ...s, brand: e.target.value }))} />
                    <input className="input" placeholder="Модель" value={clientVehicleForm.model} onChange={(e) => setClientVehicleForm((s) => ({ ...s, model: e.target.value }))} />
                    <input className="input" placeholder="Держномер *" value={clientVehicleForm.plate} onChange={(e) => setClientVehicleForm((s) => ({ ...s, plate: e.target.value }))} />
                    <input className="input" placeholder="VIN (необов'язково)" value={clientVehicleForm.vin} onChange={(e) => setClientVehicleForm((s) => ({ ...s, vin: e.target.value }))} />
                    <input className="input" type="number" placeholder="Рік випуску" value={clientVehicleForm.year} onChange={(e) => setClientVehicleForm((s) => ({ ...s, year: e.target.value }))} />
                  </div>
                  <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={addClientVehicle}>
                    Додати авто
                  </button>
                </section>

                <section>
                  <h3>Мої замовлення</h3>
                  {portalOrders.length === 0 && (
                    <p style={{ color: 'var(--text-muted)' }}>Замовлень поки немає</p>
                  )}
                  {portalOrders.map((o) => (
                    <div key={o.id} className="kanban-card" style={{ marginBottom: '0.5rem' }}>
                      <strong>Замовлення #{o.id}</strong>
                      <p style={{ margin: '4px 0 2px' }}>{o.brand} {o.model} · {o.plate}</p>
                      <p style={{ margin: '2px 0' }}>Статус: {statusUa(o.status)}</p>
                      <p style={{ margin: '2px 0', fontWeight: 500 }}>Сума: {formatCurrency(o.total_cost)}</p>
                    </div>
                  ))}
                </section>
              </div>
            </Card>
          )}

          {isAuthUi && screen === 'profile' && (
            <Card title="Мій кабінет">
              <section style={{ marginBottom: '2rem' }}>
                <h3>Інформація про акаунт</h3>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 400 }}>
                  <div>
                    <label className="label">Email</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{currentUser?.email ?? '—'}</p>
                  </div>
                </div>
              </section>
              <section>
                <h3>Зміна пароля</h3>
                <div className="form-grid" style={{ maxWidth: 400 }}>
                  <input
                    className="input"
                    type="password"
                    placeholder="Поточний пароль"
                    value={profileForm.current_password}
                    onChange={(e) => setProfileForm((s) => ({ ...s, current_password: e.target.value }))}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Новий пароль"
                    value={profileForm.new_password}
                    onChange={(e) => setProfileForm((s) => ({ ...s, new_password: e.target.value }))}
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Повторіть новий пароль"
                    value={profileForm.confirm_password}
                    onChange={(e) => setProfileForm((s) => ({ ...s, confirm_password: e.target.value }))}
                  />
                </div>
                <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={changePassword}>
                  Зберегти пароль
                </button>
              </section>
            </Card>
          )}

          {message && <p className="status">{message}</p>}
          {error && <p className="status error">{error}</p>}
        </main>
      </div>

      {token !== '' && !sessionReady ? (
        <div className="app-boot-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="app-boot-panel">
            <div className="app-boot-spinner" aria-hidden />
            <p className="app-boot-text">Завантаження облікового запису…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
