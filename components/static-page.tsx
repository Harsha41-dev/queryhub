import { PublicHeader } from "@/components/layout/public-header";

export function StaticPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">
          QueryHub
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
