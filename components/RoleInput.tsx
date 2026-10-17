/** A free-text role field that suggests the roles the academy actually has learning for, so "developer" is picked rather than retyped as "dev". */
/** Give `sharedList` the id of a datalist already on the page to reuse it, so a long list of people does not each carry its own copy of every role. */
export function RoleInput({ roles = [], name = "jobRole", id, sharedList, defaultValue, className }: { roles?: string[]; name?: string; id: string; sharedList?: string; defaultValue?: string; className?: string }) {
  return (
    <>
      <input name={name} list={sharedList ?? id} defaultValue={defaultValue} placeholder="Role (sales, developer…)" aria-label="Role" required maxLength={40} className={className} autoComplete="off" />
      {!sharedList && <datalist id={id}>{roles.map((r) => <option key={r} value={r} />)}</datalist>}
    </>
  );
}
