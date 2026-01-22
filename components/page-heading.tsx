// simple page title used on settings / list pages

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-4 rounded-[28px] border border-border bg-card p-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-4xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
