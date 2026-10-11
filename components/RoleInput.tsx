/** A free-text role field that suggests the roles the academy actually has learning for, so "developer" is picked rather than retyped as "dev". */
export function RoleInput({ roles, name = "jobRole", id, defaultValue, className }: { roles: string[]; name?: string; id: string; defaultValue?: string; className?: string }) {
  return (
    <>
      <input name={name} list={id} defaultValue={defaultValue} placeholder="Role (sales, developer…)" aria-label="Role" required maxLength={40} className={className} autoComplete="off" />
      <datalist id={id}>{roles.map((r) => <option key={r} value={r} />)}</datalist>
    </>
  );
}
