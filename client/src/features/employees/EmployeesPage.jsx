import { UserCog } from 'lucide-react';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Avatar, Segmented } from '@/components/ui';

export default function EmployeesPage() {
  return (
    <ResourcePage
      title="Employees" singular="Employee" endpoint="/employees" screen="employees" icon={UserCog} drawerSize="xl" cols={3}
      subtitle="Staff master with salary, documents and status" defaults={{ status: 'ACTIVE', title: 'Mr' }}
      filters={(s, set) => <Segmented value={s.status || ''} onChange={(v) => set({ status: v })} options={[{ value: '', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'LEFT', label: 'Left' }]} />}
      columns={[
        { key: 'emp_code', label: 'Code', sortable: true },
        { key: 'name', label: 'Name', sortable: true, render: (r) => <div className="flex items-center gap-3"><Avatar src={r.photo} name={r.name} size="sm" /><span className="font-semibold">{r.name}</span></div> },
        { key: 'designation', label: 'Designation' }, { key: 'phone', label: 'Mobile' }, { key: 'doj', label: 'Joined', type: 'date', sortable: true },
        { key: 'salary', label: 'Salary', type: 'money' }, { key: 'status', label: 'Status', type: 'status' },
      ]}
      fields={[
        { type: 'section', name: 's1', label: 'Personal' },
        { name: 'emp_code', label: 'Employee code', required: true }, { name: 'title', label: 'Title', type: 'select', options: ['Mr', 'Mrs', 'Ms'] },
        { name: 'name', label: 'Name', required: true }, { name: 'relation_type', label: 'Relation', type: 'select', options: ['S/o', 'D/o', 'W/o'] },
        { name: 'relation_name', label: 'Relation name' }, { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
        { name: 'dob', label: 'Date of birth', type: 'date' }, { name: 'marital_status', label: 'Marital status', type: 'select', options: ['Single', 'Married'] },
        { name: 'phone', label: 'Mobile' }, { name: 'email', label: 'Email', type: 'email' },
        { name: 'address', label: 'Address', type: 'textarea', span: 'full', rows: 2 },
        { type: 'section', name: 's2', label: 'Job' },
        { name: 'designation_id', label: 'Designation', type: 'async-select', endpoint: '/masters/designations' },
        { name: 'department', label: 'Department' }, { name: 'doj', label: 'Date of joining', type: 'date' },
        { name: 'salary', label: 'Monthly salary', type: 'money' }, { name: 'qualification', label: 'Qualification' }, { name: 'experience', label: 'Experience' },
        { type: 'section', name: 's3', label: 'Bank & KYC' },
        { name: 'bank_account', label: 'Bank account' }, { name: 'ifsc', label: 'IFSC' }, { name: 'pan', label: 'PAN' }, { name: 'aadhaar', label: 'Aadhaar' },
        { name: 'emergency_name', label: 'Emergency contact' }, { name: 'emergency_phone', label: 'Emergency phone' },
        { type: 'section', name: 's4', label: 'Status' },
        { name: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'LEFT'], placeholder: undefined },
        { name: 'left_date', label: 'Left on', type: 'date', show: (v) => v.status === 'LEFT' },
        { name: 'left_reason', label: 'Reason for leaving', show: (v) => v.status === 'LEFT' },
        { name: 'remarks', label: 'Remarks', type: 'textarea', span: 'full', rows: 2 },
      ]}
    />
  );
}
