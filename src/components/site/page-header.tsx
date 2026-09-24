interface PageHeaderProps {
  title: string;
  lead?: string;
  section: string;
}

/** Abertura das páginas internas: título grande à esquerda, apoio à direita, alinhado à grade. */
export function PageHeader({ title, lead, section }: PageHeaderProps) {
  return (
    <header data-section={section} className="wrap pb-14 pt-8 lg:pb-24 lg:pt-14">
      <div className="grid gap-y-6 lg:grid-cols-12 lg:gap-x-6">
        <h1 className="t-h1 lg:col-span-8">{title}</h1>
        {lead && <p className="max-w-[40ch] text-cafe lg:col-span-4 lg:self-end">{lead}</p>}
      </div>
    </header>
  );
}
