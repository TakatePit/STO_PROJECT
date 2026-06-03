import React from 'react';
import type { Role } from '../lib/roles';
import { roleSections } from '../lib/roles';

type Props = {
  role: Role;
  active: string;
  onChange: (screen: string) => void;
};

export function Sidebar({ role, active, onChange }: Props) {
  return (
    <aside id="app-sidebar" className="sidebar">
      <h3 className="sidebar-title">Розділи</h3>
      {roleSections[role].map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={active === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
          className={`nav-btn ${active === item.id ? 'nav-btn-active' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </aside>
  );
}
