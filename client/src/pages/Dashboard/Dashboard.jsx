import { SelectedSymbolProvider, useSelectedSymbol } from '../../context/SelectedSymbolContext';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import SymbolDetail from '../../components/ui/SymbolDetail/SymbolDetail';
import SymbolChart from '../../components/ui/SymbolChart/SymbolChart';
import './Dashboard.css';

function DashboardContent() {
  const { selectedSymbol } = useSelectedSymbol();

  return (
    <div className="dashboard">
      {selectedSymbol ? (
        <div className="dashboard__content">
          <SymbolDetail symbol={selectedSymbol.symbol} />
          <SymbolChart symbol={selectedSymbol.symbol} />
        </div>
      ) : (
        <p className="dashboard__prompt">Search for a symbol above to see quote details.</p>
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
