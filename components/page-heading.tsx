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
    <header className="flex items-start gap-4 border-y bg-card p-5 sm:rounded-xl sm:border sm:p-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          {title}
        </h1>
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
