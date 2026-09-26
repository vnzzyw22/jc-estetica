import { FinanceNav } from "@/components/admin/finance/finance-nav";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Financeiro" };

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageTitle title="Financeiro" />
      <FinanceNav />
      {children}
    </>
  );
}
