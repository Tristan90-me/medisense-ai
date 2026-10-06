import {
  LayoutDashboard, History, TrendingUp, Pill, MapPin,
  Trophy, Users, PhoneCall, Camera, Users2, Settings,
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
export const SECONDARY_NAV = [
  { label: 'Health Score', icon: Trophy, to: '/health-score' },
  { label: 'Family & Dependents', icon: Users, to: '/dependents' },
  { label: 'Emergency Contacts', icon: PhoneCall, to: '/emergency-contacts' },
  { label: 'Photo Log', icon: Camera, to: '/photo-log' },
  { label: 'Community Insights', icon: Users2, to: '/community' },
  { label: 'Account Settings', icon: Settings, to: '/account-settings' },
];
