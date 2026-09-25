import {
  SelectedSymbolProvider,
  useSelectedSymbol,
} from "../../context/SelectedSymbolContext";
import PageLayout from "../../components/layouts/PageLayout/PageLayout";
import SymbolHeading from "../../components/ui/SymbolHeading/SymbolHeading";
import SymbolDetail from "../../components/ui/SymbolDetail/SymbolDetail";
import SymbolChart from "../../components/ui/SymbolChart/SymbolChart";
import CompanyNews from "../../components/ui/CompanyNews/CompanyNews";
import { useQuote } from "../../hooks/useQuote";
import "./Dashboard.css";

function DashboardContent() {
  const { selectedSymbol } = useSelectedSymbol();
  const { quote, loading } = useQuote(selectedSymbol?.symbol);

  return (
    <div className="dashboard">
      {selectedSymbol ? (
        <div className="dashboard__content">
          <SymbolHeading symbol={selectedSymbol.symbol} quote={quote} loading={loading} />
          <div className="dashboard__body">
            <SymbolChart symbol={selectedSymbol.symbol} quote={quote} />
            <SymbolDetail symbol={selectedSymbol.symbol} />
          </div>
          <CompanyNews symbol={selectedSymbol.symbol} />
        </div>
      ) : (
        <p className="dashboard__prompt">
          Search for a symbol above to see quote details.
        </p>
      )}
    </div>
  );
}

function Dashboard() {
  return (
    <SelectedSymbolProvider>
      <PageLayout>
        <DashboardContent />
      </PageLayout>
    </SelectedSymbolProvider>
  );
}

export default Dashboard;
