type SectionHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <div className="sectionHeader">
      <div>
        <h2>{title}</h2>
        {description ? <p className="helperText">{description}</p> : null}
      </div>
      {actions ? <div className="sectionHeaderActions">{actions}</div> : null}
    </div>
  );
}
