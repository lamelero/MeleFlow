import type { ComponentType, SVGProps } from "react";

export interface ListIconDef {
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const LIST_ICONS: ListIconDef[] = [
  { name: "pencil", icon: PencilIcon },
  { name: "shopping-cart", icon: ShoppingCartIcon },
  { name: "briefcase", icon: BriefcaseIcon },
  { name: "home", icon: HomeIcon },
  { name: "fire", icon: FireIcon },
  { name: "book-open", icon: BookOpenIcon },
  { name: "musical-note", icon: MusicalNoteIcon },
  { name: "globe-alt", icon: GlobeAltIcon },
  { name: "computer", icon: ComputerDesktopIcon },
  { name: "paint-brush", icon: PaintBrushIcon },
  { name: "wrench", icon: WrenchIcon },
  { name: "calendar", icon: CalendarDaysIcon },
  { name: "star", icon: StarIcon },
  { name: "trending-up", icon: TrendingUpIcon },
  { name: "light-bulb", icon: LightBulbIcon },
  { name: "target", icon: TargetIcon },
  { name: "trophy", icon: TrophyIcon },
  { name: "cube", icon: CubeIcon },
  { name: "gift", icon: GiftIcon },
  { name: "sun", icon: SunIcon },
  { name: "truck", icon: TruckIcon },
  { name: "currency-dollar", icon: CurrencyDollarIcon },
  { name: "academic-cap", icon: AcademicCapIcon },
  { name: "leaf", icon: LeafIcon },
  { name: "heart", icon: HeartIcon },
  { name: "film", icon: FilmIcon },
  { name: "cake", icon: CakeIcon },
  { name: "controller", icon: ControllerIcon },
];

export function ListIcon({
  name,
  className = "h-4 w-4",
}: {
  name: string;
  className?: string;
}) {
  const def = LIST_ICONS.find((i) => i.name === name);
  if (!def) return null;
  const Icon = def.icon;
  return <Icon className={className} />;
}

function Icon({ children, ...props }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      {children}
    </svg>
  );
}

function PencilIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </Icon>
  );
}

function ShoppingCartIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272" />
      <circle cx="6" cy="20.25" r="0.75" />
      <circle cx="18.75" cy="20.25" r="0.75" />
    </Icon>
  );
}

function BriefcaseIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
    </Icon>
  );
}

function HomeIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </Icon>
  );
}

function FireIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path d="M12 18a3.75 3.75 0 01-2.875-6.247c.412-.457.75-.99.75-1.53 0-.54.147-1.036.385-1.478a3.75 3.75 0 002.74 1.462c.226.009.451.025.674.048a3.75 3.75 0 01-.674 6.245z" />
    </Icon>
  );
}

function BookOpenIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </Icon>
  );
}

function MusicalNoteIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
    </Icon>
  );
}

function GlobeAltIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </Icon>
  );
}

function ComputerDesktopIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </Icon>
  );
}

function PaintBrushIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </Icon>
  );
}

function WrenchIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
    </Icon>
  );
}

function CalendarDaysIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Icon>
  );
}

function StarIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </Icon>
  );
}

function TrendingUpIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </Icon>
  );
}

function LightBulbIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </Icon>
  );
}

function TargetIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </Icon>
  );
}

function TrophyIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0116.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.896m0 0a6.015 6.015 0 01-3 0m0 0a6.023 6.023 0 01-2.77-.896" />
    </Icon>
  );
}

function CubeIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </Icon>
  );
}

function GiftIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h17.25" />
    </Icon>
  );
}

function SunIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </Icon>
  );
}

function TruckIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </Icon>
  );
}

function CurrencyDollarIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </Icon>
  );
}

function AcademicCapIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M4.26 10.147a60.438 60.438 0 012.83-.379m2.91 3.582a60.438 60.438 0 002.83-.379m-5.74 3.09a56.09 56.09 0 00-2.8.903m5.74-3.09c.451.08.903.15 1.357.21a.75.75 0 01.63.743v2.248a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-1.5a.75.75 0 01.53-.71l.993-.291zm-11.06-4.246c.372-.078.746-.148 1.12-.211m7.5 4.246c.372-.078.746-.148 1.12-.211m-7.5-4.246a60.46 60.46 0 00-2.83.379m7.5 0a60.46 60.46 0 012.83-.379M3 13.5V6.75a.75.75 0 01.75-.75h16.5a.75.75 0 01.75.75v6.75M3 13.5V18a.75.75 0 00.75.75h16.5A.75.75 0 0021 18v-4.5M3 13.5l2.404-3.643a.75.75 0 011.08-.213L9 12l2.768-2.768a.75.75 0 011.08.213L14.25 9.75l2.04-3.09a.75.75 0 011.2 0L21 13.5" />
    </Icon>
  );
}

function LeafIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />
    </Icon>
  );
}

function HeartIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </Icon>
  );
}

function FilmIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </Icon>
  );
}

function CakeIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 6a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" />
      <path d="M18.75 9.75v6.75a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-6.75" />
      <path d="M3.75 9.75h16.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75v-1.5a.75.75 0 01.75-.75z" />
      <path d="M6.75 6.75l1.5 3m9-3l-1.5 3" />
    </Icon>
  );
}

function ControllerIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M15.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm-6 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path d="M15.75 9.75v4.5m-7.5-4.5v4.5" />
    </Icon>
  );
}
