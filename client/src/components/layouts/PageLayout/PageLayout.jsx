import Navbar from '../Navbar/Navbar';
import './PageLayout.css';

function PageLayout({ children }) {
  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-layout__content">
        {children}
      </main>
    </div>
  );
}

export default PageLayout;
