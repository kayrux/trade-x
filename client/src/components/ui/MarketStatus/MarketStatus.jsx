import { useMarketStatus } from '../../../hooks/useMarketStatus';
import './MarketStatus.css';

function MarketStatus() {
  const { isOpen, label } = useMarketStatus();
  const [prefix, detail] = label.split(' · ');

  return (
    <div className={`market-status market-status--${isOpen ? 'open' : 'closed'}`}>
      <span className="market-status__dot" aria-hidden="true" />
      <span className="market-status__label">{prefix}</span>
      {detail && <span className="market-status__detail">{detail}</span>}
    </div>
  );
}

export default MarketStatus;
