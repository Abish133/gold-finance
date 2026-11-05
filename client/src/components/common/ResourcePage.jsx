import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import { Button, DataTable, Drawer, ConfirmDrawer, PageHeader, SearchInput } from '@/components/ui';
import { FormFields } from '@/components/form/FormFields';
import { useList, useSaveResource, useDeleteResource } from '@/hooks/useApi';
import { useDebounce, useTableState } from '@/hooks/useUtils';
import { useAuth } from '@/context/AuthContext';
import { exportCsv } from '@/lib/exporters';
import { api } from '@/lib/api';

/**
 * Fully config-driven CRUD screen: list + search + paging + create/edit drawer + delete.
 *
 * <ResourcePage
 *   title="Items" endpoint="/masters/items" screen="m_items" icon={Gem}
 *   columns={[...]} fields={[...]} defaults={{ is_active: 1 }}
 *   filters={(state, set) => <Select .../>} toPayload={(v) => v} fromRecord={(r) => r}
 * />
 */
export function ResourcePage({
  title, subtitle, endpoint, screen, icon, columns, fields, defaults = {}, toPayload = (v) => v, fromRecord = (r) => r,
  drawerSize = 'md', cols = 2, filters, extraParams, rowActions, headerActions, singular, canDelete = true, formExtra, onSaved,
}) {
  const { can } = useAuth();
  const [state, set] = useTableState();
  const search = useDebounce(state.search);
  const params = { ...state, search, ...extraParams };
  const list = useList(endpoint, params);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const save = useSaveResource(endpoint, { onDone: (r) => { setEditing(null); onSaved?.(r); } });
  const del = useDeleteResource(endpoint, { onDone: () => setDeleting(null) });
  const form = useForm({ defaultValues: defaults });

  useEffect(() => {
    if (editing) form.reset({ ...defaults, ...(editing.id ? fromRecord(editing) : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const allColumns = useMemo(() => [
    ...columns,
    {
      key: '__actions', label: '', align: 'right', width: 1,
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {rowActions?.(r)}
          {can(screen, 'edit') && <Button size="icon" variant="ghost" onClick={() => setEditing(r)} aria-label="Edit"><Pencil className="size-4" /></Button>}
          {canDelete && can(screen, 'delete') && <Button size="icon" variant="ghost" onClick={() => setDeleting(r)} aria-label="Delete"><Trash2 className="size-4 text-rose-500" /></Button>}
        </div>
      ),
    },
  ], [columns, can, screen, rowActions, canDelete]);

  const doExport = async () => {
    const all = await api.get(endpoint, { ...params, all: 1 });
    exportCsv(title.replace(/\s+/g, '-').toLowerCase(), columns.filter((c) => !c.render || c.exportKey), all.data);
  };

  return (
    <div className="animate-rise">
      <PageHeader title={title} subtitle={subtitle} icon={icon} actions={(
        <>
          {headerActions}
          {can(screen, 'export') && <Button variant="outline" icon={Download} onClick={doExport}>Export</Button>}
          {can(screen, 'add') && <Button variant="gold" icon={Plus} onClick={() => setEditing({})}>Add {singular || title.replace(/s$/, '')}</Button>}
        </>
      )} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={state.search} onChange={(v) => set({ search: v })} className="w-full sm:w-80" />
        {filters?.(state, set)}
      </div>

      <DataTable
        columns={allColumns}
        rows={list.data?.data}
        loading={list.isLoading}
        fetching={list.isFetching}
        meta={list.data?.meta}
        sort={state.sort} order={state.order}
        onSort={(sort, order) => set({ sort, order })}
        onPage={(page) => set({ page })}
        onPageSize={(pageSize) => set({ pageSize })}
        onRowClick={can(screen, 'edit') ? (r) => setEditing(r) : undefined}
      />

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${singular || title.replace(/s$/, '')}` : `New ${singular || title.replace(/s$/, '')}`}
        icon={icon}
        size={drawerSize}
        footer={(
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="gold" loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate({ id: editing?.id, ...toPayload(v) }))}>Save</Button>
          </>
        )}
      >
        <form onSubmit={form.handleSubmit((v) => save.mutate({ id: editing?.id, ...toPayload(v) }))}>
          <FormFields fields={fields} form={form} cols={cols} />
          {formExtra?.(form, editing)}
          <button type="submit" className="hidden" />
        </form>
      </Drawer>

      <ConfirmDrawer
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => del.mutate(deleting.id)}
        loading={del.isPending}
        title={`Delete ${singular || 'record'}?`}
        message="This action cannot be undone. Records already used in transactions cannot be deleted - deactivate them instead."
        confirmText="Delete"
      />
    </div>
  );
}
