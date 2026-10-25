import type { ReactNode } from "react";
import type { Category } from "../models/Listing";

interface IconProps {
    size?: number;
    strokeWidth?: number;
}

function Icon({ size = 20, strokeWidth = 1.75, children }: IconProps & { children: ReactNode }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
        >
            {children}
        </svg>
    );
}

export function BoatIcon(props: IconProps) {
    return <Icon {...props}><path d="M2 16h20l-2.5 4h-15z" /><path d="M12 3v13" /><path d="M12 4l6 9h-6" /></Icon>;
}

export function TrailerIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <rect x="2" y="6" width="13" height="8" rx="1" /><path d="M15 12h6" /><circle cx="21" cy="12" r="1" />
            <circle cx="6" cy="16" r="2" /><circle cx="11" cy="16" r="2" />
        </Icon>
    );
}

export function CategoryIcon({ category, ...props }: IconProps & { category: Category }) {
    return category === "boats" ? <BoatIcon {...props} /> : <TrailerIcon {...props} />;
}

export function SearchIcon(props: IconProps) {
    return <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
}

export function PlusIcon(props: IconProps) {
    return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
}

export function ChevronLeftIcon(props: IconProps) {
    return <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>;
}

export function ArrowRightIcon(props: IconProps) {
    return <Icon {...props}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>;
}

export function CheckIcon(props: IconProps) {
    return <Icon strokeWidth={2} {...props}><path d="M20 6 9 17l-5-5" /></Icon>;
}

export function CircleIcon(props: IconProps) {
    return <Icon strokeWidth={2} {...props}><circle cx="12" cy="12" r="8" /></Icon>;
}

export function PencilIcon(props: IconProps) {
    return <Icon {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>;
}

export function CalendarIcon(props: IconProps) {
    return <Icon {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Icon>;
}

export function PinIcon(props: IconProps) {
    return <Icon {...props}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></Icon>;
}

export function UploadIcon(props: IconProps) {
    return <Icon {...props}><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></Icon>;
}

export function PhoneIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
        </Icon>
    );
}

export function MailIcon(props: IconProps) {
    return <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Icon>;
}

export function ClockIcon(props: IconProps) {
    return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
}
