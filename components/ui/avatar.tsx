import Image from "next/image";
import { cn, initials } from "@/lib/utils";

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 overflow-hidden rounded-full bg-primary/10",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="m-auto text-xs font-bold text-primary">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
