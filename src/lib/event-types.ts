export const EVENT_TYPES = [
  { value: "birthday", label: "Birthday", emoji: "🎂", recurring: true },
  { value: "anniversary", label: "Anniversary", emoji: "💜", recurring: true },
  { value: "meeting", label: "Meeting", emoji: "🤝", recurring: false },
  { value: "date_night", label: "Date Night", emoji: "🌙", recurring: false },
  { value: "celebration", label: "Celebration", emoji: "🎉", recurring: false },
  { value: "reminder", label: "Reminder", emoji: "⏰", recurring: false },
  { value: "custom", label: "Custom Event", emoji: "✨", recurring: false },
] as const;

export type EventTypeValue = (typeof EVENT_TYPES)[number]["value"];

export function eventTypeMeta(value: string | null | undefined) {
  return EVENT_TYPES.find((t) => t.value === value) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}
