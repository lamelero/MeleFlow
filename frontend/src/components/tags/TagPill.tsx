import type { Tag } from "../../store/tagStore";

interface TagPillProps {
  tag: Tag;
  onRemove?: () => void;
  size?: "sm" | "md";
}

export default function TagPill({ tag, onRemove, size = "sm" }: TagPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-urbanist font-medium ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{
        backgroundColor: `${tag.color}1A`,
        color: tag.color,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}
