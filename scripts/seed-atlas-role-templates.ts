import { db } from '../lib/db';
import { atlasRoleTemplates } from '../lib/db/schema';
import { count } from 'drizzle-orm';

// Each key matches an ACCESS_MATRIX_SYSTEMS entry via SYSTEM_KEY_MAP
const ROLE_TEMPLATES = [
  {
    presetCode: 'SVC_TECH_L1',
    label: 'Service Technician',
    department: 'Field Operations',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': true,
      'Trello': true,
      'Bill.com': false,
      'QuickBooks': false,
      'Trainual': true,
      'Fleet App': true,
    },
  },
  {
    presetCode: 'OPS_LEAD_L2',
    label: 'Regional Ops Lead',
    department: 'Field Operations',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': true,
      'Trello': true,
      'Bill.com': false,
      'QuickBooks': false,
      'Trainual': true,
      'Fleet App': true,
    },
  },
  {
    presetCode: 'CONSTR_FOREMAN',
    label: 'Construction Foreman',
    department: 'Construction',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': true,
      'Trello': true,
      'Bill.com': false,
      'QuickBooks': false,
      'Trainual': true,
      'Fleet App': true,
    },
  },
  {
    presetCode: 'ACCT_L1',
    label: 'Staff Accountant',
    department: 'Finance',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': true,
      'Trello': false,
      'Bill.com': true,
      'QuickBooks': true,
      'Trainual': true,
      'Fleet App': false,
    },
  },
  {
    presetCode: 'HR_COORD',
    label: 'HR Coordinator',
    department: 'Human Resources',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': true,
      'Trello': true,
      'Bill.com': false,
      'QuickBooks': false,
      'Trainual': true,
      'Fleet App': false,
    },
  },
  {
    presetCode: 'IT_ADMIN',
    label: 'IT Administrator',
    department: 'IT',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': true,
      'Trello': true,
      'Bill.com': false,
      'QuickBooks': false,
      'Trainual': true,
      'Fleet App': true,
    },
  },
  {
    presetCode: 'SALES_REP',
    label: 'Sales Representative',
    department: 'Sales',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': false,
      'Trello': true,
      'Bill.com': false,
      'QuickBooks': false,
      'Trainual': true,
      'Fleet App': false,
    },
  },
  {
    presetCode: 'CSR_L1',
    label: 'Customer Service Rep',
    department: 'Customer Service',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': false,
      'Trello': true,
      'Bill.com': false,
      'QuickBooks': false,
      'Trainual': true,
      'Fleet App': false,
    },
  },
  {
    presetCode: 'MGR_L3',
    label: 'Department Manager',
    department: 'Management',
    entitlements: {
      'Google Workspace': true,
      'Dropbox': true,
      'Trello': true,
      'Bill.com': true,
      'QuickBooks': true,
      'Trainual': true,
      'Fleet App': true,
    },
  },
];

async function main() {
  const [{ cnt }] = await db.select({ cnt: count() }).from(atlasRoleTemplates);
  if (Number(cnt) > 0) {
    console.log(`atlas_role_templates already has ${cnt} rows — skipping seed.`);
    process.exit(0);
  }

  await db.insert(atlasRoleTemplates).values(
    ROLE_TEMPLATES.map((t) => ({
      presetCode: t.presetCode,
      label: t.label,
      department: t.department,
      entitlements: t.entitlements,
      isActive: true,
    })),
  );

  console.log(`Seeded ${ROLE_TEMPLATES.length} role templates.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
