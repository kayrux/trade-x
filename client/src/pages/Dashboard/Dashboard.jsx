import { SelectedSymbolProvider, useSelectedSymbol } from '../../context/SelectedSymbolContext';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import SymbolDetail from '../../components/ui/SymbolDetail/SymbolDetail';
import './Dashboard.css';

function DashboardContent() {
  const { selectedSymbol } = useSelectedSymbol();

  return (
    <div className="dashboard">
      {selectedSymbol ? (
        <SymbolDetail symbol={selectedSymbol.symbol} />
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
