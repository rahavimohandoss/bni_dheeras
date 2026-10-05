import {
  BellIcon,
  CalendarDaysIcon,
  DoorOpenIcon,
  FileTextIcon,
  HomeIcon,
  IdCardIcon,
  MapPinnedIcon,
  MenuIcon,
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
  forms: FileTextIcon,
  user: UserIcon,
  bell: BellIcon,
  door: DoorOpenIcon,
  settings: SettingsIcon,
} as const;

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? HomeIcon;
  return <Icon className={className} />;
}
