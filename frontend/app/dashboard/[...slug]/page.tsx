import { notFound } from 'next/navigation';

import DashboardActivatePage from '../../../src/app/dashboard/activate/page';
import DashboardAdsNetworkPage from '../../../src/app/dashboard/ads-network/page';
import DashboardCashTasksPage from '../../../src/app/dashboard/cash-tasks/page';
import DashboardChatPage from '../../../src/app/dashboard/chat/page';
import DashboardChallengesPage from '../../../src/app/dashboard/challenges/page';
import DashboardComingSoonPage from '../../../src/app/dashboard/coming-soon/page';
import DashboardFreelancePage from '../../../src/app/dashboard/freelance/page';
import DashboardJobApplicationsPage from '../../../src/app/dashboard/jobs/applications/page';
import DashboardJobApplicantsManagePage from '../../../src/app/dashboard/jobs/[id]/applicants/page';
import DashboardJobDetailsPage from '../../../src/app/dashboard/jobs/[id]/page';
import DashboardJobsPage from '../../../src/app/dashboard/jobs/page';
import CreatorHubBrowsePage from '../../../src/app/dashboard/creator-hub/page';
import CreatorHubUploadPage from '../../../src/app/dashboard/creator-hub/upload/page';
import CreatorHubMyUploadsPage from '../../../src/app/dashboard/creator-hub/my-uploads/page';
import CreatorHubSavedPage from '../../../src/app/dashboard/creator-hub/saved/page';
import CreatorHubDetailView from '../../../src/app/dashboard/creator-hub/CreatorHubDetailView';
import CreatorHubLayout from '../../../src/app/dashboard/creator-hub/layout';
import DashboardLedgerPage from '../../../src/app/dashboard/ledger/page';
import DashboardOfferwallsPage from '../../../src/app/dashboard/offerwalls/page';
import DashboardProfilePage from '../../../src/app/dashboard/profile/page';
import DashboardReferralsPage from '../../../src/app/dashboard/referrals/page';
import DashboardSuperadminPage from '../../../src/app/dashboard/superadmin/page';
import DashboardSurveysPage from '../../../src/app/dashboard/surveys/page';
import DashboardTasksPage from '../../../src/app/dashboard/tasks/page';
import DashboardWalletPage from '../../../src/app/dashboard/wallet/page';
import AdminConsolePage from '../../../src/app/dashboard/admin-console/page';
import AdminWorkspacePage from '../../../src/app/dashboard/admin/page';
import AdminUsersPage from '../../../src/app/dashboard/admin/users/page';
import AdminAdminsPage from '../../../src/app/dashboard/admin/admins/page';
import AdminLedgerPage from '../../../src/app/dashboard/admin/ledger/page';
import AdminModerationPage from '../../../src/app/dashboard/admin/moderation/page';
import AdminSupportPage from '../../../src/app/dashboard/admin/support/page';
import AdminAuditPage from '../../../src/app/dashboard/admin/audit/page';
import AdminConfigPage from '../../../src/app/dashboard/admin/config/page';
import AdminProviderHealthPage from '../../../src/app/dashboard/admin/provider-health/page';
import LedgerReportsPage from '../../../src/app/dashboard/ledger/reports/page';
import LedgerExportPage from '../../../src/app/dashboard/ledger/export/page';
import LedgerTransactionsPage from '../../../src/app/dashboard/ledger/transactions/page';
import LedgerReconciliationPage from '../../../src/app/dashboard/ledger/reconciliation/page';
import LedgerProfilePage from '../../../src/app/dashboard/ledger/profile/page';

const ROUTES: Record<string, React.ComponentType> = {
  'admin-console': AdminConsolePage,
  admin: AdminWorkspacePage,
  'admin/users': AdminUsersPage,
  'admin/admins': AdminAdminsPage,
  'admin/ledger': AdminLedgerPage,
  'admin/moderation': AdminModerationPage,
  'admin/support': AdminSupportPage,
  'admin/audit': AdminAuditPage,
  'admin/config': AdminConfigPage,
  'admin/provider-health': AdminProviderHealthPage,
  activate: DashboardActivatePage,
  'ads-network': DashboardAdsNetworkPage,
  'cash-tasks': DashboardCashTasksPage,
  chat: DashboardChatPage,
  challenges: DashboardChallengesPage,
  'coming-soon': DashboardComingSoonPage,
  freelance: DashboardFreelancePage,
  'creator-hub': CreatorHubBrowsePage,
  'creator-hub/upload': CreatorHubUploadPage,
  'creator-hub/my-uploads': CreatorHubMyUploadsPage,
  'creator-hub/saved': CreatorHubSavedPage,
  'jobs/applications': DashboardJobApplicationsPage,
  jobs: DashboardJobsPage,
  ledger: DashboardLedgerPage,
  'ledger/reports': LedgerReportsPage,
  'ledger/export': LedgerExportPage,
  'ledger/transactions': LedgerTransactionsPage,
  'ledger/reconciliation': LedgerReconciliationPage,
  'ledger/profile': LedgerProfilePage,
  offerwalls: DashboardOfferwallsPage,
  profile: DashboardProfilePage,
  referrals: DashboardReferralsPage,
  superadmin: DashboardSuperadminPage,
  surveys: DashboardSurveysPage,
  tasks: DashboardTasksPage,
  wallet: DashboardWalletPage,
};

export default function DashboardCatchAllPage({ params }: { params: { slug?: string[] } }) {
  const slug = params.slug?.join('/') || '';
  const DirectRoute = ROUTES[slug];
  if (DirectRoute) {
    return <DirectRoute />;
  }

  if (params.slug?.[0] === 'creator-hub') {
    if (params.slug.length === 1) {
      return <CreatorHubLayout><CreatorHubBrowsePage /></CreatorHubLayout>;
    }

    if (params.slug.length === 2) {
      if (params.slug[1] === 'upload') return <CreatorHubLayout><CreatorHubUploadPage /></CreatorHubLayout>;
      if (params.slug[1] === 'my-uploads') return <CreatorHubLayout><CreatorHubMyUploadsPage /></CreatorHubLayout>;
      if (params.slug[1] === 'saved') return <CreatorHubLayout><CreatorHubSavedPage /></CreatorHubLayout>;
      return <CreatorHubLayout><CreatorHubDetailView uploadId={params.slug[1]} /></CreatorHubLayout>;
    }
  }

  if (params.slug?.[0] === 'jobs' && params.slug.length === 2) {
    return <DashboardJobDetailsPage />;
  }

  if (params.slug?.[0] === 'jobs' && params.slug.length === 3 && params.slug[2] === 'applicants') {
    return <DashboardJobApplicantsManagePage />;
  }

  const [segment] = slug.split('/');
  const Page = ROUTES[segment];

  if (!Page) {
    notFound();
  }

  return <Page />;
}


