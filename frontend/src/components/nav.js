import { LayoutDashboard, Activity, FileSpreadsheet, BellRing, UserCircle2, Network } from 'lucide-react'

/** Navigation, grouped the way a plant team thinks about it. Also drives the header breadcrumb. */
export const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Dashboards', hint: 'Plant KPIs & your own boards', icon: LayoutDashboard, end: true },
      { to: '/live', label: 'Live Floor', hint: 'Machine data, shift by shift', icon: Activity },
      { to: '/alarms', label: 'Alarms', hint: 'Events to acknowledge', icon: BellRing, badge: 'alarms' },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/reports', label: 'Reports', hint: 'PDF & Excel registers', icon: FileSpreadsheet }],
  },
  {
    label: 'Connectivity',
    items: [{ to: '/devices', label: 'Devices & Gateways', hint: 'MQTT · PLC · HMI · OPC UA', icon: Network }],
  },
  {
    label: 'Account',
    items: [{ to: '/profile', label: 'Profile & Plant', hint: 'You, the plant, shift timings', icon: UserCircle2 }],
  },
]

export function findNav(pathname) {
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (item.end ? pathname === item.to : pathname.startsWith(item.to)) return { group: g.label, item }
    }
  }
  return null
}
