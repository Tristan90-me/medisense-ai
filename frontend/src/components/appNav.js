import {
  LayoutDashboard, History, TrendingUp, Pill, MapPin,
  Trophy, Users, PhoneCall, Camera, Users2, Settings, Lock, Calendar,
} from 'lucide-react';

// Core destinations shown in the desktop sidebar (lg+) and the mobile bottom
// bar. `shortLabel` keeps the bottom bar's five slots legible at ~375px wide.
export const PRIMARY_NAV = [
  { label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Sessions', shortLabel: 'Sessions', icon: History, to: '/history' },
  { label: 'Health Stats', shortLabel: 'Stats', icon: TrendingUp, to: '/health-stats' },
  { label: 'Medications', shortLabel: 'Meds', icon: Pill, to: '/medications' },
  { label: 'Care Finder', shortLabel: 'Care', icon: MapPin, to: '/care-finder' },
];

// Everything else, reachable on mobile through the "More" sheet. Desktop
// keeps these in the dashboard's secondary grid, so they stay unchanged there.
// `group` labels the section MobileNav.jsx's More sheet renders this under —
// a presentation-only grouping, not a route/structure change (see the
// information-architecture critique point this addresses).
export const SECONDARY_NAV = [
  { label: 'Appointments', icon: Calendar, to: '/appointments', group: 'Care' },
  { label: 'Health Score', icon: Trophy, to: '/health-score', group: 'My Health' },
  { label: 'Photo Log', icon: Camera, to: '/photo-log', group: 'My Health' },
  { label: 'Community Insights', icon: Users2, to: '/community', group: 'My Health' },
  { label: 'Family & Dependents', icon: Users, to: '/dependents', group: 'Family & Safety' },
  { label: 'Emergency Contacts', icon: PhoneCall, to: '/emergency-contacts', group: 'Family & Safety' },
  { label: 'Account Settings', icon: Settings, to: '/account-settings', group: 'Settings' },
  { label: 'Privacy Center', icon: Lock, to: '/privacy-center', group: 'Settings' },
];

// Fixed display order for the groups above (object key order in the array
// isn't reliable once items are regrouped by `group`).
export const SECONDARY_NAV_GROUP_ORDER = ['My Health', 'Care', 'Family & Safety', 'Settings'];
