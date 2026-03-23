type FieldGroupProps = {
  title: string;
  children: React.ReactNode;
};

export function FieldGroup({ title, children }: FieldGroupProps) {
  return (
    <div className="formGroup">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
