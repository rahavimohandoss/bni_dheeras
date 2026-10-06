import {
  BellIcon,
  CalendarDaysIcon,
  DoorOpenIcon,
  HomeIcon,
  IdCardIcon,
  MapPinnedIcon,
  MenuIcon,
  MessageSquareTextIcon,
  ScanLineIcon,
  SettingsIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

const ICONS = {
  home: HomeIcon,
  scan: ScanLineIcon,
  map: MapPinnedIcon,
  calendar: CalendarDaysIcon,
  menu: MenuIcon,
  users: UsersIcon,
  trophy: TrophyIcon,
  card: IdCardIcon,
  feedback: MessageSquareTextIcon,
  user: UserIcon,
  bell: BellIcon,
  door: DoorOpenIcon,
  settings: SettingsIcon,
} as const;

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? HomeIcon;
  return <Icon className={className} />;
}
