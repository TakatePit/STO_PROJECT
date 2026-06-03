export type Role = 'admin' | 'manager' | 'client';

export type NavItem = {
  id: string;
  label: string;
};

export const roleSections: Record<Role, NavItem[]> = {
  admin: [
    { id: 'dashboard', label: 'Дашборд' },
    { id: 'clients', label: 'Клієнти та авто' },
    { id: 'services', label: 'Довідник послуг' },
    { id: 'orders', label: 'Замовлення (Канбан)' },
    { id: 'appointments', label: 'Онлайн-запис' },
    { id: 'profile', label: 'Мій кабінет' },
  ],
  manager: [
    { id: 'dashboard', label: 'Дашборд' },
    { id: 'clients', label: 'Клієнти та авто' },
    { id: 'services', label: 'Довідник послуг' },
    { id: 'orders', label: 'Замовлення (Канбан)' },
    { id: 'appointments', label: 'Онлайн-запис' },
    { id: 'profile', label: 'Мій кабінет' },
  ],
  client: [
    { id: 'portal', label: 'Кабінет клієнта' },
    { id: 'appointments', label: 'Онлайн-запис' },
    { id: 'profile', label: 'Мій кабінет' },
  ],
};
